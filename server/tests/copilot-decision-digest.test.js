import assert from 'node:assert';
import { models, sequelize } from '../src/config/database.js';
import { DecisionDigestService } from '../src/services/copilot/decision-digest.service.js';
import { ContextBuilder } from '../src/services/copilot/context/context-builder.service.js';
import { aiService } from '../src/services/ai/ai.service.js';
import { AppError } from '../src/lib/http.js';

describe('H5: DecisionDigestService', () => {
  let userA, userB;
  let jobA, applicationA, connectionA, profileA;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    // 1. Create Test Users
    userA = await models.User.create({
      email: 'digest_userA@example.com',
      passwordHash: 'hash'
    });
    userB = await models.User.create({
      email: 'digest_userB@example.com',
      passwordHash: 'hash'
    });

    profileA = await models.Profile.create({
      user_id: userA.id,
      name: 'User A',
      title: 'Backend Engineer',
      skills: ['Node.js', 'PostgreSQL'],
      experience_level: 'Senior'
    });

    jobA = await models.Job.create({
      user_id: userA.id,
      title: 'Senior Backend Engineer',
      company: 'TechCorp',
      status: 'saved',
      matchScore: 0
    });
    // Bypass hook to set deterministic score explicitly for testing
    await models.Job.update({ matchScore: 92 }, { where: { id: jobA.id } });

    // Mock an authoritative match score analysis
    await models.JobMatchAnalysis.create({
      jobId: jobA.id,
      finalScore: 92,
      inputHash: 'hash123'
    });

    applicationA = await models.Application.create({
      user_id: userA.id,
      job_id: jobA.id,
      status: 'applied',
      next_follow_up_date: new Date().toISOString().split('T')[0]
    });

    connectionA = await models.Connection.create({
      user_id: userA.id,
      name: 'John TechCorp',
      company: 'TechCorp',
      title: 'Engineering Manager',
      connection_score: 85
    });

    // Dummy data for User B
    const jobB = await models.Job.create({
      user_id: userB.id,
      title: 'Frontend Dev',
      company: 'WebCorp',
      status: 'saved',
      matchScore: 40
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
    // Reset any mocks on aiService
    aiService.generateStructured = aiService.constructor.prototype.generateStructured;
  });

  it('should require authentication', async () => {
    await assert.rejects(
      DecisionDigestService.generateDigest({ userId: null, query: '' }),
      (err) => err instanceof AppError && err.statusCode === 401
    );
  });

  it('should fetch prioritized deterministic data and return structured AI response', async () => {
    const originalGenerateStructured = aiService.generateStructured.bind(aiService);
    
    // Mock AI response
    aiService.generateStructured = async (prompt, schema, options) => {
      // Return a mocked structure adhering to the schema
      return {
        date: new Date().toISOString().split('T')[0],
        summary: 'Today is a great day for networking.',
        priorities: [
          { priority: 'high', type: 'job', entityId: jobA.id, title: 'Senior Backend Engineer', reason: 'High match', recommendedAction: 'Apply' }
        ],
        jobOpportunities: [
          { jobId: jobA.id, title: 'Senior Backend Engineer', company: 'TechCorp', deterministicScore: 50, reason: 'Good fit', recommendedAction: 'Apply' } // Note: Hallucinated score of 50
        ],
        referralOpportunities: [
          { jobId: jobA.id, connectionId: connectionA.id, reason: 'Knows hiring manager', recommendedAction: 'Message' }
        ],
        applicationAttention: [
          { applicationId: applicationA.id, reason: 'Follow up due today', recommendedAction: 'Email recruiter' }
        ],
        careerSignals: [
          { type: 'skill_trend', statement: 'Node.js is frequently mentioned.', evidence: ['Node.js'] }
        ],
        nextActions: [
          { rank: 1, action: 'Apply to TechCorp', reason: 'Strong match' }
        ]
      };
    };

    const digest = await DecisionDigestService.generateDigest({
      userId: userA.id,
      date: new Date().toISOString().split('T')[0],
      query: 'What should I do today?'
    });

    assert.strictEqual(digest.aiStatus, 'success');
    assert.ok(digest.summary.includes('tracker has'));
    assert.strictEqual(digest.priorities.length, 1);
    
    // Test Score Integrity: The hallucinated score of 50 should be overwritten by the deterministic 92
    assert.strictEqual(digest.jobOpportunities[0].deterministicScore, 92, 'AI hallucinated score must be overwritten by deterministic score');
    
    // Free-form career signals are not displayed unless represented as a
    // deterministic tracker fact.
    assert.strictEqual(digest.careerSignals.length, 0);
  });

  it('should fallback gracefully when AI fails', async () => {
    // Force AI failure
    aiService.generateStructured = async () => {
      throw new Error('AI Timeout');
    };

    const digest = await DecisionDigestService.generateDigest({
      userId: userA.id,
      date: new Date().toISOString().split('T')[0]
    });

    assert.strictEqual(digest.aiStatus, 'success');
    assert.strictEqual(digest.priorities.length, 1);
    assert.strictEqual(digest.priorities[0].entityId, jobA.id);
    assert.ok(digest.priorities[0].reason.includes('92'));
  });

  it('should flag ungrounded career signals', async () => {
    aiService.generateStructured = async (prompt, schema, options) => {
      return {
        date: new Date().toISOString().split('T')[0],
        summary: 'Trend report',
        priorities: [], jobOpportunities: [], referralOpportunities: [], applicationAttention: [], nextActions: [],
        careerSignals: [
          // "Rust" is not in the user's profile
          { type: 'skill_trend', statement: 'You should learn Rust.', evidence: ['Rust'] }
        ]
      };
    };

    const digest = await DecisionDigestService.generateDigest({
      userId: userA.id,
      date: new Date().toISOString().split('T')[0],
    });

    assert.strictEqual(digest.careerSignals.length, 0, 'Ungrounded signals must not be displayed');
  });

  it('should maintain tenant isolation (User B context bounds)', async () => {
    // User B has a 40 match job, and no applications/connections
    const digest = await DecisionDigestService.generateDigest({
      userId: userB.id,
      date: new Date().toISOString().split('T')[0]
    });
    
    // Should fallback or return empty priorities if AI is mocked to fail (we'll just check the deterministic priorities on fallback)
    aiService.generateStructured = async () => { throw new Error('AI off'); };
    
    const fallbackDigest = await DecisionDigestService.generateDigest({
      userId: userB.id,
      date: new Date().toISOString().split('T')[0]
    });

    // User B should ONLY see jobB
    assert.strictEqual(fallbackDigest.priorities.length, 1);
    assert.ok(fallbackDigest.priorities[0].reason.includes('40'));
  });
});
