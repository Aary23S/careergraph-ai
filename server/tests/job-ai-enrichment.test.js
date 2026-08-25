import request from 'supertest';
import { jest } from '@jest/globals';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase } from '../src/config/database.js';
import { models } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { aiService } from '../src/services/ai/ai.service.js';
import { executeEnrichment } from '../src/services/job-ai-enrichment.service.js';

describe('Job AI Enrichment & Understanding Test Suite', () => {
  let app;
  let tokenA;
  let tokenB;
  let userIdA;

  beforeAll(async () => {
    env.aiEnabled = true;
    env.aiProvider = 'mock';
    env.aiTimeoutMs = 5000;

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
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Asynchronous Ingestion and Database Mappings', () => {
    it('creates pending AI enrichment entry upon job creation', async () => {
      env.aiEnabled = true;

      const res = await request(app)
        .post('/api/jobs/ingest')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Senior Node Architect',
          companyName: 'TechCorp',
          location: 'Remote',
          description: 'Hiring a senior NodeJS dev with Postgres experience.',
          source: 'manual'
        });

      expect(res.status).toBe(201);
      const jobId = res.body.data.job.id;

      // Verify entry exists immediately (can be pending, processing, or completed asynchronously)
      const enrichment = await models.JobAiEnrichment.findOne({ where: { jobId: jobId } });
      expect(enrichment).toBeDefined();
      expect(['pending', 'processing', 'failed', 'completed']).toContain(enrichment.status);
      expect(enrichment.inputHash).toBeDefined();
    });

    it('successfully updates AI enrichment entry after processing', async () => {
      const job = await models.Job.findOne({ where: { user_id: userIdA } });
      
      // Mock generateStructured return value
      const mockResult = {
        roleCategory: 'engineering',
        seniority: 'senior',
        requiredSkills: ['Node.js', 'PostgreSQL'],
        preferredSkills: ['AWS', 'Docker'],
        location: 'Remote',
        remoteType: 'remote',
        employmentType: 'full-time',
        experienceMinYears: 5,
        experienceMaxYears: null,
        domain: ['backend', 'cloud'],
        responsibilities: ['Architect services', 'Scale databases'],
        summary: 'Excellent Backend NodeJS position.',
        confidence: 0.95
      };

      jest.spyOn(aiService, 'generateStructured').mockResolvedValueOnce(mockResult);

      await executeEnrichment(job.id);

      const enrichment = await models.JobAiEnrichment.findOne({ where: { jobId: job.id } });
      expect(enrichment.status).toBe('completed');
      expect(enrichment.roleCategory).toBe('engineering');
      expect(enrichment.seniority).toBe('senior');
      expect(enrichment.requiredSkills).toContain('Node.js');
      expect(enrichment.confidence).toBe(0.95);
    });
  });

  describe('REST Endpoints & Security Controls', () => {
    let jobId;

    beforeAll(async () => {
      const job = await models.Job.findOne({ where: { user_id: userIdA } });
      jobId = job.id;
    });

    it('returns enrichment data nested inside Job object', async () => {
      const res = await request(app)
        .get(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.aiEnrichment).toBeDefined();
      expect(res.body.data.aiEnrichment.status).toBe('completed');
    });

    it('allows triggering manual retry/reprocess of AI enrichment', async () => {
      const mockResult = {
        roleCategory: 'engineering',
        seniority: 'lead',
        requiredSkills: ['Node.js'],
        preferredSkills: [],
        location: 'Remote',
        remoteType: 'remote',
        employmentType: 'full-time',
        experienceMinYears: 8,
        experienceMaxYears: null,
        domain: ['backend'],
        responsibilities: ['Lead engineers'],
        summary: 'Lead Node role.',
        confidence: 0.98
      };

      jest.spyOn(aiService, 'generateStructured').mockResolvedValueOnce(mockResult);

      const res = await request(app)
        .post(`/api/jobs/${jobId}/ai-enrich`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.aiEnrichment.seniority).toBe('lead');
      expect(res.body.data.aiEnrichment.confidence).toBe(0.98);
    });

    it('saves user corrections without overwriting original AI values', async () => {
      const res = await request(app)
        .put(`/api/jobs/${jobId}/ai-corrections`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          seniority: 'Principal',
          requiredSkills: ['Node.js', 'Go']
        });

      expect(res.status).toBe(200);
      expect(res.body.data.aiEnrichment.userCorrectedSeniority).toBe('Principal');
      expect(res.body.data.aiEnrichment.userCorrectedRequiredSkills).toContain('Go');
      // Original AI value remains preserved
      expect(res.body.data.aiEnrichment.seniority).toBe('lead');
    });

    it('enforces tenant isolation preventing user B from modifying user A enrichment', async () => {
      const res = await request(app)
        .put(`/api/jobs/${jobId}/ai-corrections`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          seniority: 'Staff'
        });

      expect(res.status).toBe(404);
    });
  });
});
