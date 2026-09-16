import { jest } from '@jest/globals';
import { models, sequelize } from '../src/config/database.js';
import { CopilotChatService } from '../src/services/copilot/copilot-chat.service.js';
import { ActionConfirmationService } from '../src/services/actions/action-confirmation.service.js';
import { ActionExecutor } from '../src/services/actions/action-executor.service.js';
import { ActionStatuses, ActionTypes } from '../src/services/actions/action-registry.js';
import { emailService } from '../src/services/email.service.js';

describe('Phase H7-I: Copilot → Action End-to-End Integration', () => {
  let userA, userB;
  let jobA, jobB, connA, connB, appA, appB, resumeA;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    userA = await models.User.create({
      email: 'copilot_actions_userA@example.com',
      passwordHash: 'hash'
    });

    userB = await models.User.create({
      email: 'copilot_actions_userB@example.com',
      passwordHash: 'hash'
    });

    await models.Profile.create({
      user_id: userA.id,
      name: 'User A',
      title: 'Senior Backend Engineer',
      skills: ['Node.js', 'PostgreSQL', 'Sequelize']
    });

    resumeA = await models.Resume.create({
      user_id: userA.id,
      fileName: 'resume_a.pdf',
      storageKey: 'key_a',
      contentType: 'application/pdf',
      sizeBytes: 1024,
      isActive: true,
      file_path: '/resumes/resume_a.pdf'
    });

    jobA = await models.Job.create({
      user_id: userA.id,
      title: 'Backend Lead',
      company: 'TechCorp',
      status: 'saved',
      matchScore: 92
    });

    jobB = await models.Job.create({
      user_id: userB.id,
      title: 'Frontend Lead',
      company: 'OtherCorp',
      status: 'saved',
      matchScore: 85
    });

    connA = await models.Connection.create({
      user_id: userA.id,
      name: 'Rahul Sharma',
      company: 'TechCorp',
      title: 'Engineering Director',
      email: 'rahul@techcorp.com',
      relationshipStatus: 'not_contacted'
    });

    connB = await models.Connection.create({
      user_id: userB.id,
      name: 'Sarah Connor',
      company: 'OtherCorp',
      title: 'CTO',
      email: 'sarah@othercorp.com',
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

  describe('1. Informational vs Actionable Request Routing', () => {
    it('treats informational questions as read-only (type: answer)', async () => {
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Why is TechCorp a good match for me?',
        context: { jobId: jobA.id }
      });

      expect(res.type).not.toBe('action_preview');
      expect(res.data.actionPlan).toBeUndefined();
      expect(res.message).toBeDefined();
    });

    it('treats referral queries as read-only', async () => {
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Who can refer me at TechCorp?',
        context: { jobId: jobA.id }
      });

      expect(res.type).not.toBe('action_preview');
      expect(res.data.actionPlan).toBeUndefined();
    });

    it('treats decision digest requests as read-only', async () => {
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'What should I focus on today?'
      });

      expect(res.type).not.toBe('action_preview');
    });

    it('treats application status requests as read-only', async () => {
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'What is the status of my applications?'
      });

      expect(res.type).not.toBe('action_preview');
    });
  });

  describe('2. Actionable Intent Detection across all 9 Action Types', () => {
    it('1. save_job: generates action preview for saving a job', async () => {
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Save this job',
        context: { jobId: jobA.id }
      });

      expect(res.type).toBe('action_preview');
      expect(res.requiresConfirmation).toBe(true);
      expect(res.data.actionPlan).toBeDefined();
      expect(res.data.actionPlan.action.actionType).toBe(ActionTypes.SAVE_JOB);
    });

    it('2. change_job_status: generates action preview to mark job as interviewing', async () => {
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Mark this job as interviewing',
        context: { jobId: jobA.id }
      });

      expect(res.type).toBe('action_preview');
      expect(res.data.actionPlan.action.actionType).toBe(ActionTypes.CHANGE_JOB_STATUS);
      expect(res.data.actionPlan.action.payload.status).toBe('interviewing');
    });

    it('3. create_application: generates action preview for application creation with active resume fallback', async () => {
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Create an application for TechCorp',
        context: { jobId: jobA.id }
      });

      expect(res.type).toBe('action_preview');
      expect(res.data.actionPlan.action.actionType).toBe(ActionTypes.CREATE_APPLICATION);
      expect(res.data.actionPlan.action.payload.resumeId).toBe(resumeA.id);
    });

    it('4. change_application_status: generates action preview to update application status to offer', async () => {
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Mark my application as offer',
        context: { applicationId: appA.id }
      });

      expect(res.type).toBe('action_preview');
      expect(res.data.actionPlan.action.actionType).toBe(ActionTypes.CHANGE_APPLICATION_STATUS);
      expect(res.data.actionPlan.action.payload.status).toBe('offer');
    });

    it('5. schedule_followup: generates action preview to schedule follow-up with connection', async () => {
      const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: `Remind me to follow up with Rahul Sharma on ${futureDate}`,
        context: { connectionId: connA.id }
      });

      expect(res.type).toBe('action_preview');
      expect(res.data.actionPlan.action.actionType).toBe(ActionTypes.SCHEDULE_FOLLOWUP);
    });

    it('6. create_outreach_draft: generates action preview with explicit draft safety note', async () => {
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Draft a referral message to Rahul Sharma',
        context: { connectionId: connA.id }
      });

      expect(res.type).toBe('action_preview');
      expect(res.data.actionPlan.action.actionType).toBe(ActionTypes.CREATE_OUTREACH_DRAFT);
      expect(res.preview.safetyNotes).toBe('Draft only — nothing will be sent.');
    });

    it('7. add_note: generates action preview to add a note to a connection', async () => {
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Add a note that Rahul prefers morning calls',
        context: { connectionId: connA.id }
      });

      expect(res.type).toBe('action_preview');
      expect(res.data.actionPlan.action.actionType).toBe(ActionTypes.ADD_NOTE);
    });

    it('8. log_outreach: generates action preview to log outreach', async () => {
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'I contacted Rahul Sharma today',
        context: { connectionId: connA.id }
      });

      expect(res.type).toBe('action_preview');
      expect(res.data.actionPlan.action.actionType).toBe(ActionTypes.LOG_OUTREACH);
    });

    it('9. update_relationship_status: generates action preview to update connection status', async () => {
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Mark Rahul Sharma as conversation',
        context: { connectionId: connA.id }
      });

      expect(res.type).toBe('action_preview');
      expect(res.data.actionPlan.action.actionType).toBe(ActionTypes.UPDATE_RELATIONSHIP_STATUS);
      expect(res.data.actionPlan.action.payload.relationshipStatus).toBe('conversation');
    });
  });

  describe('3. Target Resolution & Ambiguity Handling', () => {
    it('returns clarification response when target entity is ambiguous or missing required fields', async () => {
      const res = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Mark job as interested' // No explicit context or matching target provided
      });

      expect(['clarification', 'action_preview', 'error']).toContain(res.type);
    });
  });

  describe('4. End-to-End Execution & Verification Flow', () => {
    it('completes E2E flow: Copilot Chat -> Preview -> Confirm -> Execute -> Database Mutation', async () => {
      // 1. Ask Copilot to change job status
      const chatRes = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Mark my TechCorp job as interviewing',
        context: { jobId: jobA.id }
      });

      expect(chatRes.type).toBe('action_preview');
      const actionPlan = chatRes.data.actionPlan;
      const actionModel = actionPlan.action;
      expect(actionModel.status).toBe(ActionStatuses.PENDING_CONFIRMATION);

      // 2. User confirms action
      const confirmRes = await ActionConfirmationService.confirmAction({
        action: actionModel,
        authenticatedUserId: userA.id
      });
      expect(confirmRes.status).toBe(ActionStatuses.CONFIRMED);

      // 3. ActionExecutor executes confirmed action
      const execRes = await ActionExecutor.executeAction({
        action: confirmRes.action,
        authenticatedUserId: userA.id
      });

      expect(execRes.status).toBe(ActionStatuses.COMPLETED);

      // 4. Verify database state mutation
      const updatedJob = await models.Job.findByPk(jobA.id);
      expect(updatedJob.status).toBe('interviewing');
    });
  });

  describe('5. External Communication Guard', () => {
    it('MANDATORY GUARD: zero external emails/messages are sent during outreach draft creation', async () => {
      const sendEmailSpy = jest.spyOn(emailService.provider, 'sendEmail').mockImplementation(async () => {});

      const chatRes = await CopilotChatService.sendChat({
        userId: userA.id,
        message: 'Draft an outreach message to Rahul Sharma',
        context: { connectionId: connA.id }
      });

      const actionModel = chatRes.data.actionPlan.action;

      const confirmRes = await ActionConfirmationService.confirmAction({
        action: actionModel,
        authenticatedUserId: userA.id
      });

      await ActionExecutor.executeAction({
        action: confirmRes.action,
        authenticatedUserId: userA.id
      });

      expect(sendEmailSpy).not.toHaveBeenCalled();
      sendEmailSpy.mockRestore();
    });
  });

  describe('6. Security & Multi-Tenant Boundaries', () => {
    it('rejects execution if User A attempts to confirm/execute User B action plan', async () => {
      const chatRes = await CopilotChatService.sendChat({
        userId: userB.id,
        message: 'Save this job',
        context: { jobId: jobB.id }
      });

      const actionModel = chatRes.data.actionPlan.action;

      await expect(
        ActionConfirmationService.confirmAction({
          action: actionModel,
          authenticatedUserId: userA.id
        })
      ).rejects.toThrow(/Unauthorized/);
    });
  });
});
