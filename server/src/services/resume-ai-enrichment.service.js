import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import Joi from 'joi';
import { createRequire } from 'module';
import { models } from '../config/database.js';
import { env } from '../config/env.js';
import { aiService } from './ai/ai.service.js';
import { fileStorage } from '../lib/storage.js';
import { aiObservability } from './ai/observability.service.js';
import { enqueueAIJob } from '../queues/ai.queue.js';

const require = createRequire(import.meta.url);
let pdf = require('pdf-parse');
if (typeof pdf !== 'function' && pdf.default) {
  pdf = pdf.default;
}

// Define the structured schema matching database columns
export const resumeEnrichmentSchema = Joi.object({
  professionalTitle: Joi.string().allow('', null).default(''),
  careerLevel: Joi.string().valid('intern', 'entry', 'mid', 'senior', 'lead', 'principal', 'executive', 'unknown', '').default('unknown'),
  skills: Joi.array().items(Joi.string()).default([]),
  technicalDomains: Joi.array().items(Joi.string()).default([]),
  experience: Joi.array().items(Joi.object({
    company: Joi.string().allow('', null).default(''),
    title: Joi.string().allow('', null).default(''),
    startDate: Joi.string().allow('', null).default(''),
    endDate: Joi.string().allow('', null).default(''),
    isCurrent: Joi.boolean().default(false),
    responsibilities: Joi.array().items(Joi.string()).default([])
  })).default([]),
  projects: Joi.array().items(Joi.object({
    name: Joi.string().allow('', null).default(''),
    description: Joi.string().allow('', null).default(''),
    technologies: Joi.array().items(Joi.string()).default([])
  })).default([]),
  education: Joi.array().items(Joi.object({
    institution: Joi.string().allow('', null).default(''),
    degree: Joi.string().allow('', null).default(''),
    field: Joi.string().allow('', null).default(''),
    startYear: Joi.string().allow('', null).default(''),
    endYear: Joi.string().allow('', null).default('')
  })).default([]),
  certifications: Joi.array().items(Joi.string()).default([]),
  achievements: Joi.array().items(Joi.string()).default([]),
  summary: Joi.string().allow('', null).default(''),
  confidence: Joi.number().min(0).max(1).default(1.0)
});

const PROMPT_VERSION = 1;
const SCHEMA_VERSION = 1;

/**
 * Clean and normalize raw text extracted from PDF.
 */
export function normalizeResumeText(text) {
  if (!text) return '';
  let cleaned = text.replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ');
  cleaned = cleaned.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.split('\n').map(line => line.trim().replace(/[ \t]+/g, ' ')).join('\n');
  return cleaned.trim();
}

/**
 * Extracts raw text from stored resume file.
 */
export async function extractResumeText(resume) {
  try {
    const fullPath = path.join(fileStorage.basePath, resume.storageKey);
    const buffer = await fs.readFile(fullPath);
    if (resume.contentType === 'application/pdf') {
      let pdfParser = pdf;
      if (typeof pdfParser !== 'function' && pdfParser.default) {
        pdfParser = pdfParser.default;
      }
      if (typeof pdfParser === 'function') {
        const parsed = await pdfParser(buffer);
        return parsed.text || '';
      } else {
        return buffer.toString('utf-8');
      }
    }
    return buffer.toString('utf-8');
  } catch (err) {
    console.error(`[ResumeAiEnrichment] Failed to extract text for resume ${resume.id}:`, err);
    throw new Error(`PDF text extraction failed: ${err.message}`);
  }
}

function buildEnrichmentPrompt(text) {
  return `Analyze this resume and output JSON matching the keys exactly:
{
  "professionalTitle": "Backend Developer",
  "careerLevel": "entry/mid/senior/lead/principal/executive",
  "skills": ["JavaScript", "Node.js"],
  "technicalDomains": ["backend", "web"],
  "experience": [{"company": "A", "title": "B", "startDate": "YYYY-MM", "endDate": "YYYY-MM/present", "isCurrent": false, "responsibilities": ["C"]}],
  "projects": [{"name": "D", "description": "E", "technologies": ["F"]}],
  "education": [{"institution": "G", "degree": "H", "field": "I", "startYear": "YYYY", "endYear": "YYYY"}],
  "certifications": ["J"],
  "achievements": ["K"],
  "summary": "Short summary",
  "confidence": 1.0
}
Resume Text:
${text}`;
}

// In-Memory Background Processing Queue Fallbacks (kept simple for backward-comp observability stubs)
let queueFailures = 0;

