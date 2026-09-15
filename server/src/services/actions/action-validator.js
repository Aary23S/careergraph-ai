import { ActionTypes, TargetTypes, ActionStatuses, ActionRegistryMap, ValidTransitions, JOB_STATUSES, APPLICATION_STATUSES } from './action-registry.js';
import { ActionValidationError } from './action.error.js';

export class ActionValidator {

  static LIMITS = {
    MAX_REASON_LENGTH: 1000,
    MAX_REQUEST_ID_LENGTH: 100,
    MAX_TARGET_ID_LENGTH: 100,
    MAX_PAYLOAD_NOTE_LENGTH: 2000
  };

  /**
   * Validates an action type
   * @param {string} actionType 
   * @returns {boolean}
   */
  static isValidActionType(actionType) {
    return Object.values(ActionTypes).includes(actionType);
  }

  /**
   * Validates a target type
   * @param {string} targetType 
   * @returns {boolean}
   */
  static isValidTargetType(targetType) {
    return Object.values(TargetTypes).includes(targetType);
  }

  /**
   * Validates if a target type is valid for the given action type
   * @param {string} actionType 
   * @param {string} targetType 
   * @returns {boolean}
   */
  static isTargetValidForAction(actionType, targetType) {
    if (!this.isValidActionType(actionType)) return false;
    
    const registryEntry = ActionRegistryMap[actionType];
    if (!registryEntry) return false;

    const validTargetTypes = Array.isArray(registryEntry.targetType) 
      ? registryEntry.targetType 
      : [registryEntry.targetType];

    return validTargetTypes.includes(targetType);
  }

  /**
   * Validates a status transition
   * @param {string} currentStatus 
   * @param {string} nextStatus 
   * @returns {boolean}
   */
  static isValidTransition(currentStatus, nextStatus) {
    const validTargets = ValidTransitions[currentStatus];
    if (!validTargets) return false;
    return validTargets.includes(nextStatus);
  }

  /**
   * Strict validation for payload shapes based on action type
   * @param {string} actionType 
   * @param {Object} payload 
   */
  static validatePayloadSchema(actionType, payload) {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      throw new ActionValidationError('Payload must be a strict object.', 'INVALID_PAYLOAD_TYPE');
    }

