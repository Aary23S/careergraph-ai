import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import Joi from 'joi';
import { createRequire } from 'module';
import mammoth from 'mammoth';
import { models } from '../config/database.js';
import { env } from '../config/env.js';
import { aiService } from './ai/ai.service.js';
import { fileStorage } from '../lib/storage.js';
import { aiObservability } from './ai/observability.service.js';
import { enqueueAIJob } from '../queues/ai.queue.js';
import { canonicalizeSkillList } from '../lib/skills-taxonomy.js';
import { estimateYearsOfExperience } from '../lib/experience.util.js';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Define the structured schema matching database columns
// Smaller/quantized models don't always conform to the nested-object shape for
// array items and sometimes hand back a plain string instead (e.g. experience[0]
// = "Acme Corp - Senior Engineer" rather than {company, title, ...}). Accepting
// either shape and normalizing the string case avoids discarding an otherwise
// valid extraction (skills/title/summary) over one malformed array.
const experienceItemSchema = Joi.alternatives().try(
  Joi.object({
    company: Joi.string().allow('', null).default(''),
    title: Joi.string().allow('', null).default(''),
    startDate: Joi.string().allow('', null).default(''),
    endDate: Joi.string().allow('', null).default(''),
    isCurrent: Joi.boolean().default(false),
    responsibilities: Joi.array().items(Joi.string()).default([])
  }),
  Joi.string()
).custom((value) => (
  typeof value === 'string'
    ? { company: '', title: value, startDate: '', endDate: '', isCurrent: false, responsibilities: [] }
    : value
));

const projectItemSchema = Joi.alternatives().try(
  Joi.object({
    name: Joi.string().allow('', null).default(''),
    description: Joi.string().allow('', null).default(''),
    technologies: Joi.array().items(Joi.string()).default([])
  }),
  Joi.string()
).custom((value) => (
  typeof value === 'string' ? { name: value, description: '', technologies: [] } : value
));

const educationItemSchema = Joi.alternatives().try(
  Joi.object({
    institution: Joi.string().allow('', null).default(''),
    degree: Joi.string().allow('', null).default(''),
    field: Joi.string().allow('', null).default(''),
    startYear: Joi.string().allow('', null).default(''),
    endYear: Joi.string().allow('', null).default('')
  }),
  Joi.string()
).custom((value) => (
  typeof value === 'string' ? { institution: value, degree: '', field: '', startYear: '', endYear: '' } : value
));

const certificationItemSchema = Joi.alternatives().try(
  Joi.object({
    name: Joi.string().allow('', null).default(''),
    issuer: Joi.string().allow('', null).default(''),
    issueDate: Joi.string().allow('', null).default(''),
    expiryDate: Joi.string().allow('', null).default(''),
    credentialId: Joi.string().allow('', null).default('')
  }),
  Joi.string()
).custom((value) => (
  typeof value === 'string'
    ? { name: value, issuer: '', issueDate: '', expiryDate: '', credentialId: '' }
    : value
));

export const CAREER_LEVELS = ['intern', 'entry', 'mid', 'senior', 'lead', 'principal', 'executive'];

export const resumeEnrichmentSchema = Joi.object({
  professionalTitle: Joi.string().allow('', null).default(''),
  careerLevel: Joi.string().trim().lowercase().allow('', null).default('unknown')
    .custom((value) => (CAREER_LEVELS.includes(value) ? value : 'unknown')),
  skills: Joi.array().items(Joi.string()).default([]),
  technicalDomains: Joi.array().items(Joi.string()).default([]),
  experience: Joi.array().items(experienceItemSchema).default([]),
  projects: Joi.array().items(projectItemSchema).default([]),
  education: Joi.array().items(educationItemSchema).default([]),
  certifications: Joi.array().items(certificationItemSchema).default([]),
  achievements: Joi.array().items(Joi.string()).default([]),
  summary: Joi.string().allow('', null).default(''),
  confidence: Joi.number().min(0).max(1).default(1.0)
});

const PROMPT_VERSION = 2;
const SCHEMA_VERSION = 2;

// Groq's on-demand tier caps at 8000 tokens/minute; an untruncated multi-page
// resume can request 30k+ tokens and get rejected outright. Ollama (local) has
// no such cap, so it gets a much larger budget; the mock provider (tests) gets
// no truncation at all so fixtures aren't silently clipped.
const MAX_PROMPT_CHARS = 6000;

export function resolvePromptCharBudget(provider) {
  if (provider === 'groq') return env.aiResumePromptCharBudgetGroq;
  if (provider === 'ollama') return env.aiResumePromptCharBudgetOllama;
  if (provider === 'mock') return env.aiResumePromptCharBudgetMock;
  return MAX_PROMPT_CHARS;
}

