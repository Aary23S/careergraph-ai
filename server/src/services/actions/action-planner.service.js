import { ActionModel } from './action.model.js';
import { ActionValidator } from './action-validator.js';
import { ActionStatuses } from './action-registry.js';

export class ActionPlanner {
  /**
   * Plans a new action, validates it, and returns a pending action object.
   * Does NOT mutate any databases or execute the action.
   * 
   * @param {Object} params
   * @param {string} params.userId - User requesting the action
   * @param {string} params.actionType - Type of action
   * @param {Object} params.target - Target {type, id}
   * @param {Object} [params.payload] - Action payload
   * @param {string} [params.reason] - Reasoning behind proposing the action
   * @param {string} params.requestId - Correlation ID for the request
   * @returns {ActionModel} - The planned pending action
   */
  static planAction({ userId, actionType, target, payload = {}, reason = '', requestId }) {
    if (!userId) throw new Error('userId is required');
    if (!requestId) throw new Error('requestId is required');

    // Extract strictly the known fields to prevent unknown field injections
    const sanitizedParams = {
      userId,
      actionType,
      target: {
        type: target?.type,
        id: target?.id
      },
      payload: typeof payload === 'object' && payload !== null && !Array.isArray(payload) ? payload : {},
      reason: typeof reason === 'string' ? reason : '',
      requestId,
      status: ActionStatuses.PENDING_CONFIRMATION
    };

    // Create the action model instance
    // It defaults to PENDING_CONFIRMATION status and assigns expiration/actionId
    const action = new ActionModel(sanitizedParams);

    // Validate the resulting contract
    ActionValidator.validateActionContract(action);

    return action;
  }
}
