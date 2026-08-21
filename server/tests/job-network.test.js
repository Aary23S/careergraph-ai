import request from 'supertest';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase } from '../src/config/database.js';
import { models } from '../src/config/database.js';

describe('CareerGraph Phase 2.5-G: Job Network Referral Workspace API Tests', () => {
  let app;
  let tokenA;
  let userIdA;
  let userIdB;
  let jobA;
  let jobB;

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
    userIdB = resB.body.data.user.id;

    // Set up Company Google
    const google = await models.Company.create({
      name: 'Google LLC',
      normalizedName: 'google'
    });

    // Create Job for User A at Google
    jobA = await models.Job.create({
      user_id: userIdA,
      company_id: google.id,
      title: 'Senior Backend Engineer',
      description: 'Require node.js, javascript, postgresql',
      status: 'saved',
      isArchived: false
    });

    // Create Job for User B at Google
    jobB = await models.Job.create({
      user_id: userIdB,
      company_id: google.id,
      title: 'Frontend Developer',
      description: 'Require react, css',
      status: 'saved',
      isArchived: false
    });

    // Create connections at Google for User A
    // Connection 1: Strong engineering match
    await models.Connection.create({
      user_id: userIdA,
      name: 'John Smith',
      company: 'Google',
      normalizedCompany: 'google',
      title: 'Senior Software Engineer',
      relationshipStrength: 'strong',
      relationshipStatus: 'not_contacted',
      priority: 'high',
      seniorityLevel: 'senior'
    });

    // Connection 2: Recruiter match
    await models.Connection.create({
      user_id: userIdA,
      name: 'Priya Recruiter',
      company: 'Google LLC',
      normalizedCompany: 'google',
      title: 'Technical Recruiter',
      relationshipStrength: 'weak',
      relationshipStatus: 'contacted',
      priority: 'medium',
      seniorityLevel: 'mid'
    });

    // Connection 3: Manager match
    await models.Connection.create({
      user_id: userIdA,
      name: 'Sarah Manager',
      company: 'Google LLC',
      normalizedCompany: 'google',
      title: 'Product Manager',
      relationshipStrength: 'medium',
      relationshipStatus: 'replied',
      priority: 'none',
      seniorityLevel: 'manager'
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('GET /api/jobs/:jobId/network', () => {
    it('should return correct job metadata and summary metrics for the owner', async () => {
      const res = await request(app)
        .get(`/api/jobs/${jobA.id}/network`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.job.title).toBe('Senior Backend Engineer');
      expect(res.body.data.job.company).toBe('Google LLC');

      const summary = res.body.data.summary;
      expect(summary.totalConnections).toBe(3);
      expect(summary.relevantConnections).toBe(2); // John (engineer) and Priya (recruiter)
      expect(summary.recruiters).toBe(1); // Priya
      expect(summary.seniorPlus).toBe(2); // John (senior) and Sarah (manager)
      expect(summary.notContacted).toBe(1); // John
      expect(summary.alreadyContacted).toBe(2); // Priya, Sarah
    });

    it('should support pagination and default sort by referralScore', async () => {
      const res = await request(app)
        .get(`/api/jobs/${jobA.id}/network?page=1&limit=2`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.candidates.length).toBe(2);
      expect(res.body.data.pagination.total).toBe(3);
      expect(res.body.data.pagination.totalPages).toBe(2);

      // Ranked by referral score desc: John should be first (strong relationship + same company + engineer match)
      expect(res.body.data.candidates[0].connection.name).toBe('John Smith');
      expect(res.body.data.candidates[0].referralScore).toBeGreaterThan(
        res.body.data.candidates[1].referralScore
      );
    });

    it('should filter candidates based on roleCategory query parameters', async () => {
      const res = await request(app)
        .get(`/api/jobs/${jobA.id}/network?roleCategory=engineering`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      // Engineering matching connections = John + Priya (recruiter)
      expect(res.body.data.candidates.length).toBe(2);
      expect(res.body.data.candidates.some(c => c.connection.name === 'John Smith')).toBe(true);
      expect(res.body.data.candidates.some(c => c.connection.name === 'Priya Recruiter')).toBe(true);
    });

    it('should reject requests with 404 for jobs not owned by the user (Tenant Isolation)', async () => {
      const res = await request(app)
        .get(`/api/jobs/${jobB.id}/network`)
        .set('Authorization', `Bearer ${tokenA}`); // User A tries to view User B's job network

      expect(res.status).toBe(404);
    });

    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).get(`/api/jobs/${jobA.id}/network`);
      expect(res.status).toBe(401);
    });
  });
});
