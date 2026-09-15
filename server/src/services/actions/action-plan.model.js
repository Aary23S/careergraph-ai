import crypto from 'crypto';
import { ActionRegistryMap } from './action-registry.js';
import { ActionModel } from './action.model.js';

export class ActionPlan {
  /**
   * Constructs an ActionPlan which is a safe, previewable wrapper around a pending action.
   * @param {Object} params
   * @param {ActionModel} params.action - The validated pending action contract
   * @param {string} params.explanation - Human-readable explanation of why this was proposed
   * @param {Array<{type: string, id: string}>} [params.affectedEntities] - Entities that will be modified
   * @param {Object} [params.preview] - UI specific preview rendering hints
   */
  constructor({ action, explanation, affectedEntities = [], preview = {} }) {
    if (!(action instanceof ActionModel)) {
      throw new Error('ActionPlan requires a valid ActionModel instance.');
    }
    
    if (action.status !== 'pending_confirmation') {
      throw new Error('ActionPlan can only wrap actions that are pending confirmation.');
    }

    const registryMetadata = ActionRegistryMap[action.actionType];

    this.planId = crypto.randomUUID();
    this.action = action;
    this.explanation = explanation;
    this.risk = registryMetadata?.risk || 'UNKNOWN';
    this.requiresConfirmation = true;
    this.affectedEntities = affectedEntities.length ? affectedEntities : [action.target];
    
    // UI Preview data
    this.preview = {
      operation: registryMetadata?.description || 'Execute action',
      target: preview.target || `${action.target.type}:${action.target.id}`,
      ...preview
    };

    // Derived properties for UI convenience
    this.expiresAt = action.expiresAt;
    
    // Prevent modification of the core wrapper fields
    Object.defineProperty(this, 'planId', { writable: false, configurable: false });
    Object.defineProperty(this, 'requiresConfirmation', { writable: false, configurable: false });
  }

  toJSON() {
    return {
      planId: this.planId,
      action: this.action.toJSON(),
      preview: this.preview,
      explanation: this.explanation,
      risk: this.risk,
      requiresConfirmation: this.requiresConfirmation,
      affectedEntities: this.affectedEntities,
      expiresAt: this.expiresAt
    };
  }
}
