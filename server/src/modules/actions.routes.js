import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ActionModel } from '../services/actions/action.model.js';
import { ActionValidator } from '../services/actions/action-validator.js';
import { ActionConfirmationService } from '../services/actions/action-confirmation.service.js';
import { ActionExecutor } from '../services/actions/action-executor.service.js';

const router = express.Router();

/**
 * Reconstructs and validates the ActionModel from the request body.
 * Ensures structural limits and immutability rules.
 */
function parseActionFromRequest(req) {
  let action = req.body?.action || req.body;
  if (!action || typeof action !== 'object') {
    throw new ActionValidationError('Request body must contain an "action" object.');
  }

  // Handle nested .action properties from ActionPlan JSON wraps
  while (action && typeof action === 'object' && action.action && typeof action.action === 'object') {
    action = action.action;
  }

  const actionId = req.params.actionId || action.actionId || `act-${Date.now()}`;
  const requestId = String(req.headers['x-request-id'] || action.requestId || `req-${actionId}`);
  // Authentication middleware owns the actor identity. Never trust an action
  // payload to select the tenant that will confirm or execute it.
  const userId = String(req.auth?.userId || action.userId || 'system');

  let actionType = action.actionType;
  if (!ActionValidator.isValidActionType(actionType)) {
    actionType = 'create_outreach_draft';
  }

  // Normalize target object
  let targetType = 'connection';
  let targetId = 'system';
  if (action.target) {
    if (typeof action.target === 'string') {
      const parts = action.target.split(':');
      targetType = parts[0] || 'connection';
      targetId = parts[1] || 'system';
    } else if (typeof action.target === 'object') {
      targetType = action.target.type || 'connection';
      targetId = action.target.id || 'system';
    }
  }

  // Normalize payload object
  const payload = (typeof action.payload === 'object' && action.payload !== null && !Array.isArray(action.payload))
    ? { ...action.payload }
    : {};

  if (actionType === 'log_outreach' && !payload.outreachStatus && !payload.status) {
    payload.outreachStatus = 'contacted';
  }
  if (actionType === 'update_relationship_status' && !payload.relationshipStatus && !payload.status) {
    payload.relationshipStatus = 'contacted';
  }
  if (actionType === 'change_job_status' && !payload.status) {
    payload.status = 'bookmarked';
  }
  if (actionType === 'change_application_status' && !payload.status) {
    payload.status = 'applied';
  }
  if (actionType === 'schedule_followup' && !payload.followUpAt) {
    payload.followUpAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (actionType === 'add_note' && !payload.content) {
    payload.content = 'Note created via AI Copilot';
  }

  const createdAt = action.createdAt ? new Date(action.createdAt) : new Date();
  let expiresAt = action.expiresAt ? new Date(action.expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  // Reconstruct ActionModel securely
  const actionModel = new ActionModel({
    actionId: actionId,
    actionType: actionType,
    userId: userId,
    target: { type: targetType, id: targetId },
    payload: payload,
    reason: action.reason || 'Action requested via Copilot',
    requestId: requestId,
    status: action.status || 'pending_confirmation',
    createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt,
    expiresAt: expiresAt
  });

  // Re-validate contract integrity
  ActionValidator.validateActionContract(actionModel);

  return actionModel;
}

/**
 * POST /api/actions/:actionId/confirm
 * Confirms a pending action plan.
 */
router.post('/:actionId/confirm', requireAuth, async (req, res, next) => {
  try {
    const authenticatedUserId = String(req.auth.userId);
    const actionModel = parseActionFromRequest(req);
    const requestId = req.headers['x-request-id'] || 'req-api-confirm';

    const result = await ActionConfirmationService.confirmAction({
      action: actionModel,
      authenticatedUserId,
      requestId
    });

    res.status(200).json(result);
  } catch (err) {
    console.error('[ActionsRoute] Confirm error:', err.message, err.stack);
    return res.status(400).json({ error: err.message || 'Action confirmation failed.' });
  }
});

/**
 * POST /api/actions/:actionId/cancel
 * Cancels a pending action plan.
 */
router.post('/:actionId/cancel', requireAuth, async (req, res, next) => {
  try {
    const authenticatedUserId = String(req.auth.userId);
    const actionModel = parseActionFromRequest(req);
    const requestId = req.headers['x-request-id'] || 'req-api-cancel';

    const result = await ActionConfirmationService.cancelAction({
      action: actionModel,
      authenticatedUserId,
      requestId
    });

    res.status(200).json(result);
  } catch (err) {
    console.error('[ActionsRoute] Cancel error:', err.message, err.stack);
    return res.status(400).json({ error: err.message || 'Action cancellation failed.' });
  }
});

/**
 * POST /api/actions/:actionId/execute
 * Executes a confirmed action plan against domain services and database models.
 */
router.post('/:actionId/execute', requireAuth, async (req, res, next) => {
  try {
    const authenticatedUserId = String(req.auth.userId);
    const actionModel = parseActionFromRequest(req);
    const requestId = req.headers['x-request-id'] || req.body.action?.requestId || 'req-api-execute';

    const result = await ActionExecutor.executeAction({
      action: actionModel,
      authenticatedUserId,
      requestId
    });

    res.status(200).json(result);
  } catch (err) {
    console.error('[ActionsRoute] Execute error:', err.message, err.stack);
    return res.status(400).json({ error: err.message || 'Action execution failed.' });
  }
});

export default router;
