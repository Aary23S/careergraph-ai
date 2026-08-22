import { Router } from 'express';
import Joi from 'joi';
import { Op } from 'sequelize';
import { models } from '../config/database.js';
import { AppError, asyncHandler, created, ok } from '../lib/http.js';
import { getPagination, makePageMeta } from '../lib/pagination.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ingestJob, ingestJobsBatch } from '../services/job-ingestion.service.js';
import {
  calculateMatchScore,
  calculateReferralScore,
  calculateOpportunityScore,
  determineActionRecommendation,
  extractSkillsFromText,
} from '../services/intelligence.service.js';
import { getJobNetworkDetails } from '../services/job-network.service.js';

const router = Router();

const jobSchema = Joi.object({
  title: Joi.string().required(),
  companyName: Joi.string().required(),
  description: Joi.string().allow('', null),
  location: Joi.string().allow('', null),
  employmentType: Joi.string().allow('', null),
  experienceMin: Joi.number().integer().min(0).allow(null),
  experienceMax: Joi.number().integer().min(0).allow(null),
  url: Joi.string().uri().allow('', null),
  source: Joi.string().allow('', null),
  sourceJobId: Joi.string().allow('', null),
  postedDate: Joi.string().allow('', null),
  firstSeenDate: Joi.string().allow('', null),
  status: Joi.string().allow('', null),
});

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(10),
  q: Joi.string().allow('', null),
  company: Joi.string().allow('', null),
  location: Joi.string().allow('', null),
  status: Joi.string().allow('', null),
  archived: Joi.boolean(),
  remoteType: Joi.string().allow('', null),
  experienceLevel: Joi.string().allow('', null),
  source: Joi.string().allow('', null),
  minMatchScore: Joi.number().integer().min(0).max(100).allow(null),
  postedDate: Joi.string().allow('', null),
  roleCategory: Joi.string().allow('', null),
  sortBy: Joi.string().valid('postedDate', 'matchScore', 'createdAt', 'title', 'company').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').default('desc'),
});

function normalizeCompanyName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function findOrCreateCompany(companyName) {
  const normalizedName = normalizeCompanyName(companyName);
  const [company] = await models.Company.findOrCreate({
    where: { normalizedName },
    defaults: { name: companyName.trim(), normalizedName },
  });

  if (company.name !== companyName.trim()) {
    company.name = companyName.trim();
    await company.save();
  }

  return company;
}

async function ensureJobOwnership(userId, jobId) {
  const job = await models.Job.findOne({
    where: { id: jobId, user_id: userId },
    include: [{ model: models.Company, as: 'company' }],
  });

  if (!job) {
    throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found.');
  }

  return job;
}

async function serializeJob(job, profile, userId) {
  const jobJson = job.toJSON();
  const companyName = job.company?.name ?? null;

  // Calculate matching intelligence on the fly
  const matchScore = calculateMatchScore(profile, job);
  
  // Find connections at this company
  let connections = [];
  if (job.company) {
    connections = await models.Connection.findAll({
      where: {
        user_id: userId,
        company: { [Op.like]: `%${job.company.name}%` }
      }
    });
  }

  const scoredContacts = connections.map(conn => {
    const referralScore = calculateReferralScore(conn, job);
    return {
      id: conn.id,
      name: conn.name,
      title: conn.title,
      company: conn.company,
      relationshipStrength: conn.relationshipStrength,
      referralScore
    };
  }).sort((a, b) => b.referralScore - a.referralScore);

  const maxReferralScore = scoredContacts.length > 0 ? scoredContacts[0].referralScore : 0;
  const opportunityScore = calculateOpportunityScore(matchScore, maxReferralScore);
  const recommendedAction = determineActionRecommendation(matchScore, scoredContacts[0] || null);

  const jobText = `${job.title || ''} ${job.description || ''}`;
  const jobSkills = extractSkillsFromText(jobText);
  const profileSkills = (profile?.skills || []).map(s => s.toLowerCase());

  return {
    ...jobJson,
    companyName,
    matchScore,
    matchedSkills: jobSkills.filter(s => profileSkills.includes(s)),
    missingSkills: jobSkills.filter(s => !profileSkills.includes(s)),
    opportunityScore,
    recommendedContacts: scoredContacts,
    recommendedAction
  };
}