    switch (actionType) {
      case ActionTypes.SAVE_JOB:
      case ActionTypes.CREATE_APPLICATION:
      case ActionTypes.CREATE_OUTREACH_DRAFT:
        break;

      case ActionTypes.CHANGE_JOB_STATUS:
        if (typeof payload.status !== 'string' || !payload.status.trim()) {
          throw new ActionValidationError('change_job_status payload must contain a valid "status" string.', 'INVALID_PAYLOAD');
        }
        if (!JOB_STATUSES.includes(payload.status.trim())) {
          throw new ActionValidationError(`Invalid job status '${payload.status}'. Supported statuses are: ${JOB_STATUSES.join(', ')}.`, 'INVALID_JOB_STATUS');
        }
        break;

      case ActionTypes.CHANGE_APPLICATION_STATUS:
        if (typeof payload.status !== 'string' || !payload.status.trim()) {
          throw new ActionValidationError('change_application_status payload must contain a valid "status" string.', 'INVALID_PAYLOAD');
        }
        if (!APPLICATION_STATUSES.includes(payload.status.trim())) {
          throw new ActionValidationError(`Invalid application status '${payload.status}'. Supported statuses are: ${APPLICATION_STATUSES.join(', ')}.`, 'INVALID_APPLICATION_STATUS');
        }
        break;

      case ActionTypes.SCHEDULE_FOLLOWUP: {
        if (!payload.followUpAt) {
          throw new ActionValidationError('schedule_followup payload must contain "followUpAt".', 'INVALID_PAYLOAD');
        }
        const dateObj = new Date(payload.followUpAt);
        if (isNaN(dateObj.getTime())) {
          throw new ActionValidationError('followUpAt must be a valid date.', 'INVALID_PAYLOAD_DATE');
        }
        break;
      }

      case ActionTypes.ADD_NOTE:
        if (typeof payload.content !== 'string' || !payload.content.trim()) {
          throw new ActionValidationError('add_note payload must contain a non-empty "content" string.', 'INVALID_PAYLOAD');
        }
        if (payload.content.length > this.LIMITS.MAX_PAYLOAD_NOTE_LENGTH) {
          throw new ActionValidationError(`Note content exceeds maximum length of ${this.LIMITS.MAX_PAYLOAD_NOTE_LENGTH}.`, 'PAYLOAD_TOO_LARGE');
        }
        break;

      default:
        break;
    }
  }

  /**
   * Validates the structure and data of an action contract
   * @param {Object} actionData 
   * @throws {ActionValidationError} If validation fails
   */
  static validateActionContract(actionData) {
    if (typeof actionData !== 'object' || actionData === null || Array.isArray(actionData)) {
      throw new ActionValidationError('Action data must be an object.', 'INVALID_ACTION_SHAPE');
    }

    if (typeof actionData.actionId !== 'string' || !actionData.actionId.trim()) {
      throw new ActionValidationError('actionId is required and must be a string.', 'MISSING_ACTION_ID');
    }

    if (typeof actionData.requestId !== 'string' || !actionData.requestId.trim()) {
      throw new ActionValidationError('requestId is required and must be a string.', 'MISSING_REQUEST_ID');
    }
    if (actionData.requestId.length > this.LIMITS.MAX_REQUEST_ID_LENGTH) {
      throw new ActionValidationError(`requestId exceeds max length of ${this.LIMITS.MAX_REQUEST_ID_LENGTH}.`, 'REQUEST_ID_TOO_LARGE');
    }
    
    if (!actionData.actionType || typeof actionData.actionType !== 'string' || !this.isValidActionType(actionData.actionType)) {
      throw new ActionValidationError(`Invalid or missing actionType: ${actionData.actionType}`, 'INVALID_ACTION_TYPE');
    }

    if (!actionData.status || typeof actionData.status !== 'string' || !Object.values(ActionStatuses).includes(actionData.status)) {
      throw new ActionValidationError(`Invalid or missing status: ${actionData.status}`, 'INVALID_STATUS');
    }

    if (typeof actionData.userId !== 'string' || !actionData.userId.trim()) {
      throw new ActionValidationError('userId is required and must be a string.', 'MISSING_USER_ID');
    }

    // Target Validation
    if (typeof actionData.target !== 'object' || actionData.target === null || Array.isArray(actionData.target)) {
      throw new ActionValidationError('target must be an object containing type and id.', 'INVALID_TARGET_SHAPE');
    }

    if (typeof actionData.target.type !== 'string' || typeof actionData.target.id !== 'string' || !actionData.target.id.trim()) {
      throw new ActionValidationError('target must include valid string type and non-empty string id.', 'INVALID_TARGET_FIELDS');
    }

    if (actionData.target.id.length > this.LIMITS.MAX_TARGET_ID_LENGTH) {
      throw new ActionValidationError(`target id exceeds max length of ${this.LIMITS.MAX_TARGET_ID_LENGTH}.`, 'TARGET_ID_TOO_LARGE');
    }

    if (!this.isValidTargetType(actionData.target.type)) {
      throw new ActionValidationError(`Invalid target type: ${actionData.target.type}`, 'INVALID_TARGET_TYPE');
    }

    if (!this.isTargetValidForAction(actionData.actionType, actionData.target.type)) {
      throw new ActionValidationError(`Target type ${actionData.target.type} is not valid for action ${actionData.actionType}`, 'INCOMPATIBLE_TARGET');
    }

    // Payload Validation
    if (actionData.payload !== undefined) {
      this.validatePayloadSchema(actionData.actionType, actionData.payload);
    }

    // Reason Validation
    if (actionData.reason !== undefined && actionData.reason !== null) {
      if (typeof actionData.reason !== 'string') {
        throw new ActionValidationError('reason must be a string.', 'INVALID_REASON');
      }
      if (actionData.reason.length > this.LIMITS.MAX_REASON_LENGTH) {
        throw new ActionValidationError(`reason exceeds max length of ${this.LIMITS.MAX_REASON_LENGTH}.`, 'REASON_TOO_LARGE');
      }
    }

    // Date Validation
    if (!(actionData.createdAt instanceof Date) || isNaN(actionData.createdAt.getTime())) {
      throw new ActionValidationError('createdAt must be a valid Date object.', 'INVALID_CREATED_AT');
    }

    if (!(actionData.expiresAt instanceof Date) || isNaN(actionData.expiresAt.getTime())) {
      throw new ActionValidationError('expiresAt must be a valid Date object.', 'INVALID_EXPIRES_AT');
    }

    if (actionData.expiresAt.getTime() <= actionData.createdAt.getTime()) {
      throw new ActionValidationError('expiresAt must be strictly after createdAt.', 'EXPIRED_ON_ARRIVAL');
    }
  }
}
