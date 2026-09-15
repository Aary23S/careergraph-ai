import { ActionTypes } from './action-registry.js';

export class IntentMapper {
  /**
   * Deterministically maps a natural language intent or structured intent string to a formal ActionType.
   * If mapping fails, returns null.
   * 
   * @param {string} rawIntent - The parsed intent string from the LLM or user keyword
   * @returns {string|null} The ActionType, or null if unmapped
   */
  static mapIntentToActionType(rawIntent) {
    if (!rawIntent || typeof rawIntent !== 'string') return null;

    const normalized = rawIntent.toLowerCase().trim();

    // Direct matches
    if (Object.values(ActionTypes).includes(normalized)) {
      return normalized;
    }

    // Heuristics mapping
    if (/\b(change.*application.*status|update.*application|mark.*application|move.*application)\b/i.test(normalized)) {
      return ActionTypes.CHANGE_APPLICATION_STATUS;
    }
    if (/\b(save.*job|bookmark.*job|track.*job)\b/i.test(normalized)) {
      return ActionTypes.SAVE_JOB;
    }
    if (/\b(change.*job.*status|mark.*job|move.*job|mark.*interested|mark.*rejected|move.*pipeline|update.*status)\b/i.test(normalized)) {
      return ActionTypes.CHANGE_JOB_STATUS;
    }
    if (/\b(apply|create.*application|log.*application)\b/i.test(normalized)) {
      return ActionTypes.CREATE_APPLICATION;
    }
    if (/\b(remind.*follow.*up|schedule.*follow.*up|follow.*up)\b/i.test(normalized)) {
      return ActionTypes.SCHEDULE_FOLLOWUP;
    }
    if (/\b(log.*outreach|record.*outreach|contacted|log.*contact)\b/i.test(normalized)) {
      return ActionTypes.LOG_OUTREACH;
    }
    if (/\b(update.*relationship|change.*relationship|mark.*contacted|mark.*relationship)\b/i.test(normalized)) {
      return ActionTypes.UPDATE_RELATIONSHIP_STATUS;
    }
    if (/\b(draft.*message|draft.*outreach|write.*email|prepare.*outreach|referral.*request)\b/i.test(normalized)) {
      return ActionTypes.CREATE_OUTREACH_DRAFT;
    }
    if (/\b(add.*note|write.*note|log.*note)\b/i.test(normalized)) {
      return ActionTypes.ADD_NOTE;
    }

    return null;
  }

  /**
   * Helps determine if an intent is missing critical information required to proceed.
   */
  static analyzeCompleteness(actionType, targetId, payload) {
    if (!actionType) return { complete: false, missing: 'intent' };
    if (!targetId) return { complete: false, missing: 'target' };

    switch (actionType) {
      case ActionTypes.CHANGE_JOB_STATUS:
      case ActionTypes.CHANGE_APPLICATION_STATUS:
        if (!payload || !payload.status) return { complete: false, missing: 'payload.status' };
        break;
      case ActionTypes.LOG_OUTREACH:
        if (!payload || (!payload.outreachStatus && !payload.status)) return { complete: false, missing: 'payload.outreachStatus' };
        break;
      case ActionTypes.UPDATE_RELATIONSHIP_STATUS:
        if (!payload || (!payload.relationshipStatus && !payload.status)) return { complete: false, missing: 'payload.relationshipStatus' };
        break;
      case ActionTypes.SCHEDULE_FOLLOWUP:
        if (!payload || !payload.followUpAt) return { complete: false, missing: 'payload.followUpAt' };
        break;
      case ActionTypes.ADD_NOTE:
        if (!payload || !payload.content) return { complete: false, missing: 'payload.content' };
        break;
    }

    return { complete: true };
  }
}
