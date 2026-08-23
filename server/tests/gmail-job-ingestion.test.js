import { jest } from '@jest/globals';

// Mock googleapis
jest.unstable_mockModule('googleapis', () => {
  const mockOAuth2Client = {
    generateAuthUrl: jest.fn(() => 'https://google.com/oauth-url-test'),
    getToken: jest.fn(async () => ({ tokens: { refresh_token: 'mock-refresh-token-xyz', scope: 'gmail.readonly' } })),
    setCredentials: jest.fn()
  };

  const mockList = jest.fn(async () => ({
    data: {
      messages: [
        { id: 'msg-12345' }
      ],
      nextPageToken: null
    }
  }));

  const mockGet = jest.fn(async () => ({
    data: {
      id: 'msg-12345',
      payload: {
        body: {
          data: Buffer.from(`
            <html>
              <body>
                <a href="https://www.linkedin.com/jobs/view/999888777?alertId=xyz">Staff Software Engineer</a>
                <div>Google</div>
                <span>Remote</span>
              </body>
            </html>
          `).toString('base64url')
        }
      }
    }
  }));

  return {
    google: {
      auth: {
        OAuth2: jest.fn(() => mockOAuth2Client)
      },
      gmail: jest.fn(() => ({
        users: {
          getProfile: jest.fn(async () => ({ data: { emailAddress: 'test-oauth@gmail.com' } })),
          messages: {
            list: mockList,
            get: mockGet
          }
        }
      }))
    }
  };
});

import request from 'supertest';
const { createApp } = await import('../src/app.js');
const { sequelize, resetDatabase, models } = await import('../src/config/database.js');
const { encryptSecret } = await import('../src/lib/crypto.js');

describe('Gmail Ingestion Integration & Idempotency Test Suite', () => {
  let app;
  let token;
  let testUser;

  beforeAll(async () => {
    app = createApp();
    await resetDatabase();

    // Register User
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'gmail-ingest@example.com', password: 'Password123!', name: 'Ingest Tester' });
    
    token = res.body.data.tokens.accessToken;
    testUser = res.body.data.user;

    // Create target user profile
    await models.Profile.create({
      user_id: testUser.id,
      name: 'Ingest Tester',
      skills: ['node', 'react', 'javascript'],
      targetRoles: ['Staff Software Engineer']
    });

    // Create Gmail integration link for the user
    await models.GmailIntegration.create({
      user_id: testUser.id,
      emailAddress: 'test-oauth@gmail.com',
      encryptedRefreshToken: encryptSecret('mock-refresh-token-xyz'),
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      status: 'active'
    });
  });

  afterAll(async () => {
    if (sequelize) {
      await sequelize.close();
    }
  });

  test('Sync endpoint processes emails, ingests jobs, and verifies idempotency', async () => {
    // 1. Initial manual sync trigger
    const syncRes = await request(app)
      .post('/api/integrations/gmail/jobs/sync')
      .set('Authorization', `Bearer ${token}`);

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.data.emailsProcessed).toBe(1);
    expect(syncRes.body.data.jobsFound).toBe(1);
    expect(syncRes.body.data.created).toBe(1);

    // Verify job in database
    const jobs = await models.Job.findAll({ where: { user_id: testUser.id } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe('Staff Software Engineer');
    expect(jobs[0].company_id).toBeDefined();

    // 2. Repeat sync: verifies message ID is skipped (idempotent!)
    const syncRes2 = await request(app)
      .post('/api/integrations/gmail/jobs/sync')
      .set('Authorization', `Bearer ${token}`);

    expect(syncRes2.status).toBe(200);
    expect(syncRes2.body.data.emailsProcessed).toBe(0); // skipped!
    expect(syncRes2.body.data.created).toBe(0);
  });
});
