import { jest } from '@jest/globals';
import request from 'supertest';
import { models, resetDatabase } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

let mockFetch = jest.fn();
global.fetch = mockFetch;

const { handleTelegramMessage, telegramLinkingCodes } = await import('../src/services/telegram.service.js');
const { classifyMessage, parseTelegramJob, parseTelegramJobAsync } = await import('../src/services/telegram-job-parser.service.js');

describe('Telegram Integration & Bot Ingestion Test Suite', () => {
  let app;
  let testUser;
  let authToken;

  beforeAll(async () => {
    await resetDatabase();
    app = createApp();

    const passwordHash = await bcrypt.hash('Password123!', 10);
    testUser = await models.User.create({
      email: 'telegram-test@example.com',
      passwordHash,
      name: 'Telegram Tester',
      isEmailVerified: true
    });

    // Mock environmental variables for Bot client checks in test run
    env.telegramEnabled = true;
    env.telegramBotToken = 'mock-bot-token-xyz';

    // Generate JWT access token for API requests (sub represents the userId mapping)
    authToken = jwt.sign(
      { sub: testUser.id, email: testUser.email },
      env.jwtAccessSecret,
      { expiresIn: '1h' }
    );

    // Mock profile skills for match score calculations
    await models.Profile.create({
      user_id: testUser.id,
      name: 'Telegram Tester',
      skills: ['Node.js', 'PostgreSQL', 'AWS']
    });
  });

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      json: async () => ({ ok: true, result: { message_id: 101 } })
    });
  });

  describe('Classifier & Parser Unit Tests', () => {
    test('classifyMessage classifies high-confidence jobs vs conversation', () => {
      const jobText = `🚀 Hiring Backend Developer\nRole: Backend Developer\nCompany: XYZ Tech\nApply: https://xyz.com/apply`;
      expect(classifyMessage(jobText)).toBe('JOB');

      const nonJobText = `Hello everyone, good morning! Hope you all have a great day.`;
      expect(classifyMessage(nonJobText)).toBe('NON_JOB');

      const reviewText = `Urgent hiring for full stack developer, contact me at test@example.com`;
      expect(classifyMessage(reviewText)).toBe('REVIEW_REQUIRED');
    });

    test('parseTelegramJob extracts structured metadata from raw text', () => {
      const jobText = `
        🚀 Hiring Backend Developer
        Company: XYZ Technologies
        Location: Bangalore / Remote
        Experience: 2-4 years
        Salary: 12-18 LPA
        Skills: Node.js, PostgreSQL, AWS
        Apply: https://xyz.com/jobs/backend
      `;
      const { parsedJob, confidence } = parseTelegramJob(jobText);

      expect(parsedJob.title).toBe('Backend Developer');
      expect(parsedJob.companyName).toBe('XYZ Technologies');
      expect(parsedJob.location).toContain('Bangalore');
      expect(parsedJob.experience).toBe('2-4 years');
      expect(parsedJob.salary).toBe('12-18 LPA');
      expect(parsedJob.skills).toContain('Node.js');
      expect(parsedJob.skills).toContain('PostgreSQL');
      expect(parsedJob.skills).toContain('AWS');
      expect(parsedJob.jobUrl).toBe('https://xyz.com/jobs/backend');
      expect(confidence).toBeGreaterThanOrEqual(0.8);
    });

    test('parseTelegramJob parses Company Name: prefix correctly', () => {
      const userText = `
        Company name: micro1
        Role: Competitive Programmer
        Batch Eligible: All college students+ Working Professionals (Open to all)
        Salary: $40 - $80 per hour
        Location: Remote (Work From Home)
        Apply Link (200 openings): https://bit.ly/4gz0o6v
      `;
      const { parsedJob } = parseTelegramJob(userText);
      expect(parsedJob.title).toBe('Competitive Programmer');
      expect(parsedJob.companyName).toBe('micro1');
      expect(parsedJob.location).toContain('Remote');
    });

    test('parseTelegramJobAsync uses AI structured extraction when AI is enabled', async () => {
      env.aiEnabled = true;
      env.aiProvider = 'mock';

      const shortJobPost = `Hiring Sr Backend Engineer @ Stripe in NYC. Salary $180k. Apply https://stripe.com/jobs/123`;
      const result = await parseTelegramJobAsync(shortJobPost);

      expect(result.parsedJob).toBeDefined();
      expect(result.parsedJob.title).toBeTruthy();
      expect(result.parsedJob.jobUrl).toBe('https://stripe.com/jobs/123');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    test('parseTelegramJobAsync parses long unstructured multi-paragraph job post', async () => {
      env.aiEnabled = true;
      env.aiProvider = 'mock';

      const longJobPost = `
        🚀 OPPORTUNITY ALERT - SDE-2 (Backend) 🚀
        Hey folks, our team at Google (Bengaluru office) is expanding! We have multiple openings for Backend Engineers.
        You will work on massive scale distributed systems using Go, Java, and gRPC.

        Requirements:
        - 3-5 years exp in backend engineering
        - Expertise in Go / Java / Node.js
        - Strong CS fundamentals

        Perks:
        - Competitive pay (~35-45 LPA)
        - Hybrid work policy (2 days WFH)

        Send your resumes to hiring@google.com or apply directly here: https://careers.google.com/jobs/999
      `;
      const result = await parseTelegramJobAsync(longJobPost);

      expect(result.parsedJob).toBeDefined();
      expect(result.parsedJob.jobUrl).toBe('https://careers.google.com/jobs/999');
      expect(result.parsedJob.contactEmail).toBe('hiring@google.com');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    test('parseTelegramJobAsync falls back to heuristic parser when AI is disabled', async () => {
      env.aiEnabled = false;

      const jobPost = `
        Role: Frontend Developer
        Company: Acme Corp
        Location: Remote
        Apply: https://acme.com/apply
      `;
      const result = await parseTelegramJobAsync(jobPost);

      expect(result.parsedJob.title).toBe('Frontend Developer');
      expect(result.parsedJob.companyName).toBe('Acme Corp');
      expect(result.parsedJob.location).toBe('Remote');
      expect(result.parsedJob.jobUrl).toBe('https://acme.com/apply');
    });
  });

  describe('Account Linking Workflow', () => {
    test('Generates link token and links Telegram account via /start command', async () => {
      // 1. Get linking code from REST API
      const res = await request(app)
        .get('/api/integrations/telegram/link')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      const { code } = res.body.data;
      expect(code).toMatch(/^CG-[A-Z0-9]{6}$/);

      // 2. Mock bot update message with code
      const startMessage = {
        message_id: 55,
        chat: { id: 98765, type: 'private' },
        from: { id: 98765, username: 'test_tele_user' },
        text: `/start ${code}`
      };

      await handleTelegramMessage(startMessage);

      // 3. Verify TelegramIntegration is saved in db
      const link = await models.TelegramIntegration.findOne({
        where: { user_id: testUser.id }
      });
      expect(link).toBeDefined();
      expect(link.telegramUserId).toBe('98765');
      expect(link.telegramUsername).toBe('test_tele_user');

      // 4. Verify REST API connection status reflects linked account
      const statusRes = await request(app)
        .get('/api/integrations/telegram/status')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.connected).toBe(true);
      expect(statusRes.body.data.telegramUsername).toBe('test_tele_user');
    });
  });

  describe('Telegram Job Ingestion & Review Pipe', () => {
    test('Auto-ingests high confidence job message', async () => {
      const jobMessage = {
        message_id: 102,
        chat: { id: 98765, type: 'private' },
        from: { id: 98765 },
        text: `🚀 Hiring Backend Developer\nRole: Backend Developer\nCompany: XYZ Technologies\nLocation: Bangalore\nApply: https://xyz.com/apply`
      };

      await handleTelegramMessage(jobMessage);

      // Verify job is ingested directly into jobs table
      const job = await models.Job.findOne({
        where: { user_id: testUser.id, title: 'Backend Developer' },
        include: [{ model: models.Company, as: 'company' }]
      });
      expect(job).not.toBeNull();
      expect(job.company.name).toBe('XYZ Technologies');

      // Verify the processed incoming event status is marked approved
      const incoming = await models.IncomingJob.findOne({
        where: { user_id: testUser.id, telegramMessageId: '102' }
      });
      expect(incoming).not.toBeNull();
      expect(incoming.status).toBe('approved');
    });

    test('Places low confidence job in review queue', async () => {
      const lowConfidenceMessage = {
        message_id: 103,
        chat: { id: 98765, type: 'private' },
        from: { id: 98765 },
        text: `Urgent hiring for developers, email your CV to hr@example.com`
      };

      await handleTelegramMessage(lowConfidenceMessage);

      // Verify job is NOT created in main jobs table yet
      const job = await models.Job.findOne({
        where: { user_id: testUser.id, title: 'developers' } // title fallback key
      });
      expect(job).toBeNull();

      // Verify it exists in incoming_jobs in pending_review status
      const incoming = await models.IncomingJob.findOne({
        where: { user_id: testUser.id, telegramMessageId: '103' }
      });
      expect(incoming).not.toBeNull();
      expect(incoming.status).toBe('pending_review');
    });

    test('List, Ignore, and Approve REST endpoints function correctly', async () => {
      // 1. List pending incoming jobs
      const listRes = await request(app)
        .get('/api/incoming-jobs?status=pending_review')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
      const pendingJob = listRes.body.data.find(j => j.telegramMessageId === '103');

      // 2. Approve and edit details for ingestion
      const approveRes = await request(app)
        .post(`/api/incoming-jobs/${pendingJob.id}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Full Stack Engineer',
          companyName: 'Acme Corp',
          location: 'Remote',
          skills: ['Node.js', 'React']
        });
      
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('created');

      // Verify it was persisted in jobs table
      const createdJob = await models.Job.findOne({
        where: { user_id: testUser.id, title: 'Full Stack Engineer' },
        include: [{ model: models.Company, as: 'company' }]
      });
      expect(createdJob).not.toBeNull();
      expect(createdJob.company.name).toBe('Acme Corp');

      // Verify incoming job record status changed to approved
      const updatedIncoming = await models.IncomingJob.findByPk(pendingJob.id);
      expect(updatedIncoming.status).toBe('approved');
    });

    test('Disconnects Telegram integration', async () => {
      const res = await request(app)
        .post('/api/integrations/telegram/disconnect')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.disconnected).toBe(true);

      const link = await models.TelegramIntegration.findOne({
        where: { user_id: testUser.id }
      });
      expect(link).toBeNull();
    });
  });
});
