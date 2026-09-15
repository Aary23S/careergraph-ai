import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ContextBuilder } from '../services/copilot/context/context-builder.service.js';
import { ReferralPathAgentService } from '../services/copilot/referral-path-agent.service.js';
import { AppError } from '../lib/http.js';
import { getContextPolicy } from '../services/copilot/context/context-policy.service.js';
import { MatchExplainerService } from '../services/copilot/match-explainer.service.js';
import { DecisionDigestService } from '../services/copilot/decision-digest.service.js';
import { CopilotChatService } from '../services/copilot/copilot-chat.service.js';

const router = Router();

// Secure all copilot endpoints
router.use(requireAuth);

/**
 * @route POST /api/copilot/context
 * @desc Retrieves sanitized, authorized context for LLM reasoning.
 * @access Private
 */
router.post('/context', async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const { intent, jobId, connectionId, applicationId, query } = req.body;

    if (!intent) {
      throw new AppError(400, 'BAD_REQUEST', 'Intent is required.');
    }

    try {
      // Validate intent exists
      getContextPolicy(intent);
    } catch (e) {
      throw new AppError(400, 'BAD_REQUEST', e.message);
    }

    const contextPackage = await ContextBuilder.buildContext(userId, {
      intent,
      jobId,
      connectionId,
      applicationId,
      query
    });

    res.json(contextPackage);
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/copilot/referral-path
 * @desc Executes Referral Path Agent to recommend contacts and draft outreach for a job.
 * @access Private
 */
router.post('/referral-path', async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const { jobId, query } = req.body;

    if (!jobId) {
      throw new AppError(400, 'BAD_REQUEST', 'jobId is required.');
    }

    const result = await ReferralPathAgentService.findReferralPath({
      userId,
      jobId,
      query
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/match-explanation', async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const { jobId, query } = req.body;

    if (!jobId) {
      throw new AppError(400, 'BAD_REQUEST', 'jobId is required.');
    }

    const result = await MatchExplainerService.explainMatch({
      userId,
      jobId,
      query
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/decision-digest', async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const { date, query } = req.body;

    const result = await DecisionDigestService.generateDigest({
      userId,
      date,
      query
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/copilot/chat
 * @desc Conversational orchestration endpoint routing across CareerGraph capabilities.
 * @access Private
 */
router.post('/chat', async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const { message, messages, context } = req.body;

    const result = await CopilotChatService.sendChat({
      userId,
      message,
      messages,
      context
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

