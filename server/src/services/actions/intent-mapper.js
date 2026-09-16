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
    if (/\b(update.*relationship|change.*relationship|mark.*contacted|mark.*relationship|mark.*conversation|set.*relationship|relationship.*status)\b/i.test(normalized)) {
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
   * Extracts initial payload attributes from natural language intent if not explicitly provided.
   */
  static extractPayloadFromIntent(actionType, rawIntent, existingPayload = {}) {
    const payload = { ...existingPayload };
    if (!rawIntent || typeof rawIntent !== 'string') return payload;

    const lower = rawIntent.toLowerCase();

    switch (actionType) {
      case ActionTypes.CHANGE_JOB_STATUS:
        if (!payload.status) {
          if (/\binterviewing\b/i.test(lower)) payload.status = 'interviewing';
          else if (/\boffer\b/i.test(lower)) payload.status = 'offer';
          else if (/\brejected\b/i.test(lower)) payload.status = 'rejected';
          else if (/\bapplied\b|\bapplying\b/i.test(lower)) payload.status = 'applied';
          else if (/\bsaved\b/i.test(lower)) payload.status = 'saved';
          else if (/\barchived\b/i.test(lower)) payload.status = 'archived';
        }
        break;

      case ActionTypes.CHANGE_APPLICATION_STATUS:
        if (!payload.status) {
          if (/\binterviewing\b/i.test(lower)) payload.status = 'interviewing';
          else if (/\boffer\b/i.test(lower)) payload.status = 'offer';
          else if (/\bscreening\b/i.test(lower)) payload.status = 'screening';
          else if (/\bapplied\b/i.test(lower)) payload.status = 'applied';
          else if (/\brejected\b/i.test(lower)) payload.status = 'rejected';
          else if (/\bwithdrawn\b/i.test(lower)) payload.status = 'withdrawn';
          else if (/\bdraft\b/i.test(lower)) payload.status = 'draft';
        }
        break;

      case ActionTypes.SCHEDULE_FOLLOWUP:
        if (!payload.followUpAt) {
          const dateMatch = rawIntent.match(/\b\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?\b/);
          if (dateMatch) {
            payload.followUpAt = dateMatch[0];
          } else {
            payload.followUpAt = new Date(Date.now() + 7 * 86400000).toISOString();
          }
        }
        break;

      case ActionTypes.ADD_NOTE:
        if (!payload.content) {
          let content = rawIntent.replace(/^(add a note that|add note that|add note|write a note that|write note|note that)\s*/i, '').trim();
          payload.content = content || rawIntent;
        }
        break;

      case ActionTypes.LOG_OUTREACH:
        if (!payload.outreachStatus && !payload.status) {
          if (/\bcontacted\b|\bmessaged\b|\bemailed\b|\bcalled\b/i.test(lower)) payload.outreachStatus = 'contacted';
          else if (/\breplied\b/i.test(lower)) payload.outreachStatus = 'replied';
          else if (/\bconversation\b/i.test(lower)) payload.outreachStatus = 'conversation';
          else payload.outreachStatus = 'contacted';
        }
        break;

      case ActionTypes.UPDATE_RELATIONSHIP_STATUS:
        if (!payload.relationshipStatus && !payload.status) {
          if (/\bconversation\b/i.test(lower)) payload.relationshipStatus = 'conversation';
          else if (/\bcontacted\b/i.test(lower)) payload.relationshipStatus = 'contacted';
          else if (/\bresearching\b/i.test(lower)) payload.relationshipStatus = 'researching';
          else if (/\breferral_requested\b|\breferral request\b/i.test(lower)) payload.relationshipStatus = 'referral_requested';
          else if (/\breferral_received\b|\breferral received\b/i.test(lower)) payload.relationshipStatus = 'referral_received';
          else if (/\bclosed\b/i.test(lower)) payload.relationshipStatus = 'closed';
        }
        break;
    }

    return payload;
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
