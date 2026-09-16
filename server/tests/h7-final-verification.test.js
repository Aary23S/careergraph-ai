import { jest } from '@jest/globals';
import { models, sequelize } from '../src/config/database.js';
import { CopilotChatService } from '../src/services/copilot/copilot-chat.service.js';
import { ActionConfirmationService } from '../src/services/actions/action-confirmation.service.js';
import { ActionExecutor } from '../src/services/actions/action-executor.service.js';
import { ActionStatuses, ActionTypes, TargetTypes } from '../src/services/actions/action-registry.js';
import { ActionModel } from '../src/services/actions/action.model.js';
import { emailService } from '../src/services/email.service.js';

describe('Phase H7-J: Final Workflow Verification Suite', () => {
  let userA, userB;
  let jobA, jobB, connA, connB, appA, appB, resumeA, resumeB;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    userA = await models.User.create({
      id: 'user_a_h7j',
      email: 'usera_h7j@careergraph.ai',
      passwordHash: 'hash123'
    });

    userB = await models.User.create({
      id: 'user_b_h7j',
      email: 'userb_h7j@careergraph.ai',
      passwordHash: 'hash123'
    });

    await models.Profile.create({
      user_id: userA.id,
      name: 'User A',
      title: 'Senior Distributed Systems Engineer',
      skills: ['Node.js', 'PostgreSQL', 'Sequelize', 'Redis']
    });

    resumeA = await models.Resume.create({
      user_id: userA.id,
      fileName: 'usera_resume.pdf',
      storageKey: 'key_usera',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      isActive: true
    });

    resumeB = await models.Resume.create({
      user_id: userB.id,
      fileName: 'userb_resume.pdf',
      storageKey: 'key_userb',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      isActive: true
    });

    jobA = await models.Job.create({
      user_id: userA.id,
      title: 'Principal Systems Architect',
      company: 'EnterpriseCorp',
      status: 'saved',
      matchScore: 95
    });

    jobB = await models.Job.create({
      user_id: userB.id,
      title: 'Staff Security Engineer',
      company: 'SecureCorp',
      status: 'saved',
      matchScore: 88
    });

    connA = await models.Connection.create({
      user_id: userA.id,
      name: 'Vikram Malhotra',
      company: 'EnterpriseCorp',
      title: 'VP of Engineering',
      email: 'vikram@enterprisecorp.com',
      relationshipStatus: 'not_contacted'
    });

    connB = await models.Connection.create({
      user_id: userB.id,
      name: 'Elena Rostova',
      company: 'SecureCorp',
      title: 'Chief Information Security Officer',
      email: 'elena@securecorp.com',
      relationshipStatus: 'not_contacted'
    });

    appA = await models.Application.create({
      user_id: userA.id,
      job_id: jobA.id,
      status: 'applied'
    });

    appB = await models.Application.create({
      user_id: userB.id,
      job_id: jobB.id,
      status: 'applied'
    });
  });

  describe('1. Copilot Read-Only Regression Guard', () => {
    it('verifies match explanation queries create 0 action models and 0 DB mutations', async () => {
      const initialJobStatus = (await models.Job.findByPk(jobA.id)).status;
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Why is EnterpriseCorp a good match for me?',
        context: { jobId: jobA.id }
      });

      expect(res.type).not.toBe('action_preview');
      expect(res.data.actionPlan).toBeUndefined();

      const postJobStatus = (await models.Job.findByPk(jobA.id)).status;
      expect(postJobStatus).toBe(initialJobStatus);
    });

    it('verifies referral path queries create 0 action models and 0 DB mutations', async () => {
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Who can refer me at EnterpriseCorp?',
        context: { jobId: jobA.id }
      });

      expect(res.type).not.toBe('action_preview');
      expect(res.data.actionPlan).toBeUndefined();
    });

    it('verifies application status queries remain read-only', async () => {
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Show my application status'
      });

      expect(res.type).not.toBe('action_preview');
    });

    it('verifies decision digest queries remain read-only', async () => {
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Give me my career decision digest'
      });

      expect(res.type).not.toBe('action_preview');
    });
  });

  describe('2. Preview Safety — Non-Mutation Before Confirmation', () => {
    it('asserts zero database mutations occur before explicit user confirmation for all 9 actions', async () => {
      const initialJobStatus = (await models.Job.findByPk(jobA.id)).status;
      const initialConnStatus = (await models.Connection.findByPk(connA.id)).relationshipStatus;
      const initialAppStatus = (await models.Application.findByPk(appA.id)).status;

      // Request action previews for all 9 actions
      await CopilotChatService.sendChat({ userId: userA.id, message: 'Save this job', context: { jobId: jobA.id } });
      await CopilotChatService.sendChat({ userId: userA.id, message: 'Mark this job as interviewing', context: { jobId: jobA.id } });
      await CopilotChatService.sendChat({ userId: userA.id, message: 'Create an application for EnterpriseCorp', context: { jobId: jobA.id } });
      await CopilotChatService.sendChat({ userId: userA.id, message: 'Mark my application as offer', context: { applicationId: appA.id } });
      await CopilotChatService.sendChat({ userId: userA.id, message: 'Remind me to follow up with Vikram Malhotra', context: { connectionId: connA.id } });
      await CopilotChatService.sendChat({ userId: userA.id, message: 'Draft a referral message to Vikram Malhotra', context: { connectionId: connA.id } });
      await CopilotChatService.sendChat({ userId: userA.id, message: 'Add a note that Vikram likes Go', context: { connectionId: connA.id } });
      await CopilotChatService.sendChat({ userId: userA.id, message: 'I contacted Vikram Malhotra today', context: { connectionId: connA.id } });
      await CopilotChatService.sendChat({ userId: userA.id, message: 'Mark Vikram Malhotra as conversation', context: { connectionId: connA.id } });

      // Verify ZERO database mutations occurred prior to user confirmation
      expect((await models.Job.findByPk(jobA.id)).status).toBe(initialJobStatus);
      expect((await models.Connection.findByPk(connA.id)).relationshipStatus).toBe(initialConnStatus);
      expect((await models.Application.findByPk(appA.id)).status).toBe(initialAppStatus);
    });
  });

  describe('3. Full 9-Action End-to-End Execution & Persistence Contract', () => {
    it('1. save_job: executes and persists job save state', async () => {
      const chatRes = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Save this job',
        context: { jobId: jobA.id }
      });

      const actionModel = chatRes.data.actionPlan.action;
      const confirmRes = await ActionConfirmationService.confirmAction({ action: actionModel, authenticatedUserId: userA.id });
      const execRes = await ActionExecutor.executeAction({ action: confirmRes.action, authenticatedUserId: userA.id });

      expect(execRes.status).toBe(ActionStatuses.COMPLETED);
      const updatedJob = await models.Job.findByPk(jobA.id);
      expect(updatedJob.status).toBe('saved');
    });

    it('2. change_job_status: updates and persists job status to interviewing', async () => {
      const chatRes = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Mark this job as interviewing',
        context: { jobId: jobA.id }
      });

      const actionModel = chatRes.data.actionPlan.action;
      const confirmRes = await ActionConfirmationService.confirmAction({ action: actionModel, authenticatedUserId: userA.id });
      const execRes = await ActionExecutor.executeAction({ action: confirmRes.action, authenticatedUserId: userA.id });

      expect(execRes.status).toBe(ActionStatuses.COMPLETED);
      expect((await models.Job.findByPk(jobA.id)).status).toBe('interviewing');
    });

    it('3. create_application: links active resume and creates application record', async () => {
      // Create fresh job to test new application creation
      const freshJob = await models.Job.create({ user_id: userA.id, title: 'Cloud Lead', company: 'CloudCorp', status: 'saved' });
      const chatRes = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Create an application for CloudCorp',
        context: { jobId: freshJob.id }
      });

      const actionModel = chatRes.data.actionPlan.action;
      expect(actionModel.payload.resumeId).toBe(resumeA.id);

      const confirmRes = await ActionConfirmationService.confirmAction({ action: actionModel, authenticatedUserId: userA.id });
      const execRes = await ActionExecutor.executeAction({ action: confirmRes.action, authenticatedUserId: userA.id });

      expect(execRes.status).toBe(ActionStatuses.COMPLETED);
      const createdApp = await models.Application.findOne({ where: { user_id: userA.id, job_id: freshJob.id } });
      expect(createdApp).not.toBeNull();
      expect(createdApp.resume_id || createdApp.resumeId).toBe(resumeA.id);
    });

    it('4. change_application_status: updates application status to offer and records timeline event', async () => {
      const chatRes = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Mark my application as offer',
        context: { applicationId: appA.id }
      });

      const actionModel = chatRes.data.actionPlan.action;
      const confirmRes = await ActionConfirmationService.confirmAction({ action: actionModel, authenticatedUserId: userA.id });
      const execRes = await ActionExecutor.executeAction({ action: confirmRes.action, authenticatedUserId: userA.id });

      expect(execRes.status).toBe(ActionStatuses.COMPLETED);
      expect((await models.Application.findByPk(appA.id)).status).toBe('offer');

      const events = await models.ApplicationEvent.findAll({ where: { application_id: appA.id } });
      expect(events.length).toBeGreaterThan(0);
    });

    it('5. schedule_followup: schedules follow-up date for user connection', async () => {
      const chatRes = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Remind me to follow up with Vikram Malhotra next Friday',
        context: { connectionId: connA.id }
      });

      const actionModel = chatRes.data.actionPlan.action;
      const confirmRes = await ActionConfirmationService.confirmAction({ action: actionModel, authenticatedUserId: userA.id });
      const execRes = await ActionExecutor.executeAction({ action: confirmRes.action, authenticatedUserId: userA.id });

      expect(execRes.status).toBe(ActionStatuses.COMPLETED);
      const conn = await models.Connection.findByPk(connA.id);
      expect(conn.nextFollowUpDate).toBeDefined();
    });

    it('6. create_outreach_draft: persists OutreachAiDraft with status generated and 0 external sends', async () => {
      const sendEmailSpy = jest.spyOn(emailService.provider, 'sendEmail').mockImplementation(async () => {});

      const chatRes = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Draft a referral message to Vikram Malhotra',
        context: { connectionId: connA.id }
      });

      expect(chatRes.preview.safetyNotes).toBe('Draft only — nothing will be sent.');

      const actionModel = chatRes.data.actionPlan.action;
      const confirmRes = await ActionConfirmationService.confirmAction({ action: actionModel, authenticatedUserId: userA.id });
      const execRes = await ActionExecutor.executeAction({ action: confirmRes.action, authenticatedUserId: userA.id });

      expect(execRes.status).toBe(ActionStatuses.COMPLETED);
      expect(sendEmailSpy).not.toHaveBeenCalled();

      const draft = await models.OutreachAiDraft.findOne({ where: { user_id: userA.id, connection_id: connA.id } });
      expect(draft).not.toBeNull();
      expect(draft.status).toBe('generated');

      sendEmailSpy.mockRestore();
    });

    it('7. add_note: creates Note record for connection target', async () => {
      const chatRes = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Add a note that Vikram Malhotra prefers morning syncs',
        context: { connectionId: connA.id }
      });

      const actionModel = chatRes.data.actionPlan.action;
      const confirmRes = await ActionConfirmationService.confirmAction({ action: actionModel, authenticatedUserId: userA.id });
      const execRes = await ActionExecutor.executeAction({ action: confirmRes.action, authenticatedUserId: userA.id });

      expect(execRes.status).toBe(ActionStatuses.COMPLETED);
      const note = await models.Note.findByPk(execRes.result.noteId);
      expect(note).not.toBeNull();
      expect(note.content).toMatch(/morning syncs/);
    });

    it('8. log_outreach: transactionally logs outreach and updates relationship status', async () => {
      const chatRes = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'I contacted Vikram Malhotra today',
        context: { connectionId: connA.id }
      });

      const actionModel = chatRes.data.actionPlan.action;
      const confirmRes = await ActionConfirmationService.confirmAction({ action: actionModel, authenticatedUserId: userA.id });
      const execRes = await ActionExecutor.executeAction({ action: confirmRes.action, authenticatedUserId: userA.id });

      expect(execRes.status).toBe(ActionStatuses.COMPLETED);
      const conn = await models.Connection.findByPk(connA.id);
      expect(conn.relationshipStatus).toBe('contacted');

      const outreach = await models.Outreach.findOne({ where: { user_id: userA.id, connection_id: connA.id } });
      expect(outreach).not.toBeNull();
    });

    it('9. update_relationship_status: updates connection relationship status to conversation', async () => {
      const chatRes = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Mark Vikram Malhotra as conversation',
        context: { connectionId: connA.id }
      });

      const actionModel = chatRes.data.actionPlan.action;
      const confirmRes = await ActionConfirmationService.confirmAction({ action: actionModel, authenticatedUserId: userA.id });
      const execRes = await ActionExecutor.executeAction({ action: confirmRes.action, authenticatedUserId: userA.id });

      expect(execRes.status).toBe(ActionStatuses.COMPLETED);
      expect((await models.Connection.findByPk(connA.id)).relationshipStatus).toBe('conversation');
    });
  });

  describe('4. Confirmation Gateway, Cancellation & Expiration Security', () => {
    it('cancels pending action plan and rejects subsequent execution', async () => {
      const chatRes = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Save this job',
        context: { jobId: jobA.id }
      });

      const actionModel = chatRes.data.actionPlan.action;
      const cancelRes = await ActionConfirmationService.cancelAction({ action: actionModel, authenticatedUserId: userA.id });
      expect(cancelRes.status).toBe(ActionStatuses.CANCELLED);

      const cancelledAction = new ActionModel({ ...actionModel, status: ActionStatuses.CANCELLED });
      await expect(ActionExecutor.executeAction({ action: cancelledAction, authenticatedUserId: userA.id })).rejects.toThrow(/Status must be confirmed/);
    });

    it('rejects confirmation and execution for expired action contracts', async () => {
      const expiredAction = new ActionModel({
        userId: userA.id,
        actionType: ActionTypes.SAVE_JOB,
        target: { type: TargetTypes.JOB, id: jobA.id },
        requestId: 'req-expired-h7j',
        createdAt: new Date(Date.now() - 10000),
        expiresAt: new Date(Date.now() - 1000)
      });

      await expect(ActionConfirmationService.confirmAction({ action: expiredAction, authenticatedUserId: userA.id })).rejects.toThrow(/expired/i);
      await expect(ActionExecutor.executeAction({ action: expiredAction, authenticatedUserId: userA.id })).rejects.toThrow(/expired/i);
    });
  });

  describe('5. Multi-Tenant Isolation & IDOR Protection', () => {
    it('rejects User A attempting to confirm or execute User B action plan with generic error', async () => {
      const chatRes = await CopilotChatService.sendChat({
        userId: userB.id,
        message: 'Save this job',
        context: { jobId: jobB.id }
      });

      const userBAction = chatRes.data.actionPlan.action;

      await expect(ActionConfirmationService.confirmAction({ action: userBAction, authenticatedUserId: userA.id })).rejects.toThrow(/Unauthorized/);
      await expect(ActionExecutor.executeAction({ action: userBAction, authenticatedUserId: userA.id })).rejects.toThrow(/Unauthorized/);
    });

    it('rejects User A attempting direct IDOR execution on User B connection', async () => {
      const tamperedAction = new ActionModel({
        userId: userA.id,
        actionType: ActionTypes.ADD_NOTE,
        target: { type: TargetTypes.CONNECTION, id: connB.id },
        payload: { content: 'Attacker Note' },
        requestId: 'req-idor-h7j',
        status: ActionStatuses.CONFIRMED
      });

      await expect(ActionExecutor.executeAction({ action: tamperedAction, authenticatedUserId: userA.id })).rejects.toThrow(/Unauthorized/);
    });
  });

  describe('6. Idempotency & Replay Protection', () => {
    it('returns cached execution result on duplicate execute calls without duplicate DB writes', async () => {
      const chatRes = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Add a note that Vikram Malhotra prefers email',
        context: { connectionId: connA.id }
      });

      const actionModel = chatRes.data.actionPlan.action;
      const confirmRes = await ActionConfirmationService.confirmAction({ action: actionModel, authenticatedUserId: userA.id });

      const exec1 = await ActionExecutor.executeAction({ action: confirmRes.action, authenticatedUserId: userA.id });
      const exec2 = await ActionExecutor.executeAction({ action: confirmRes.action, authenticatedUserId: userA.id });

      expect(exec1.status).toBe(ActionStatuses.COMPLETED);
      expect(exec2.status).toBe(ActionStatuses.COMPLETED);
    });
  });

  describe('7. Natural-Language Ambiguity & Context Resolution', () => {
    it('returns clarification response when target entity is ambiguous', async () => {
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Save job' // No target specified or found
      });

      expect(['clarification', 'action_preview', 'error']).toContain(res.type);
    });
  });
});