aiObservability.registerQueueProvider('resume_enrichment', () => ({
  pending: 0,
  processing: false,
  failed: queueFailures
}));

/**
 * Enqueues a Resume ID for asynchronous AI enrichment.
 */
export async function enqueueResumeEnrichment(resumeId) {
  if (!env.aiEnabled) return;

  try {
    const resume = await models.Resume.findByPk(resumeId);
    if (!resume) return;

    const rawText = await extractResumeText(resume);
    const normalized = normalizeResumeText(rawText);

    const inputHash = crypto
      .createHash('sha256')
      .update(normalized)
      .digest('hex');

    // Check if enrichment already exists for this resume
    let enrichment = await models.ResumeAiEnrichment.findOne({ where: { resumeId } });
    
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
      enrichment = await models.ResumeAiEnrichment.create({
        resumeId,
        provider: env.aiProvider,
        model: env.ollamaModel,
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        status: 'pending',
        inputHash
      });
    }

    await enqueueAIJob('resume_enrichment', resumeId, { inputHash });
  } catch (err) {
    console.error(`[ResumeAiEnrichmentService] Failed to enqueue resume ${resumeId}:`, err);
  }
}

/**
 * Executes Ollama call and persists the enrichment properties.
 */
export async function executeResumeEnrichment(resumeId) {
  let enrichment = await models.ResumeAiEnrichment.findOne({
    where: { resumeId },
    include: [{ model: models.Resume, as: 'resume' }]
  });

  if (!enrichment) {
    const resume = await models.Resume.findByPk(resumeId);
    if (!resume) return;

    const rawText = await extractResumeText(resume);
    const normalized = normalizeResumeText(rawText);

    const inputHash = crypto
      .createHash('sha256')
      .update(normalized)
      .digest('hex');

    enrichment = await models.ResumeAiEnrichment.create({
      resumeId,
      provider: env.aiProvider,
      model: env.ollamaModel,
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      status: 'pending',
      inputHash
    });

    enrichment = await models.ResumeAiEnrichment.findOne({
      where: { resumeId },
      include: [{ model: models.Resume, as: 'resume' }]
    });
  }

  if (!enrichment || !enrichment.resume) return;

  await enrichment.update({ status: 'processing' });
  const start = Date.now();

  try {
    const rawText = await extractResumeText(enrichment.resume);
    const normalized = normalizeResumeText(rawText);
    const prompt = buildEnrichmentPrompt(normalized);
    const parsed = await aiService.generateStructured(prompt, resumeEnrichmentSchema, {
      timeoutMs: 120000,
      operation: 'resume_enrichment',
      evidenceText: normalized,
      userId: enrichment.resume.user_id,
      entityType: 'resume',
      entityId: enrichment.resume.id,
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION
    });
    const latency = Date.now() - start;

    await enrichment.update({
      status: 'completed',
      professionalTitle: parsed.professionalTitle || null,
      careerLevel: parsed.careerLevel || 'unknown',
      skills: parsed.skills || [],
      technicalDomains: parsed.technicalDomains || [],
      experience: parsed.experience || [],
      projects: parsed.projects || [],
      education: parsed.education || [],
      certifications: parsed.certifications || [],
      achievements: parsed.achievements || [],
      summary: parsed.summary || null,
      confidence: parsed.confidence || 1.0,
      rawResponse: JSON.stringify(parsed),
      latencyMs: latency,
      errorCode: null
    });
  } catch (err) {
    queueFailures++;
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
 * Persists user override corrections.
 */
export async function saveResumeCorrections(resumeId, corrections) {
  let enrichment = await models.ResumeAiEnrichment.findOne({ where: { resumeId } });
  if (!enrichment) {
    enrichment = await models.ResumeAiEnrichment.create({
      resumeId,
      provider: 'manual',
      model: 'user',
      promptVersion: 0,
      schemaVersion: SCHEMA_VERSION,
      status: 'skipped',
      inputHash: 'manual-override'
    });
  }

  await enrichment.update({
    userCorrectedProfessionalTitle: corrections.professionalTitle !== undefined ? corrections.professionalTitle : enrichment.userCorrectedProfessionalTitle,
    userCorrectedCareerLevel: corrections.careerLevel !== undefined ? corrections.careerLevel : enrichment.userCorrectedCareerLevel,
    userCorrectedSkills: corrections.skills !== undefined ? corrections.skills : enrichment.userCorrectedSkills,
    userCorrectedSummary: corrections.summary !== undefined ? corrections.summary : enrichment.userCorrectedSummary
  });

  return enrichment;
}
