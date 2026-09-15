import assert from 'node:assert';
import { models, sequelize } from '../src/config/database.js';
import { CopilotChatService } from '../src/services/copilot/copilot-chat.service.js';
import { aiService } from '../src/services/ai/ai.service.js';
import { AppError } from '../src/lib/http.js';

describe('H6: CopilotChatService', () => {
  let userA, userB;
  let jobA, jobB, connectionA, applicationA;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    userA = await models.User.create({
      email: 'chat_userA@example.com',
      passwordHash: 'hash'
    });

    userB = await models.User.create({
      email: 'chat_userB@example.com',
      passwordHash: 'hash'
    });

    await models.Profile.create({
      user_id: userA.id,
      name: 'User A',
      title: 'Senior Backend Engineer',
      skills: ['Node.js', 'PostgreSQL', 'Sequelize']
    });

    jobA = await models.Job.create({
      user_id: userA.id,
      title: 'Senior Backend Engineer',
      company: 'TechCorp',
      status: 'saved',
      matchScore: 90
    });
    await models.Job.update({ matchScore: 90 }, { where: { id: jobA.id } });

    await models.JobMatchAnalysis.create({
      jobId: jobA.id,
      finalScore: 90,
      inputHash: 'hash90'
    });

    connectionA = await models.Connection.create({
      user_id: userA.id,
      name: 'John TechCorp',
      company: 'TechCorp',
      title: 'Engineering Director',
      connection_score: 88
    });

    applicationA = await models.Application.create({
      user_id: userA.id,
      job_id: jobA.id,
      status: 'applied',
      next_follow_up_date: new Date().toISOString().split('T')[0]
    });

    // User B data for tenant isolation tests
    jobB = await models.Job.create({
      user_id: userB.id,
      title: 'Frontend Lead',
      company: 'WebCorp',
      status: 'saved',
      matchScore: 60
    });
  });

  afterAll(async () => {
    await models.Application.destroy({ where: {} });
    await models.JobMatchAnalysis.destroy({ where: {} });
    await models.Job.destroy({ where: {} });
    await models.Connection.destroy({ where: {} });
    await models.Profile.destroy({ where: {} });
    await models.User.destroy({ where: { id: [userA.id, userB.id] } });
  });

  afterEach(() => {
    // Reset AI mocks
    aiService.generateStructured = aiService.constructor.prototype.generateStructured;
    aiService.generateText = aiService.constructor.prototype.generateText;
  });

  // 1. AUTH
  it('should require authentication', async () => {
    await assert.rejects(
      CopilotChatService.sendChat({ userId: null, message: 'Hello' }),
      (err) => err instanceof AppError && err.statusCode === 401
    );
  });

  // 2. INPUT VALIDATION & CONVERSATION LIMITS
  it('should reject empty or oversized messages', async () => {
    await assert.rejects(
      CopilotChatService.sendChat({ userId: userA.id, message: '' }),
      (err) => err instanceof AppError && err.statusCode === 400
    );

    const longMessage = 'a'.repeat(2001);
    await assert.rejects(
      CopilotChatService.sendChat({ userId: userA.id, message: longMessage }),
      (err) => err instanceof AppError && err.statusCode === 400
    );
  });

  it('should reject oversized conversation history', async () => {
    const longHistory = Array(7).fill({ role: 'user', content: 'hi' });
    await assert.rejects(
      CopilotChatService.sendChat({ userId: userA.id, message: 'Hello', messages: longHistory }),
      (err) => err instanceof AppError && err.statusCode === 400
    );
  });

  // 3. INTENT ROUTING: REFERRAL SEARCH (H3)
  it('should route referral query to H3 ReferralPathAgentService', async () => {
    const res = await CopilotChatService.sendChat({
      userId: userA.id,
      message: 'Who can refer me for my top job?',
      context: { jobId: jobA.id }
    });

    assert.strictEqual(res.intent, 'referral_search');
    assert.ok(res.references.some(r => r.type === 'job' && r.id === jobA.id));
    assert.ok(res.references.some(r => r.type === 'connection' && r.id === connectionA.id));
  });

  // 4. INTENT ROUTING: MATCH EXPLANATION (H4)
  it('should route match query to H4 MatchExplainerService and preserve deterministic score', async () => {
    const res = await CopilotChatService.sendChat({
      userId: userA.id,
      message: 'Why is this job a good match?',
      context: { jobId: jobA.id }
    });

    assert.strictEqual(res.intent, 'match_explanation');
    assert.strictEqual(res.data.deterministicScore, 90, 'Deterministic match score must be preserved');
    assert.ok(res.references.some(r => r.type === 'job' && r.id === jobA.id));
  });

  // 5. INTENT ROUTING: DECISION DIGEST (H5)
  it('should route priority query to H5 DecisionDigestService', async () => {
    const res = await CopilotChatService.sendChat({
      userId: userA.id,
      message: 'What should I focus on today?'
    });

    assert.strictEqual(res.intent, 'decision_digest');
    assert.ok(res.message);
    assert.ok(Array.isArray(res.suggestedPrompts));
  });

  // 6. INTENT ROUTING: APPLICATION STATUS
  it('should route application query to application status handler', async () => {
    const res = await CopilotChatService.sendChat({
      userId: userA.id,
      message: 'What is the status of my applications?'
    });

    assert.strictEqual(res.intent, 'application_status');
    assert.ok(res.data.applications.length > 0);
    assert.strictEqual(res.data.applications[0].jobTitle, 'Senior Backend Engineer');
  });

  // 7. INTENT ROUTING: CAREER QUERY
  it('should route career skills query to career_query handler', async () => {
    const res = await CopilotChatService.sendChat({
      userId: userA.id,
      message: 'What skills should I improve for senior roles?'
    });

    assert.strictEqual(res.intent, 'career_query');
    assert.ok(res.message);
  });

  // 8. ACTION SAFETY GUARDRAIL
  it('should intercept side-effect action requests without executing side effects', async () => {
    const res = await CopilotChatService.sendChat({
      userId: userA.id,
      message: 'Send an email to John TechCorp right now'
    });

    assert.strictEqual(res.intent, 'action_blocked');
    assert.ok(res.data.actionBlocked);
    assert.ok(res.message.includes('not performed automatically'));
  });

  // 9. TENANT ISOLATION & CONTEXT AUTHORIZATION
  it('should ignore/reject cross-tenant job context (User A using User B jobId)', async () => {
    const res = await CopilotChatService.sendChat({
      userId: userA.id,
      message: 'Why is this job a good match?',
      context: { jobId: jobB.id } // User B's job!
    });

    // Should not leak User B's job details or match score
    assert.notStrictEqual(res.data.jobId, jobB.id);
  });

  // 10. AI FAILURE FALLBACK
  it('should fallback gracefully when AI service fails', async () => {
    aiService.generateText = async () => {
      throw new Error('AI Provider Unavailable');
    };

    const res = await CopilotChatService.sendChat({
      userId: userA.id,
      message: 'What applications do I currently have?'
    });

    assert.strictEqual(res.intent, 'application_status');
    assert.strictEqual(res.aiStatus, 'unavailable');
    assert.ok(res.message.includes('1 total application(s)'));
  });
});
