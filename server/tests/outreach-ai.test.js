import request from 'supertest';
import { jest } from '@jest/globals';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase, models } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { aiService } from '../src/services/ai/ai.service.js';
import { buildOutreachAIContext } from '../src/services/outreach-ai-context.service.js';
import { checkOutreachDuplicates } from '../src/services/outreach-ai-guard.service.js';

describe('AI Outreach Assistant Test Suite', () => {
  let app;
  let tokenA;
  let tokenB;
  let userIdA;
  let userIdB;
  let connectionA;
  let jobA;

  beforeAll(async () => {
    env.aiEnabled = true;
    env.aiProvider = 'mock';

    app = createApp();
    await resetDatabase();

    // Register User A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({ email: 'userA@example.com', password: 'Password123!', name: 'User A' });
    tokenA = resA.body.data.tokens.accessToken;
    userIdA = resA.body.data.user.id;

    // Register User B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({ email: 'userB@example.com', password: 'Password123!', name: 'User B' });
    tokenB = resB.body.data.tokens.accessToken;
    userIdB = resB.body.data.user.id;

    // Create Connection for User A
    connectionA = await models.Connection.create({
      user_id: userIdA,
      name: 'Sarah Connor',
      company: 'Cyberdyne',
      title: 'Operations Director'
    });

    // Create Job for User A
    jobA = await models.Job.create({
      user_id: userIdA,
      title: 'Infrastructure Architect',
      normalizedCompany: 'Cyberdyne'
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Context Builder', () => {
    it('correctly builds structured context for connection and job', async () => {
      const context = await buildOutreachAIContext({
        userId: userIdA,
        jobId: jobA.id,
        connectionId: connectionA.id
      });

      expect(context.job).toBeDefined();
      expect(context.job.title).toBe('Infrastructure Architect');
      expect(context.connection).toBeDefined();
      expect(context.connection.name).toBe('Sarah Connor');
      expect(context.relationship.connectionStatus).toBe('not_contacted');
    });

    it('gracefully handles missing optional job/connection parameters', async () => {
      const context = await buildOutreachAIContext({
        userId: userIdA,
        jobId: null,
        connectionId: null
      });

      expect(context.job).toBeNull();
      expect(context.connection).toBeNull();
      expect(context.relationship.connectionStatus).toBe('not_contacted');
    });
  });

  describe('Outreach Duplicate Guard', () => {
    it('returns empty warnings when no outreach exists', async () => {
      const guard = await checkOutreachDuplicates({
        userId: userIdA,
        jobId: jobA.id,
        connectionId: connectionA.id
      });
      expect(guard.warnings).toHaveLength(0);
    });

    it('returns warning when referral has already been requested', async () => {
      // Create existing outreach simulating referral requested
      await models.Outreach.create({
        user_id: userIdA,
        connection_id: connectionA.id,
        status: 'referral_requested',
        jobId: jobA.id,
        contactDate: new Date()
      });

      const guard = await checkOutreachDuplicates({
        userId: userIdA,
        jobId: jobA.id,
        connectionId: connectionA.id
      });

      expect(guard.warnings.some(w => w.code === 'REFERRAL_ALREADY_REQUESTED')).toBe(true);
    });
  });

  describe('REST Endpoints', () => {
    let testDraftId;

    it('generates an outreach draft via POST /api/outreach/ai-drafts/generate', async () => {
      const mockResult = {
        message: 'Hi Sarah, I would love to connect regarding your team at Cyberdyne.',
        tone: 'professional',
        personalizationPoints: ['Sarah Connor work company Cyberdyne']
      };

      const spy = jest.spyOn(aiService, 'generateStructured').mockResolvedValueOnce(mockResult);

      const res = await request(app)
        .post('/api/outreach/ai-drafts/generate')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          connectionId: connectionA.id,
          jobId: jobA.id,
          intent: 'referral_request',
          tone: 'professional',
          length: 'short',
          forceGenerate: true
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.draft).toBeDefined();
      expect(res.body.data.draft.message).toContain('Cyberdyne');
      testDraftId = res.body.data.draft.id;

      spy.mockRestore();
    });

    it('allows updating/patching an existing draft text', async () => {
      const res = await request(app)
        .patch(`/api/outreach/ai-drafts/${testDraftId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ draft: 'Edited draft content manually.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.draft.message).toBe('Edited draft content manually.');
      expect(res.body.data.draft.status).toBe('edited');
    });

    it('denies User B from editing User A draft (tenant isolation)', async () => {
      const res = await request(app)
        .patch(`/api/outreach/ai-drafts/${testDraftId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ draft: 'Malicious modification' });

      expect(res.status).toBe(404);
    });

    it('saves a draft to the CRM logs via POST /api/outreach/ai-drafts/:id/save', async () => {
      const res = await request(app)
        .post(`/api/outreach/ai-drafts/${testDraftId}/save`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.draftStatus).toBe('saved');

      // Verify a note was created under the outreach connection
      const outreachRecord = await models.Outreach.findOne({
        where: { connection_id: connectionA.id, user_id: userIdA }
      });
      expect(outreachRecord).toBeDefined();

      const note = await models.Note.findOne({
        where: { entityId: outreachRecord.id, entityType: 'outreach', user_id: userIdA }
      });
      expect(note).toBeDefined();
      expect(note.content).toBe('Edited draft content manually.');
    });
  });
});
