import Joi from 'joi';
import { ContextBuilder } from './context/context-builder.service.js';
import { aiService } from '../ai/ai.service.js';
import { validateOutreachDraft } from '../ai/guardrails.service.js';
import { AppError } from '../../lib/http.js';

const referralPathSchema = Joi.object({
  recommendedContacts: Joi.array().items(
    Joi.object({
      connectionId: Joi.string().required(),
      recommendationRank: Joi.number().integer().required(),
      reason: Joi.string().required(),
      referralStrategy: Joi.string().required(),
      evidence: Joi.array().items(Joi.string()).default([])
    })
  ).required(),
  primaryRecommendation: Joi.object({
    connectionId: Joi.string().required(),
    reason: Joi.string().required(),
    recommendedAction: Joi.string().required()
  }).allow(null).optional(),
  outreachDraft: Joi.object({
    connectionId: Joi.string().required(),
    subject: Joi.string().required(),
    message: Joi.string().required()
  }).allow(null).optional()
});

export class ReferralPathAgentService {
  /**
   * Finds the optimal referral path and drafts outreach for a target job.
   * 
   * @param {Object} params
   * @param {string} params.userId - Authenticated user ID
   * @param {string} params.jobId - Target job ID
   * @param {string} [params.query] - Optional user intent query
   * @param {number} [params.candidateLimit=5] - Upper limit of candidates sent to LLM
   * @returns {Promise<Object>} Formatted referral recommendations and outreach draft
   */
  static async findReferralPath({ userId, jobId, query, candidateLimit = 5 }) {
    if (!jobId) {
      throw new AppError(400, 'BAD_REQUEST', 'jobId is required to find referral path.');
    }

    // 1. Retrieve authorized context from H2 ContextBuilder
    const contextPackage = await ContextBuilder.buildContext(userId, {
      intent: 'referral_search',
      jobId,
      query
    });

    // 2. Identify target job
    const job = contextPackage.entities.jobs.find(j => j.entityId === jobId);
    if (!job) {
      throw new AppError(404, 'NOT_FOUND', 'Job not found or user is unauthorized to access it.');
    }

    const connections = contextPackage.entities.connections || [];

    // 3. Handle case where no candidate connections exist deterministically
    if (connections.length === 0) {
      return {
        job: {
          id: job.entityId,
          title: job.title,
          company: job.company,
          location: job.location
        },
        recommendedContacts: [],
        primaryRecommendation: null,
        outreachDraft: null,
        provenance: contextPackage.facts || [],
        aiStatus: 'no_candidates',
        message: 'No strong referral candidates were found for this opportunity.'
      };
    }

    // 4. Bounded candidates & target company insider filtering
    const displayCompany = (job.company && job.company.toLowerCase() !== 'unknown company')
      ? job.company
      : (job.normalizedCompany && job.normalizedCompany.toLowerCase() !== 'unknown company'
        ? job.normalizedCompany
        : 'your target company');

    const targetCompLower = displayCompany.toLowerCase().trim();
    const directInsiders = connections.filter(c => {
      const connComp = (c.company || '').toLowerCase().trim();
      return connComp && targetCompLower && (connComp.includes(targetCompLower) || targetCompLower.includes(connComp));
    });

    const hasDirectInsiders = directInsiders.length > 0;
    const selectedCandidates = hasDirectInsiders ? directInsiders.slice(0, candidateLimit) : connections.slice(0, candidateLimit);
    const validCandidateIds = new Set(selectedCandidates.map(c => c.entityId));

    // 5. Structure evidence for candidates
    const candidatesEvidence = selectedCandidates.map((c) => {
      const evidenceList = [...(c.reasons || [])];
      const isInsider = c.company && targetCompLower && c.company.toLowerCase().includes(targetCompLower);
      if (isInsider) {
        evidenceList.push(`Direct Employee / Insider at target company (${c.company})`);
      } else if (c.company) {
        evidenceList.push(`Works at ${c.company}`);
      }
      if (c.title) {
        evidenceList.push(`Role: ${c.title}`);
      }
      evidenceList.push(`Referral score: ${c.referralScore || 0}`);

      return {
        connectionId: c.entityId,
        name: c.name,
        company: c.company,
        title: c.title,
        referralScore: c.referralScore || 0,
        isInsider,
        evidence: evidenceList
      };
    });

    // 6. Build LLM prompt with strict grounding rules
    const evidenceTextSummary = `Target Job: ${job.title} at ${displayCompany}.\n` +
      `Target Company Insiders Available: ${hasDirectInsiders ? 'YES' : 'NO (User has no direct connections working at ' + displayCompany + ')'}\n` +
      candidatesEvidence.map(c => `${c.name} (${c.company}, ${c.title}, connectionId: ${c.connectionId}): ${c.evidence.join('; ')}`).join('\n');

    const prompt = `
YOU ARE CAREER COPILOT - REFERRAL PATH AGENT.
Your job is to recommend professional contacts for job referrals and draft personalized outreach.

TARGET JOB DETAILS:
- Title: ${job.title}
- Company: ${displayCompany}

AVAILABLE CANDIDATE CONNECTIONS:
${evidenceTextSummary}

INSTRUCTIONS:
1. If DIRECT NETWORK INSIDERS are FOUND: Recommend ONLY candidate(s) working at ${displayCompany}. Explain their insider role.
2. If DIRECT NETWORK INSIDERS are NONE FOUND: DO NOT claim any candidate works at ${displayCompany}. Clearly state they work at their respective company (e.g. Microsoft, RCM) and can offer warm advice or general industry guidance.
3. Select up to 3 best contacts from the candidates.
4. Pick 1 primary recommended contact and provide a clear action step.
5. Draft a concise, personalized outreach message (subject and body) for the primary contact.
6. Return ONLY valid JSON matching the schema. Do NOT invent contacts or facts.

RESPONSE FORMAT (JSON ONLY):
{
  "recommendedContacts": [
    {
      "connectionId": "string",
      "recommendationRank": 1,
      "reason": "Why this contact is recommended",
      "referralStrategy": "Specific advice on how to approach them",
      "evidence": ["supporting fact 1"]
    }
  ],
  "primaryRecommendation": {
    "connectionId": "string",
    "reason": "Why this contact is top priority",
    "recommendedAction": "Actionable next step"
  },
  "outreachDraft": {
    "connectionId": "string",
    "subject": "Professional email subject",
    "message": "Personalized email message body"
  }
}
`;

    // 7. Invoke AIService with graceful fallback
    try {
      let aiStatus = 'success';
      let aiResponse = null;

      try {
        const response = await aiService.generateStructured(prompt, referralPathSchema, {
          operation: 'copilot_referral_path',
          userId,
          entityType: 'job',
          entityId: job.entityId,
          evidenceText: evidenceTextSummary
        });
        aiResponse = response;
      } catch (aiErr) {
        console.warn('[ReferralPathAgentService] AI call failed, falling back to deterministic synthesis:', aiErr.message);
        aiStatus = 'fallback';
      }

      // 8. Grounding Validation: Enforce that returned connectionIds belong to candidate set
      let recommendedContacts = (aiResponse?.recommendedContacts || []).filter(item =>
        validCandidateIds.has(item.connectionId)
      );

      let primaryRecommendation = aiResponse?.primaryRecommendation;
      if (primaryRecommendation && !validCandidateIds.has(primaryRecommendation.connectionId)) {
        primaryRecommendation = null;
      }

      let outreachDraft = aiResponse?.outreachDraft;
      if (outreachDraft && !validCandidateIds.has(outreachDraft.connectionId)) {
        outreachDraft = null;
      }

      const topCandidate = selectedCandidates[0];
      if (!primaryRecommendation && topCandidate) {
        primaryRecommendation = {
          connectionId: topCandidate.entityId,
          reason: topCandidate.company && targetCompLower && topCandidate.company.toLowerCase().includes(targetCompLower)
            ? `Direct insider at ${displayCompany}.`
            : `Top network contact (${topCandidate.company || 'N/A'}).`,
          recommendedAction: `Send a professional message to ${topCandidate.name}.`
        };
      }

      if (!outreachDraft && topCandidate) {
        outreachDraft = {
          connectionId: topCandidate.entityId,
          subject: `Referral inquiry for ${job.title} position at ${displayCompany}`,
          message: `Hi ${topCandidate.name.split(' ')[0]},\n\nI noticed you work at ${topCandidate.company || displayCompany} as a ${topCandidate.title || 'team member'}. I'm applying for the ${job.title} role at ${displayCompany} and would love to hear your perspective on the team.\n\nBest regards,`
        };
      }

      if (recommendedContacts.length === 0) {
        recommendedContacts = selectedCandidates.map((c, idx) => ({
          connectionId: c.entityId,
          recommendationRank: idx + 1,
          reason: c.company && targetCompLower && c.company.toLowerCase().includes(targetCompLower)
            ? `Direct insider match at ${c.company}.`
            : `Network contact at ${c.company || 'N/A'} (${c.title || 'N/A'}).`,
          referralStrategy: c.company && targetCompLower && c.company.toLowerCase().includes(targetCompLower)
            ? `Reach out to ${c.name} directly as an insider at ${c.company} to ask about the team and referral process.`
            : `Connect with ${c.name} to express interest in tech opportunities.`,
          evidence: [
            c.company ? `Company: ${c.company}` : null,
            c.title ? `Title: ${c.title}` : null
          ].filter(Boolean)
        }));
      }

      // Enforce connection metadata onto recommendedContacts
      recommendedContacts = recommendedContacts.map(item => {
        const conn = selectedCandidates.find(c => c.entityId === item.connectionId);
        return {
          ...item,
          name: conn?.name || 'Connection',
          company: conn?.company || displayCompany,
          title: conn?.title || 'Team Member'
        };
      });

      // The model may choose from bounded candidates, but user-facing facts
      // and recommendations are always regenerated from CRM fields here.
      // This prevents unsupported role, relationship, or referral claims.
      recommendedContacts = selectedCandidates.map((c, idx) => ({
        connectionId: c.entityId,
        recommendationRank: idx + 1,
        name: c.name,
        company: c.company,
        title: c.title,
        reason: c.company && targetCompLower && c.company.toLowerCase().includes(targetCompLower)
          ? `Works at ${c.company}.`
          : `Works at ${c.company || 'an unlisted company'}.`,
        referralStrategy: c.company && targetCompLower && c.company.toLowerCase().includes(targetCompLower)
          ? `Ask ${c.name} about the team and referral process.`
          : `Ask ${c.name} for general career advice; they are not listed as an employee of ${displayCompany}.`,
        evidence: [
          c.company ? `Company: ${c.company}` : null,
          c.title ? `Title: ${c.title}` : null,
        ].filter(Boolean),
      }));

      const groundedTopCandidate = selectedCandidates[0];
      primaryRecommendation = groundedTopCandidate ? {
        connectionId: groundedTopCandidate.entityId,
        reason: groundedTopCandidate.company && targetCompLower && groundedTopCandidate.company.toLowerCase().includes(targetCompLower)
          ? `Direct CRM contact at ${groundedTopCandidate.company}.`
          : `CRM contact at ${groundedTopCandidate.company || 'an unlisted company'}.`,
        recommendedAction: `Draft a message to ${groundedTopCandidate.name}.`,
      } : null;

      outreachDraft = groundedTopCandidate ? {
        connectionId: groundedTopCandidate.entityId,
        subject: `Question about ${job.title} at ${displayCompany}`,
        message: `Hi ${groundedTopCandidate.name.split(' ')[0]},\n\nI saw that you work at ${groundedTopCandidate.company || 'your company'}${groundedTopCandidate.title ? ` as a ${groundedTopCandidate.title}` : ''}. I am considering a ${job.title} role at ${displayCompany} and would appreciate any perspective you are comfortable sharing.\n\nBest regards,`,
      } : null;

      // Formulate clear, honest summary
      const summaryHeader = hasDirectInsiders
        ? `Here are your direct referral connections at **${displayCompany}** for **${job.title}**:`
        : `I searched your network for direct insiders at **${displayCompany}**, but found no direct connections currently working at **${displayCompany}**. Here are top tech network contacts who may provide warm introduction advice:`;

      const summary = `${summaryHeader}\n\n` +
        recommendedContacts.map(c => `• **${c.name}** (${c.title || 'Team Member'} at ${c.company})\n  *Fit*: ${c.reason}`).join('\n\n') +
        `\n\n💡 **Next Step**: ${primaryRecommendation?.recommendedAction || `Reach out to ${recommendedContacts[0]?.name || 'your top connection'} for advice.`}`;

      return {
        job: {
          id: job.entityId,
          title: job.title,
          company: displayCompany,
          location: job.location
        },
        recommendedContacts,
        primaryRecommendation,
        outreachDraft,
        summary,
        provenance: contextPackage.facts || [],
        aiStatus,
        aiMessage: aiStatus === 'fallback' ? 'AI explanation unavailable; displaying deterministic candidate ranking.' : undefined
      };
    } catch (err) {
      console.warn('[ReferralPathAgentService] AI generation failed or unavailable, returning deterministic fallback:', err.message);

      // 9. Deterministic Candidate Ranking Fallback
      const fallbackContacts = selectedCandidates.map((c, idx) => ({
        connectionId: c.entityId,
        name: c.name,
        company: c.company,
        title: c.title,
        recommendationRank: idx + 1,
        reason: c.company && targetCompLower && c.company.toLowerCase().includes(targetCompLower)
          ? `Direct insider match at ${c.company}.`
          : `Network contact at ${c.company || 'N/A'} (${c.title || 'N/A'}).`,
        referralStrategy: c.company && targetCompLower && c.company.toLowerCase().includes(targetCompLower)
          ? `Reach out to ${c.name} directly as an insider at ${c.company} to ask about the team and referral process.`
          : `Connect with ${c.name} to express interest in tech opportunities.`,
        evidence: [
          c.company ? `Company: ${c.company}` : null,
          c.title ? `Title: ${c.title}` : null
        ].filter(Boolean)
      }));

      const topCandidate = selectedCandidates[0];
      const primaryRecommendation = topCandidate ? {
        connectionId: topCandidate.entityId,
        reason: `Top network contact (${topCandidate.company || 'N/A'}).`,
        recommendedAction: `Send a professional message to ${topCandidate.name}.`
      } : null;

      const outreachDraft = topCandidate ? {
        connectionId: topCandidate.entityId,
        subject: `Referral inquiry for ${job.title} position at ${displayCompany}`,
        message: `Hi ${topCandidate.name.split(' ')[0]},\n\nI hope you're doing well. I noticed your background as a ${topCandidate.title || 'team member'} at ${topCandidate.company || 'your company'}. I'm currently applying for the ${job.title} role at ${displayCompany} and would love to hear your perspective on the industry.\n\nBest regards,`
      } : null;

      const summaryHeader = hasDirectInsiders
        ? `Here are your direct referral connections at **${displayCompany}** for **${job.title}**:`
        : `I searched your network for direct insiders at **${displayCompany}**, but found no direct connections currently working at **${displayCompany}**. Here are top tech network contacts who may provide warm introduction advice:`;

      const summary = `${summaryHeader}\n\n` +
        fallbackContacts.map(c => `• **${c.name}** (${c.title || 'Team Member'} at ${c.company})\n  *Fit*: ${c.reason}`).join('\n\n') +
        `\n\n💡 **Next Step**: ${primaryRecommendation?.recommendedAction || `Reach out to ${fallbackContacts[0]?.name || 'your top connection'} for advice.`}`;

      return {
        job: {
          id: job.entityId,
          title: job.title,
          company: displayCompany,
          location: job.location
        },
        recommendedContacts: fallbackContacts,
        primaryRecommendation,
        outreachDraft,
        summary,
        provenance: contextPackage.facts || [],
        aiStatus: 'unavailable',
        aiMessage: 'AI explanation unavailable; displaying deterministic candidate ranking.'
      };
    }
  }
}
