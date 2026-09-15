import { ActionTypes, TargetTypes, ActionStatuses, ActionRegistryMap, ValidTransitions } from './action-registry.js';

export class ActionValidator {
  
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
   * Validates the structure and data of an action contract
   * @param {Object} actionData 
   * @throws {Error} If validation fails
   */
  static validateActionContract(actionData) {
    if (!actionData) throw new Error('Action data is required');
    if (!actionData.actionId) throw new Error('actionId is required');
    if (!actionData.requestId) throw new Error('requestId is required');
    
    if (!actionData.actionType || !this.isValidActionType(actionData.actionType)) {
      throw new Error(`Invalid or missing actionType: ${actionData.actionType}`);
    }

    if (!actionData.status || !Object.values(ActionStatuses).includes(actionData.status)) {
      throw new Error(`Invalid or missing status: ${actionData.status}`);
    }

    if (!actionData.userId) {
      throw new Error('userId is required');
    }

    if (!actionData.target || !actionData.target.type || !actionData.target.id) {
      throw new Error('target must include type and id');
    }

    if (!this.isValidTargetType(actionData.target.type)) {
      throw new Error(`Invalid target type: ${actionData.target.type}`);
    }

    if (!this.isTargetValidForAction(actionData.actionType, actionData.target.type)) {
      throw new Error(`Target type ${actionData.target.type} is not valid for action ${actionData.actionType}`);
    }

    if (!actionData.createdAt || !(actionData.createdAt instanceof Date)) {
      throw new Error('createdAt must be a valid Date');
    }

    if (!actionData.expiresAt || !(actionData.expiresAt instanceof Date)) {
      throw new Error('expiresAt must be a valid Date');
    }
  }
}
