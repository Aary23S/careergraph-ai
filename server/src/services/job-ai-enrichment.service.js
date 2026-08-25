import crypto from 'crypto';
import Joi from 'joi';
import { models } from '../config/database.js';
import { env } from '../config/env.js';
import { aiService } from './ai/ai.service.js';

// Define the structured schema matching database columns
export const jobEnrichmentSchema = Joi.object({
  roleCategory: Joi.string().allow('', null).default(''),
  seniority: Joi.string().allow('', null).default(''),
  requiredSkills: Joi.array().items(Joi.string()).default([]),
  preferredSkills: Joi.array().items(Joi.string()).default([]),
  location: Joi.string().allow('', null).default(''),
  remoteType: Joi.string().valid('remote', 'hybrid', 'onsite', '').default(''),
  employmentType: Joi.string().valid('full-time', 'part-time', 'contract', '').default(''),
  experienceMinYears: Joi.number().integer().min(0).allow(null).default(null),
  experienceMaxYears: Joi.number().integer().min(0).allow(null).default(null),
  domain: Joi.array().items(Joi.string()).default([]),
  responsibilities: Joi.array().items(Joi.string()).default([]),
  summary: Joi.string().allow('', null).default(''),
  confidence: Joi.number().min(0).max(1).default(1.0)
});

// Prompt Template version: job-enrichment.v1
const PROMPT_VERSION = 1;
const SCHEMA_VERSION = 1;

function buildEnrichmentPrompt(job) {
  return `You are a professional recruiting coordinator. Analyze the following job post:

Title: ${job.title || 'Unknown'}
Company: ${job.normalizedCompany || 'Unknown'}
Location: ${job.location || 'Unknown'}
Description:
${job.description || ''}

Instructions:
1. Extract only information supported by the text. Do NOT invent values.
2. Distinguish requiredSkills (essential) vs preferredSkills (nice-to-have).
3. Infer seniority (e.g. entry, mid, senior, lead, principal, executive) only when clear evidence is present.
4. Extract remoteType ('remote', 'hybrid', 'onsite') and employmentType ('full-time', 'part-time', 'contract').
5. Output domain categories (e.g. 'backend', 'frontend', 'infrastructure', 'fintech', 'healthcare').
6. Provide a concise 2-3 sentence summary of the role.
7. Return a valid JSON matching the schema format.`;
}

// In-Memory Background Processing Queue
const enrichmentQueue = [];
let queueProcessing = false;

async function processQueue() {
  if (queueProcessing) return;
  queueProcessing = true;

  while (enrichmentQueue.length > 0) {
    const jobId = enrichmentQueue.shift();
    try {
      await executeEnrichment(jobId);
    } catch (e) {
      console.error(`[JobAiEnrichmentService] Error processing job ${jobId} queue item:`, e);
    }
  }

  queueProcessing = false;
}

/**
 * Enqueues a Job ID for asynchronous AI enrichment.
 * @param {string} jobId - UUID of the Job.
 */
export async function enqueueEnrichment(jobId) {
  if (!env.aiEnabled) return;

  try {
    const job = await models.Job.findByPk(jobId);
    if (!job) return;

    const inputHash = crypto
      .createHash('sha256')
      .update(`${job.title || ''}:${job.description || ''}`)
      .digest('hex');

    // Check if enrichment already exists for this job
    let enrichment = await models.JobAiEnrichment.findOne({ where: { jobId: jobId } });
    
    if (enrichment) {
      // If hash matches and it's already completed or skipped, skip re-processing
      if (enrichment.inputHash === inputHash && ['completed', 'skipped'].includes(enrichment.status)) {
        return;
      }
      // Reset state for reprocessing
      await enrichment.update({
        status: 'pending',
        inputHash,
        provider: env.aiProvider,
        model: env.ollamaModel,
        errorCode: null
      });
    } else {
      enrichment = await models.JobAiEnrichment.create({
        jobId: jobId,
        provider: env.aiProvider,
        model: env.ollamaModel,
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        status: 'pending',
        inputHash
      });
    }

    enrichmentQueue.push(jobId);
    processQueue();
  } catch (err) {
    console.error(`[JobAiEnrichmentService] Failed to enqueue job ${jobId}:`, err);
  }
}

/**
 * Executes Ollama call and persists the enrichment properties.
 * @param {string} jobId - UUID of the Job.
 */
