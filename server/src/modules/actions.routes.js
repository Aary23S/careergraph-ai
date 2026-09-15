import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ActionModel } from '../services/actions/action.model.js';
import { ActionValidator } from '../services/actions/action-validator.js';
import { ActionConfirmationService } from '../services/actions/action-confirmation.service.js';

const router = express.Router();

/**
 * Reconstructs and validates the ActionModel from the request body.
 */
function parseActionFromRequest(req) {
  const { action } = req.body;
  if (!action || typeof action !== 'object') {
    throw new Error('Request body must contain an "action" object.');
  }

  // Enforce route param matches body param
  if (action.actionId !== req.params.actionId) {
    throw new Error('Action ID in payload does not match route parameter.');
  }

  // Reconstruct ActionModel
  const actionModel = new ActionModel({
    actionId: action.actionId,
    actionType: action.actionType,
    userId: action.userId,
    target: action.target,
    payload: action.payload,
    reason: action.reason,
    requestId: action.requestId,
    status: action.status,
    createdAt: action.createdAt,
    expiresAt: action.expiresAt
  });

  // Re-validate the contract to ensure UI didn't tamper with structural limits
  ActionValidator.validateActionContract(actionModel);

  return actionModel;
}

/**
 * POST /api/actions/:actionId/confirm
 * Confirms a pending action plan.
 */
router.post('/:actionId/confirm', requireAuth, async (req, res, next) => {
  try {
    const authenticatedUserId = req.user.id;
    const actionModel = parseActionFromRequest(req);
    const requestId = req.headers['x-request-id'] || 'req-api-confirm';

    const result = await ActionConfirmationService.confirmAction({
      action: actionModel,
      authenticatedUserId,
      requestId
    });

    res.status(200).json(result);
  } catch (err) {
    if (err.name === 'ActionValidationError' || err.message.includes('Unauthorized') || err.message.includes('expired')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/actions/:actionId/cancel
 * Cancels a pending action plan.
 */
router.post('/:actionId/cancel', requireAuth, async (req, res, next) => {
  try {
    const authenticatedUserId = req.user.id;
    const actionModel = parseActionFromRequest(req);
    const requestId = req.headers['x-request-id'] || 'req-api-cancel';

    const result = await ActionConfirmationService.cancelAction({
      action: actionModel,
      authenticatedUserId,
      requestId
    });

    res.status(200).json(result);
  } catch (err) {
    if (err.name === 'ActionValidationError' || err.message.includes('Unauthorized') || err.message.includes('expired')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

export default router;
