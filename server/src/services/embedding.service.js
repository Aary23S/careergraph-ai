import crypto from 'crypto';
import { models } from '../config/database.js';
import { env } from '../config/env.js';
import { aiService } from './ai/ai.service.js';

/**
 * Computes SHA-256 hash for a given string.
 */
export function computeSha256(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

/**
 * Builders for canonical semantic text representations.
 */
export function buildJobSemanticText(job, enrichment) {
  const parts = [
    `Title: ${job.title || 'Unknown'}`,
    `Company: ${job.normalizedCompany || 'Unknown'}`,
    `Role Category: ${enrichment?.userCorrectedRoleCategory || enrichment?.roleCategory || 'Unknown'}`,
    `Seniority: ${enrichment?.userCorrectedSeniority || enrichment?.seniority || 'Unknown'}`,
    `Required Skills: ${(enrichment?.userCorrectedRequiredSkills || enrichment?.requiredSkills || []).join(', ')}`,
    `Preferred Skills: ${(enrichment?.userCorrectedPreferredSkills || enrichment?.preferredSkills || []).join(', ')}`,
    `Domain: ${(enrichment?.userCorrectedDomain || enrichment?.domain || []).join(', ')}`,
    `Responsibilities: ${(enrichment?.userCorrectedResponsibilities || enrichment?.responsibilities || []).join('. ')}`,
    `Summary: ${enrichment?.userCorrectedSummary || enrichment?.summary || job.description || ''}`
  ];
  return parts.filter(Boolean).join('\n');
}

export function buildResumeSemanticText(resume, enrichment) {
  const parts = [
    `Title: ${enrichment?.userCorrectedProfessionalTitle || enrichment?.professionalTitle || resume.fileName || 'Resume'}`,
    `Career Level: ${enrichment?.userCorrectedCareerLevel || enrichment?.careerLevel || 'Unknown'}`,
    `Skills: ${(enrichment?.userCorrectedSkills || enrichment?.skills || []).join(', ')}`,
    `Domains: ${(enrichment?.technicalDomains || []).join(', ')}`,
    `Summary: ${enrichment?.userCorrectedSummary || enrichment?.summary || ''}`,
    `Projects: ${(enrichment?.projects || []).join('. ')}`,
    `Achievements: ${(enrichment?.achievements || []).join('. ')}`
  ];
  return parts.filter(Boolean).join('\n');
}

export function buildConnectionSemanticText(connection, enrichment) {
  const parts = [
    `Name: ${connection.name || 'Unknown'}`,
    `Headline: ${connection.headline || connection.title || ''}`,
    `Role: ${connection.title || enrichment?.userCorrectedProfessionalRole || enrichment?.professionalRole || ''}`,
    `Company: ${connection.company || ''}`,
    `AI Professional Role: ${enrichment?.userCorrectedProfessionalRole || enrichment?.professionalRole || ''}`,
    `Career Level: ${enrichment?.userCorrectedCareerLevel || enrichment?.careerLevel || ''}`,
    `Expertise: ${(enrichment?.userCorrectedExpertiseAreas || enrichment?.expertiseAreas || []).join(', ')}`,
    `Technologies: ${(enrichment?.userCorrectedTechnologies || enrichment?.technologies || []).join(', ')}`,
    `Domains: ${(enrichment?.userCorrectedTechnicalDomains || enrichment?.technicalDomains || []).join(', ')}`,
    `Summary: ${enrichment?.userCorrectedSummary || enrichment?.summary || connection.notes || ''}`
  ];
  return parts.filter(Boolean).join('\n');
}

/**
 * Retrieves the up-to-date embedding or generates it if stale or missing.
 */
export async function getOrGenerateEmbedding({ userId, entityType, entityId, text }) {
  const modelName = env.ollamaEmbeddingModel || 'mock';
  const textHash = computeSha256(text);

  // 1. Check if identical embedding already exists
  const existing = await models.SemanticEmbedding.findOne({
    where: {
      userId,
      entityType,
      entityId,
      embeddingModel: modelName,
      contentHash: textHash
    }
  });

  if (existing) {
    return existing;
  }

  // 2. Generate new vector
  const vector = await aiService.generateEmbedding(text, modelName);
  const dimension = vector.length;

  // 3. Upsert record
  const [record] = await models.SemanticEmbedding.upsert({
    userId,
    entityType,
    entityId,
    embedding: vector,
    contentHash: textHash,
    embeddingModel: modelName,
    embeddingDimension: dimension,
    status: 'completed'
  });

  return record;
}

/**
 * Backfill embeddings for connections.
 */
export async function backfillConnectionsEmbedding({ userId, limit = 50, onlyMissing = true }) {
  const modelName = env.ollamaEmbeddingModel || 'mock';
  const connections = await models.Connection.findAll({
    where: { user_id: userId },
    include: [{ model: models.ConnectionAiEnrichment, as: 'aiEnrichment' }]
  });

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const conn of connections) {
    if (processed >= limit) break;

    try {
      const text = buildConnectionSemanticText(conn, conn.aiEnrichment);
      const textHash = computeSha256(text);

      if (onlyMissing) {
        const existing = await models.SemanticEmbedding.findOne({
          where: {
            userId,
            entityType: 'connection',
            entityId: conn.id,
            embeddingModel: modelName,
            contentHash: textHash
          }
        });
        if (existing) {
          skipped++;
          continue;
        }
      }

      await getOrGenerateEmbedding({
        userId,
        entityType: 'connection',
        entityId: conn.id,
        text
      });
      processed++;
    } catch (err) {
      console.error(`[EmbeddingBackfill] Connection ${conn.id} failed:`, err.message);
      failed++;
    }
  }

  return { processed, skipped, failed };
}

