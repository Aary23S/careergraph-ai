import { jest } from '@jest/globals';

// Mock googleapis
jest.unstable_mockModule('googleapis', () => {
  const mockOAuth2Client = {
    generateAuthUrl: jest.fn(() => 'https://google.com/oauth-url-test'),
    getToken: jest.fn(async () => ({ tokens: { refresh_token: 'mock-refresh-token-xyz', scope: 'gmail.readonly' } })),
    setCredentials: jest.fn()
  };

  return {
    google: {
      auth: {
        OAuth2: jest.fn(() => mockOAuth2Client)
      },
      gmail: jest.fn(() => ({
        users: {
          getProfile: jest.fn(async () => ({ data: { emailAddress: 'reconnect-test@gmail.com' } }))
        }
      }))
    }
  };
});

import request from 'supertest';
const { createApp } = await import('../src/app.js');
const { sequelize, resetDatabase, models } = await import('../src/config/database.js');

describe('Gmail OAuth callback route (real HTTP path)', () => {
  let app;
  let userId;

  beforeAll(async () => {
    app = createApp();
    await resetDatabase();

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'gmail-callback@example.com', password: 'Password123!', name: 'Callback Tester' });
    userId = res.body.data.user.id;
  });

  afterAll(async () => {
    if (sequelize) {
      await sequelize.close();
    }
  });

  test('first connect creates a GmailIntegration row with the correct email address', async () => {
    const res = await request(app)
      .get('/api/integrations/gmail/callback')
      .query({ code: 'mock-auth-code', state: userId });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('gmail_connected=true');

    const rows = await models.GmailIntegration.findAll({ where: { user_id: userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].emailAddress).toBe('reconnect-test@gmail.com');
    expect(rows[0].status).toBe('active');
  });

  test('reconnecting updates the existing row instead of creating a duplicate', async () => {
    const existing = await models.GmailIntegration.findOne({ where: { user_id: userId } });
    await existing.update({ status: 'expired' });

    const res = await request(app)
      .get('/api/integrations/gmail/callback')
      .query({ code: 'mock-auth-code', state: userId });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('gmail_connected=true');

    const rows = await models.GmailIntegration.findAll({ where: { user_id: userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(existing.id);
    expect(rows[0].status).toBe('active');
  });
});
