import { ActionModel } from './action.model.js';
import { ActionValidator } from './action-validator.js';
import { ActionStatuses, ActionRegistryMap, TargetTypes } from './action-registry.js';
import { IntentMapper } from './intent-mapper.js';
import { TargetResolver } from './target-resolver.js';
import { ActionPlan } from './action-plan.model.js';

export class ActionPlanner {
  /**
   * Plans a new action, validates it, and returns a pending ActionPlan.
   * Does NOT mutate any databases or execute the action.
   * 
   * @param {Object} params
   * @param {string} params.userId - User requesting the action
   * @param {string} params.intent - Raw natural language intent or structured intent from LLM
   * @param {string} [params.targetDescription] - Natural language description of target
   * @param {Object} [params.targetId] - Exact ID if already known
   * @param {Object} [params.payload] - Action payload
   * @param {string} [params.explanation] - Reasoning behind proposing the action
   * @param {string} params.requestId - Correlation ID for the request
   * @returns {Promise<Object>} - The ActionPlan, or an object requesting clarification
   */
  static async planAction({ userId, intent, targetDescription, targetId, payload = {}, explanation = '', requestId }) {
    if (!userId) throw new Error('userId is required');
    if (!requestId) throw new Error('requestId is required');

    // 1. Map Intent
    const actionType = IntentMapper.mapIntentToActionType(intent);
    if (!actionType) {
      return { needsInput: true, message: 'I could not determine a valid action type from your request.' };
    }

    const expectedTargetType = ActionRegistryMap[actionType]?.targetType;
    // For ADD_NOTE which takes an array, default to JOB if unknown, but better to enforce explicit resolution if possible.
    // For H7-C, if it's an array, we assume the specific type is provided in the target mapping, or we just use the first for simplicity in ambiguity resolution.
    const primaryTargetType = Array.isArray(expectedTargetType) ? expectedTargetType[0] : expectedTargetType;

    // 2. Resolve Target
    let resolvedTargetId = targetId;
    let resolvedTargetType = primaryTargetType;
    let resolvedEntity = null;

    if (!resolvedTargetId && targetDescription) {
      const resolution = await TargetResolver.resolve(userId, resolvedTargetType, targetDescription);
      if (resolution.needsClarification) {
        return { needsClarification: true, candidates: resolution.candidates, message: 'Multiple or no matching entities found. Please clarify.' };
      }
      resolvedTargetId = resolution.resolvedTarget.id;
      resolvedEntity = resolution.resolvedTarget;
    }

    // 3. Completeness Check
    const completeness = IntentMapper.analyzeCompleteness(actionType, resolvedTargetId, payload);
    if (!completeness.complete) {
      return { needsInput: true, message: `Missing required information: ${completeness.missing}.` };
    }

    // Extract strictly the known fields to prevent unknown field injections
    const sanitizedParams = {
      userId,
      actionType,
      target: {
        type: resolvedTargetType,
        id: resolvedTargetId
      },
      payload: typeof payload === 'object' && payload !== null && !Array.isArray(payload) ? payload : {},
      reason: typeof explanation === 'string' ? explanation : '',
      requestId,
      status: ActionStatuses.PENDING_CONFIRMATION
    };

    // 4. Create the action model instance
    const action = new ActionModel(sanitizedParams);

    // 5. Validate the resulting contract
    ActionValidator.validateActionContract(action);

    // 6. Wrap in ActionPlan
    let previewTitle = ActionRegistryMap[actionType]?.description || 'Execute action';
    let previewTarget = `${resolvedTargetType}:${resolvedTargetId}`;
    if (resolvedEntity) {
      previewTarget = resolvedEntity.title ? `${resolvedEntity.title} at ${resolvedEntity.company}` 
                    : resolvedEntity.name ? `${resolvedEntity.name}` 
                    : previewTarget;
    }

    return new ActionPlan({
      action,
      explanation: typeof explanation === 'string' && explanation.trim() ? explanation : `You asked to ${previewTitle.toLowerCase()}.`,
      preview: {
        operation: previewTitle,
        target: previewTarget
      }
    });
  }
}
