import crypto from 'crypto';
import Joi from 'joi';
import { models } from '../config/database.js';
import { env } from '../config/env.js';
import { aiService } from './ai/ai.service.js';
import { buildConnectionAiInput } from './connection-ai-input.service.js';

export const connectionAiSchema = Joi.object({
  professionalRole: Joi.string().allow('', null).default(''),
  roleFamily: Joi.string().allow('', null).default(''),
  careerLevel: Joi.string().allow('', null).default(''),
  technicalDomains: Joi.array().items(Joi.string()).default([]),
  technologies: Joi.array().items(Joi.string()).default([]),
  industryDomains: Joi.array().items(Joi.string()).default([]),
  expertiseAreas: Joi.array().items(Joi.string()).default([]),
  leadershipLevel: Joi.string().allow('', null).default(''),
  summary: Joi.string().allow('', null).default(''),
  confidence: Joi.number().min(0).max(1).default(1.0)
});

const PROMPT_VERSION = 1;
const SCHEMA_VERSION = 1;

function buildEnrichmentPrompt(profileText) {
  return `Analyze the following LinkedIn connection profile:

=== PROFILE DATA ===
${profileText}

Instructions:
1. Extract professionalRole (e.g. Senior Backend Engineer, Product Manager, Data Analyst).
2. Categorize into a roleFamily (e.g. software_engineering, product_management, data_science, marketing, operations, human_resources, design, sales, finance, management, other).
3. Infer careerLevel (e.g. junior, mid, senior, lead, principal, director, executive).
4. Identify technicalDomains (e.g. backend, frontend, devops, database, machine_learning, cloud).
5. Extract technologies (e.g. Node.js, AWS, Python, Docker). Do NOT invent or hallucinate technologies.
6. Identify industryDomains (e.g. SaaS, Fintech, E-commerce, Healthcare, Telecommunications).
7. Extract expertiseAreas (specific tasks/competencies they are experienced in).
8. Determine leadershipLevel ('manager', 'director', 'executive', 'individual_contributor'). Do not assume management without explicit evidence.
9. Provide a concise 2-3 sentence careerSummary.
10. Determine a confidence score between 0.0 and 1.0 based on data quality.

CRITICAL RULES:
- Use ONLY the provided evidence.
- Do NOT invent technologies or skills.
- Do NOT treat a single historical technology mention as current expertise.
- JSON output only matching the schema exactly.`;
}

// Background Queue
const queue = [];
let processing = false;

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const connectionId = queue.shift();
    try {
      await executeEnrichment(connectionId);
    } catch (e) {
      console.error(`[ConnectionAiEnrichmentService] Error processing connection ${connectionId}:`, e);
    }
  }

  processing = false;
}

/**
 * Enqueues a Connection for async AI profile analysis.
 */
export async function enqueueConnectionEnrichment(connectionId) {
  if (!env.aiEnabled) return;

  try {
    const connection = await models.Connection.findByPk(connectionId);
    if (!connection) return;

    const inputData = buildConnectionAiInput(connection);
    const inputHash = crypto.createHash('sha256').update(inputData).digest('hex');

    let enrichment = await models.ConnectionAiEnrichment.findOne({ where: { connectionId } });
    if (enrichment) {
      if (enrichment.inputHash === inputHash && ['completed', 'skipped'].includes(enrichment.status)) {
        return;
      }
      await enrichment.update({
        status: 'pending',
        inputHash,
        provider: env.aiProvider,
        model: env.ollamaModel,
        errorCode: null
      });
    } else {
      enrichment = await models.ConnectionAiEnrichment.create({
        connectionId,
        provider: env.aiProvider,
        model: env.ollamaModel,
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        status: 'pending',
        inputHash
      });
    }

    queue.push(connectionId);
    processQueue();
  } catch (err) {
    console.error(`[ConnectionAiEnrichmentService] Failed to enqueue connection ${connectionId}:`, err);
  }
}

/**
 * Invokes AI generation and saves profile attributes.
 */
export async function executeEnrichment(connectionId) {
  let enrichment = await models.ConnectionAiEnrichment.findOne({
    where: { connectionId },
    include: [{ model: models.Connection, as: 'connection' }]
  });

  if (!enrichment) {
    const connection = await models.Connection.findByPk(connectionId);
    if (!connection) return;

    const inputData = buildConnectionAiInput(connection);
    const inputHash = crypto.createHash('sha256').update(inputData).digest('hex');

    enrichment = await models.ConnectionAiEnrichment.create({
      connectionId,
      provider: env.aiProvider,
      model: env.ollamaModel,
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      status: 'pending',
      inputHash
    });

    enrichment = await models.ConnectionAiEnrichment.findOne({
      where: { connectionId },
      include: [{ model: models.Connection, as: 'connection' }]
    });
  }

  if (!enrichment || !enrichment.connection) return;

  await enrichment.update({ status: 'processing' });
  const start = Date.now();

  try {
    const inputData = buildConnectionAiInput(enrichment.connection);
    const prompt = buildEnrichmentPrompt(inputData);
    const parsed = await aiService.generateStructured(prompt, connectionAiSchema);
    const latency = Date.now() - start;

    await enrichment.update({
      status: 'completed',
      professionalRole: parsed.professionalRole || null,
      roleFamily: parsed.roleFamily || null,
      careerLevel: parsed.careerLevel || null,
      technicalDomains: parsed.technicalDomains || [],
      technologies: parsed.technologies || [],
      industryDomains: parsed.industryDomains || [],
      expertiseAreas: parsed.expertiseAreas || [],
      leadershipLevel: parsed.leadershipLevel || null,
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
 * Saves manual human overrides separately.
 */
export async function saveUserCorrections(connectionId, corrections) {
  let enrichment = await models.ConnectionAiEnrichment.findOne({ where: { connectionId } });
  if (!enrichment) {
    enrichment = await models.ConnectionAiEnrichment.create({
      connectionId,
      provider: 'manual',
      model: 'user',
      promptVersion: 0,
      schemaVersion: SCHEMA_VERSION,
      status: 'skipped',
      inputHash: 'manual-override'
    });
  }

  await enrichment.update({
    userCorrectedProfessionalRole: corrections.professionalRole !== undefined ? corrections.professionalRole : enrichment.userCorrectedProfessionalRole,
    userCorrectedRoleFamily: corrections.roleFamily !== undefined ? corrections.roleFamily : enrichment.userCorrectedRoleFamily,
    userCorrectedCareerLevel: corrections.careerLevel !== undefined ? corrections.careerLevel : enrichment.userCorrectedCareerLevel,
    userCorrectedTechnicalDomains: corrections.technicalDomains !== undefined ? corrections.technicalDomains : enrichment.userCorrectedTechnicalDomains,
    userCorrectedTechnologies: corrections.technologies !== undefined ? corrections.technologies : enrichment.userCorrectedTechnologies,
    userCorrectedIndustryDomains: corrections.industryDomains !== undefined ? corrections.industryDomains : enrichment.userCorrectedIndustryDomains,
    userCorrectedExpertiseAreas: corrections.expertiseAreas !== undefined ? corrections.expertiseAreas : enrichment.userCorrectedExpertiseAreas,
    userCorrectedLeadershipLevel: corrections.leadershipLevel !== undefined ? corrections.leadershipLevel : enrichment.userCorrectedLeadershipLevel,
    userCorrectedSummary: corrections.summary !== undefined ? corrections.summary : enrichment.userCorrectedSummary
  });

  return enrichment;
}
