import crypto from 'crypto';
import { models } from '../config/database.js';
import { env } from '../config/env.js';
import { aiService } from './ai/ai.service.js';
import { enqueueAIJob } from '../queues/ai.queue.js';
import { mlServiceClient } from './ml-service.client.js';
import { aiObservability } from './ai/observability.service.js';

/**
 * Computes SHA-256 hash for a given string.
 */
export function computeSha256(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

/**
 * Single source of truth for "which embedding model is currently active."
 * Both generation (here) and search (semantic-search.service.js) must
 * resolve the same string, since SemanticEmbedding rows are looked up by
 * this exact value -- if they ever disagreed, embeddings generated via one
 * path would simply never be found by the other.
 */
export function resolveEmbeddingModelName() {
  return env.mlServiceEnabled ? env.mlServiceEmbeddingModel : (env.ollamaEmbeddingModel || 'mock');
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
 * Generates an embedding vector for arbitrary text, trying the Python ML
 * service first (Phase 4D) when enabled and falling back to the existing
 * Node/Ollama/mock path (`aiService.generateEmbedding`) on any failure.
 *
 * This is the ONE place that decides "Python or Node" -- every caller that
 * generates an embedding (stored-entity generation below, and semantic
 * search's query-embedding generation) must go through this function, or
 * query vectors and stored vectors can end up produced by different paths
 * with different dimensions, silently breaking similarity search.
 */
export async function generateEmbeddingVector(text, modelName, { entityType, entityId } = {}) {
  const requestId = crypto.randomUUID();
  const start = Date.now();
  let vector;
  let source = 'node';

  if (env.mlServiceEnabled) {
    try {
      const result = await mlServiceClient.embed(text, { model: modelName });
      vector = result.embedding;
      source = 'python';
    } catch (err) {
      console.warn(`[EmbeddingService] ML service unavailable (${err.code || 'UNKNOWN'}), falling back to Node path: ${err.message}`);
    }
  }

  if (!vector) {
    // aiService.generateEmbedding() records its own observability internally
    // on success -- only record it ourselves below for the Python path,
    // which bypasses aiService entirely, to avoid double-counting.
    vector = await aiService.generateEmbedding(text, modelName);
  } else {
    aiObservability.recordEmbedding(Date.now() - start);
  }

  console.log(JSON.stringify({
    requestId,
    operation: 'embedding_generation',
    entityType: entityType || null,
    entityId: entityId || null,
    source,
    model: modelName,
    dimension: vector.length,
    latencyMs: Date.now() - start,
    status: 'success'
  }));

  return vector;
}

/**
 * Retrieves the up-to-date embedding or generates it if stale or missing.
 */
export async function getOrGenerateEmbedding({ userId, entityType, entityId, text }) {
  const modelName = resolveEmbeddingModelName();
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
  const vector = await generateEmbeddingVector(text, modelName, { entityType, entityId });
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
export async function backfillConnectionsEmbedding({ userId, limit = 50, batchSize = 100, onlyMissing = true, priority = 30 }) {
  const modelName = resolveEmbeddingModelName();
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let offset = 0;

  while (processed < limit) {
    const currentBatchSize = Math.min(batchSize, limit - processed);
    if (currentBatchSize <= 0) break;

    const connections = await models.Connection.findAll({
      where: { user_id: userId },
      include: [{ model: models.ConnectionAiEnrichment, as: 'aiEnrichment' }],
      limit: currentBatchSize,
      offset: offset
    });

    if (connections.length === 0) break;

    for (const conn of connections) {
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

        await enqueueAIJob('embedding_generation', conn.id, {
          userId,
          entityType: 'connection',
          text,
          inputHash: textHash
        }, {
          priority: priority
        });
        processed++;
      } catch (err) {
        console.error(`[EmbeddingBackfill] Connection ${conn.id} failed:`, err.message);
        failed++;
      }
    }

    offset += connections.length;
  }

  return { processed, skipped, failed };
}

/**
 * Backfill embeddings for jobs.
 */
export async function backfillJobsEmbedding({ userId, limit = 50, batchSize = 100, onlyMissing = true, priority = 30 }) {
  const modelName = resolveEmbeddingModelName();
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let offset = 0;

  while (processed < limit) {
    const currentBatchSize = Math.min(batchSize, limit - processed);
    if (currentBatchSize <= 0) break;

    const jobs = await models.Job.findAll({
      where: { user_id: userId },
      include: [{ model: models.JobAiEnrichment, as: 'aiEnrichment' }],
      limit: currentBatchSize,
      offset: offset
    });

    if (jobs.length === 0) break;

    for (const job of jobs) {
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

        await enqueueAIJob('embedding_generation', job.id, {
          userId,
          entityType: 'job',
          text,
          inputHash: textHash
        }, {
          priority: priority
        });
        processed++;
      } catch (err) {
        console.error(`[EmbeddingBackfill] Job ${job.id} failed:`, err.message);
        failed++;
      }
    }

    offset += jobs.length;
  }

  return { processed, skipped, failed };
}

/**
 * Backfill embeddings for resumes.
 */
export async function backfillResumesEmbedding({ userId, limit = 50, batchSize = 100, onlyMissing = true, priority = 30 }) {
  const modelName = resolveEmbeddingModelName();
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let offset = 0;

  while (processed < limit) {
    const currentBatchSize = Math.min(batchSize, limit - processed);
    if (currentBatchSize <= 0) break;

    const resumes = await models.Resume.findAll({
      where: { user_id: userId },
      include: [{ model: models.ResumeAiEnrichment, as: 'aiEnrichment' }],
      limit: currentBatchSize,
      offset: offset
    });

    if (resumes.length === 0) break;

    for (const resume of resumes) {
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

        await enqueueAIJob('embedding_generation', resume.id, {
          userId,
          entityType: 'resume',
          text,
          inputHash: textHash
        }, {
          priority: priority
        });
        processed++;
      } catch (err) {
        console.error(`[EmbeddingBackfill] Resume ${resume.id} failed:`, err.message);
        failed++;
      }
    }

    offset += resumes.length;
  }

  return { processed, skipped, failed };
}
