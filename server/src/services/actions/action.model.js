import crypto from 'crypto';
import { ActionStatuses, ActionConfig } from './action-registry.js';

/**
 * In-memory representation of a Workflow Action.
 * For H7-A, this is a POJO representing the Action Contract.
 */
export class ActionModel {
  /**
   * Creates a new action instance.
   * @param {Object} params
   * @param {string} params.actionType
   * @param {string} params.userId
   * @param {Object} params.target
   * @param {string} params.target.type
   * @param {string} params.target.id
   * @param {Object} [params.payload]
   * @param {string} [params.reason]
   * @param {string} params.requestId
   * @param {string} [params.status]
   * @param {number} [params.expirationMs]
   */
  constructor({
    actionType,
    userId,
    target,
    payload = {},
    reason = '',
    requestId,
    status = ActionStatuses.PENDING_CONFIRMATION,
    expirationMs = ActionConfig.DEFAULT_EXPIRATION_MS
  }) {
    this.actionId = crypto.randomUUID();
    this.actionType = actionType;
    this.status = status;
    this.userId = userId;
    this.target = {
      type: target?.type,
      id: target?.id
    };
    this.payload = payload;
    this.reason = reason;
    this.requestId = requestId;
    this.createdAt = new Date();
    this.expiresAt = new Date(this.createdAt.getTime() + expirationMs);

    // Freeze security fields to prevent mutation
    Object.defineProperty(this, 'actionId', { writable: false, configurable: false });
    Object.defineProperty(this, 'userId', { writable: false, configurable: false });
    Object.defineProperty(this, 'requestId', { writable: false, configurable: false });
    Object.defineProperty(this, 'createdAt', { writable: false, configurable: false });
  }

  /**
   * Serializes the action to a plain object.
   * @returns {Object}
   */
  toJSON() {
    return {
      actionId: this.actionId,
      actionType: this.actionType,
      status: this.status,
      userId: this.userId,
      target: this.target,
      payload: this.payload,
      reason: this.reason,
      requestId: this.requestId,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt
    };
  }
}
