import { models } from '../config/database.js';
import { getAuthenticatedClient } from './gmail-oauth.service.js';
import { listMessages, getMessage, getMessageBody } from './gmail-message.service.js';
import { LinkedInEmailJobSource } from './linkedin-email-job-source.js';
import { ingestJobsBatch } from './job-ingestion.service.js';
import { decryptSecret } from '../lib/crypto.js';
import { env } from '../config/env.js';

/**
 * Programmatically syncs Gmail LinkedIn alert emails and ingests jobs for a user.
 * 
 * @param {string} userId User ID
 * @returns {Promise<Object>} Sync execution summary statistics
 */
export async function syncGmailJobs(userId) {
  const summary = {
    emailsProcessed: 0,
    jobsFound: 0,
    created: 0,
    updated: 0,
    duplicates: 0,
    failed: 0
  };

  const integration = await models.GmailIntegration.findOne({
    where: { user_id: userId }
  });

  if (!integration) {
    // If not configured, exit silently or return zero counts
    return summary;
  }

  const refreshToken = decryptSecret(integration.encryptedRefreshToken);
  const authClient = getAuthenticatedClient(refreshToken);

  const label = env.gmailJobLabel || 'CareerGraph/LinkedInJobs';
  const queryStr = `label:"${label}" OR label:"${label.replace(/\//g, '-')}" OR label:"${label.toLowerCase()}" OR label:"${label.toLowerCase().replace(/\//g, '-')}"`;
  const { messages } = await listMessages(authClient, queryStr);

  if (!messages || messages.length === 0) {
    return summary;
  }

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
      console.error(`[GmailSync] Error processing message ID ${msg.id}:`, err);
      summary.failed++;
    }
  }

  // Update integration last sync timestamp
  await integration.update({
    lastSyncAt: new Date()
  });

  return summary;
}
