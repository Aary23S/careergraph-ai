import { ActionExecutor } from '../src/services/actions/action-executor.service.js';
import { ActionModel } from '../src/services/actions/action.model.js';
import { ActionStatuses, ActionTypes, TargetTypes } from '../src/services/actions/action-registry.js';
import { models, resetDatabase } from '../src/config/database.js';
import { jest } from '@jest/globals';

describe('Phase H7-E: Action Executor Service', () => {
  const userId = 'd9b3a7f8-3e4c-4e89-9a1b-123456789abc';
  const otherUserId = 'e8c2b6a7-2d3b-4f78-8b0a-987654321def';

  let testJob;
  let testConnection;
  let testApplication;

  beforeAll(async () => {
    // Reset database schema and seed test users
    await resetDatabase();
    await models.User.create({
      id: userId,
      email: 'user_h7e@example.com',
      passwordHash: 'hash123'
    });
    await models.User.create({
      id: otherUserId,
      email: 'attacker_h7e@example.com',
      passwordHash: 'hash123'
    });
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create fresh test entities in database using user_id
    testJob = await models.Job.create({
      title: 'Senior Software Engineer',
      user_id: userId,
      status: 'new'
    });

    testConnection = await models.Connection.create({
      name: 'Sarah Connor',
      user_id: userId,
      company: 'Skynet Solutions'
    });

    testApplication = await models.Application.create({
      user_id: userId,
      job_id: testJob.id,
      status: 'applied',
      appliedAt: new Date()
    });
  });

  afterEach(async () => {
    // Clean up created test models
    if (testApplication) await models.Application.destroy({ where: { id: testApplication.id } }).catch(() => {});
    if (testConnection) await models.Connection.destroy({ where: { id: testConnection.id } }).catch(() => {});
    if (testJob) await models.Job.destroy({ where: { id: testJob.id } }).catch(() => {});
    await models.Note.destroy({ where: { user_id: [userId, otherUserId] } }).catch(() => {});
    await models.OutreachAiDraft.destroy({ where: { user_id: [userId, otherUserId] } }).catch(() => {});
    await models.Outreach.destroy({ where: { user_id: [userId, otherUserId] } }).catch(() => {});
    await models.ApplicationEvent.destroy({ where: { user_id: [userId, otherUserId] } }).catch(() => {});
  });

  function createConfirmedAction(actionType, target, payload = {}, expirationMs = 60000) {
    const action = new ActionModel({
      userId,
      actionType,
      target,
      payload,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      expirationMs
    });
    action.status = ActionStatuses.CONFIRMED;
    return action;
  }

  describe('Authorization & Security Boundary', () => {
    test('rejects execution if user is unauthenticated', async () => {
      const action = createConfirmedAction(ActionTypes.SAVE_JOB, { type: TargetTypes.JOB, id: testJob.id });
      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: null })
      ).rejects.toThrow('Unauthenticated request');
    });

    test('rejects execution if user A attempts to execute action belonging to user B', async () => {
      const action = createConfirmedAction(ActionTypes.SAVE_JOB, { type: TargetTypes.JOB, id: testJob.id });
      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: otherUserId })
      ).rejects.toThrow(/Unauthorized: Cannot execute action belonging to another user/);
    });

    test('rejects execution if target entity belongs to another user', async () => {
      // Create a job belonging to attacker
      const attackerJob = await models.Job.create({
        title: 'Attacker Job',
        user_id: otherUserId,
        status: 'new'
      });

      // User tries to modify attacker's job status
      const action = createConfirmedAction(
        ActionTypes.CHANGE_JOB_STATUS,
        { type: TargetTypes.JOB, id: attackerJob.id },
        { status: 'applied' }
      );

      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: userId })
      ).rejects.toThrow(/Unauthorized/);

      await models.Job.destroy({ where: { id: attackerJob.id } });
    });

    test('zero mutations occur on unauthorized execution failure', async () => {
      const updateSpy = jest.spyOn(models.Job, 'update');
      const action = createConfirmedAction(ActionTypes.SAVE_JOB, { type: TargetTypes.JOB, id: testJob.id });

      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: otherUserId })
      ).rejects.toThrow();

      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Status & Expiration Validation', () => {
    test('rejects PENDING_CONFIRMATION actions', async () => {
      const action = new ActionModel({
        userId,
        actionType: ActionTypes.SAVE_JOB,
        target: { type: TargetTypes.JOB, id: testJob.id },
        requestId: 'req_pending'
      });

      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: userId })
      ).rejects.toThrow(/Status must be confirmed/);
    });

    test('rejects CANCELLED actions', async () => {
      const action = createConfirmedAction(ActionTypes.SAVE_JOB, { type: TargetTypes.JOB, id: testJob.id });
      action.status = ActionStatuses.CANCELLED;

      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: userId })
      ).rejects.toThrow(/Status must be confirmed/);
    });

    test('rejects EXPIRED actions', async () => {
      const pastCreatedAt = new Date(Date.now() - 20000);
      const pastExpiresAt = new Date(Date.now() - 10000);

      const action = new ActionModel({
        userId,
        actionType: ActionTypes.SAVE_JOB,
        target: { type: TargetTypes.JOB, id: testJob.id },
        requestId: 'req_expired',
        createdAt: pastCreatedAt,
        expiresAt: pastExpiresAt
      });
      action.status = ActionStatuses.CONFIRMED;

      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: userId })
      ).rejects.toThrow(/Action has expired/);
    });
  });

  describe('Action Execution & Domain Mutations', () => {
    test('action: save_job updates job status safely', async () => {
      const action = createConfirmedAction(ActionTypes.SAVE_JOB, { type: TargetTypes.JOB, id: testJob.id });
      const result = await ActionExecutor.executeAction({ action, authenticatedUserId: userId });

      expect(result.status).toBe(ActionStatuses.COMPLETED);
      expect(result.result.jobId).toBe(testJob.id);
      expect(result.result.status).toBe('saved');

      const reloadedJob = await models.Job.findByPk(testJob.id);
      expect(reloadedJob.status).toBe('saved');
    });

    test('action: change_job_status mutates job status', async () => {
      const action = createConfirmedAction(
        ActionTypes.CHANGE_JOB_STATUS,
        { type: TargetTypes.JOB, id: testJob.id },
        { status: 'interview' }
      );
      const result = await ActionExecutor.executeAction({ action, authenticatedUserId: userId });

      expect(result.status).toBe(ActionStatuses.COMPLETED);
      expect(result.result.status).toBe('interview');

      const reloadedJob = await models.Job.findByPk(testJob.id);
      expect(reloadedJob.status).toBe('interview');
    });

    test('action: create_application creates application and event atomically', async () => {
      const newJob = await models.Job.create({
        title: 'Lead Architect',
        user_id: userId,
        status: 'new'
      });

      const action = createConfirmedAction(
        ActionTypes.CREATE_APPLICATION,
        { type: TargetTypes.JOB, id: newJob.id },
        { status: 'applied', notes: 'Applied online' }
      );

      const result = await ActionExecutor.executeAction({ action, authenticatedUserId: userId });

      expect(result.status).toBe(ActionStatuses.COMPLETED);
      expect(result.result.applicationId).toBeDefined();
      expect(result.result.eventId).toBeDefined();

      const createdApp = await models.Application.findByPk(result.result.applicationId);
      expect(createdApp).not.toBeNull();
      expect(createdApp.status).toBe('applied');

      const createdEvent = await models.ApplicationEvent.findByPk(result.result.eventId);
      expect(createdEvent).not.toBeNull();
      const eventAppId = createdEvent.application_id || createdEvent.applicationId || createdEvent.get('application_id');
      expect(eventAppId).toBe(createdApp.id);

      await models.ApplicationEvent.destroy({ where: { id: createdEvent.id } });
      await models.Application.destroy({ where: { id: createdApp.id } });
      await models.Job.destroy({ where: { id: newJob.id } });
    });

    test('action: schedule_followup schedules follow up date on target', async () => {
      const followUpDate = '2026-10-15';
      const action = createConfirmedAction(
        ActionTypes.SCHEDULE_FOLLOWUP,
        { type: TargetTypes.CONNECTION, id: testConnection.id },
        { followUpAt: followUpDate }
      );

      const result = await ActionExecutor.executeAction({ action, authenticatedUserId: userId });

      expect(result.status).toBe(ActionStatuses.COMPLETED);
      expect(result.result.targetId).toBe(testConnection.id);

      const outreach = await models.Outreach.findOne({ where: { connection_id: testConnection.id, user_id: userId } });
      expect(outreach).not.toBeNull();
    });

    test('action: create_outreach_draft creates draft ONLY and sends NO external message', async () => {
      const action = createConfirmedAction(
        ActionTypes.CREATE_OUTREACH_DRAFT,
        { type: TargetTypes.CONNECTION, id: testConnection.id },
        { intent: 'referral_request', message: 'Hello Sarah, could you refer me?' }
      );

      const result = await ActionExecutor.executeAction({ action, authenticatedUserId: userId });

      expect(result.status).toBe(ActionStatuses.COMPLETED);
      expect(result.result.draftId).toBeDefined();
      expect(result.result.note).toMatch(/No external message was sent/);

      const draft = await models.OutreachAiDraft.findByPk(result.result.draftId);
      expect(draft).not.toBeNull();
      expect(draft.draft).toBe('Hello Sarah, could you refer me?');
      expect(draft.status).toBe('generated');
    });

    test('action: add_note creates note record', async () => {
      const action = createConfirmedAction(
        ActionTypes.ADD_NOTE,
        { type: TargetTypes.JOB, id: testJob.id },
        { content: 'Strong benefits package offered.' }
      );

      const result = await ActionExecutor.executeAction({ action, authenticatedUserId: userId });

      expect(result.status).toBe(ActionStatuses.COMPLETED);
      expect(result.result.noteId).toBeDefined();

      const note = await models.Note.findByPk(result.result.noteId);
      expect(note).not.toBeNull();
      expect(note.content).toBe('Strong benefits package offered.');
    });
  });

  describe('Transactional Rollback', () => {
    test('rolls back entire application creation if application event creation fails', async () => {
      const newJob = await models.Job.create({
        title: 'Backend Dev',
        user_id: userId
      });

      // Force ApplicationEvent.create to throw error
      const eventSpy = jest.spyOn(models.ApplicationEvent, 'create').mockRejectedValueOnce(new Error('Event creation DB crash'));

      const action = createConfirmedAction(
        ActionTypes.CREATE_APPLICATION,
        { type: TargetTypes.JOB, id: newJob.id },
        { status: 'applied' }
      );

      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: userId })
      ).rejects.toThrow('Event creation DB crash');

      // Verify ZERO application state left in DB
      const orphanedApp = await models.Application.findOne({ where: { job_id: newJob.id, user_id: userId } });
      expect(orphanedApp).toBeNull();

      eventSpy.mockRestore();
      await models.Job.destroy({ where: { id: newJob.id } });
    });
  });

  describe('Idempotency & Double Execution', () => {
    test('re-executing a completed action returns cached result without duplicate domain mutations', async () => {
      const action = createConfirmedAction(ActionTypes.SAVE_JOB, { type: TargetTypes.JOB, id: testJob.id });

      // First execution
      const res1 = await ActionExecutor.executeAction({ action, authenticatedUserId: userId });
      expect(res1.status).toBe(ActionStatuses.COMPLETED);

      const updateSpy = jest.spyOn(models.Job, 'update');

      // Second execution (same action object instance)
      const res2 = await ActionExecutor.executeAction({ action, authenticatedUserId: userId });
      expect(res2.status).toBe(ActionStatuses.COMPLETED);
      expect(res2.actionId).toBe(action.actionId);

      // Verify domain update was NOT called a second time
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Audit Logging', () => {
    test('records successful execution in audit log', async () => {
      const action = createConfirmedAction(
        ActionTypes.ADD_NOTE,
        { type: TargetTypes.JOB, id: testJob.id },
        { content: 'Audit test note' }
      );

      await ActionExecutor.executeAction({ action, authenticatedUserId: userId });

      if (models.AiAuditLog) {
        const audit = await models.AiAuditLog.findOne({
          where: { user_id: userId, operation: 'ACTION_EXECUTION', correlation_id: action.requestId }
        });
        expect(audit).not.toBeNull();
        expect(audit.status).toBe('success');
      }
    });

    test('records failed execution in audit log on error', async () => {
      // Pass valid UUID format that does not exist in DB to trigger execution failure
      const action = createConfirmedAction(
        ActionTypes.ADD_NOTE,
        { type: TargetTypes.JOB, id: 'd9b3a7f8-3e4c-4e89-9a1b-000000000000' },
        { content: 'Fail test' }
      );

      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: userId })
      ).rejects.toThrow();

      if (models.AiAuditLog) {
        const audit = await models.AiAuditLog.findOne({
          where: { user_id: userId, operation: 'ACTION_EXECUTION', correlation_id: action.requestId }
        });
        expect(audit).not.toBeNull();
        expect(audit.status).toBe('failed');
      }
    });
  });
});
