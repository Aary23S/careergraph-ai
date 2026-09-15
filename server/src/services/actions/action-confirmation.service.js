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
    if (!action || !(action instanceof ActionModel)) {
      throw new ActionValidationError('Action must be a valid ActionModel instance.');
    }

    if (!authenticatedUserId) {
      throw new Error('Unauthenticated user.');
    }

    // 1. Enforce Ownership
    if (action.userId !== authenticatedUserId) {
      throw new Error('Unauthorized: You cannot transition an action belonging to another user.');
    }

    // 2. Enforce Expiration
    if (action.expiresAt < new Date()) {
      throw new ActionValidationError('This action has expired and can no longer be transitioned.');
    }

    // 3. Atomicity & Idempotency Check
    const currentTrackedStatus = await this._getTrackedStatus(action.actionId);
    
    // If we've already tracked a transition for this action, it's either idempotent success or an invalid state race
    if (currentTrackedStatus) {
      if (currentTrackedStatus === targetStatus) {
        // Idempotent duplicate request
        return {
          actionId: action.actionId,
          status: currentTrackedStatus,
          userId: action.userId,
          message: 'Idempotent success: already in requested state.',
          transitionedAt: new Date()
        };
      } else {
        // A transition already happened to a different state (e.g. Cancelled, then user tries to Confirm)
        throw new ActionValidationError(`Invalid transition: Action is already in state '${currentTrackedStatus}'.`);
      }
    }

    // 4. Validate State Transition (PENDING -> target)
    const allowedTargets = ValidTransitions[action.status] || [];
    if (!allowedTargets.includes(targetStatus)) {
      throw new ActionValidationError(`Invalid transition from ${action.status} to ${targetStatus}.`);
    }

    // 5. Commit Transition
    await this._setTrackedStatus(action.actionId, targetStatus);
    action.status = targetStatus;

    return {
      actionId: action.actionId,
      status: targetStatus,
      userId: action.userId,
      transitionedAt: new Date()
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
