import request from 'supertest';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase } from '../src/config/database.js';
import { models } from '../src/config/database.js';

describe('CareerGraph Phase 2.6: Job Tracker & Application Lifecycle E2E Tests', () => {
  let app;
  let tokenA;
  let tokenB;
  let userIdA;
  let userIdB;
  let resumeA;
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

    // Setup active resume and connection for User A
    resumeA = await models.Resume.create({
      user_id: userIdA,
      fileName: 'resume.pdf',
      storageKey: 'resume_key',
      contentType: 'application/pdf',
      sizeBytes: 1024,
      isActive: true,
      version: 1
    });

    connA = await models.Connection.create({
      user_id: userIdA,
      name: 'Alice Referral',
      company: 'Adobe',
      title: 'Manager',
      email: 'alice@adobe.com'
    });

    // Create user profile for User A so that match score can be calculated
    await models.Profile.create({
      user_id: userIdA,
      name: 'User A',
      skills: ['react', 'node', 'javascript']
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Job Ingestion & Deduplication', () => {
    it('should ingest a manual job successfully and normalize properties', async () => {
      const res = await request(app)
        .post('/api/jobs/ingest')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Senior React Developer',
          companyName: 'Adobe',
          location: 'San Jose, CA',
          sourceUrl: 'https://adobe.com/careers/123',
          externalJobId: 'adobe-123',
          description: 'Looking for a Senior React Dev.',
          source: 'manual'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('created');
      expect(res.body.data.job.title).toBe('Senior React Developer');
      expect(res.body.data.job.experienceLevel).toBe('senior');
      expect(res.body.data.job.remoteType).toBe('onsite');
      expect(res.body.data.job.matchScore).toBeGreaterThanOrEqual(0);
    });

    it('should detect duplicate on repeated ingestion and perform non-destructive updates', async () => {
      // Ingest again
      const res = await request(app)
        .post('/api/jobs/ingest')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Senior React Developer',
          companyName: 'Adobe',
          location: 'San Jose, CA',
          sourceUrl: 'https://adobe.com/careers/123',
          externalJobId: 'adobe-123',
          description: 'Updated description that should merge',
          source: 'manual',
          sourceMetadata: { importance: 'high' }
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('updated');
      expect(res.body.data.job.sourceMetadata.importance).toBe('high');
    });

    it('should support batch job ingestion and return detailed summaries', async () => {
      const batchData = [
        {
          title: 'Staff Node Developer',
          companyName: 'Google',
          location: 'Remote',
          sourceUrl: 'https://google.com/careers/abc',
          externalJobId: 'google-abc',
          source: 'api'
        },
        {
          title: 'Junior QA Engineer',
          companyName: 'Microsoft',
          location: 'Seattle, WA',
          sourceUrl: 'https://microsoft.com/careers/xyz',
          externalJobId: 'ms-xyz',
          source: 'email'
        }
      ];

      const res = await request(app)
        .post('/api/jobs/ingest/batch')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(batchData);

      expect(res.status).toBe(200);
      expect(res.body.data.processed).toBe(2);
      expect(res.body.data.created).toBe(2);
    });
  });

  describe('Job Tracker Filters and Ordering', () => {
    it('should support server-side filtering by remote type and experience level', async () => {
      const res = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${tokenA}`)
        .query({ remoteType: 'remote' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Staff Node Developer');
    });

    it('should support sorting jobs by matchScore', async () => {
      const res = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${tokenA}`)
        .query({ sortBy: 'matchScore', sortOrder: 'desc' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Active Application Lifecycle & Timeline', () => {
    let jobId;
    let appId;

    beforeAll(async () => {
      const jobs = await models.Job.findAll({ where: { user_id: userIdA } });
      jobId = jobs[0].id;
    });

    it('should create an application with resume, cover letter, and referral details', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          jobId,
          status: 'applying',
          resumeId: resumeA.id,
          coverLetter: 'Dear Hiring Manager, I love React.',
          referralConnectionId: connA.id,
          notes: 'Init notes'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('applying');
      expect(res.body.data.resumeId).toBe(resumeA.id);
      expect(res.body.data.referralConnectionId).toBe(connA.id);
      appId = res.body.data.id;
    });

    it('should allow updates to application attributes', async () => {
      const res = await request(app)
        .put(`/api/applications/${appId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          status: 'applied',
          coverLetter: 'Dear Hiring Manager, I REALLY love React.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('applied');
      expect(res.body.data.coverLetter).toBe('Dear Hiring Manager, I REALLY love React.');
    });

    it('should log custom events on the application timeline', async () => {
      const res = await request(app)
        .post(`/api/applications/${appId}/events`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          eventType: 'recruiter_contacted',
          status: 'interview',
          notes: 'Had quick sync call with HR lead'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.eventType).toBe('recruiter_contacted');
      expect(res.body.data.status).toBe('interview');
    });
  });

  describe('Tenant Isolation / Security', () => {
    let jobIdA;
    let appIdA;

    beforeAll(async () => {
      const jobs = await models.Job.findAll({ where: { user_id: userIdA } });
      jobIdA = jobs[0].id;
      const apps = await models.Application.findAll({ where: { user_id: userIdA } });
      appIdA = apps[0].id;
    });

    it('should prevent User B from viewing User A job', async () => {
      const res = await request(app)
        .get(`/api/jobs/${jobIdA}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it('should prevent User B from viewing User A application details', async () => {
      const res = await request(app)
        .get(`/api/applications/${appIdA}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });
  });
});