export async function executeEnrichment(jobId) {
  let enrichment = await models.JobAiEnrichment.findOne({
    where: { jobId: jobId },
    include: [{ model: models.Job, as: 'job' }]
  });

  if (!enrichment) {
    const job = await models.Job.findByPk(jobId);
    if (!job) return;

    const inputHash = crypto
      .createHash('sha256')
      .update(`${job.title || ''}:${job.description || ''}`)
      .digest('hex');

    enrichment = await models.JobAiEnrichment.create({
      jobId: jobId,
      provider: env.aiProvider,
      model: env.ollamaModel,
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      status: 'pending',
      inputHash
    });

    enrichment = await models.JobAiEnrichment.findOne({
      where: { jobId: jobId },
      include: [{ model: models.Job, as: 'job' }]
    });
  }

  if (!enrichment || !enrichment.job) return;

  await enrichment.update({ status: 'processing' });
  const start = Date.now();

  try {
    const prompt = buildEnrichmentPrompt(enrichment.job);
    const parsed = await aiService.generateStructured(prompt, jobEnrichmentSchema);
    const latency = Date.now() - start;

    await enrichment.update({
      status: 'completed',
      roleCategory: parsed.roleCategory || null,
      seniority: parsed.seniority || null,
      requiredSkills: parsed.requiredSkills || [],
      preferredSkills: parsed.preferredSkills || [],
      location: parsed.location || null,
      remoteType: parsed.remoteType || null,
      employmentType: parsed.employmentType || null,
      experienceMinYears: parsed.experienceMinYears || null,
      experienceMaxYears: parsed.experienceMaxYears || null,
      domain: parsed.domain || [],
      responsibilities: parsed.responsibilities || [],
      summary: parsed.summary || null,
      confidence: parsed.confidence || 1.0,
      rawResponse: JSON.stringify(parsed),
      latencyMs: latency,
      errorCode: null
    });
  } catch (err) {
    const latency = Date.now() - start;
    let errorCode = 'UNKNOWN';
    const errMessage = err.message.toLowerCase();

    if (errMessage.includes('timeout')) {
      errorCode = 'TIMEOUT';
    } else if (errMessage.includes('disabled')) {
      errorCode = 'AI_DISABLED';
    } else if (errMessage.includes('validation')) {
      errorCode = 'VALIDATION_FAILED';
    } else if (errMessage.includes('fetch') || errMessage.includes('connection')) {
      errorCode = 'PROVIDER_UNAVAILABLE';
    }

    await enrichment.update({
      status: 'failed',
      errorCode,
      rawResponse: err.message,
      latencyMs: latency
    });
  }
}

/**
 * Persists user override values for AI enrichment.
 * @param {string} jobId - UUID of the Job.
 * @param {object} corrections - Input values from human corrections form.
 */
export async function saveUserCorrections(jobId, corrections) {
  let enrichment = await models.JobAiEnrichment.findOne({ where: { jobId: jobId } });
  if (!enrichment) {
    enrichment = await models.JobAiEnrichment.create({
      jobId: jobId,
      provider: 'manual',
      model: 'user',
      promptVersion: 0,
      schemaVersion: SCHEMA_VERSION,
      status: 'skipped',
      inputHash: 'manual-override'
    });
  }

  await enrichment.update({
    userCorrectedRoleCategory: corrections.roleCategory !== undefined ? corrections.roleCategory : enrichment.userCorrectedRoleCategory,
    userCorrectedSeniority: corrections.seniority !== undefined ? corrections.seniority : enrichment.userCorrectedSeniority,
    userCorrectedRequiredSkills: corrections.requiredSkills !== undefined ? corrections.requiredSkills : enrichment.userCorrectedRequiredSkills,
    userCorrectedPreferredSkills: corrections.preferredSkills !== undefined ? corrections.preferredSkills : enrichment.userCorrectedPreferredSkills,
    userCorrectedLocation: corrections.location !== undefined ? corrections.location : enrichment.userCorrectedLocation,
    userCorrectedRemoteType: corrections.remoteType !== undefined ? corrections.remoteType : enrichment.userCorrectedRemoteType,
    userCorrectedEmploymentType: corrections.employmentType !== undefined ? corrections.employmentType : enrichment.userCorrectedEmploymentType,
    userCorrectedExperienceMinYears: corrections.experienceMinYears !== undefined ? corrections.experienceMinYears : enrichment.userCorrectedExperienceMinYears,
    userCorrectedExperienceMaxYears: corrections.experienceMaxYears !== undefined ? corrections.experienceMaxYears : enrichment.userCorrectedExperienceMaxYears,
    userCorrectedDomain: corrections.domain !== undefined ? corrections.domain : enrichment.userCorrectedDomain,
    userCorrectedResponsibilities: corrections.responsibilities !== undefined ? corrections.responsibilities : enrichment.userCorrectedResponsibilities,
    userCorrectedSummary: corrections.summary !== undefined ? corrections.summary : enrichment.userCorrectedSummary
  });

  return enrichment;
}
