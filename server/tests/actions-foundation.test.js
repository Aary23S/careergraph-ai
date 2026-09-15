import { ActionValidator } from '../src/services/actions/action-validator.js';
import { ActionPlanner } from '../src/services/actions/action-planner.service.js';
import { ActionExecutor } from '../src/services/actions/action-executor.service.js';
import { ActionTypes, TargetTypes, ActionStatuses, ActionConfig } from '../src/services/actions/action-registry.js';
import { ActionModel } from '../src/services/actions/action.model.js';

describe('Phase H7-A: Workflow Action Foundation', () => {

  const validUserId = 'user_123';
  const validRequestId = 'req_456';
  const validTarget = { type: TargetTypes.JOB, id: 'job_789' };

  describe('Action Registry & Validator', () => {
    
    // 1. valid action type
    test('accepts valid action types', () => {
      expect(ActionValidator.isValidActionType(ActionTypes.SAVE_JOB)).toBe(true);
      expect(ActionValidator.isValidActionType(ActionTypes.CREATE_APPLICATION)).toBe(true);
    });

    // 2. invalid action type
    test('rejects invalid action types', () => {
      expect(ActionValidator.isValidActionType('invalid_action')).toBe(false);
      expect(ActionValidator.isValidActionType(null)).toBe(false);
    });

    // 3. valid target type
    test('accepts valid target types', () => {
      expect(ActionValidator.isValidTargetType(TargetTypes.JOB)).toBe(true);
      expect(ActionValidator.isValidTargetType(TargetTypes.CONNECTION)).toBe(true);
    });

    // 4. invalid target type
    test('rejects invalid target types', () => {
      expect(ActionValidator.isValidTargetType('invalid_target')).toBe(false);
    });

    // 5. valid action contract
    test('validates a correct action contract', () => {
      const action = new ActionModel({
        actionType: ActionTypes.SAVE_JOB,
        userId: validUserId,
        target: validTarget,
        requestId: validRequestId
      });
      expect(() => ActionValidator.validateActionContract(action)).not.toThrow();
    });

    // 6. malformed action contract
    test('rejects malformed action contract', () => {
      const missingUserId = new ActionModel({
        actionType: ActionTypes.SAVE_JOB,
        target: validTarget,
        requestId: validRequestId
      });
      expect(() => ActionValidator.validateActionContract(missingUserId)).toThrow('userId is required');

      const invalidTargetType = new ActionModel({
        actionType: ActionTypes.SAVE_JOB,
        userId: validUserId,
        target: { type: 'wrong', id: '123' },
        requestId: validRequestId
      });
      expect(() => ActionValidator.validateActionContract(invalidTargetType)).toThrow(/Invalid target type/);
    });

    // 13. invalid status transition
    test('validates lifecycle transitions', () => {
      expect(ActionValidator.isValidTransition(ActionStatuses.PENDING_CONFIRMATION, ActionStatuses.CONFIRMED)).toBe(true);
      expect(ActionValidator.isValidTransition(ActionStatuses.PENDING_CONFIRMATION, ActionStatuses.EXECUTING)).toBe(false);
      expect(ActionValidator.isValidTransition(ActionStatuses.CONFIRMED, ActionStatuses.COMPLETED)).toBe(false);
      expect(ActionValidator.isValidTransition(ActionStatuses.EXECUTING, ActionStatuses.COMPLETED)).toBe(true);
    });

  });

  describe('Action Planner', () => {
    
    // 7. planner creates pending_confirmation
    // 14. expiration calculation
    test('creates action with pending status and correct expiration', () => {
      const beforeTime = new Date().getTime();
      const action = ActionPlanner.planAction({
        userId: validUserId,
        actionType: ActionTypes.SAVE_JOB,
        target: validTarget,
        requestId: validRequestId
      });

      expect(action.status).toBe(ActionStatuses.PENDING_CONFIRMATION);
      expect(action.actionId).toBeDefined();
      
      const afterTime = new Date().getTime();
      const diffMs = action.expiresAt.getTime() - action.createdAt.getTime();
      
      expect(diffMs).toBe(ActionConfig.DEFAULT_EXPIRATION_MS);
      expect(action.createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(action.createdAt.getTime()).toBeLessThanOrEqual(afterTime);
    });

    // 8. planner does not execute mutations
    test('planner only returns a pure object and does not mutate (implicit)', () => {
      const action = ActionPlanner.planAction({
        userId: validUserId,
        actionType: ActionTypes.SAVE_JOB,
        target: validTarget,
        requestId: validRequestId
      });
      expect(action instanceof ActionModel).toBe(true);
    });
  });

  describe('Action Executor', () => {
    
    let validAction;
    beforeEach(() => {
      validAction = new ActionModel({
        actionType: ActionTypes.SAVE_JOB,
        userId: validUserId,
        target: validTarget,
        requestId: validRequestId,
        status: ActionStatuses.CONFIRMED
      });
    });

    // 9. executor rejects pending action
    test('rejects pending actions', async () => {
      validAction.status = ActionStatuses.PENDING_CONFIRMATION;
      await expect(ActionExecutor.executeAction(validAction, validUserId)).rejects.toThrow(/Status must be confirmed/);
    });

    // 10. executor rejects cancelled action
    test('rejects cancelled actions', async () => {
      validAction.status = ActionStatuses.CANCELLED;
      await expect(ActionExecutor.executeAction(validAction, validUserId)).rejects.toThrow(/Status must be confirmed/);
    });

    // 11. executor rejects expired action
    test('rejects expired actions', async () => {
      validAction.expiresAt = new Date(Date.now() - 1000); // 1 second ago
      await expect(ActionExecutor.executeAction(validAction, validUserId)).rejects.toThrow('Action has expired');
    });

    // 12. executor rejects unsupported action
    test('rejects unsupported actions through contract validation', async () => {
      validAction.actionType = 'arbitrary_unsupported_action';
      await expect(ActionExecutor.executeAction(validAction, validUserId)).rejects.toThrow(/Invalid or missing actionType/);
    });

    // 15. action ownership validation
    // 16. cross-user action access denied
    test('enforces cross-user access denial', async () => {
      const otherUserId = 'user_999';
      await expect(ActionExecutor.executeAction(validAction, otherUserId)).rejects.toThrow('Unauthorized: Cannot execute action belonging to another user');
    });

    test('rejects unauthenticated execution', async () => {
      await expect(ActionExecutor.executeAction(validAction, null)).rejects.toThrow('Unauthenticated request');
    });

    // 17. LLM cannot confirm action (simulation)
    test('LLM workflow simulates rejection since it outputs pending actions', async () => {
      const llmOutputAction = ActionPlanner.planAction({
        userId: validUserId,
        actionType: ActionTypes.SAVE_JOB,
        target: validTarget,
        requestId: validRequestId
      });
      // The LLM tries to directly pass this to the executor without user confirmation
      await expect(ActionExecutor.executeAction(llmOutputAction, validUserId)).rejects.toThrow(/Status must be confirmed/);
    });

    // Success path (H7-A Stub)
    test('executes confirmed valid actions and returns a stub', async () => {
      const result = await ActionExecutor.executeAction(validAction, validUserId);
      expect(result.success).toBe(true);
      expect(result.actionId).toBe(validAction.actionId);
    });
  });
});
