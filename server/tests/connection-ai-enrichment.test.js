import request from 'supertest';
import { jest } from '@jest/globals';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase } from '../src/config/database.js';
import { models } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { aiService } from '../src/services/ai/ai.service.js';
import { executeEnrichment } from '../src/services/connection-ai-enrichment.service.js';

describe('Connection AI Enrichment & Profile Intelligence Test Suite', () => {
  let app;
  let tokenA;
  let tokenB;
  let userIdA;
  let userIdB;
  let connectionA;
  let connectionB;

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
      name: 'John Doe',
      company: 'VelivoHR',
      title: 'Senior Developer',
      location: 'Remote',
      skills: ['Node.js', 'PostgreSQL'],
      experience: [
        { title: 'Senior Developer', company: 'VelivoHR', dateRange: '2022 - Present' }
      ]
    });

    // Create Connection for User B
    connectionB = await models.Connection.create({
      user_id: userIdB,
      name: 'Jane Smith',
      company: 'VelivoHR',
      title: 'Recruiter',
      location: 'Hybrid'
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Enrichment execution & caching', () => {
    it('successfully processes connection AI profile and writes attributes to database', async () => {
      const mockResult = {
        professionalRole: 'Senior Backend Engineer',
        roleFamily: 'software_engineering',
        careerLevel: 'senior',
        technicalDomains: ['backend', 'cloud'],
        technologies: ['Node.js', 'PostgreSQL', 'AWS'],
        industryDomains: ['SaaS'],
        expertiseAreas: ['API design'],
        leadershipLevel: 'individual_contributor',
        summary: 'Senior software engineer.',
        confidence: 0.95
      };

      const spy = jest.spyOn(aiService, 'generateStructured').mockResolvedValueOnce(mockResult);

      await executeEnrichment(connectionA.id);

      const enrichment = await models.ConnectionAiEnrichment.findOne({ where: { connectionId: connectionA.id } });
      expect(enrichment).toBeDefined();
      expect(enrichment.status).toBe('completed');
      expect(enrichment.professionalRole).toBe('Senior Backend Engineer');
      expect(enrichment.roleFamily).toBe('software_engineering');
      expect(enrichment.careerLevel).toBe('senior');
      expect(enrichment.technologies).toContain('Node.js');
      expect(enrichment.confidence).toBe(0.95);
      spy.mockRestore();
    });
  });

  describe('REST API routes', () => {
    it('returns enrichment data nested inside GET /api/connections/:id', async () => {
      const res = await request(app)
        .get(`/api/connections/${connectionA.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.aiEnrichment).toBeDefined();
      expect(res.body.data.aiEnrichment.professionalRole).toBe('Senior Backend Engineer');
    });

    it('saves user corrections and retrieves them separately', async () => {
      const res = await request(app)
        .put(`/api/connections/${connectionA.id}/ai-corrections`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          professionalRole: 'Lead Backend Developer',
          careerLevel: 'lead'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.userCorrectedProfessionalRole).toBe('Lead Backend Developer');
      expect(res.body.data.userCorrectedCareerLevel).toBe('lead');
      expect(res.body.data.professionalRole).toBe('Senior Backend Engineer'); // raw remains unchanged
    });

    it('prevents User B from correcting or retrieving User A connections (tenant isolation)', async () => {
      const getRes = await request(app)
        .get(`/api/connections/${connectionA.id}/ai`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(getRes.status).toBe(404);

      const postRes = await request(app)
        .put(`/api/connections/${connectionA.id}/ai-corrections`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ professionalRole: 'Hacker' });
      expect(postRes.status).toBe(404);
    });

    it('successfully enqueues batch analysis limits', async () => {
      const res = await request(app)
        .post('/api/connections/ai-enrich/batch')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ limit: 10, onlyWithoutAiEnrichment: true });

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(0); // already enriched connectionA
    });
  });
});
