import { Router } from 'express';
import { google } from 'googleapis';
import { ok, asyncHandler, AppError } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { models } from '../config/database.js';
import { getAuthorizationUrl, exchangeCodeForTokens, getAuthenticatedClient } from '../services/gmail-oauth.service.js';
import { encryptSecret } from '../lib/crypto.js';
import { syncGmailJobs } from '../services/gmail-sync.service.js';

const router = Router();

// OAuth connect initiation (user redirected to Google consent)
router.get(
  '/gmail/connect',
  asyncHandler(async (req, res) => {
    // Pass userId as state to retrieve it during callback redirection
    const userId = req.query.userId || req.auth?.userId;
    if (!userId || userId === 'undefined' || userId === 'null') {
      throw new AppError(400, 'BAD_REQUEST', 'User ID is required in query params');
    }
    const authUrl = getAuthorizationUrl(userId);
    res.redirect(authUrl);
  })
);

// OAuth callback redirect handler
router.get(
  '/gmail/callback',
  asyncHandler(async (req, res) => {
    console.log('GMAIL CALLBACK QUERY RECEIVED:', req.query);
    const { code, state: userId } = req.query;
    if (!code || !userId || userId === 'undefined' || userId === 'null') {
      return res.redirect(`http://localhost:5173/?gmail_error=missing_callback_params`);
    }

    try {
      const tokens = await exchangeCodeForTokens(code);
      if (!tokens.refresh_token) {
        // Fallback: if refresh token not returned (already consented), prompt consent again
        return res.redirect(`http://localhost:5173/?gmail_error=missing_refresh_token`);
      }

      // Fetch user profile email
      const authClient = getAuthenticatedClient(tokens.refresh_token);
      const gmail = google.gmail({ version: 'v1', auth: authClient });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      const emailAddress = profile.data.emailAddress;

      // Encrypt the refresh token
      const encrypted = encryptSecret(tokens.refresh_token);

      // Save integration to database
      await models.GmailIntegration.upsert({
        user_id: userId,
        email: emailAddress,
        encryptedRefreshToken: encrypted
      });

      res.redirect(`http://localhost:5173/?gmail_connected=true&email=${encodeURIComponent(emailAddress)}`);
    } catch (err) {
      console.error('Gmail OAuth Callback Error:', err);
      res.redirect(`http://localhost:5173/?gmail_error=${encodeURIComponent(err.message)}`);
    }
  })
);

// Fetch connected integration status
router.get(
  '/gmail/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const integration = await models.GmailIntegration.findOne({
      where: { user_id: req.auth.userId }
    });

    if (!integration) {
      return ok(res, { connected: false });
    }

    ok(res, {
      connected: true,
      email: integration.email,
      lastSyncAt: integration.lastSyncAt
    });
  })
);

// Disconnect Gmail integration
router.post(
  '/gmail/disconnect',
  requireAuth,
  asyncHandler(async (req, res) => {
    await models.GmailIntegration.destroy({
      where: { user_id: req.auth.userId }
    });
    ok(res, { disconnected: true });
  })
);

// Synchronize jobs from labelled Gmail inbox messages
router.post(
  '/gmail/jobs/sync',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const integration = await models.GmailIntegration.findOne({
      where: { user_id: userId }
    });

    if (!integration) {
      throw new AppError(400, 'BAD_REQUEST', 'Gmail integration not configured.');
    }

    const summary = await syncGmailJobs(userId);
    ok(res, summary);
  })
);

export default router;
