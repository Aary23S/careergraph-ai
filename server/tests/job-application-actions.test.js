import { ActionExecutor } from '../src/services/actions/action-executor.service.js';
import { ActionPlanner } from '../src/services/actions/action-planner.service.js';
import { ActionModel } from '../src/services/actions/action.model.js';
import { ActionStatuses, ActionTypes, TargetTypes, JOB_STATUSES, APPLICATION_STATUSES } from '../src/services/actions/action-registry.js';
import { models, resetDatabase } from '../src/config/database.js';
import { jest } from '@jest/globals';

describe('Phase H7-F: Job & Application Workflow Actions', () => {
  const userId = 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d';
  const otherUserId = 'f9e8d7c6-b5a4-4f3e-2d1c-0b9a8f7e6d5c';

  let testJob;
  let attackerJob;
  let testConnection;
  let attackerConnection;
  let activeResume;
  let otherUserResume;
  let testApplication;

  beforeAll(async () => {
    await resetDatabase();
    await models.User.create({
      id: userId,
      email: 'user_h7f@example.com',
      passwordHash: 'hash123'
    });
    await models.User.create({
      id: otherUserId,
      email: 'attacker_h7f@example.com',
      passwordHash: 'hash123'
    });
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create test entities
    testJob = await models.Job.create({
      title: 'Senior Backend Engineer',
      user_id: userId,
      status: 'new'
    });

    attackerJob = await models.Job.create({
      title: 'Attacker Job',
      user_id: otherUserId,
      status: 'new'
    });

    testConnection = await models.Connection.create({
      name: 'Elena Rostova',
      user_id: userId,
      company: 'TechCorp'
    });

    attackerConnection = await models.Connection.create({
      name: 'Foreign Connection',
      user_id: otherUserId,
      company: 'CompetitorInc'
    });

    activeResume = await models.Resume.create({
      user_id: userId,
      fileName: 'main_resume.pdf',
      storageKey: 'key_active',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      isActive: true
    });

    otherUserResume = await models.Resume.create({
      user_id: otherUserId,
      fileName: 'foreign_resume.pdf',
      storageKey: 'key_foreign',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      isActive: true
    });

    testApplication = await models.Application.create({
      user_id: userId,
      job_id: testJob.id,
      status: 'applied',
      appliedAt: new Date()
    });
  });

  afterEach(async () => {
    if (testApplication) await models.Application.destroy({ where: { id: testApplication.id } }).catch(() => {});
    if (activeResume) await models.Resume.destroy({ where: { id: activeResume.id } }).catch(() => {});
    if (otherUserResume) await models.Resume.destroy({ where: { id: otherUserResume.id } }).catch(() => {});
    if (testConnection) await models.Connection.destroy({ where: { id: testConnection.id } }).catch(() => {});
    if (attackerConnection) await models.Connection.destroy({ where: { id: attackerConnection.id } }).catch(() => {});
    if (testJob) await models.Job.destroy({ where: { id: testJob.id } }).catch(() => {});
    if (attackerJob) await models.Job.destroy({ where: { id: attackerJob.id } }).catch(() => {});
    await models.Note.destroy({ where: { user_id: [userId, otherUserId] } }).catch(() => {});
    await models.Outreach.destroy({ where: { user_id: [userId, otherUserId] } }).catch(() => {});
    await models.ApplicationEvent.destroy({ where: { user_id: [userId, otherUserId] } }).catch(() => {});
  });

  function createConfirmedAction(actionType, target, payload = {}) {
    const action = new ActionModel({
      userId,
      actionType,
      target,
      payload,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      expirationMs: 60000
    });
    action.status = ActionStatuses.CONFIRMED;
    return action;
  }

  describe('1. Job Actions (save_job & change_job_status)', () => {
    test('save_job saves user job idempotently', async () => {
      const action = createConfirmedAction(ActionTypes.SAVE_JOB, { type: TargetTypes.JOB, id: testJob.id });
      
      const res1 = await ActionExecutor.executeAction({ action, authenticatedUserId: userId });
      expect(res1.status).toBe(ActionStatuses.COMPLETED);
      expect(res1.result.status).toBe('saved');

      // Re-executing save_job
      const action2 = createConfirmedAction(ActionTypes.SAVE_JOB, { type: TargetTypes.JOB, id: testJob.id });
      const res2 = await ActionExecutor.executeAction({ action: action2, authenticatedUserId: userId });
      expect(res2.status).toBe(ActionStatuses.COMPLETED);
      expect(res2.result.status).toBe('saved');
    });

    test('save_job rejects foreign job execution', async () => {
      const action = createConfirmedAction(ActionTypes.SAVE_JOB, { type: TargetTypes.JOB, id: attackerJob.id });
      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: userId })
      ).rejects.toThrow(/Unauthorized/);
    });

    test('change_job_status updates status for valid job status values', async () => {
      for (const validStatus of ['interested', 'interviewing', 'offer', 'rejected']) {
        const action = createConfirmedAction(
          ActionTypes.CHANGE_JOB_STATUS,
          { type: TargetTypes.JOB, id: testJob.id },
          { status: validStatus }
        );
        const res = await ActionExecutor.executeAction({ action, authenticatedUserId: userId });
        expect(res.result.status).toBe(validStatus);
      }
    });

    test('change_job_status rejects invalid job status values', async () => {
      const action = createConfirmedAction(
        ActionTypes.CHANGE_JOB_STATUS,
        { type: TargetTypes.JOB, id: testJob.id },
        { status: 'invalid-status-xyz' }
      );
      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: userId })
      ).rejects.toThrow(/Invalid job status/);
    });
  });

  describe('2. Application Creation & Active Resume Fallback', () => {
    test('create_application auto-falls back to active resume when resumeId omitted', async () => {
      const unappliedJob = await models.Job.create({
        title: 'Fullstack Dev',
        user_id: userId
      });

      const action = createConfirmedAction(
        ActionTypes.CREATE_APPLICATION,
        { type: TargetTypes.JOB, id: unappliedJob.id },
        { status: 'applied' }
      );

      const res = await ActionExecutor.executeAction({ action, authenticatedUserId: userId });
      expect(res.status).toBe(ActionStatuses.COMPLETED);
      expect(res.result.applicationId).toBeDefined();

      const createdApp = await models.Application.findByPk(res.result.applicationId);
      expect(createdApp.get('resume_id') || createdApp.resumeId).toBe(activeResume.id);

      await models.ApplicationEvent.destroy({ where: { application_id: createdApp.id } });
      await models.Application.destroy({ where: { id: createdApp.id } });
      await models.Job.destroy({ where: { id: unappliedJob.id } });
    });

    test('create_application uses explicit resumeId when provided', async () => {
      const explicitResume = await models.Resume.create({
        user_id: userId,
        fileName: 'explicit_resume.pdf',
        storageKey: 'key_exp',
        contentType: 'application/pdf',
        sizeBytes: 1024,
        isActive: false
      });

      const unappliedJob = await models.Job.create({
        title: 'Cloud Dev',
        user_id: userId
      });

      const action = createConfirmedAction(
        ActionTypes.CREATE_APPLICATION,
        { type: TargetTypes.JOB, id: unappliedJob.id },
        { resumeId: explicitResume.id, status: 'applied' }
      );

      const res = await ActionExecutor.executeAction({ action, authenticatedUserId: userId });
      expect(res.status).toBe(ActionStatuses.COMPLETED);

      const createdApp = await models.Application.findByPk(res.result.applicationId);
      expect(createdApp.get('resume_id') || createdApp.resumeId).toBe(explicitResume.id);

      await models.ApplicationEvent.destroy({ where: { application_id: createdApp.id } });
      await models.Application.destroy({ where: { id: createdApp.id } });
      await models.Resume.destroy({ where: { id: explicitResume.id } });
      await models.Job.destroy({ where: { id: unappliedJob.id } });
    });

    test('create_application rejects if no active resume exists and no resumeId provided', async () => {
      // Create user without active resume
      const noResumeUserId = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f';
      await models.User.create({
        id: noResumeUserId,
        email: 'noresume@example.com',
        passwordHash: 'hash123'
      });

      const jobNoResume = await models.Job.create({
        title: 'No Resume Job',
        user_id: noResumeUserId
      });

      const action = new ActionModel({
        userId: noResumeUserId,
        actionType: ActionTypes.CREATE_APPLICATION,
        target: { type: TargetTypes.JOB, id: jobNoResume.id },
        requestId: 'req_no_resume',
        expirationMs: 60000
      });
      action.status = ActionStatuses.CONFIRMED;

      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: noResumeUserId })
      ).rejects.toThrow(/A resume is required/);

      await models.Job.destroy({ where: { id: jobNoResume.id } });
      await models.User.destroy({ where: { id: noResumeUserId } });
    });

    test('create_application rejects foreign resume or foreign referral connection', async () => {
      const unappliedJob = await models.Job.create({
        title: 'DevOps Eng',
        user_id: userId
      });

      // Try with foreign resume
      const action1 = createConfirmedAction(
        ActionTypes.CREATE_APPLICATION,
        { type: TargetTypes.JOB, id: unappliedJob.id },
        { resumeId: otherUserResume.id }
      );

      await expect(
        ActionExecutor.executeAction({ action: action1, authenticatedUserId: userId })
      ).rejects.toThrow(/Unauthorized or invalid Resume ID/);

      // Try with foreign referral connection
      const action2 = createConfirmedAction(
        ActionTypes.CREATE_APPLICATION,
        { type: TargetTypes.JOB, id: unappliedJob.id },
        { referralConnectionId: attackerConnection.id }
      );

      await expect(
        ActionExecutor.executeAction({ action: action2, authenticatedUserId: userId })
      ).rejects.toThrow(/Unauthorized or invalid Connection ID/);

      await models.Job.destroy({ where: { id: unappliedJob.id } });
    });

    test('create_application prevents duplicate application and returns idempotent status', async () => {
      // testApplication already exists for testJob
      const action = createConfirmedAction(
        ActionTypes.CREATE_APPLICATION,
        { type: TargetTypes.JOB, id: testJob.id },
        { status: 'applied' }
      );

      const res = await ActionExecutor.executeAction({ action, authenticatedUserId: userId });
      expect(res.status).toBe(ActionStatuses.COMPLETED);
      expect(res.result.status).toBe('already_exists');
      expect(res.result.applicationId).toBe(testApplication.id);
    });
  });

  describe('3. Application Status & Transition Actions', () => {
    test('change_application_status updates application status and creates event', async () => {
      for (const validStatus of ['screening', 'interview', 'offer', 'rejected']) {
        const action = createConfirmedAction(
          ActionTypes.CHANGE_APPLICATION_STATUS,
          { type: TargetTypes.APPLICATION, id: testApplication.id },
          { status: validStatus }
        );
        const res = await ActionExecutor.executeAction({ action, authenticatedUserId: userId });
        expect(res.status).toBe(ActionStatuses.COMPLETED);
        expect(res.result.status).toBe(validStatus);

        const reloadedApp = await models.Application.findByPk(testApplication.id);
        expect(reloadedApp.status).toBe(validStatus);
      }
    });

    test('change_application_status rejects invalid application status values', async () => {
      const action = createConfirmedAction(
        ActionTypes.CHANGE_APPLICATION_STATUS,
        { type: TargetTypes.APPLICATION, id: testApplication.id },
        { status: 'invalid-app-status' }
      );
      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: userId })
      ).rejects.toThrow(/Invalid application status/);
    });

    test('change_application_status rejects execution on foreign application', async () => {
      const foreignApp = await models.Application.create({
        user_id: otherUserId,
        job_id: attackerJob.id,
        status: 'applied'
      });

      const action = createConfirmedAction(
        ActionTypes.CHANGE_APPLICATION_STATUS,
        { type: TargetTypes.APPLICATION, id: foreignApp.id },
        { status: 'interview' }
      );

      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: userId })
      ).rejects.toThrow(/Unauthorized/);

      await models.Application.destroy({ where: { id: foreignApp.id } });
    });
  });

  describe('4. Follow-up & Planning Orchestration', () => {
    test('schedule_followup handles application and job targets safely', async () => {
      const followUpDate = '2026-11-01';

      // On Application
      const actionApp = createConfirmedAction(
        ActionTypes.SCHEDULE_FOLLOWUP,
        { type: TargetTypes.APPLICATION, id: testApplication.id },
        { followUpAt: followUpDate }
      );
      const resApp = await ActionExecutor.executeAction({ action: actionApp, authenticatedUserId: userId });
      expect(resApp.status).toBe(ActionStatuses.COMPLETED);

      // On Job
      const actionJob = createConfirmedAction(
        ActionTypes.SCHEDULE_FOLLOWUP,
        { type: TargetTypes.JOB, id: testJob.id },
        { followUpAt: followUpDate }
      );
      const resJob = await ActionExecutor.executeAction({ action: actionJob, authenticatedUserId: userId });
      expect(resJob.status).toBe(ActionStatuses.COMPLETED);
    });

    test('ActionPlanner plans Job vs Application intents accurately without database mutations', async () => {
      // Plan change_job_status
      const planJob = await ActionPlanner.planAction({
        userId,
        intent: 'Mark this job as interested',
        targetId: testJob.id,
        payload: { status: 'interested' },
        requestId: 'req_plan_job'
      });
      expect(planJob.action.actionType).toBe(ActionTypes.CHANGE_JOB_STATUS);
      expect(planJob.action.target.type).toBe(TargetTypes.JOB);

      // Plan change_application_status
      const planApp = await ActionPlanner.planAction({
        userId,
        intent: 'Mark my application as interview',
        targetId: testApplication.id,
        payload: { status: 'interview' },
        requestId: 'req_plan_app'
      });
      expect(planApp.action.actionType).toBe(ActionTypes.CHANGE_APPLICATION_STATUS);
      expect(planApp.action.target.type).toBe(TargetTypes.APPLICATION);
    });
  });
});