router.use(requireAuth);

router.post(
  '/',
  validate(jobSchema),
  asyncHandler(async (req, res) => {
    const company = await findOrCreateCompany(req.body.companyName);

    // 1. Deduplication checks
    let existingJob = null;

    if (req.body.url) {
      existingJob = await models.Job.findOne({
        where: { user_id: req.auth.userId, url: req.body.url },
        include: [{ model: models.Company, as: 'company' }],
      });
    }

    if (!existingJob && req.body.source && req.body.sourceJobId) {
      existingJob = await models.Job.findOne({
        where: {
          user_id: req.auth.userId,
          source: req.body.source,
          sourceJobId: req.body.sourceJobId,
        },
        include: [{ model: models.Company, as: 'company' }],
      });
    }

    if (!existingJob) {
      existingJob = await models.Job.findOne({
        where: {
          user_id: req.auth.userId,
          company_id: company.id,
          title: req.body.title,
          isArchived: false,
        },
        include: [{ model: models.Company, as: 'company' }],
      });
    }

    // If duplicate found, update existing job attributes and return it
    if (existingJob) {
      await existingJob.update({
        description: req.body.description || existingJob.description,
        location: req.body.location || existingJob.location,
        employmentType: req.body.employmentType || existingJob.employmentType,
        experienceMin: req.body.experienceMin !== undefined ? req.body.experienceMin : existingJob.experienceMin,
        experienceMax: req.body.experienceMax !== undefined ? req.body.experienceMax : existingJob.experienceMax,
        url: req.body.url || existingJob.url,
        source: req.body.source || existingJob.source,
        sourceJobId: req.body.sourceJobId || existingJob.sourceJobId,
        postedDate: req.body.postedDate || existingJob.postedDate,
        status: req.body.status || existingJob.status,
      });

      const profile = await models.Profile.findOne({ where: { user_id: req.auth.userId } });
      const serialized = await serializeJob(existingJob, profile, req.auth.userId);
      ok(res, serialized, undefined, 200);
      return;
    }

    // Otherwise, create a new job
    const job = await models.Job.create({
      user_id: req.auth.userId,
      company_id: company.id,
      title: req.body.title,
      description: req.body.description,
      location: req.body.location,
      employmentType: req.body.employmentType,
      experienceMin: req.body.experienceMin,
      experienceMax: req.body.experienceMax,
      url: req.body.url,
      source: req.body.source,
      sourceJobId: req.body.sourceJobId,
      postedDate: req.body.postedDate || null,
      firstSeenDate: req.body.firstSeenDate || new Date().toISOString().slice(0, 10),
      status: req.body.status || 'new',
    });

    const fullJob = await ensureJobOwnership(req.auth.userId, job.id);
    const profile = await models.Profile.findOne({ where: { user_id: req.auth.userId } });
    const serialized = await serializeJob(fullJob, profile, req.auth.userId);
    created(res, serialized);
  }),
);

router.get(
  '/',
  validate(querySchema, 'query'),
  asyncHandler(async (req, res) => {
    const pagination = getPagination(req.query);
    const where = { user_id: req.auth.userId };

    if (req.query.q) {
      where[Op.or] = [
        { title: { [Op.like]: `%${req.query.q}%` } },
        { description: { [Op.like]: `%${req.query.q}%` } },
      ];
    }
    if (req.query.location) {
      where.location = { [Op.like]: `%${req.query.location}%` };
    }
    if (req.query.status) where.status = req.query.status;
    if (typeof req.query.archived === 'boolean') where.isArchived = req.query.archived;
    if (req.query.remoteType) where.remoteType = req.query.remoteType;
    if (req.query.experienceLevel) where.experienceLevel = req.query.experienceLevel;
    if (req.query.source) where.source = req.query.source;
    if (req.query.postedDate) where.postedDate = req.query.postedDate;
    if (req.query.minMatchScore !== undefined && req.query.minMatchScore !== null) {
      where.matchScore = { [Op.gte]: req.query.minMatchScore };
    }
    if (req.query.roleCategory) {
      where.normalizedTitle = { [Op.like]: `%${req.query.roleCategory.toLowerCase().trim()}%` };
    }

    const include = [{ model: models.Company, as: 'company' }];
    if (req.query.company) {
      include[0].where = { name: { [Op.like]: `%${req.query.company}%` } };
    }

    let order = [['created_at', 'DESC']];
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = (req.query.sortOrder || 'desc').toUpperCase();
    if (sortBy === 'postedDate') {
      order = [['posted_date', sortOrder]];
    } else if (sortBy === 'matchScore') {
      order = [['match_score', sortOrder]];
    } else if (sortBy === 'title') {
      order = [['title', sortOrder]];
    } else if (sortBy === 'company') {
      order = [[{ model: models.Company, as: 'company' }, 'name', sortOrder]];
    } else {
      order = [['created_at', sortOrder]];
    }

    const { rows, count } = await models.Job.findAndCountAll({
      where,
      include,
      order,
      limit: pagination.limit,
      offset: pagination.offset,
      distinct: true,
    });

    const profile = await models.Profile.findOne({ where: { user_id: req.auth.userId } });
    const items = await Promise.all(rows.map(row => serializeJob(row, profile, req.auth.userId)));
    ok(res, items, makePageMeta({ ...pagination, total: count }));
  }),
);

