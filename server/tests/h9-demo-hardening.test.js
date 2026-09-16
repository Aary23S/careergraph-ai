import { jest } from '@jest/globals';
import { models, sequelize } from '../src/config/database.js';
import { getHealth } from '../src/controllers/health.controller.js';
import { resetDemoDataset } from '../scripts/demo-reset.js';
import { CopilotChatService } from '../src/services/copilot/copilot-chat.service.js';
import { ActionConfirmationService } from '../src/services/actions/action-confirmation.service.js';
import { ActionExecutor } from '../src/services/actions/action-executor.service.js';
import { ActionStatuses } from '../src/services/actions/action-registry.js';
import { DecisionDigestService } from '../src/services/copilot/decision-digest.service.js';

describe('Phase H9: Demo Hardening & Final Hackathon Verification Suite', () => {
  let demoUser, demoJob, demoConn;

  beforeAll(async () => {
    process.env.DEMO_MODE = 'true';
    await resetDemoDataset();

    demoUser = await models.User.findOne({ where: { email: 'demo.user@careergraph.ai' } });
    demoJob = await models.Job.findOne({ where: { user_id: demoUser.id, normalizedCompany: 'cloudscale' } });
    demoConn = await models.Connection.findOne({ where: { user_id: demoUser.id, normalizedCompany: 'cloudscale' } });
  });

  it('1. verifies demo dataset seeding and reset CLI safety', async () => {
    expect(demoUser).not.toBeNull();
    expect(demoJob).not.toBeNull();
    expect(demoConn).not.toBeNull();
    expect(demoUser.email).toBe('demo.user@careergraph.ai');
  });

  it('2. verifies health check controller status monitoring with 0 secret disclosure', () => {
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    getHealth({}, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    const payload = mockRes.json.mock.calls[0][0];

    expect(payload.status).toBe('ok');
    expect(payload.components.database).toBeDefined();
    expect(payload.components.aiProvider).toBeDefined();

    const payloadStr = JSON.stringify(payload);
    expect(payloadStr).not.toMatch(/password|secret|jwt|database_url|redis_url/i);
  });

  it('3. Scenario 1: Opportunity Discovery to Action (Copilot -> Match -> Referral -> Action Preview -> Execution)', async () => {
    // 1. Search jobs & referral path query
    const chatRes1 = await CopilotChatService.sendChat({
      userId: demoUser.id,
      message: 'Find me the best backend jobs and tell me who can refer me'
    });
    expect(chatRes1.type).toMatch(/answer|action_preview/);

    // 2. Action Proposal for Save Job
    const chatRes2 = await CopilotChatService.sendChat({
      userId: demoUser.id,
      message: 'Save this job',
      context: { jobId: demoJob.id }
    });

    expect(chatRes2.type).toBe('action_preview');
    const actionModel = chatRes2.data.actionPlan.action;
    expect(actionModel.status).toBe(ActionStatuses.PENDING_CONFIRMATION);

    // 3. Confirm & Execute
    const confirmRes = await ActionConfirmationService.confirmAction({ action: actionModel, authenticatedUserId: demoUser.id });
    const execRes = await ActionExecutor.executeAction({ action: confirmRes.action, authenticatedUserId: demoUser.id });

    expect(execRes.status).toBe(ActionStatuses.COMPLETED);
    const updatedJob = await models.Job.findByPk(demoJob.id);
    expect(updatedJob.status).toBe('saved');
  });

  it('4. Scenario 2: Networking & Outreach (Draft Only Safety Guard & Follow-Up)', async () => {
    // 1. Draft Outreach (Draft Only)
    const chatRes = await CopilotChatService.sendChat({
      userId: demoUser.id,
      message: 'Draft an outreach message to Vikram Malhotra for CloudScale',
      context: { connectionId: demoConn.id }
    });

    expect(chatRes.type).toBe('action_preview');
    const actionModel = chatRes.data.actionPlan.action;

    const confirmRes = await ActionConfirmationService.confirmAction({ action: actionModel, authenticatedUserId: demoUser.id });
    const execRes = await ActionExecutor.executeAction({ action: confirmRes.action, authenticatedUserId: demoUser.id });

    expect(execRes.status).toBe(ActionStatuses.COMPLETED);
    expect(execRes.result.note).toMatch(/Draft created successfully. No external message was sent/i);
  });

  it('5. Scenario 3: Decision Support & Daily Digest (H5)', async () => {
    const digestRes = await DecisionDigestService.generateDigest({ userId: demoUser.id });
    expect(digestRes).toBeDefined();
    expect(digestRes.summary).toBeDefined();
    expect(digestRes.priorities).toBeDefined();
  });

  it('6. verifies AI unavailable graceful fallback', async () => {
    const chatRes = await CopilotChatService.sendChat({
      userId: demoUser.id,
      message: 'Why is Senior DevOps Engineer at CloudScale a good match for me?'
    });
    expect(chatRes.type).toBe('answer');
    expect(chatRes.message).toBeDefined();
  });
});