/**
 * Backfill embeddings for jobs.
 */
export async function backfillJobsEmbedding({ userId, limit = 50, onlyMissing = true }) {
  const modelName = env.ollamaEmbeddingModel || 'mock';
  const jobs = await models.Job.findAll({
    where: { user_id: userId },
    include: [{ model: models.JobAiEnrichment, as: 'aiEnrichment' }]
  });

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const job of jobs) {
    if (processed >= limit) break;

    try {
      const text = buildJobSemanticText(job, job.aiEnrichment);
      const textHash = computeSha256(text);

      if (onlyMissing) {
        const existing = await models.SemanticEmbedding.findOne({
          where: {
            userId,
            entityType: 'job',
            entityId: job.id,
            embeddingModel: modelName,
            contentHash: textHash
          }
        });
        if (existing) {
          skipped++;
          continue;
        }
      }

      await getOrGenerateEmbedding({
        userId,
        entityType: 'job',
        entityId: job.id,
        text
      });
      processed++;
    } catch (err) {
      console.error(`[EmbeddingBackfill] Job ${job.id} failed:`, err.message);
      failed++;
    }
  }

  return { processed, skipped, failed };
}

/**
 * Backfill embeddings for resumes.
 */
export async function backfillResumesEmbedding({ userId, limit = 50, onlyMissing = true }) {
  const modelName = env.ollamaEmbeddingModel || 'mock';
  const resumes = await models.Resume.findAll({
    where: { user_id: userId },
    include: [{ model: models.ResumeAiEnrichment, as: 'aiEnrichment' }]
  });

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const resume of resumes) {
    if (processed >= limit) break;

    try {
      const text = buildResumeSemanticText(resume, resume.aiEnrichment);
      const textHash = computeSha256(text);

      if (onlyMissing) {
        const existing = await models.SemanticEmbedding.findOne({
          where: {
            userId,
            entityType: 'resume',
            entityId: resume.id,
            embeddingModel: modelName,
            contentHash: textHash
          }
        });
        if (existing) {
          skipped++;
          continue;
        }
      }

      await getOrGenerateEmbedding({
        userId,
        entityType: 'resume',
        entityId: resume.id,
        text
      });
      processed++;
    } catch (err) {
      console.error(`[EmbeddingBackfill] Resume ${resume.id} failed:`, err.message);
      failed++;
    }
  }

  return { processed, skipped, failed };
}
