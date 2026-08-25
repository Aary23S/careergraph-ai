import Joi from 'joi';
import { models } from '../config/database.js';
import { env } from '../config/env.js';
import { aiService } from './ai/ai.service.js';

export const resumeAnalysisSchema = Joi.object({
  matchedSkills: Joi.array().items(Joi.string()).default([]),
  missingSkills: Joi.array().items(Joi.string()).default([]),
  strengths: Joi.array().items(Joi.string()).default([]),
  potentialGaps: Joi.array().items(Joi.string()).default([]),
  analysisSummary: Joi.string().allow('', null).default(''),
  compatibilityAssessment: Joi.string().valid('high', 'medium', 'low', 'unknown').default('unknown')
});

function buildAnalysisPrompt(jobIntel, resumeIntel) {
  return `Analyze the alignment between the following Job requirements and Candidate Resume profile:

=== JOB REQUIREMENTS ===
Role Category: ${jobIntel.roleCategory || 'N/A'}
Seniority: ${jobIntel.seniority || 'N/A'}
Required Skills: ${(jobIntel.requiredSkills || []).join(', ')}
Preferred Skills: ${(jobIntel.preferredSkills || []).join(', ')}
Summary: ${jobIntel.summary || 'N/A'}

=== CANDIDATE RESUME ===
Title: ${resumeIntel.professionalTitle || 'N/A'}
Level: ${resumeIntel.careerLevel || 'N/A'}
Skills: ${(resumeIntel.skills || []).join(', ')}
Summary: ${resumeIntel.summary || 'N/A'}

Instructions:
1. Identify matchedSkills (skills from the job posting that are supported by the resume).
2. Identify missingSkills (key required/preferred job skills not clearly indicated in the resume).
3. Outline core strengths (where the candidate's background matches perfectly).
4. Identify potentialGaps (e.g. lack of experience in a specific framework or domain).
5. Provide a brief 2-3 sentence compatibility analysisSummary.
6. Assess overall compatibility: 'high', 'medium', 'low'.
7. Return a valid JSON matching the schema format.`;
}

/**
 * Executes AI-based Job vs Resume Gap Analysis.
 */
export async function analyzeJobResumeFit(jobId, resumeId) {
  const defaultAnalysis = {
    matchedSkills: [],
    missingSkills: [],
    strengths: ['AI analysis is currently disabled or unavailable.'],
    potentialGaps: [],
    analysisSummary: 'AI analysis could not be completed at this time.',
    compatibilityAssessment: 'unknown'
  };

  if (!env.aiEnabled) {
    return defaultAnalysis;
  }

  try {
    // 1. Fetch and auto-enrich Job AI details if missing/incomplete
    let jobEnrichment = await models.JobAiEnrichment.findOne({ where: { jobId } });
    if (!jobEnrichment || jobEnrichment.status !== 'completed') {
      const { executeEnrichment } = await import('./job-ai-enrichment.service.js');
      await executeEnrichment(jobId);
      jobEnrichment = await models.JobAiEnrichment.findOne({ where: { jobId } });
    }

    if (!jobEnrichment || jobEnrichment.status !== 'completed') {
      return {
        ...defaultAnalysis,
        analysisSummary: 'Job details could not be fully enriched. Please ensure AI is enabled and retry.'
      };
    }

    // 2. Fetch and auto-enrich Resume AI details if missing/incomplete
    let resumeEnrichment = await models.ResumeAiEnrichment.findOne({ where: { resumeId } });
    if (!resumeEnrichment || resumeEnrichment.status !== 'completed') {
      const { executeResumeEnrichment } = await import('./resume-ai-enrichment.service.js');
      await executeResumeEnrichment(resumeId);
      resumeEnrichment = await models.ResumeAiEnrichment.findOne({ where: { resumeId } });
    }

    if (!resumeEnrichment || resumeEnrichment.status !== 'completed') {
      return {
        ...defaultAnalysis,
        analysisSummary: 'Resume details could not be fully enriched. Please ensure AI is enabled and retry.'
      };
    }

    // 3. Resolve user overrides for both Job and Resume if available
    const jobIntel = {
      roleCategory: jobEnrichment.userCorrectedRoleCategory || jobEnrichment.roleCategory,
      seniority: jobEnrichment.userCorrectedSeniority || jobEnrichment.seniority,
      requiredSkills: jobEnrichment.userCorrectedRequiredSkills || jobEnrichment.requiredSkills || [],
      preferredSkills: jobEnrichment.userCorrectedPreferredSkills || jobEnrichment.preferredSkills || [],
      summary: jobEnrichment.userCorrectedSummary || jobEnrichment.summary
    };

    const resumeIntel = {
      professionalTitle: resumeEnrichment.userCorrectedProfessionalTitle || resumeEnrichment.professionalTitle,
      careerLevel: resumeEnrichment.userCorrectedCareerLevel || resumeEnrichment.careerLevel,
      skills: resumeEnrichment.userCorrectedSkills || resumeEnrichment.skills || [],
      summary: resumeEnrichment.userCorrectedSummary || resumeEnrichment.summary
    };

    const prompt = buildAnalysisPrompt(jobIntel, resumeIntel);
    const parsed = await aiService.generateStructured(prompt, resumeAnalysisSchema);

    return {
      matchedSkills: parsed.matchedSkills || [],
      missingSkills: parsed.missingSkills || [],
      strengths: parsed.strengths || [],
      potentialGaps: parsed.potentialGaps || [],
      analysisSummary: parsed.analysisSummary || '',
      compatibilityAssessment: parsed.compatibilityAssessment || 'unknown'
    };
  } catch (err) {
    console.error(`[ResumeAnalysisService] Failed to analyze fit for Job ${jobId} and Resume ${resumeId}:`, err);
    return {
      ...defaultAnalysis,
      analysisSummary: `AI matching execution failed: ${err.message}`
    };
  }
}
