import { Router } from 'express';
import { google } from 'googleapis';
import Joi from 'joi';
import { ok, created, asyncHandler, AppError } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { models } from '../config/database.js';
import { env } from '../config/env.js';
import { getAuthorizationUrl, exchangeCodeForTokens, getAuthenticatedClient } from '../services/gmail-oauth.service.js';
import { getMessageBody, listMessages, getMessage } from '../services/gmail-message.service.js';
import { LinkedInEmailJobSource } from '../services/linkedin-email-job-source.js';
import { encryptSecret, decryptSecret } from '../lib/crypto.js';
import { ingestJobsBatch } from '../services/job-ingestion.service.js';

const router = Router();

// OAuth connect initiation (user redirected to Google consent)
router.get(
  '/gmail/connect',
  asyncHandler(async (req, res) => {
    // Pass userId as state to retrieve it during callback redirection
    const userId = req.query.userId || req.auth?.userId;
    if (!userId) {
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
    const { code, state: userId } = req.query;
    if (!code || !userId) {
      return res.redirect(`http://localhost:5173/?gmail_error=missing_callback_params`);
    }

    try {
      const tokens = await exchangeCodeForTokens(code);
      if (!tokens.refresh_token) {
        // Fallback: if refresh token not returned (already consented), prompt consent again
        return res.redirect(`http://localhost:5173/?gmail_error=missing_refresh_token`);
      }

      // Fetch user's Gmail profile email address
      const authClient = getAuthenticatedClient(tokens.refresh_token);
      const gmail = google.gmail({ version: 'v1', auth: authClient });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      const emailAddress = profile.data.emailAddress;

      const encryptedRefreshToken = encryptSecret(tokens.refresh_token);

      // Save integration to database
      await models.GmailIntegration.upsert({
        user_id: userId,
        emailAddress,
        encryptedRefreshToken,
        scope: tokens.scope || env.gmailOauthScopes,
        status: 'active',
        lastSyncAt: null
      });

      res.redirect(`http://localhost:5173/?gmail_connected=true&email=${encodeURIComponent(emailAddress)}`);
    } catch (err) {
      console.error('Gmail OAuth Callback Error:', err);
      res.redirect(`http://localhost:5173/?gmail_error=${encodeURIComponent(err.message)}`);
    }
  })
);

// Gmail Integration Status Check
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
      email: integration.emailAddress,
      status: integration.status,
      lastSyncAt: integration.lastSyncAt
    });
  })
);

// Revoke and delete Gmail Connection
router.post(
  '/gmail/disconnect',
  requireAuth,
  asyncHandler(async (req, res) => {
    const integration = await models.GmailIntegration.findOne({
      where: { user_id: req.auth.userId }
    });

    if (integration) {
      await integration.destroy();
    }

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

    const refreshToken = decryptSecret(integration.encryptedRefreshToken);
    const authClient = getAuthenticatedClient(refreshToken);

    const queryStr = `label:${env.gmailJobLabel || 'CareerGraph/LinkedInJobs'}`;
    const { messages } = await listMessages(authClient, queryStr);

    const summary = {
      emailsProcessed: 0,
      jobsFound: 0,
      created: 0,
      updated: 0,
      duplicates: 0,
      failed: 0,
      results: []
    };

    const source = new LinkedInEmailJobSource();

    for (const msg of messages) {
      try {
        // Idempotency check: verify message is not processed already
        const existingEvent = await models.JobIngestionEvent.findOne({
          where: {
            user_id: userId,
            sourceType: 'linkedin_email',
            sourceMessageId: msg.id
          }
        });

        if (existingEvent) {
          continue;
        }

        // Fetch full message details
        const fullMsg = await getMessage(authClient, msg.id);
        const htmlBody = getMessageBody(fullMsg);
        
        const parsedJobs = source.parseLinkedInAlert(htmlBody);
        summary.jobsFound += parsedJobs.length;

        if (parsedJobs.length > 0) {
          const batchRes = await ingestJobsBatch(userId, parsedJobs);
          summary.created += batchRes.created;
          summary.updated += batchRes.updated;
          summary.duplicates += batchRes.duplicate;
          summary.failed += batchRes.failed;
        }

        // Register processed message event record
        await models.JobIngestionEvent.create({
          user_id: userId,
          sourceType: 'linkedin_email',
          sourceMessageId: msg.id,
          status: 'success',
          processedAt: new Date()
        });

        summary.emailsProcessed++;
      } catch (err) {
        console.error(`Error processing message ID ${msg.id}:`, err);
        summary.failed++;
      }
    }

    // Update integration last sync timestamp
    await integration.update({
      lastSyncAt: new Date()
    });

    ok(res, summary);
  })
);

export default router;
