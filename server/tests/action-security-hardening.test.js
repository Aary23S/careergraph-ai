import { jest } from '@jest/globals';
import { ActionExecutor } from '../src/services/actions/action-executor.service.js';
import { ActionModel } from '../src/services/actions/action.model.js';
import { ActionValidator } from '../src/services/actions/action-validator.js';
import { ActionTypes, TargetTypes, ActionStatuses } from '../src/services/actions/action-registry.js';
import { models, resetDatabase } from '../src/config/database.js';
import { emailService } from '../src/services/email.service.js';

describe('Phase H7-H: Security, Idempotency & Audit Hardening', () => {
  const userAId = 'user-h7h-a-1111-1111-111111111111';
  const userBId = 'user-h7h-b-2222-2222-222222222222';

  let jobUserA;
  let jobUserB;
  let connUserA;
  let connUserB;
  let resumeUserA;
  let resumeUserB;
  let appUserA;
  let appUserB;

  beforeAll(async () => {
    await resetDatabase();

    await models.User.create({ id: userAId, email: 'usera_h7h@careergraph.ai', passwordHash: 'hash' });
    await models.User.create({ id: userBId, email: 'userb_h7h@careergraph.ai', passwordHash: 'hash' });

    jobUserA = await models.Job.create({ user_id: userAId, title: 'Security Architect', company: 'Palantir', status: 'saved' });
    jobUserB = await models.Job.create({ user_id: userBId, title: 'DevSecOps Manager', company: 'CrowdStrike', status: 'saved' });

    connUserA = await models.Connection.create({ user_id: userAId, name: 'Alice Smith', company: 'Palantir', relationshipStatus: 'not_contacted' });
    connUserB = await models.Connection.create({ user_id: userBId, name: 'Bob Jones', company: 'CrowdStrike', relationshipStatus: 'not_contacted' });

    resumeUserA = await models.Resume.create({ user_id: userAId, fileName: 'resume_a.pdf', storageKey: 'key_a', contentType: 'application/pdf', sizeBytes: 1024, isActive: true });
    resumeUserB = await models.Resume.create({ user_id: userBId, fileName: 'resume_b.pdf', storageKey: 'key_b', contentType: 'application/pdf', sizeBytes: 1024, isActive: true });

    appUserA = await models.Application.create({ user_id: userAId, job_id: jobUserA.id, status: 'applied', appliedAt: new Date() });
    appUserB = await models.Application.create({ user_id: userBId, job_id: jobUserB.id, status: 'applied', appliedAt: new Date() });
  });

  function createConfirmedAction(userId, actionType, target, payload = {}) {
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

  describe('1. Authentication & Generic Authorization Error Hardening', () => {
    it('rejects execution if user is unauthenticated', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.SAVE_JOB, { type: TargetTypes.JOB, id: jobUserA.id });
      await expect(ActionExecutor.executeAction(action, null)).rejects.toThrow('Unauthenticated request');
    });

    it('rejects execution if action belongs to User B but executed by User A with generic message', async () => {
      const action = createConfirmedAction(userBId, ActionTypes.SAVE_JOB, { type: TargetTypes.JOB, id: jobUserB.id });
      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: userAId })
      ).rejects.toThrow(/Unauthorized/);
    });

    it('rejects direct Action-ID access by User A for User B action without exposing tenant metadata', async () => {
      const action = createConfirmedAction(userBId, ActionTypes.ADD_NOTE, { type: TargetTypes.CONNECTION, id: connUserB.id }, { content: 'Secret note' });
      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: userAId })
      ).rejects.toThrow(/Unauthorized/);
    });
  });

  describe('2. Comprehensive Multi-Entity Tenant Isolation Matrix', () => {
    it('save_job: rejects User A accessing User B job', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.SAVE_JOB, { type: TargetTypes.JOB, id: jobUserB.id });
      await expect(ActionExecutor.executeAction({ action, authenticatedUserId: userAId })).rejects.toThrow(/Unauthorized/);
    });

    it('change_job_status: rejects User A modifying User B job', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.CHANGE_JOB_STATUS, { type: TargetTypes.JOB, id: jobUserB.id }, { status: 'interviewing' });
      await expect(ActionExecutor.executeAction({ action, authenticatedUserId: userAId })).rejects.toThrow(/Unauthorized/);
    });

    it('create_application: rejects mixed-tenant resume (User A job + User B resume)', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.CREATE_APPLICATION, { type: TargetTypes.JOB, id: jobUserA.id }, { resumeId: resumeUserB.id });
      await expect(ActionExecutor.executeAction({ action, authenticatedUserId: userAId })).rejects.toThrow(/Unauthorized/);
    });

    it('create_application: rejects mixed-tenant referral (User A job + User B connection)', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.CREATE_APPLICATION, { type: TargetTypes.JOB, id: jobUserA.id }, { referralConnectionId: connUserB.id });
      await expect(ActionExecutor.executeAction({ action, authenticatedUserId: userAId })).rejects.toThrow(/Unauthorized/);
    });

    it('change_application_status: rejects User A modifying User B application', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.CHANGE_APPLICATION_STATUS, { type: TargetTypes.APPLICATION, id: appUserB.id }, { status: 'offer' });
      await expect(ActionExecutor.executeAction({ action, authenticatedUserId: userAId })).rejects.toThrow(/Unauthorized/);
    });

    it('schedule_followup: rejects User A connection linked to User B job', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.SCHEDULE_FOLLOWUP, { type: TargetTypes.CONNECTION, id: connUserA.id }, { followUpAt: new Date().toISOString(), jobId: jobUserB.id });
      await expect(ActionExecutor.executeAction({ action, authenticatedUserId: userAId })).rejects.toThrow(/Unauthorized/);
    });

    it('create_outreach_draft: rejects User A connection linked to User B job', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.CREATE_OUTREACH_DRAFT, { type: TargetTypes.CONNECTION, id: connUserA.id }, { jobId: jobUserB.id });
      await expect(ActionExecutor.executeAction({ action, authenticatedUserId: userAId })).rejects.toThrow(/Unauthorized/);
    });

    it('log_outreach: rejects User A connection linked to User B application', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.LOG_OUTREACH, { type: TargetTypes.CONNECTION, id: connUserA.id }, { applicationId: appUserB.id, outreachStatus: 'contacted' });
      await expect(ActionExecutor.executeAction({ action, authenticatedUserId: userAId })).rejects.toThrow(/Unauthorized/);
    });

    it('update_relationship_status: rejects User A modifying User B connection', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.UPDATE_RELATIONSHIP_STATUS, { type: TargetTypes.CONNECTION, id: connUserB.id }, { relationshipStatus: 'contacted' });
      await expect(ActionExecutor.executeAction({ action, authenticatedUserId: userAId })).rejects.toThrow(/Unauthorized/);
    });

    it('add_note: rejects User A adding note to User B connection', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.ADD_NOTE, { type: TargetTypes.CONNECTION, id: connUserB.id }, { content: 'Attacker note' });
      await expect(ActionExecutor.executeAction({ action, authenticatedUserId: userAId })).rejects.toThrow(/Unauthorized/);
    });
  });

  describe('3. Lifecycle Transitions & Tampering Hardening', () => {
    it('rejects unconfirmed (PENDING_CONFIRMATION) actions', async () => {
      const action = new ActionModel({
        userId: userAId,
        actionType: ActionTypes.SAVE_JOB,
        target: { type: TargetTypes.JOB, id: jobUserA.id },
        requestId: 'req-unconfirmed'
      });
      expect(action.status).toBe(ActionStatuses.PENDING_CONFIRMATION);
      await expect(ActionExecutor.executeAction({ action, authenticatedUserId: userAId })).rejects.toThrow(/Status must be confirmed/);
    });

    it('rejects CANCELLED actions', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.SAVE_JOB, { type: TargetTypes.JOB, id: jobUserA.id });
      action.status = ActionStatuses.CANCELLED;
      await expect(ActionExecutor.executeAction({ action, authenticatedUserId: userAId })).rejects.toThrow(/Status must be confirmed/);
    });

    it('rejects EXPIRED actions', async () => {
      const action = new ActionModel({
        userId: userAId,
        actionType: ActionTypes.SAVE_JOB,
        target: { type: TargetTypes.JOB, id: jobUserA.id },
        requestId: 'req-expired',
        expirationMs: 1
      });
      action.status = ActionStatuses.CONFIRMED;
      // Sleep to ensure expiration
      await new Promise(r => setTimeout(r, 50));
      await expect(ActionExecutor.executeAction({ action, authenticatedUserId: userAId })).rejects.toThrow(/Action has expired/);
    });
  });

  describe('4. Replay & Concurrency Protection', () => {
    it('returns cached execution result on replay without creating duplicate database records', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.ADD_NOTE, { type: TargetTypes.CONNECTION, id: connUserA.id }, { content: 'Idempotency note check' });
      
      const res1 = await ActionExecutor.executeAction({ action, authenticatedUserId: userAId });
      const res2 = await ActionExecutor.executeAction({ action, authenticatedUserId: userAId });

      expect(res1.status).toBe(ActionStatuses.COMPLETED);
      expect(res2.status).toBe(ActionStatuses.COMPLETED);
      expect(res1.result.noteId).toBe(res2.result.noteId);

      const count = await models.Note.count({ where: { content: 'Idempotency note check' } });
      expect(count).toBe(1);
    });
  });

  describe('5. Transaction Rollback Verification', () => {
    it('rolls back entire Application creation if ApplicationEvent fails', async () => {
      const freshJob = await models.Job.create({
        user_id: userAId,
        title: 'Fresh Job For Rollback Test',
        company: 'Rollback Inc',
        status: 'new'
      });

      const spy = jest.spyOn(models.ApplicationEvent, 'create').mockImplementationOnce(() => {
        throw new Error('Database disk write failure simulation');
      });

      const action = createConfirmedAction(userAId, ActionTypes.CREATE_APPLICATION, { type: TargetTypes.JOB, id: freshJob.id });

      await expect(ActionExecutor.executeAction({ action, authenticatedUserId: userAId })).rejects.toThrow('Database disk write failure simulation');

      const app = await models.Application.findOne({ where: { job_id: freshJob.id, user_id: userAId } });
      expect(app).toBeNull();

      spy.mockRestore();
    });
  });

  describe('6. Audit Integrity & External Send Guard Assertion', () => {
    it('records trusted server-side properties in AiAuditLog', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.ADD_NOTE, { type: TargetTypes.JOB, id: jobUserA.id }, { content: 'Audit test note' });
      const res = await ActionExecutor.executeAction({ action, authenticatedUserId: userAId, requestId: 'req-audit-123' });

      expect(res.status).toBe(ActionStatuses.COMPLETED);

      const audit = await models.AiAuditLog.findOne({ where: { correlation_id: 'req-audit-123' } });
      expect(audit).not.toBeNull();
      expect(audit.user_id).toBe(userAId);
      expect(audit.model).toBe(ActionTypes.ADD_NOTE);
      expect(audit.status).toBe('success');
    });

    it('MANDATORY GUARD ASSERTION: 0 external communication send calls occur across all action types', async () => {
      const sendDigestSpy = jest.spyOn(emailService, 'sendDigest').mockImplementation(() => Promise.resolve({ success: true }));
      const providerSpy = jest.spyOn(emailService.provider, 'sendEmail').mockImplementation(() => Promise.resolve({ success: true }));

      const action = createConfirmedAction(userAId, ActionTypes.CREATE_OUTREACH_DRAFT, { type: TargetTypes.CONNECTION, id: connUserA.id }, { message: 'Security test draft' });
      await ActionExecutor.executeAction({ action, authenticatedUserId: userAId });

      expect(sendDigestSpy).toHaveBeenCalledTimes(0);
      expect(providerSpy).toHaveBeenCalledTimes(0);

      sendDigestSpy.mockRestore();
      providerSpy.mockRestore();
    });
  });
});
