import request from 'supertest';
import { jest } from '@jest/globals';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase } from '../src/config/database.js';
import { models } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { aiService } from '../src/services/ai/ai.service.js';
import { fileStorage } from '../src/lib/storage.js';
import { executeResumeEnrichment } from '../src/services/resume-ai-enrichment.service.js';
import { analyzeJobResumeFit } from '../src/services/resume-analysis.service.js';

describe('Resume AI Enrichment & Intelligence Test Suite', () => {
  let app;
  let tokenA;
  let tokenB;
  let userIdA;
  let resumeA;

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

    // Create a mock active resume for User A
    const stored = await fileStorage.save({
      originalname: 'resumeA.pdf',
      buffer: Buffer.from('PDF Content of Resume A'),
      mimetype: 'application/pdf',
      size: 24
    });

    resumeA = await models.Resume.create({
      user_id: userIdA,
      fileName: 'resumeA.pdf',
      storageKey: stored.key,
      contentType: 'application/pdf',
      sizeBytes: 24,
      isActive: true,
      version: 1
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Enrichment execution & parsing', () => {
    it('creates pending resume AI enrichment entry and triggers background worker', async () => {
      // Mock generateStructured return value
      const mockResult = {
        professionalTitle: 'Backend Developer',
        careerLevel: 'mid',
        skills: ['JavaScript', 'Node.js', 'PostgreSQL'],
        technicalDomains: ['backend', 'web development'],
        experience: [
          {
            company: 'Example Corp',
            title: 'Software Engineer',
            startDate: '2024-01',
            endDate: '2026-02',
            isCurrent: false,
            responsibilities: ['Built REST APIs']
          }
        ],
        projects: [
          {
            name: 'CareerGraph',
            description: 'Career pathing app',
            technologies: ['Node.js']
          }
        ],
        education: [],
        certifications: [],
        achievements: [],
        summary: 'Passionate developer.',
        confidence: 0.95
      };

      const spy = jest.spyOn(aiService, 'generateStructured').mockResolvedValueOnce(mockResult);

      await executeResumeEnrichment(resumeA.id);

      const enrichment = await models.ResumeAiEnrichment.findOne({ where: { resumeId: resumeA.id } });
      expect(enrichment).toBeDefined();
      expect(enrichment.status).toBe('completed');
      expect(enrichment.professionalTitle).toBe('Backend Developer');
      expect(enrichment.careerLevel).toBe('mid');
      expect(enrichment.skills).toContain('Node.js');
      expect(enrichment.confidence).toBe(0.95);
      spy.mockRestore();
    });

    it('gracefully handles timeout and marks status failed without throwing', async () => {
      const spy = jest.spyOn(aiService, 'generateStructured').mockRejectedValueOnce(new Error('AI request timeout exceeded'));

      // Create a separate resume to test failure scenario
      const storedFail = await fileStorage.save({
        originalname: 'resumeFail.pdf',
        buffer: Buffer.from('PDF Content of Resume Fail'),
        mimetype: 'application/pdf',
        size: 28
      });

      const resumeFail = await models.Resume.create({
        user_id: userIdA,
        fileName: 'resumeFail.pdf',
        storageKey: storedFail.key,
        contentType: 'application/pdf',
        sizeBytes: 28,
        isActive: false,
        version: 2
      });

      await executeResumeEnrichment(resumeFail.id);

      const enrichment = await models.ResumeAiEnrichment.findOne({ where: { resumeId: resumeFail.id } });
      expect(enrichment.status).toBe('failed');
      expect(enrichment.errorCode).toBe('TIMEOUT');
      spy.mockRestore();
    });
  });

  describe('REST API routes', () => {
    it('returns enrichment data nested inside GET /api/resumes', async () => {
      const res = await request(app)
        .get('/api/resumes')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].aiEnrichment).toBeDefined();
    });

    it('returns manual corrections PUT saves overrides separately', async () => {
      const res = await request(app)
        .put(`/api/resumes/${resumeA.id}/ai-corrections`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          professionalTitle: 'Lead Backend Developer',
          careerLevel: 'senior',
          skills: ['JavaScript', 'Node.js', 'Go']
        });

      expect(res.status).toBe(200);
      expect(res.body.data.aiEnrichment.userCorrectedProfessionalTitle).toBe('Lead Backend Developer');
      expect(res.body.data.aiEnrichment.userCorrectedCareerLevel).toBe('senior');
      expect(res.body.data.aiEnrichment.userCorrectedSkills).toContain('Go');
      // Original values are not overridden
      expect(res.body.data.aiEnrichment.careerLevel).toBe('mid');
    });

    it('enforces tenant isolation preventing user B from reading or correcting user A resumes', async () => {
      const resGet = await request(app)
        .get(`/api/resumes/${resumeA.id}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(resGet.status).toBe(404);

      const resPut = await request(app)
        .put(`/api/resumes/${resumeA.id}/ai-corrections`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ professionalTitle: 'Hacker' });
      expect(resPut.status).toBe(404);
    });
  });

  describe('Resume ↔ Job Analysis fit', () => {
    let jobId;

    beforeAll(async () => {
      // Setup Job and Job AI Enrichment
      const job = await models.Job.create({
        user_id: userIdA,
        title: 'Senior Dev',
        companyId: 'abc-123',
        location: 'Remote',
        description: 'Need Node.js and Go experience.',
        source: 'manual'
      });
      jobId = job.id;

      await models.JobAiEnrichment.create({
        jobId: job.id,
        provider: 'mock',
        model: 'mock',
        status: 'completed',
        inputHash: 'somehash',
        roleCategory: 'engineering',
        seniority: 'senior',
        requiredSkills: ['Node.js', 'Go'],
        preferredSkills: ['PostgreSQL'],
        summary: 'Lead dev role.'
      });
    });

    it('successfully generates job fit analysis and matches skills', async () => {
      const mockAnalysisResult = {
        matchedSkills: ['Node.js', 'Go'],
        missingSkills: ['PostgreSQL'],
        strengths: ['Solid experience with Go backend services.'],
        potentialGaps: ['Missing database management skill evidence.'],
        analysisSummary: 'Highly compatible candidate.',
        compatibilityAssessment: 'high'
      };

      const spy = jest.spyOn(aiService, 'generateStructured').mockResolvedValueOnce(mockAnalysisResult);

      const fit = await analyzeJobResumeFit(jobId, resumeA.id);
      expect(fit.compatibilityAssessment).toBe('high');
      expect(fit.matchedSkills).toContain('Go');
      expect(fit.missingSkills).toContain('PostgreSQL');
      spy.mockRestore();
    });

    it('enforces tenant isolation on job resume analysis route', async () => {
      const res = await request(app)
        .get(`/api/jobs/${jobId}/resume-analysis`)
        .set('Authorization', `Bearer ${tokenB}`);
      
      expect(res.status).toBe(404);
    });
  });
});
