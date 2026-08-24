import request from 'supertest';
import { createApp } from '../src/app.js';
import { models, resetDatabase } from '../src/config/database.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { ingestJob } from '../src/services/job-ingestion.service.js';

describe('Job Discovery Automation & Monitoring Test Suite', () => {
  let app;
  let testUser;
  let authToken;

  beforeAll(async () => {
    app = createApp();
    // Drop and recreate test tables with updated schema columns
    await resetDatabase();

    // Create a unique test user
    const email = `discovery-${Date.now()}@example.com`;
    testUser = await models.User.create({
      email,
      passwordHash: 'hashed_password_123',
      isEmailVerified: true
    });

    // Generate JWT access token
    authToken = jwt.sign(
      { sub: testUser.id, email: testUser.email },
      env.jwtAccessSecret,
      { expiresIn: '1h' }
    );

    // Setup initial Profile skills and target roles
    await models.Profile.create({
      user_id: testUser.id,
      name: 'Discovery Developer',
      skills: ['React', 'Node.js', 'PostgreSQL'],
      targetRoles: ['Frontend Engineer', 'Full Stack Developer'],
      preferredLocations: ['Remote', 'Bangalore']
    });

    // Create preferences record
    await models.UserPreference.create({
      user_id: testUser.id,
      notificationsEnabled: true,
      notifyHighlyRelevant: true,
      notifyStrongReferral: true,
      notifyTargetCompany: true,
      minimumMatchScore: 80
    });

    // Create a target company profile
    await models.JobSearchProfile.create({
      user_id: testUser.id,
      name: 'Top Targets',
      keywords: 'engineer',
      targetCompanies: ['Google', 'Stripe'],
      isActive: true
    });
  });

  afterAll(async () => {
    // Cleanup records
    if (testUser) {
      await models.JobDeduplicationLog.destroy({ where: { user_id: testUser.id } });
      await models.JobSearchProfile.destroy({ where: { user_id: testUser.id } });
      await models.UserPreference.destroy({ where: { user_id: testUser.id } });
      await models.Profile.destroy({ where: { user_id: testUser.id } });
      await models.Notification.destroy({ where: { user_id: testUser.id } });
      await models.Job.destroy({ where: { user_id: testUser.id } });
      await models.User.destroy({ where: { id: testUser.id } });
    }
  });

  test('Relevance classifier assigns target_company priority and matchScore correctly', async () => {
    const jobInput = {
      title: 'Frontend Engineer',
      companyName: 'Google',
      location: 'Remote',
      description: 'We need a React developer with Node.js and PostgreSQL skills.',
      source: 'manual',
      sourceUrl: 'https://careers.google.com/jobs/frontend',
      url: 'https://careers.google.com/jobs/frontend'
    };

    const res = await ingestJob(testUser.id, jobInput);
    expect(res.status).toBe('created');

    const job = await models.Job.findOne({
      where: { id: res.job.id },
      include: [{ model: models.Company, as: 'company' }]
    });

    expect(job.priority).toBe('target_company');
    expect(job.matchScore).toBeGreaterThanOrEqual(80);

    // Verify alert notification was automatically triggered
    const alert = await models.Notification.findOne({
      where: { user_id: testUser.id, type: 'job_alert' }
    });
    expect(alert).not.toBeNull();
    expect(alert.title).toContain('Google');
  });

  test('Ingestion captures duplicate job and logs deduplication reason', async () => {
    const duplicateInput = {
      title: 'UI Developer',
      companyName: 'Google',
      location: 'Remote',
      description: 'We need a React developer with Node.js.',
      source: 'manual',
      sourceUrl: 'https://careers.google.com/jobs/frontend',
      url: 'https://careers.google.com/jobs/frontend'
    };

    const res = await ingestJob(testUser.id, duplicateInput);
    expect(['duplicate', 'updated']).toContain(res.status);

    const duplicateLog = await models.JobDeduplicationLog.findOne({
      where: { user_id: testUser.id }
    });

    expect(duplicateLog).not.toBeNull();
    expect(duplicateLog.reason).toBe('Job URL Match');
  });

  test('REST Endpoints report health matrix and metrics', async () => {
    const res = await request(app)
      .get('/api/dashboard/ingestion-monitor')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.sources.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data.stats.duplicates).toBeGreaterThanOrEqual(1);

    const logsRes = await request(app)
      .get('/api/dashboard/deduplication-logs')
      .set('Authorization', `Bearer ${authToken}`);

    expect(logsRes.status).toBe(200);
    expect(logsRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(logsRes.body.data[0].reason).toBe('Job URL Match');
  });

  test('Updating user automation preferences persists settings', async () => {
    const updatedPref = {
      notificationsEnabled: true,
      notifyHighlyRelevant: false,
      notifyStrongReferral: true,
      notifyTargetCompany: false,
      minimumMatchScore: 90
    };

    const putRes = await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updatedPref);

    expect(putRes.status).toBe(200);
    expect(putRes.body.data.notifyHighlyRelevant).toBe(false);
    expect(putRes.body.data.minimumMatchScore).toBe(90);
  });
});
