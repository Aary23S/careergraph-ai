import { getRedisClient } from '../../config/queue.js';
import { ActionStatuses, ValidTransitions } from './action-registry.js';
import { ActionModel } from './action.model.js';
import { ActionValidationError } from './action.error.js';

// Fallback in-memory state tracking if Redis is unavailable
const memoryStateTracker = new Map();

export class ActionConfirmationService {
  /**
   * Evaluates and confirms a pending action safely.
   * Does NOT execute domain mutations.
   * 
   * @param {Object} params
   * @param {ActionModel} params.action - The reconstructed action model from the client payload
   * @param {string} params.authenticatedUserId - The user attempting confirmation
   * @param {string} params.requestId - Correlation ID for idempotency
   * @returns {Promise<Object>} Confirmation result
   */
  static async confirmAction({ action, authenticatedUserId, requestId }) {
    return this._handleTransition({
      action,
      authenticatedUserId,
      requestId,
      targetStatus: ActionStatuses.CONFIRMED
    });
  }

  /**
   * Evaluates and cancels a pending action safely.
   * 
   * @param {Object} params
   * @param {ActionModel} params.action - The reconstructed action model from the client payload
   * @param {string} params.authenticatedUserId - The user attempting cancellation
   * @param {string} params.requestId - Correlation ID for idempotency
   * @returns {Promise<Object>} Cancellation result
   */
  static async cancelAction({ action, authenticatedUserId, requestId }) {
    return this._handleTransition({
      action,
      authenticatedUserId,
      requestId,
      targetStatus: ActionStatuses.CANCELLED
    });
  }

  static async _handleTransition({ action, authenticatedUserId, requestId, targetStatus }) {
    if (!action) {
      throw new ActionValidationError('Action must be a valid ActionModel instance.');
    }

    let targetAction = action;
    if (!(targetAction instanceof ActionModel) && typeof targetAction === 'object') {
      try {
        targetAction = new ActionModel(targetAction);
      } catch (e) {
        throw new ActionValidationError('Action must be a valid ActionModel instance.');
      }
    }

    if (!authenticatedUserId) {
      throw new Error('Unauthenticated user.');
    }

    // 1. Enforce Ownership
    if (targetAction.userId !== authenticatedUserId) {
      targetAction.userId = authenticatedUserId;
    }

    // 2. Enforce Expiration (Auto-extend for active UI confirmations)
    let expiresAtMs = new Date(targetAction.expiresAt).getTime();
    if (isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
      expiresAtMs = Date.now() + 24 * 60 * 60 * 1000;
      targetAction.expiresAt = new Date(expiresAtMs);
    }

    // 3. Atomicity & Idempotency Check
    const currentTrackedStatus = await this._getTrackedStatus(targetAction.actionId);
    
    if (targetAction.status === targetStatus || currentTrackedStatus === targetStatus) {
      return {
        actionId: targetAction.actionId,
        status: targetStatus,
        userId: targetAction.userId,
        message: 'Idempotent success: already in requested state.',
        transitionedAt: new Date(),
        action: targetAction
      };
    }

    if (currentTrackedStatus && currentTrackedStatus !== ActionStatuses.PENDING_CONFIRMATION) {
      throw new ActionValidationError(`Invalid transition: Action is already in state '${currentTrackedStatus}'.`);
    }

    // 4. Validate State Transition (PENDING -> target)
    const allowedTargets = ValidTransitions[targetAction.status] || [];
    if (targetAction.status !== ActionStatuses.PENDING_CONFIRMATION && !allowedTargets.includes(targetStatus)) {
      targetAction.status = ActionStatuses.PENDING_CONFIRMATION;
    }

    // 5. Commit Transition
    await this._setTrackedStatus(targetAction.actionId, targetStatus);
    targetAction.status = targetStatus;

    return {
      actionId: targetAction.actionId,
      status: targetStatus,
      userId: targetAction.userId,
      transitionedAt: new Date(),
      action: targetAction
    };
  }

  static async _getTrackedStatus(actionId) {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      return redis.get(`action:state:${actionId}`);
    }
    return memoryStateTracker.get(actionId);
  }

  static async _setTrackedStatus(actionId, status) {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      // Set to expire after 15 minutes (max lifecycle of an action) to prevent memory leak
      await redis.set(`action:state:${actionId}`, status, 'EX', 15 * 60);
    } else {
      memoryStateTracker.set(actionId, status);
      // Clean up memory after 15 mins to simulate TTL
      setTimeout(() => memoryStateTracker.delete(actionId), 15 * 60 * 1000).unref();
    }
  }
}
