import { google } from 'googleapis';
import { env } from '../config/env.js';

/**
 * Creates a raw Google OAuth2 Client
 */
export function createOAuthClient() {
  return new google.auth.OAuth2(
    env.googleClientId,
    env.googleClientSecret,
    env.googleRedirectUri
  );
}

/**
 * Generates the redirect URL to prompt user consent for gmail.readonly
 */
export function getAuthorizationUrl() {
  const oauth2Client = createOAuthClient();
  const scopes = env.gmailOauthScopes ? env.gmailOauthScopes.split(',') : ['https://www.googleapis.com/auth/gmail.readonly'];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes
  });
}

/**
 * Exchanges the code returned by redirect callback for OAuth tokens
 */
export async function exchangeCodeForTokens(code) {
  const oauth2Client = createOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Returns a ready-to-use authenticated client using the stored refresh token
 */
export function getAuthenticatedClient(refreshToken) {
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });
  return oauth2Client;
}
