import { Router } from 'express';
import { ok, asyncHandler, AppError, created } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { models } from '../config/database.js';
import { ingestJob } from '../services/job-ingestion.service.js';

const router = Router();

// List incoming jobs pending review
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const status = req.query.status || 'pending_review';

    const jobs = await models.IncomingJob.findAll({
      where: { user_id: userId, status },
      order: [['receivedAt', 'DESC']]
    });

    ok(res, jobs);
  })
);

// Approve and ingest an incoming job
router.post(
  '/:id/approve',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const id = req.params.id;

    const incoming = await models.IncomingJob.findOne({
      where: { id, user_id: userId }
    });

    if (!incoming) {
      throw new AppError(404, 'INCOMING_JOB_NOT_FOUND', 'Incoming job posting not found.');
    }

    if (incoming.status !== 'pending_review') {
      throw new AppError(400, 'ALREADY_PROCESSED', 'This incoming job has already been processed.');
    }

    // Ingest job using the existing JobIngestionService
    // req.body contains the reviewed/edited fields (title, companyName, description, location, etc.)
    const result = await ingestJob(userId, {
      title: req.body.title || incoming.parsedData?.title || 'Unknown Role',
      companyName: req.body.companyName || incoming.parsedData?.companyName || 'Unknown Company',
      location: req.body.location || incoming.parsedData?.location || 'Remote',
      url: req.body.jobUrl || req.body.url || incoming.parsedData?.jobUrl || '',
      description: req.body.description || incoming.rawText,
      source: 'telegram_bot',
      provider: 'telegram',
      sourceJobId: incoming.telegramMessageId || incoming.id,
      employmentType: req.body.employmentType || incoming.parsedData?.employmentType || null,
      remoteType: req.body.remoteType || incoming.parsedData?.remoteType || null,
      experienceLevel: req.body.experienceLevel || incoming.parsedData?.experienceLevel || null,
      skills: req.body.skills || incoming.parsedData?.skills || []
    });

    // Update incoming job status to approved
    await incoming.update({
      status: 'approved',
      parsedData: {
        ...(incoming.parsedData || {}),
        ...req.body
      },
      matchScore: result.job?.matchScore || incoming.matchScore
    });

    ok(res, { status: result.status, job: result.job });
  })
);

// Ignore an incoming job posting
router.post(
  '/:id/ignore',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const id = req.params.id;

    const incoming = await models.IncomingJob.findOne({
      where: { id, user_id: userId }
    });

    if (!incoming) {
      throw new AppError(404, 'INCOMING_JOB_NOT_FOUND', 'Incoming job posting not found.');
    }

    await incoming.update({
      status: 'ignored'
    });

    ok(res, { ignored: true });
  })
);

export default router;
