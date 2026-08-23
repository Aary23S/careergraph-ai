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
          getProfile: jest.fn(async () => ({ data: { emailAddress: 'test-oauth@gmail.com' } }))
        }
      }))
    }
  };
});

const { getAuthorizationUrl, exchangeCodeForTokens, getAuthenticatedClient } = await import('../src/services/gmail-oauth.service.js');
const { encryptSecret, decryptSecret } = await import('../src/lib/crypto.js');
const { models, resetDatabase } = await import('../src/config/database.js');
import bcrypt from 'bcryptjs';

describe('Gmail OAuth & Crypto Test Suite', () => {
  let testUser;

  beforeAll(async () => {
    await resetDatabase();
    const passwordHash = await bcrypt.hash('Password123!', 10);
    testUser = await models.User.create({
      email: 'oauth-test@example.com',
      passwordHash,
      name: 'OAuth Tester',
      isEmailVerified: true
    });
  });

  test('Token Encryption & Decryption preserves string data', () => {
    const rawToken = '1//0gRefreshSecretStuff';
    const encrypted = encryptSecret(rawToken);
    
    expect(encrypted).toContain(':');
    
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(rawToken);
  });

  test('getAuthorizationUrl returns mock consent URL', () => {
    const url = getAuthorizationUrl('user-id-123');
    expect(url).toBe('https://google.com/oauth-url-test');
  });

  test('exchangeCodeForTokens exchanges code for tokens', async () => {
    const tokens = await exchangeCodeForTokens('mock-auth-code');
    expect(tokens.refresh_token).toBe('mock-refresh-token-xyz');
  });

  test('getAuthenticatedClient returns oauth client with credentials set', () => {
    const client = getAuthenticatedClient('mock-refresh-token-xyz');
    expect(client).toBeDefined();
  });
});
