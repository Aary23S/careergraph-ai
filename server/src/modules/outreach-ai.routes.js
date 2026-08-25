import { Router } from 'express';
import Joi from 'joi';
import { models } from '../config/database.js';
import { AppError, asyncHandler, ok, created } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { generateOutreachDraft } from '../services/outreach-ai-draft.service.js';

const router = Router();

const generateSchema = Joi.object({
  jobId: Joi.string().uuid().optional().allow(null),
  connectionId: Joi.string().uuid().optional().allow(null),
  intent: Joi.string().valid(
    'referral_request',
    'guidance_request',
    'introduction',
    'networking',
    'follow_up',
    'thank_you'
  ).required(),
  tone: Joi.string().valid('professional', 'friendly', 'concise').required(),
  length: Joi.string().valid('short', 'medium').required(),
  forceGenerate: Joi.boolean().default(false)
});

const patchSchema = Joi.object({
  draft: Joi.string().required()
});

async function ensureDraftOwnership(userId, draftId) {
  const draft = await models.OutreachAiDraft.findOne({
    where: { id: draftId, user_id: userId }
  });
  if (!draft) {
    throw new AppError(404, 'DRAFT_NOT_FOUND', 'AI Draft not found.');
  }
  return draft;
}

router.use(requireAuth);

// Trigger or check warnings for AI outreach draft generation
router.post(
  '/generate',
  validate(generateSchema),
  asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const { jobId, connectionId, intent, tone, length, forceGenerate } = req.body;

    // Enforce authorization checks for job and connection
    if (jobId) {
      const job = await models.Job.findOne({ where: { id: jobId, user_id: userId } });
      if (!job) {
        throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found.');
      }
    }
    if (connectionId) {
      const connection = await models.Connection.findOne({ where: { id: connectionId, user_id: userId } });
      if (!connection) {
        throw new AppError(404, 'CONNECTION_NOT_FOUND', 'Connection not found.');
      }
    }

    try {
      const result = await generateOutreachDraft({
        userId,
        jobId,
        connectionId,
        intent,
        tone,
        length,
        forceGenerate
      });
      ok(res, result);
    } catch (err) {
      if (err.message === 'AI_PROVIDER_UNAVAILABLE') {
        res.status(503).json({
          success: false,
          code: 'AI_PROVIDER_UNAVAILABLE',
          message: 'AI draft generation is temporarily unavailable. You can still create outreach manually.'
        });
      } else {
        throw err;
      }
    }
  })
);

// Get details of a draft
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const draft = await ensureDraftOwnership(req.auth.userId, req.params.id);
    ok(res, { success: true, draft });
  })
);

// Edit an existing generated draft text
router.patch(
  '/:id',
  validate(patchSchema),
  asyncHandler(async (req, res) => {
    const draft = await ensureDraftOwnership(req.auth.userId, req.params.id);
    draft.draft = req.body.draft;
    draft.status = 'edited';
    await draft.save();

    ok(res, {
      success: true,
      draft: {
        id: draft.id,
        message: draft.draft,
        tone: draft.tone,
        personalizationPoints: draft.personalizationPoints || [],
        status: draft.status
      }
    });
  })
);

// Save generated AI draft to Outreach CRM
router.post(
  '/:id/save',
  asyncHandler(async (req, res) => {
    const draft = await ensureDraftOwnership(req.auth.userId, req.params.id);

    if (!draft.connectionId) {
      throw new AppError(400, 'MISSING_CONNECTION', 'Draft must be associated with a connection to save to CRM.');
    }

    // 1. Find or create actual Outreach log
    let outreach = await models.Outreach.findOne({
      where: { connection_id: draft.connectionId, user_id: req.auth.userId }
    });

    if (!outreach) {
      outreach = await models.Outreach.create({
        user_id: req.auth.userId,
        connection_id: draft.connectionId,
        status: 'contacted',
        contactDate: new Date(),
        jobId: draft.jobId || null
      });
    } else {
      // Update job context if not previously set
      if (!outreach.jobId && draft.jobId) {
        outreach.jobId = draft.jobId;
        await outreach.save();
      }
    }

    // 2. Create Note containing the outreach content
    const note = await models.Note.create({
      user_id: req.auth.userId,
      entityType: 'outreach',
      entityId: outreach.id,
      content: draft.draft
    });

    // 3. Log event history
    await models.OutreachEvent.create({
      outreach_id: outreach.id,
      user_id: req.auth.userId,
      status: outreach.status,
      notes: `AI outreach message saved.`,
      occurredAt: new Date(),
      eventType: 'status_changed'
    });

    // 4. Mark draft as saved
    draft.status = 'saved';
    await draft.save();

    ok(res, {
      success: true,
      outreach,
      note,
      draftStatus: draft.status
    });
  })
);

// Discard AI draft
router.post(
  '/:id/discard',
  asyncHandler(async (req, res) => {
    const draft = await ensureDraftOwnership(req.auth.userId, req.params.id);
    draft.status = 'discarded';
    await draft.save();

    ok(res, { success: true, status: draft.status });
  })
);

export default router;
