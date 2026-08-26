import { Router } from 'express';
import Joi from 'joi';
import { models } from '../config/database.js';
import { AppError, asyncHandler, ok } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { querySemanticMatches } from '../services/semantic-search.service.js';
import {
  backfillConnectionsEmbedding,
  backfillJobsEmbedding,
  backfillResumesEmbedding
} from '../services/embedding.service.js';

const router = Router();

const searchSchema = Joi.object({
  query: Joi.string().required(),
  entityTypes: Joi.array().items(Joi.string().valid('connection', 'job', 'resume')).default(['connection']),
  limit: Joi.number().integer().min(1).max(100).default(20),
  filters: Joi.object().optional().default({})
});

const jobSearchSchema = Joi.object({
  query: Joi.string().required(),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

function extractMatchedConcepts(query, entity, enrichment) {
  const queryLower = query.toLowerCase();
  const sourceSkills = entity.skills || [];
  const requiredSkills = enrichment?.requiredSkills || [];
  const preferredSkills = enrichment?.preferredSkills || [];
  const technologies = enrichment?.technologies || [];
  const expertise = enrichment?.expertiseAreas || [];
  const domains = enrichment?.technicalDomains || enrichment?.domain || [];

  const candidates = [
    ...sourceSkills,
    ...requiredSkills,
    ...preferredSkills,
    ...technologies,
    ...expertise,
    ...domains
  ].map(s => String(s).toLowerCase());

  const matched = [];
  const uniqueCandidates = [...new Set(candidates)];

  for (const c of uniqueCandidates) {
    if (queryLower.includes(c) || c.includes(queryLower)) {
      matched.push(c);
    }
  }

  // Capitalize for display
  return matched.map(m => m.replace(/\b\w/g, char => char.toUpperCase())).slice(0, 5);
}

router.use(requireAuth);

// Hybrid Semantic Search Endpoint
router.post(
  '/semantic',
  validate(searchSchema),
  asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const { query, entityTypes, limit, filters } = req.body;

    let matches = [];
    try {
      matches = await querySemanticMatches({
        userId,
        queryText: query,
        entityTypes,
        limit: limit * 2
      });
    } catch (err) {
      throw new AppError(503, 'SEMANTIC_SEARCH_UNAVAILABLE', `Semantic search is temporarily offline: ${err.message}`);
    }

    const results = [];

    // 2. Resolve entities and apply filters
    for (const match of matches) {
      if (match.entityType === 'connection') {
        const conn = await models.Connection.findOne({
          where: { id: match.entityId, user_id: userId },
          include: [{ model: models.ConnectionAiEnrichment, as: 'aiEnrichment' }]
        });

        if (!conn) continue;

        // Apply filters
        if (filters.company && conn.company !== filters.company) continue;
        if (filters.seniority && conn.seniorityLevel !== filters.seniority) continue;
        if (filters.location && conn.location !== filters.location) continue;

        results.push({
          entityId: conn.id,
          entityType: 'connection',
          similarity: match.similarity,
          connection: conn,
          matchedConcepts: extractMatchedConcepts(query, conn, conn.aiEnrichment)
        });
      } else if (match.entityType === 'job') {
        const job = await models.Job.findOne({
          where: { id: match.entityId, user_id: userId },
          include: [{ model: models.JobAiEnrichment, as: 'aiEnrichment' }]
        });

        if (!job) continue;

        results.push({
          entityId: job.id,
          entityType: 'job',
          similarity: match.similarity,
          job,
          matchedConcepts: extractMatchedConcepts(query, job, job.aiEnrichment)
        });
      } else if (match.entityType === 'resume') {
        const resume = await models.Resume.findOne({
          where: { id: match.entityId, user_id: userId },
          include: [{ model: models.ResumeAiEnrichment, as: 'aiEnrichment' }]
        });

        if (!resume) continue;

        results.push({
          entityId: resume.id,
          entityType: 'resume',
          similarity: match.similarity,
          resume,
          matchedConcepts: extractMatchedConcepts(query, resume, resume.aiEnrichment)
        });
      }
    }

    ok(res, results.slice(0, limit));
  })
);

// Job Semantic Search Shortcut
router.post(
  '/jobs',
  validate(jobSearchSchema),
  asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const { query, limit } = req.body;

    let matches = [];
    try {
      matches = await querySemanticMatches({
        userId,
        queryText: query,
        entityTypes: ['job'],
        limit
      });
    } catch (err) {
      throw new AppError(503, 'SEMANTIC_SEARCH_UNAVAILABLE', `Semantic search is temporarily offline: ${err.message}`);
    }

    const results = [];
    for (const match of matches) {
      const job = await models.Job.findOne({
        where: { id: match.entityId, user_id: userId },
        include: [{ model: models.JobAiEnrichment, as: 'aiEnrichment' }]
      });

      if (!job) continue;

      results.push({
        job,
        similarity: match.similarity,
        matchedConcepts: extractMatchedConcepts(query, job, job.aiEnrichment)
      });
    }

    ok(res, results);
  })
);

// Trigger Backfill of embeddings for existing records
router.post(
  '/backfill',
  asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const connStats = await backfillConnectionsEmbedding({ userId, limit: 100, onlyMissing: true });
    const jobStats = await backfillJobsEmbedding({ userId, limit: 100, onlyMissing: true });
    const resumeStats = await backfillResumesEmbedding({ userId, limit: 100, onlyMissing: true });

    ok(res, {
      connections: connStats,
      jobs: jobStats,
      resumes: resumeStats
    });
  })
);

export default router;
