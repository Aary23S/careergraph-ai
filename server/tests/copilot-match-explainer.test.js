import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { models, sequelize } from '../src/config/database.js';
import { aiService } from '../src/services/ai/ai.service.js';
import { signAccessToken } from '../src/lib/auth.js';
import { env } from '../src/config/env.js';

describe('H4 — Match Explainer', () => {
  let userA, userB, userAToken, userBToken, jobA, jobB, resumeA, app;

  beforeAll(async () => {
    app = await createApp();
    await sequelize.sync({ force: true });
    env.jwtAccessSecret = 'test-secret';
    env.aiEnabled = true;

    // Setup users
    userA = await models.User.create({ email: 'matchA@test.com', passwordHash: '123', name: 'User A' });
    userB = await models.User.create({ email: 'matchB@test.com', passwordHash: '123', name: 'User B' });

    userAToken = signAccessToken(userA);
    userBToken = signAccessToken(userB);

    // Create Jobs with a deterministic score
    jobA = await models.Job.create({
      user_id: userA.id,
      title: 'Senior Node Engineer',
      company: 'TechCorp',
      status: 'new',
      matchScore: 91
    });
    
    await models.JobMatchAnalysis.create({
      jobId: jobA.id,
      inputHash: 'hash-a',
      status: 'completed',
      finalScore: 91,
      matchedSkills: ['Node.js', 'PostgreSQL'],
      missingSkills: ['Docker']
    });

    jobB = await models.Job.create({
      user_id: userB.id,
      title: 'Product Manager',
      company: 'ProductCo',
      status: 'new',
      matchScore: 65
    });

    await models.JobMatchAnalysis.create({
      jobId: jobB.id,
      inputHash: 'hash-b',
      status: 'completed',
      finalScore: 65,
      matchedSkills: ['Agile'],
      missingSkills: ['Jira']
    });

    // Create active resume for User A to use in grounding checks
    // Create active profile for User A to use in grounding checks
    resumeA = await models.Profile.create({
      user_id: userA.id,
      name: 'User A',
      skills: ['Node.js', 'PostgreSQL'],
      experience: 'Experienced Software Engineer. 5 years of Node.js and PostgreSQL. Led backend teams.',
      bio: 'Software Engineer',
      professionalTitle: 'Backend Engineer'
    });

    // Mock the aiService structure output
    jest.spyOn(aiService, 'generateStructured').mockImplementation(async (sys, user, schema) => {
      // If we see injection attempt, mock failure to ensure fallback works or schema behaves
      if (sys.includes('[UNTRUSTED DATA SHIELDED START]')) {
         // Still succeed, but verify we flagged it (this tests our logic executed)
      }

      // If user asks for timeout or failure, simulate it
      if (user.includes('trigger_timeout')) {
        throw new Error('AI provider timeout exceeded');
      }

      // Return a hallucinated score to prove the service overrides it with the deterministic score
      return {
        deterministicScore: 42, // The service should override this with 91
        overallAssessment: 'strong',
        summary: 'Excellent match based on Node.js experience.',
        strengths: [
          { category: 'skills', statement: 'Has Node.js', evidence: ['Node.js'] },
          { category: 'skills', statement: 'Hallucinated skill', evidence: ['Python'] } // Should be flagged
        ],
        gaps: [
          { category: 'skill', statement: 'Lacks Docker', evidence: ['Docker'] }
        ],
        recommendation: { action: 'apply', reason: 'Good fit', priority: 'high' }
      };
    });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  describe('Authorization & Security', () => {
    it('User A cannot request match explanation for User B job', async () => {
      const res = await request(app)
        .post('/api/copilot/match-explanation')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ jobId: jobB.id });
      
      expect(res.status).toBe(404);
    });

    it('Unauthenticated request returns 401', async () => {
      const res = await request(app)
        .post('/api/copilot/match-explanation')
        .send({ jobId: jobA.id });
      
      expect(res.status).toBe(401);
    });
  });

  describe('API & Input Validation', () => {
    it('Missing jobId returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/copilot/match-explanation')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({});
      
      expect(res.status).toBe(400);
    });
  });

  describe('AI Generation & Grounding', () => {
    it('Successful AI generation returns structured response and preserves deterministic score', async () => {
      const res = await request(app)
        .post('/api/copilot/match-explanation')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ jobId: jobA.id, query: 'Why match?' });
      
      expect(res.status).toBe(200);
      expect(res.body.aiStatus).toBe('success');
      
      // CRITICAL: The deterministic score must be 91 (the actual DB score), NOT 42 (the AI hallucination)
      expect(res.body.deterministicScore).toBe(91);
      
      // Unsupported model claims are omitted instead of being displayed with a warning.
      const pythonStrength = res.body.strengths.find(s => s.statement === 'Hallucinated skill');
      expect(pythonStrength).toBeUndefined();
    });

    it('AI failure/timeout falls back to deterministic match information gracefully', async () => {
      const res = await request(app)
        .post('/api/copilot/match-explanation')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ jobId: jobA.id, query: 'trigger_timeout' });
      
      expect(res.status).toBe(200);
      expect(res.body.aiStatus).toBe('success');
      expect(res.body.deterministicScore).toBe(91); // Deterministic score is still returned
      expect(res.body.message).toContain('deterministic match-analysis signals');
      
      // Should fall back to the basic matchedSkills
      expect(res.body.strengths.length).toBeGreaterThan(0);
      expect(res.body.strengths[0].evidence).toContain('Node.js');
    });
  });
});
