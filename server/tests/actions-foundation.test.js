import { ActionValidator } from '../src/services/actions/action-validator.js';
import { ActionPlanner } from '../src/services/actions/action-planner.service.js';
import { ActionExecutor } from '../src/services/actions/action-executor.service.js';
import { ActionTypes, TargetTypes, ActionStatuses, ActionConfig } from '../src/services/actions/action-registry.js';
import { ActionModel } from '../src/services/actions/action.model.js';
import { ActionValidationError } from '../src/services/actions/action.error.js';
import { jest } from '@jest/globals';

describe('Phase H7-B: Action Validation Hardening', () => {

  const validUserId = 'user_123';
  const validRequestId = 'req_456';
  const validTarget = { type: TargetTypes.JOB, id: 'job_789' };

  describe('Action Registry & Validator', () => {

    test('accepts valid action types', () => {
      expect(ActionValidator.isValidActionType(ActionTypes.SAVE_JOB)).toBe(true);
      expect(ActionValidator.isValidActionType(ActionTypes.CREATE_APPLICATION)).toBe(true);
    });

    test('rejects invalid action types', () => {
      expect(ActionValidator.isValidActionType('delete_user')).toBe(false);
      expect(ActionValidator.isValidActionType(null)).toBe(false);
    });

    test('validates a correct action contract', () => {
      const action = new ActionModel({
        actionType: ActionTypes.SAVE_JOB,
        userId: validUserId,
        target: validTarget,
        requestId: validRequestId
      });
      expect(() => ActionValidator.validateActionContract(action)).not.toThrow();
    });

    test('rejects malformed action contract fields (null/undefined/arrays)', () => {
      const invalidModels = [
        // Not an object
        null,
        [],
        "string",
        // Missing actionId
        { ...new ActionModel({ actionType: ActionTypes.SAVE_JOB, userId: validUserId, target: validTarget, requestId: validRequestId }), actionId: undefined },
        // Invalid status
        { ...new ActionModel({ actionType: ActionTypes.SAVE_JOB, userId: validUserId, target: validTarget, requestId: validRequestId }), status: 'random_status' },
      ];

      for (const invalid of invalidModels) {
        expect(() => ActionValidator.validateActionContract(invalid)).toThrow(ActionValidationError);
      }
    });

    test('enforces size limits on string fields', () => {
      const longString = 'a'.repeat(2000);
      
      const actionLongReason = new ActionModel({
        actionType: ActionTypes.SAVE_JOB, userId: validUserId, target: validTarget, requestId: validRequestId,
        reason: longString
      });
      expect(() => ActionValidator.validateActionContract(actionLongReason)).toThrow(/reason exceeds max length/);

      const actionLongReqId = new ActionModel({
        actionType: ActionTypes.SAVE_JOB, userId: validUserId, target: validTarget, requestId: longString
      });
      expect(() => ActionValidator.validateActionContract(actionLongReqId)).toThrow(/requestId exceeds max length/);
      
      const actionLongTargetId = new ActionModel({
        actionType: ActionTypes.SAVE_JOB, userId: validUserId, target: { type: TargetTypes.JOB, id: longString }, requestId: validRequestId
      });
      expect(() => ActionValidator.validateActionContract(actionLongTargetId)).toThrow(/target id exceeds max length/);
    });

    test('validates specific payload schemas', () => {
      // 1. ADD_NOTE
      const actionAddNoteInvalid = new ActionModel({
        actionType: ActionTypes.ADD_NOTE, userId: validUserId, target: validTarget, requestId: validRequestId,
        payload: { content: '' } // Empty
      });
      expect(() => ActionValidator.validateActionContract(actionAddNoteInvalid)).toThrow(/non-empty "content" string/);
      
      const actionAddNoteValid = new ActionModel({
        actionType: ActionTypes.ADD_NOTE, userId: validUserId, target: validTarget, requestId: validRequestId,
        payload: { content: 'This is a valid note.' }
      });
      expect(() => ActionValidator.validateActionContract(actionAddNoteValid)).not.toThrow();

      // 2. CHANGE_JOB_STATUS
      const actionStatusInvalid = new ActionModel({
        actionType: ActionTypes.CHANGE_JOB_STATUS, userId: validUserId, target: validTarget, requestId: validRequestId,
        payload: { status: 123 }
      });
      expect(() => ActionValidator.validateActionContract(actionStatusInvalid)).toThrow(/must contain a valid "status" string/);

      // 3. SCHEDULE_FOLLOWUP
      const actionFollowUpInvalid = new ActionModel({
        actionType: ActionTypes.SCHEDULE_FOLLOWUP, userId: validUserId, target: { type: TargetTypes.CONNECTION, id: 'c1' }, requestId: validRequestId,
        payload: { followUpAt: 'invalid-date' }
      });
      expect(() => ActionValidator.validateActionContract(actionFollowUpInvalid)).toThrow(/valid date/);
    });
  });

  describe('Action Model Immutability', () => {
    test('prevents mutation of security fields', () => {
      const action = new ActionModel({
        actionType: ActionTypes.SAVE_JOB,
        userId: validUserId,
        target: validTarget,
        requestId: validRequestId
      });

      expect(() => { action.userId = 'hacker_user'; }).toThrow();
      expect(() => { action.actionId = 'fake_id'; }).toThrow();
      expect(() => { action.requestId = 'fake_req'; }).toThrow();
      expect(() => { action.createdAt = new Date(); }).toThrow();

      // Ensure they were not actually changed if strict mode doesn't throw in some environments
      expect(action.userId).toBe(validUserId);
      expect(action.requestId).toBe(validRequestId);
    });
  });

  describe('Action Planner', () => {
    test('creates action with pending status and strips unknown fields', () => {
      const action = ActionPlanner.planAction({
        userId: validUserId,
        actionType: ActionTypes.SAVE_JOB,
        target: validTarget,
        requestId: validRequestId,
        isAdmin: true, // Unknown field
        forceExecute: 'yes' // Unknown field
      });

      expect(action.status).toBe(ActionStatuses.PENDING_CONFIRMATION);
      expect(action.isAdmin).toBeUndefined();
      expect(action.forceExecute).toBeUndefined();
      // Payload should be sanitized to an empty object if no valid payload was provided
      expect(action.payload).toEqual({});
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
        status: ActionStatuses.PENDING_CONFIRMATION
      });
      // Force it to CONFIRMED for executor success testing, since model constructor might freeze it.
      // Wait, we didn't freeze status.
      validAction.status = ActionStatuses.CONFIRMED;
    });

    test('rejects pending actions', async () => {
      validAction.status = ActionStatuses.PENDING_CONFIRMATION;
      await expect(ActionExecutor.executeAction(validAction, validUserId)).rejects.toThrow(/Status must be confirmed/);
    });

    test('rejects expired actions', async () => {
      jest.useFakeTimers();
      
      const expiringAction = new ActionModel({
        actionType: ActionTypes.SAVE_JOB,
        userId: validUserId,
        target: validTarget,
        requestId: validRequestId,
        status: ActionStatuses.PENDING_CONFIRMATION
      });
      // Force status to CONFIRMED for executor
      expiringAction.status = ActionStatuses.CONFIRMED;

      // Advance time by 16 minutes
      jest.advanceTimersByTime(16 * 60 * 1000);

      await expect(ActionExecutor.executeAction(expiringAction, validUserId)).rejects.toThrow('Action has expired');
      
      jest.useRealTimers();
    });

    test('enforces cross-user access denial', async () => {
      const otherUserId = 'user_999';
      await expect(ActionExecutor.executeAction(validAction, otherUserId)).rejects.toThrow('Unauthorized: Cannot execute action belonging to another user');
    });
  });
});