// Cuts at the last newline at/before maxChars so truncation never breaks
// mid-line (which can otherwise nudge a smaller model into malformed JSON).
export function truncateResumeText(text, maxChars) {
  if (!text || maxChars <= 0 || text.length <= maxChars) return text || '';
  const window = text.slice(0, maxChars);
  const lastNewline = window.lastIndexOf('\n');
  if (lastNewline > maxChars * 0.5) return window.slice(0, lastNewline);
  return window;
}

const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_REGEX = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/;
const LINKEDIN_REGEX = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+\/?/i;
const GITHUB_REGEX = /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+\/?/i;
const PORTFOLIO_REGEX = /(?:https?:\/\/)?(?:www\.)?[\w-]+\.(?:dev|me|io|com|in)\/[\w-]*/i;

// Deterministic regex pass instead of asking the LLM — contact details are
// either present verbatim in the text or not; an LLM can hallucinate or
// truncate them, a regex over the full untruncated text cannot.
export function extractContactInfo(rawText) {
  const text = rawText || '';
  const email = text.match(EMAIL_REGEX)?.[0] || null;
  const phone = text.match(PHONE_REGEX)?.[0] || null;
  const linkedin = text.match(LINKEDIN_REGEX)?.[0] || null;
  const github = text.match(GITHUB_REGEX)?.[0] || null;
  let portfolio = null;
  if (!linkedin && !github) {
    const candidate = text.match(PORTFOLIO_REGEX)?.[0];
    if (candidate && !EMAIL_REGEX.test(candidate)) portfolio = candidate;
  }
  return { email, phone, linkedin, github, portfolio, otherLinks: [] };
}

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
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return result.text || '';
      } finally {
        await parser.destroy();
      }
    }
    if (resume.contentType === DOCX_CONTENT_TYPE) {
      const parsed = await mammoth.extractRawText({ buffer });
      return parsed.value || '';
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
  "careerLevel": "intern/entry/mid/senior/lead/principal/executive",
  "skills": ["JavaScript", "Node.js"],
  "technicalDomains": ["backend", "web"],
  "experience": [{"company": "A", "title": "B", "startDate": "YYYY-MM", "endDate": "YYYY-MM/present", "isCurrent": false, "responsibilities": ["C"]}],
  "projects": [{"name": "D", "description": "E", "technologies": ["F"]}],
  "education": [{"institution": "G", "degree": "H", "field": "I", "startYear": "YYYY", "endYear": "YYYY"}],
  "certifications": [{"name": "AWS Certified Solutions Architect", "issuer": "Amazon", "issueDate": "2023"}],
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
      const isStale = enrichment.schemaVersion !== SCHEMA_VERSION || enrichment.promptVersion !== PROMPT_VERSION;
      if (!isStale && enrichment.inputHash === inputHash && ['completed', 'skipped'].includes(enrichment.status)) {
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
    const promptBudget = resolvePromptCharBudget(env.aiProvider);
    const prompt = buildEnrichmentPrompt(truncateResumeText(normalized, promptBudget));
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

    const confidence = parsed.confidence || 1.0;
    const experience = parsed.experience || [];
    const totalExperienceYears = estimateYearsOfExperience(experience);
    const hasParseableStart = experience.some((entry) => entry?.startDate);
    const needsReview = confidence < 0.6 || (experience.length > 0 && !hasParseableStart);

    await enrichment.update({
      status: 'completed',
      professionalTitle: parsed.professionalTitle || null,
      careerLevel: parsed.careerLevel || 'unknown',
      skills: parsed.skills || [],
      canonicalSkills: canonicalizeSkillList(parsed.skills || []),
      technicalDomains: parsed.technicalDomains || [],
      experience,
      projects: parsed.projects || [],
      education: parsed.education || [],
      certifications: parsed.certifications || [],
      achievements: parsed.achievements || [],
      summary: parsed.summary || null,
      confidence,
      contactInfo: extractContactInfo(normalized),
      totalExperienceYears,
      needsReview,
      rawResponse: JSON.stringify(parsed),
      latencyMs: latency,
      errorCode: null,
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION
    });

    if (enrichment.resume.isActive) {
      const { syncProfileFromResumeEnrichment } = await import('./profile-resume-sync.service.js');
      await syncProfileFromResumeEnrichment(enrichment.resume.user_id, enrichment).catch((syncErr) => {
        console.error(`[ResumeAiEnrichmentService] Profile auto-sync failed for resume ${resumeId}:`, syncErr);
      });

      const { refreshMatchAnalysisForTrackedJobs } = await import('./job-match-analysis.service.js');
      refreshMatchAnalysisForTrackedJobs(enrichment.resume.user_id);
    }
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
