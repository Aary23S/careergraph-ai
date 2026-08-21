import request from 'supertest';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase } from '../src/config/database.js';
import { models } from '../src/config/database.js';

describe('CareerGraph Phase 2.5-D: Individual Connection CRM Detail Tests', () => {
  let app;
  let tokenA;
  let tokenB;
  let userIdA;
  let userIdB;
  let connA;

  beforeAll(async () => {
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
    connA = await models.Connection.create({
      user_id: userIdA,
      name: 'Alice CRM User',
      company: 'Google',
      title: 'Staff Software Engineer',
      email: 'alice@google.com',
      location: 'SF',
      connectedDate: '2026-01-01',
      relationshipStatus: 'not_contacted',
      relationshipStrength: 'warm',
      priority: 'high'
    });

    // Create Connection for User B
    await models.Connection.create({
      user_id: userIdB,
      name: 'Bob Connection',
      company: 'Apple',
      title: 'Product Manager',
      email: 'bob@apple.com',
      location: 'Cupertino'
    });

    // Create a job for company Google belonging to User A
    const company = await models.Company.create({
      name: 'Google',
      normalizedName: 'google'
    });
    await models.Job.create({
      user_id: userIdA,
      company_id: company.id,
      title: 'Backend Developer',
      status: 'saved',
      isArchived: false
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('GET /api/connections/:id', () => {
    it('should return connection detail with empty notes, outreach, and populated jobs for the owner', async () => {
      const res = await request(app)
        .get(`/api/connections/${connA.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(connA.id);
      expect(res.body.data.name).toBe('Alice CRM User');
      expect(res.body.data.company).toBe('Google');
      expect(res.body.data.tags).toBeInstanceOf(Array);
      expect(res.body.data.notes).toBeInstanceOf(Array);
      expect(res.body.data.outreach).toBeInstanceOf(Array);
      expect(res.body.data.relatedJobs).toBeInstanceOf(Array);
      expect(res.body.data.relatedJobs.length).toBeGreaterThan(0);
      expect(res.body.data.relatedJobs[0].title).toBe('Backend Developer');
    });

    it('should prevent User B from viewing User A connection (returns 404)', async () => {
      const res = await request(app)
        .get(`/api/connections/${connA.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it('should return 401 for unauthenticated request', async () => {
      const res = await request(app).get(`/api/connections/${connA.id}`);
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/connections/:id', () => {
    it('should update CRM fields and preserve core fields', async () => {
      const res = await request(app)
        .put(`/api/connections/${connA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Alice CRM User Updated',
          relationshipStatus: 'contacted',
          relationshipStrength: 'strong',
          priority: 'low',
          tags: ['Backend', 'Recruiter']
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Alice CRM User Updated');
      expect(res.body.data.relationshipStatus).toBe('contacted');
      expect(res.body.data.relationshipStrength).toBe('strong');
      expect(res.body.data.priority).toBe('low');
      expect(res.body.data.tags).toContain('Backend');
      expect(res.body.data.tags).toContain('Recruiter');
    });

    it('should prevent User B from updating User A connection (returns 404)', async () => {
      const res = await request(app)
        .put(`/api/connections/${connA.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Alice CRM Hack' });

      expect(res.status).toBe(404);
    });
  });

  describe('Notes and Outreach Integration', () => {
    it('should allow adding connection notes and verify ownership is enforced', async () => {
      // User A creates a note on connA
      const noteRes = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          entityType: 'connection',
          entityId: connA.id,
          content: 'Discussed referral options.'
        });

      expect(noteRes.status).toBe(201);
      expect(noteRes.body.data.content).toBe('Discussed referral options.');

      // Verify that this note is returned in connection details
      const detailRes = await request(app)
        .get(`/api/connections/${connA.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(detailRes.body.data.notes.length).toBe(1);
      expect(detailRes.body.data.notes[0].content).toBe('Discussed referral options.');

      // Security: User B tries to post note to User A connection
      const hackRes = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          entityType: 'connection',
          entityId: connA.id,
          content: 'Bob hack note.'
        });

      expect(hackRes.status).toBe(404);
    });

    it('should allow logging outreach and retrieve in history timeline', async () => {
      // Log outreach for connA
      const outRes = await request(app)
        .post('/api/outreach')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          connectionId: connA.id,
          status: 'contacted',
          contactDate: '2026-08-20',
          followUpDate: '2026-08-27',
          notes: 'Messaged on LinkedIn.'
        });

      expect(outRes.status).toBe(201);
      expect(outRes.body.data.status).toBe('contacted');

      // Verify returned detail history has outreach list
      const detailRes = await request(app)
        .get(`/api/connections/${connA.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(detailRes.body.data.outreach.length).toBe(1);
      expect(detailRes.body.data.outreach[0].notes).toBe('Messaged on LinkedIn.');
    });
  });
});