router.post(
  '/ingest',
  asyncHandler(async (req, res) => {
    const result = await ingestJob(req.auth.userId, req.body);
    const profile = await models.Profile.findOne({ where: { user_id: req.auth.userId } });
    const serialized = await serializeJob(result.job, profile, req.auth.userId);
    created(res, { status: result.status, job: serialized });
  })
);

router.post(
  '/ingest/batch',
  asyncHandler(async (req, res) => {
    if (!Array.isArray(req.body)) {
      throw new AppError(400, 'ARRAY_REQUIRED', 'Batch input must be an array.');
    }
    const summary = await ingestJobsBatch(req.auth.userId, req.body);
    ok(res, summary);
  })
);

router.get(
  '/:jobId/network',
  asyncHandler(async (req, res) => {
    const details = await getJobNetworkDetails(req.auth.userId, req.params.jobId, req.query);
    ok(res, details);
  }),
);

router.get(
  '/:jobId',
  asyncHandler(async (req, res) => {
    const job = await ensureJobOwnership(req.auth.userId, req.params.jobId);
    const profile = await models.Profile.findOne({ where: { user_id: req.auth.userId } });
    const serialized = await serializeJob(job, profile, req.auth.userId);
    ok(res, serialized);
  }),
);

router.put(
  '/:jobId',
  validate(jobSchema),
  asyncHandler(async (req, res) => {
    const job = await ensureJobOwnership(req.auth.userId, req.params.jobId);
    const company = await findOrCreateCompany(req.body.companyName);
    await job.update({
      company_id: company.id,
      title: req.body.title,
      description: req.body.description,
      location: req.body.location,
      employmentType: req.body.employmentType,
      experienceMin: req.body.experienceMin,
      experienceMax: req.body.experienceMax,
      url: req.body.url,
      source: req.body.source,
      sourceJobId: req.body.sourceJobId,
      postedDate: req.body.postedDate || null,
      firstSeenDate: req.body.firstSeenDate || job.firstSeenDate,
      status: req.body.status || job.status,
    });
    const refreshed = await ensureJobOwnership(req.auth.userId, job.id);
    const profile = await models.Profile.findOne({ where: { user_id: req.auth.userId } });
    const serialized = await serializeJob(refreshed, profile, req.auth.userId);
    ok(res, serialized);
  }),
);

router.patch(
  '/:jobId/archive',
  validate(Joi.object({ isArchived: Joi.boolean().required() })),
  asyncHandler(async (req, res) => {
    const job = await ensureJobOwnership(req.auth.userId, req.params.jobId);
    job.isArchived = req.body.isArchived;
    await job.save();
    const refreshed = await ensureJobOwnership(req.auth.userId, job.id);
    const profile = await models.Profile.findOne({ where: { user_id: req.auth.userId } });
    const serialized = await serializeJob(refreshed, profile, req.auth.userId);
    ok(res, serialized);
  }),
);

router.delete(
  '/:jobId',
  asyncHandler(async (req, res) => {
    const job = await ensureJobOwnership(req.auth.userId, req.params.jobId);
    await job.destroy();
    ok(res, { deleted: true });
  }),
);

export default router;
