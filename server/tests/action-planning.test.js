import { ActionPlanner } from '../src/services/actions/action-planner.service.js';
import { TargetResolver } from '../src/services/actions/target-resolver.js';
import { IntentMapper } from '../src/services/actions/intent-mapper.js';
import { ActionTypes, TargetTypes, ActionStatuses } from '../src/services/actions/action-registry.js';
import { models } from '../src/config/database.js';
import { ActionPlan } from '../src/services/actions/action-plan.model.js';
import { jest } from '@jest/globals';

describe('Phase H7-C: Action Planning', () => {

  const validUserId = 'user_abc';
  const requestId = 'req_123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('IntentMapper', () => {
    test('maps natural language explicitly to action types', () => {
      expect(IntentMapper.mapIntentToActionType('Save this job')).toBe(ActionTypes.SAVE_JOB);
      expect(IntentMapper.mapIntentToActionType('Mark interested')).toBe(ActionTypes.CHANGE_JOB_STATUS);
      expect(IntentMapper.mapIntentToActionType('Apply to this job')).toBe(ActionTypes.CREATE_APPLICATION);
      expect(IntentMapper.mapIntentToActionType('Remind me to follow up')).toBe(ActionTypes.SCHEDULE_FOLLOWUP);
      expect(IntentMapper.mapIntentToActionType('Draft a message')).toBe(ActionTypes.CREATE_OUTREACH_DRAFT);
      expect(IntentMapper.mapIntentToActionType('Add a note')).toBe(ActionTypes.ADD_NOTE);
    });

    test('returns null for non-actionable intent', () => {
      expect(IntentMapper.mapIntentToActionType('What are my skills?')).toBeNull();
      expect(IntentMapper.mapIntentToActionType('Why is this job a match?')).toBeNull();
    });
  });

  describe('TargetResolver', () => {
    test('resolves exact match safely', async () => {
      jest.spyOn(models.Job, 'findAll').mockResolvedValueOnce([
        { id: 'job_1', title: 'Backend', company: 'Google', user_id: validUserId }
      ]);
      
      const res = await TargetResolver.resolve(validUserId, TargetTypes.JOB, 'Google job');
      expect(res.needsClarification).toBeUndefined();
      expect(res.resolvedTarget.id).toBe('job_1');
      expect(models.Job.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ user_id: validUserId }) // Proves tenant isolation
      }));
    });

    test('returns ambiguity when multiple candidates match', async () => {
      jest.spyOn(models.Job, 'findAll').mockResolvedValueOnce([
        { id: 'job_1', title: 'Backend', company: 'Google' },
        { id: 'job_2', title: 'Frontend', company: 'Google' }
      ]);

      const res = await TargetResolver.resolve(validUserId, TargetTypes.JOB, 'Google');
      expect(res.needsClarification).toBe(true);
      expect(res.candidates.length).toBe(2);
      expect(res.resolvedTarget).toBeUndefined();
    });

    test('returns missing when no description provided', async () => {
      const res = await TargetResolver.resolve(validUserId, TargetTypes.JOB, '');
      expect(res.needsClarification).toBe(true);
      expect(res.candidates).toEqual([]);
    });
  });

  describe('ActionPlanner Orchestration', () => {
    test('successfully plans an action with exact target', async () => {
      jest.spyOn(models.Job, 'findAll').mockResolvedValueOnce([
        { id: 'job_xyz', title: 'SWE', company: 'Apple', user_id: validUserId }
      ]);

      const planRes = await ActionPlanner.planAction({
        userId: validUserId,
        intent: 'Save this job',
        targetDescription: 'Apple',
        requestId
      });

      // Must return an ActionPlan abstraction
      expect(planRes).toBeInstanceOf(ActionPlan);
      expect(planRes.action.status).toBe(ActionStatuses.PENDING_CONFIRMATION);
      expect(planRes.action.actionType).toBe(ActionTypes.SAVE_JOB);
      expect(planRes.action.target.id).toBe('job_xyz');
      expect(planRes.requiresConfirmation).toBe(true);
      expect(planRes.risk).toBe('LOW'); // Configured in registry
      expect(planRes.preview.operation).toBe('Save a job to your list');
    });

    test('safely rejects ambiguous plans', async () => {
      jest.spyOn(models.Job, 'findAll').mockResolvedValueOnce([
        { id: 'job_1', title: 'SWE', company: 'Meta' },
        { id: 'job_2', title: 'Lead', company: 'Meta' }
      ]);

      const planRes = await ActionPlanner.planAction({
        userId: validUserId,
        intent: 'Save this job',
        targetDescription: 'Meta',
        requestId
      });

      expect(planRes.needsClarification).toBe(true);
      expect(planRes).not.toBeInstanceOf(ActionPlan);
    });

    test('safely rejects missing required payload info', async () => {
      const planRes = await ActionPlanner.planAction({
        userId: validUserId,
        intent: 'Mark interested', // maps to change_job_status
        targetId: 'job_123',
        requestId
        // payload is missing { status: '...' }
      });

      expect(planRes.needsInput).toBe(true);
      expect(planRes.message).toMatch(/Missing required information: payload.status/);
    });

    test('strips unknown hallucinated fields (Security test)', async () => {
      const planRes = await ActionPlanner.planAction({
        userId: validUserId,
        intent: 'Save this job',
        targetId: 'job_123',
        requestId,
        payload: {
          isAdmin: true, // Should be stripped/safely stored in payload but not affect execution
          forceExecute: true // Same
        }
      });

      expect(planRes).toBeInstanceOf(ActionPlan);
      expect(planRes.action.isAdmin).toBeUndefined();
      expect(planRes.action.status).toBe(ActionStatuses.PENDING_CONFIRMATION); // Never executed automatically
      expect(planRes.requiresConfirmation).toBe(true);
    });

    test('never executes database mutations in H7-C', async () => {
      const updateSpy = jest.spyOn(models.Job, 'update');
      const createSpy = jest.spyOn(models.Application, 'create');

      const planRes = await ActionPlanner.planAction({
        userId: validUserId,
        intent: 'Apply to this job',
        targetId: 'job_123',
        requestId
      });

      expect(planRes).toBeInstanceOf(ActionPlan);
      expect(updateSpy).not.toHaveBeenCalled();
      expect(createSpy).not.toHaveBeenCalled();
    });
  });

});
