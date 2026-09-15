import { ActionConfirmationService } from '../src/services/actions/action-confirmation.service.js';
import { ActionModel } from '../src/services/actions/action.model.js';
import { ActionStatuses, ActionTypes, TargetTypes } from '../src/services/actions/action-registry.js';
import { models } from '../src/config/database.js';
import { jest } from '@jest/globals';

describe('Phase H7-D: Action Confirmation Workflow', () => {
  const validUserId = 'user_abc';
  const otherUserId = 'user_def';
  const validTarget = { type: TargetTypes.JOB, id: 'job_123' };
  
  let validPendingAction;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a fresh pending action for each test
    validPendingAction = new ActionModel({
      userId: validUserId,
      actionType: ActionTypes.SAVE_JOB,
      target: validTarget,
      requestId: 'req_test'
    });
  });

  describe('Confirmation', () => {
    test('confirms a valid pending action', async () => {
      const result = await ActionConfirmationService.confirmAction({
        action: validPendingAction,
        authenticatedUserId: validUserId,
        requestId: 'req_1'
      });

      expect(result.status).toBe(ActionStatuses.CONFIRMED);
      expect(result.actionId).toBe(validPendingAction.actionId);
      expect(result.userId).toBe(validUserId);
      expect(validPendingAction.status).toBe(ActionStatuses.CONFIRMED);
    });

    test('rejects confirmation if action is expired', async () => {
      // Force expiration
      validPendingAction = new ActionModel({
        userId: validUserId,
        actionType: ActionTypes.SAVE_JOB,
        target: validTarget,
        requestId: 'req_test',
        expirationMs: -1000 // Expired 1 second ago
      });

      await expect(
        ActionConfirmationService.confirmAction({
          action: validPendingAction,
          authenticatedUserId: validUserId,
          requestId: 'req_1'
        })
      ).rejects.toThrow('expired');
    });
  });

  describe('Cancellation', () => {
    test('cancels a valid pending action', async () => {
      const result = await ActionConfirmationService.cancelAction({
        action: validPendingAction,
        authenticatedUserId: validUserId,
        requestId: 'req_1'
      });

      expect(result.status).toBe(ActionStatuses.CANCELLED);
      expect(validPendingAction.status).toBe(ActionStatuses.CANCELLED);
    });
  });

  describe('Security and Authorization', () => {
    test('rejects transition by a different user', async () => {
      await expect(
        ActionConfirmationService.confirmAction({
          action: validPendingAction,
          authenticatedUserId: otherUserId, // Different user
          requestId: 'req_1'
        })
      ).rejects.toThrow('Unauthorized');
    });

    test('maintains immutable fields (cannot forge actionId/userId)', () => {
      expect(() => {
        validPendingAction.userId = otherUserId;
      }).toThrow(TypeError);

      expect(() => {
        validPendingAction.actionId = 'fake_id';
      }).toThrow(TypeError);
    });
  });

  describe('State Machine & Idempotency', () => {
    test('safely handles duplicate confirmations (Idempotent success)', async () => {
      const reqId = 'req_duplicate';
      
      // First confirm
      const result1 = await ActionConfirmationService.confirmAction({
        action: validPendingAction,
        authenticatedUserId: validUserId,
        requestId: reqId
      });
      expect(result1.status).toBe(ActionStatuses.CONFIRMED);

      // Second confirm (should return success, not throw error)
      const result2 = await ActionConfirmationService.confirmAction({
        action: validPendingAction,
        authenticatedUserId: validUserId,
        requestId: reqId
      });
      expect(result2.status).toBe(ActionStatuses.CONFIRMED);
      expect(result2.message).toMatch(/Idempotent success/);
    });

    test('rejects confirming an already cancelled action', async () => {
      // Cancel it first
      await ActionConfirmationService.cancelAction({
        action: validPendingAction,
        authenticatedUserId: validUserId,
        requestId: 'req_race'
      });

      // Try to confirm the same action
      await expect(
        ActionConfirmationService.confirmAction({
          action: validPendingAction,
          authenticatedUserId: validUserId,
          requestId: 'req_race2'
        })
      ).rejects.toThrow(/Invalid transition: Action is already in state 'cancelled'/);
    });

    test('rejects transition from non-pending states if tracked memory expires/fails', async () => {
      // Manually force it to completed to bypass tracking cache check
      validPendingAction.status = ActionStatuses.COMPLETED;

      // Ensure we use a new actionId so it's not in the memory tracker
      const anotherAction = new ActionModel({
        userId: validUserId,
        actionType: ActionTypes.SAVE_JOB,
        target: validTarget,
        requestId: 'req_test',
        status: ActionStatuses.COMPLETED // bypassing cache tracking
      });

      await expect(
        ActionConfirmationService.confirmAction({
          action: anotherAction,
          authenticatedUserId: validUserId,
          requestId: 'req_1'
        })
      ).rejects.toThrow(/Invalid transition from completed to confirmed/);
    });
  });

  describe('Zero-Mutation Policy', () => {
    test('never executes domain mutations during confirmation or cancellation', async () => {
      const jobUpdateSpy = jest.spyOn(models.Job, 'update');
      const appCreateSpy = jest.spyOn(models.Application, 'create');
      const outreachCreateSpy = jest.spyOn(models.Outreach, 'create');
      const noteCreateSpy = jest.spyOn(models.Note, 'create');

      await ActionConfirmationService.confirmAction({
        action: validPendingAction,
        authenticatedUserId: validUserId,
        requestId: 'req_0'
      });

      expect(jobUpdateSpy).not.toHaveBeenCalled();
      expect(appCreateSpy).not.toHaveBeenCalled();
      expect(outreachCreateSpy).not.toHaveBeenCalled();
      expect(noteCreateSpy).not.toHaveBeenCalled();
    });
  });

});
