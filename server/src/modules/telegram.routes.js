import { Router } from 'express';
import { ok, asyncHandler, AppError } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { models } from '../config/database.js';
import { env } from '../config/env.js';
import { telegramLinkingCodes } from '../services/telegram.service.js';

const router = Router();

// Generate a one-time linking code for the user
router.get(
  '/link',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth.userId;

    // Generate random 6-character alphanumeric code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'CG-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Cache linking code in memory (expires in 10 minutes)
    telegramLinkingCodes.set(code, {
      userId,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    ok(res, { code, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
  })
);

// Fetch Telegram integration status and counts
router.get(
  '/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth.userId;

    const integration = await models.TelegramIntegration.findOne({
      where: { user_id: userId }
    });

    if (!integration) {
      return ok(res, { connected: false, botUsername: env.telegramBotUsername || 'CareerGraphJobBot' });
    }

    // Fetch stats of received messages
    const receivedCount = await models.IncomingJob.count({ where: { user_id: userId } });
    const approvedCount = await models.IncomingJob.count({ where: { user_id: userId, status: 'approved' } });
    const ignoredCount = await models.IncomingJob.count({ where: { user_id: userId, status: 'ignored' } });
    const pendingCount = await models.IncomingJob.count({ where: { user_id: userId, status: 'pending_review' } });

    ok(res, {
      connected: true,
      botUsername: env.telegramBotUsername || 'CareerGraphJobBot',
      telegramUsername: integration.telegramUsername || null,
      telegramUserId: integration.telegramUserId,
      linkedAt: integration.linkedAt,
      stats: {
        received: receivedCount,
        jobsCreated: approvedCount,
        duplicates: receivedCount - approvedCount - ignoredCount - pendingCount, // Quick heuristic for duplicate hits
        pendingReview: pendingCount
      }
    });
  })
);

// Disconnect Telegram account
router.post(
  '/disconnect',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth.userId;

    await models.TelegramIntegration.destroy({
      where: { user_id: userId }
    });

    ok(res, { disconnected: true });
  })
);

export default router;
