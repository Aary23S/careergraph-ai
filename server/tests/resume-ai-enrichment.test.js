import request from 'supertest';
import { jest } from '@jest/globals';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase } from '../src/config/database.js';
import { models } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { aiService } from '../src/services/ai/ai.service.js';
import { fileStorage } from '../src/lib/storage.js';
import {
  executeResumeEnrichment,
  enqueueResumeEnrichment,
  extractContactInfo,
  truncateResumeText,
  resolvePromptCharBudget,
  resumeEnrichmentSchema
} from '../src/services/resume-ai-enrichment.service.js';
import { analyzeJobResumeFit } from '../src/services/resume-analysis.service.js';
import { estimateYearsOfExperience } from '../src/lib/experience.util.js';
import { buildMinimalPdfBuffer } from './helpers/pdf-fixture.js';

async function createTestResume(userId, { fileName, content, isActive = false }) {
  const buffer = buildMinimalPdfBuffer(content);
  const stored = await fileStorage.save({
    originalname: fileName,
    buffer,
    mimetype: 'application/pdf',
    size: buffer.length
  });
  return models.Resume.create({
    user_id: userId,
    fileName,
    storageKey: stored.key,
    contentType: 'application/pdf',
    sizeBytes: buffer.length,
    isActive,
    version: 1
  });
}

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
    const resumeABuffer = buildMinimalPdfBuffer('PDF Content of Resume A');
    const stored = await fileStorage.save({
      originalname: 'resumeA.pdf',
      buffer: resumeABuffer,
      mimetype: 'application/pdf',
      size: resumeABuffer.length
    });

    resumeA = await models.Resume.create({
      user_id: userIdA,
      fileName: 'resumeA.pdf',
      storageKey: stored.key,
      contentType: 'application/pdf',
      sizeBytes: resumeABuffer.length,
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
      const resumeFailBuffer = buildMinimalPdfBuffer('PDF Content of Resume Fail');
      const storedFail = await fileStorage.save({
        originalname: 'resumeFail.pdf',
        buffer: resumeFailBuffer,
        mimetype: 'application/pdf',
        size: resumeFailBuffer.length
      });

      const resumeFail = await models.Resume.create({
        user_id: userIdA,
        fileName: 'resumeFail.pdf',
        storageKey: storedFail.key,
        contentType: 'application/pdf',
        sizeBytes: resumeFailBuffer.length,
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

  describe('Richer extraction: contact info, canonical skills, review flags, structured certifications', () => {
    it('extracts contact info via deterministic regex, independent of the LLM response', () => {
      const info = extractContactInfo(
        'Jane Doe\nEmail: jane.doe@example.com\nPhone: (555) 123-4567\n' +
        'linkedin.com/in/janedoe\ngithub.com/janedoe'
      );
      expect(info.email).toBe('jane.doe@example.com');
      expect(info.phone).toContain('555');
      expect(info.linkedin).toContain('linkedin.com/in/janedoe');
      expect(info.github).toContain('github.com/janedoe');
    });

    it('truncateResumeText cuts at a full line boundary, never mid-line', () => {
      const line1 = 'A'.repeat(100);
      const line2 = 'B'.repeat(100);
      const line3 = 'C'.repeat(100);
      const text = [line1, line2, line3].join('\n');

      const truncated = truncateResumeText(text, 150);
      expect(truncated).toBe(line1);
      expect(truncated).not.toContain('B');
    });

    it('truncateResumeText is a no-op when maxChars is 0 (mock provider budget)', () => {
      const text = 'A'.repeat(500);
      expect(truncateResumeText(text, 0)).toBe(text);
    });

    it('resolvePromptCharBudget returns the per-provider budget from env', () => {
      expect(resolvePromptCharBudget('groq')).toBe(env.aiResumePromptCharBudgetGroq);
      expect(resolvePromptCharBudget('ollama')).toBe(env.aiResumePromptCharBudgetOllama);
      expect(resolvePromptCharBudget('mock')).toBe(env.aiResumePromptCharBudgetMock);
    });

    it('persists canonicalSkills distinct from raw skills and computes totalExperienceYears deterministically', async () => {
      const resume = await createTestResume(userIdA, { fileName: 'canon.pdf', content: 'Resume canon' });
      const mockExperience = [
        { company: 'Acme', title: 'Engineer', startDate: '2020-01', endDate: '2022-01', isCurrent: false, responsibilities: [] }
      ];
      const spy = jest.spyOn(aiService, 'generateStructured').mockResolvedValueOnce({
        professionalTitle: 'Engineer',
        careerLevel: 'mid',
        skills: ['Node', 'react', 'POSTGRES'],
        technicalDomains: [],
        experience: mockExperience,
        projects: [],
        education: [],
        certifications: [],
        achievements: [],
        summary: 'Solid engineer.',
        confidence: 0.9
      });

      await executeResumeEnrichment(resume.id);
      spy.mockRestore();

      const enrichment = await models.ResumeAiEnrichment.findOne({ where: { resumeId: resume.id } });
      expect(enrichment.skills).toEqual(['Node', 'react', 'POSTGRES']);
      expect(enrichment.canonicalSkills).toEqual(expect.arrayContaining(['Node.js', 'React', 'PostgreSQL']));
      expect(enrichment.totalExperienceYears).toBe(estimateYearsOfExperience(mockExperience));
      expect(enrichment.needsReview).toBe(false);
    });

    it('sets needsReview true when confidence is low', async () => {
      const resume = await createTestResume(userIdA, { fileName: 'lowconf.pdf', content: 'Resume lowconf' });
      const spy = jest.spyOn(aiService, 'generateStructured').mockResolvedValueOnce({
        professionalTitle: 'Engineer',
        careerLevel: 'mid',
        skills: ['JavaScript'],
        technicalDomains: [],
        experience: [{ company: 'X', title: 'Y', startDate: '2021-01', endDate: '2022-01', isCurrent: false, responsibilities: [] }],
        projects: [],
        education: [],
        certifications: [],
        achievements: [],
        summary: '',
        confidence: 0.3
      });

      await executeResumeEnrichment(resume.id);
      spy.mockRestore();

      const enrichment = await models.ResumeAiEnrichment.findOne({ where: { resumeId: resume.id } });
      expect(enrichment.needsReview).toBe(true);
    });

    it('sets needsReview true when no experience entry has a parseable startDate', async () => {
      const resume = await createTestResume(userIdA, { fileName: 'nodate.pdf', content: 'Resume nodate' });
      const spy = jest.spyOn(aiService, 'generateStructured').mockResolvedValueOnce({
        professionalTitle: 'Engineer',
        careerLevel: 'mid',
        skills: ['JavaScript'],
        technicalDomains: [],
        experience: [{ company: 'X', title: 'Y', startDate: '', endDate: '', isCurrent: false, responsibilities: [] }],
        projects: [],
        education: [],
        certifications: [],
        achievements: [],
        summary: '',
        confidence: 0.9
      });

      await executeResumeEnrichment(resume.id);
      spy.mockRestore();

      const enrichment = await models.ResumeAiEnrichment.findOne({ where: { resumeId: resume.id } });
      expect(enrichment.needsReview).toBe(true);
    });

    it('accepts both legacy flat-string and new structured-object certifications', () => {
      // aiService.generateStructured is mocked elsewhere in this suite, which bypasses
      // its internal schema.validate() call — so the coercion itself is tested directly
      // against resumeEnrichmentSchema, the same schema the real pipeline validates against.
      const { error, value } = resumeEnrichmentSchema.validate({
        certifications: ['AWS Certified', { name: 'PMP', issuer: 'PMI', issueDate: '2021' }]
      });

      expect(error).toBeUndefined();
      expect(value.certifications).toHaveLength(2);
      expect(value.certifications[0]).toMatchObject({ name: 'AWS Certified', issuer: '' });
      expect(value.certifications[1]).toMatchObject({ name: 'PMP', issuer: 'PMI', issueDate: '2021' });
    });

    it('forces re-extraction when SCHEMA_VERSION bumps even though inputHash is unchanged', async () => {
      const resume = await createTestResume(userIdA, { fileName: 'stale.pdf', content: 'Resume stale' });
      const spy = jest.spyOn(aiService, 'generateStructured').mockResolvedValueOnce({
        professionalTitle: 'Engineer',
        careerLevel: 'mid',
        skills: [],
        technicalDomains: [],
        experience: [],
        projects: [],
        education: [],
        certifications: [],
        achievements: [],
        summary: '',
        confidence: 0.9
      });
      await executeResumeEnrichment(resume.id);
      spy.mockRestore();

      // Simulate a pre-existing enrichment produced by an older schema/prompt version.
      let enrichment = await models.ResumeAiEnrichment.findOne({ where: { resumeId: resume.id } });
      expect(enrichment.status).toBe('completed');
      await enrichment.update({ schemaVersion: 1, promptVersion: 1 });

      await enqueueResumeEnrichment(resume.id);

      enrichment = await models.ResumeAiEnrichment.findOne({ where: { resumeId: resume.id } });
      // Proceeded past the early-return despite an unchanged inputHash, because
      // the stale schema/prompt version forced re-processing.
      expect(enrichment.status).toBe('pending');
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
