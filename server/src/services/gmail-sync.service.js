import { ColdEmailOutreachService } from './cold-email-outreach.service.js';
import { models } from '../config/database.js';
import { getAuthenticatedClient } from './gmail-oauth.service.js';
import { listMessages, getMessage, getMessageBody, listLabels } from './gmail-message.service.js';
import { LinkedInEmailJobSource } from './linkedin-email-job-source.js';
import { ingestJobsBatch } from './job-ingestion.service.js';
import { decryptSecret } from '../lib/crypto.js';
import { env } from '../config/env.js';
import { AppError } from '../lib/http.js';

function isInvalidGrantError(err) {
  return err?.response?.data?.error === 'invalid_grant' || /invalid_grant/i.test(err?.message || '');
}

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

  let authClient;
  let messages;
  try {
    const refreshToken = decryptSecret(integration.encryptedRefreshToken);
    authClient = getAuthenticatedClient(refreshToken);

    const label = env.gmailJobLabel || 'CareerGraph/LinkedInJobs';
    const queryStr = `label:"${label}" OR label:"${label.replace(/\//g, '-')}" OR label:"${label.toLowerCase()}" OR label:"${label.toLowerCase().replace(/\//g, '-')}"`;
    ({ messages } = await listMessages(authClient, queryStr));
  } catch (err) {
    if (isInvalidGrantError(err)) {
      await integration.update({ status: 'expired' });
      // 400, not 401: this is the linked Gmail account's OAuth token, unrelated
      // to the caller's own CareerGraph session — a 401 here would trigger the
      // API client's access-token refresh/logout flow for the wrong reason.
      throw new AppError(
        400,
        'GMAIL_REAUTH_REQUIRED',
        'Your Gmail connection has expired or been revoked. Please reconnect Gmail in Integrations.'
      );
    }
    throw err;
  }

  if (!messages || messages.length === 0) {
    await integration.update({ lastSyncAt: new Date(), status: 'active' });
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
        summary.emailsProcessed++;
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
    lastSyncAt: new Date(),
    status: 'active'
  });

  return summary;
}

export async function syncGmailColdEmails(userId, labelName = 'opportunity') {
  const summary = {
    connected: true,
    messagesFound: 0,
    ingested: 0,
    linkedCompanies: 0,
    linkedConnections: 0,
    message: ''
  };

  const integration = await models.GmailIntegration.findOne({
    where: { user_id: userId }
  });

  if (!integration) {
    return {
      connected: false,
      message: 'Gmail account is not connected. Please connect your Gmail account in Integrations or paste JSON/CSV data below.'
    };
  }

  let authClient;
  let messages = [];
  let matchingLabelNames = [];
  try {
    const refreshToken = decryptSecret(integration.encryptedRefreshToken);
    authClient = getAuthenticatedClient(refreshToken);

    // Dynamic Label Discovery: list all user labels from Gmail
    const userLabels = await listLabels(authClient);
    const opportunityRegex = new RegExp(labelName.replace(/s$/, ''), 'i'); // matches opportunity, opportunities, Opportunity
    const foundLabels = userLabels.filter(l => opportunityRegex.test(l.name));
    matchingLabelNames = foundLabels.map(l => l.name);

    let queryParts = [];
    if (matchingLabelNames.length > 0) {
      matchingLabelNames.forEach(name => {
        queryParts.push(`label:"${name}"`);
      });
    } else {
      queryParts.push(`label:"${labelName}"`, `label:"Opportunity"`, `label:"opportunity"`, `label:"Opportunities"`);
    }

    const queryStr = queryParts.join(' OR ');
    const res = await listMessages(authClient, queryStr);
    messages = res.messages || [];

    // Fallback: search query for opportunity keyword if 0 label matches
    if (messages.length === 0) {
      const fallbackRes = await listMessages(authClient, 'subject:opportunity OR subject:Opportunity OR opportunity OR Opportunity');
      messages = fallbackRes.messages || [];
    }
  } catch (err) {
    if (isInvalidGrantError(err)) {
      await integration.update({ status: 'expired' });
      throw new AppError(
        400,
        'GMAIL_REAUTH_REQUIRED',
        'Your Gmail connection has expired or been revoked. Please reconnect Gmail in Integrations.'
      );
    }
    throw err;
  }

  if (!messages || messages.length === 0) {
    const availableText = matchingLabelNames.length > 0 
      ? `Matched labels: ${matchingLabelNames.join(', ')}` 
      : 'No labels matching "opportunity" found in your Gmail.';
    summary.message = `No messages found in Gmail matching label/query "opportunity". (${availableText})`;
    return summary;
  }

  summary.messagesFound = messages.length;
  const emailsToIngest = [];
  const userEmail = (integration.emailAddress || '').toLowerCase();

  for (const msg of messages) {
    try {
      const fullMsg = await getMessage(authClient, msg.id);
      const headers = fullMsg.payload?.headers || [];
      const getHeader = (name) => {
        const h = headers.find(hdr => hdr.name.toLowerCase() === name.toLowerCase());
        return h ? h.value : '';
      };

      const toHeader = getHeader('To');
      const fromHeader = getHeader('From');
      const subject = getHeader('Subject') || 'Cold Outreach';
      const dateHeader = getHeader('Date');
      const bodyText = getMessageBody(fullMsg);
      const snippet = fullMsg.snippet || '';

      const parseContact = (headerVal) => {
        if (!headerVal) return { email: '', name: '' };
        const emailMatch = headerVal.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        const email = emailMatch ? emailMatch[1] : '';
        const nameMatch = headerVal.match(/^"?([^"<]+)"?\s*</);
        const name = nameMatch ? nameMatch[1].trim() : (email ? email.split('@')[0].replace(/[._]/g, ' ') : '');
        return { email, name };
      };

      const toContact = parseContact(toHeader);
      const fromContact = parseContact(fromHeader);

      let targetContact = toContact;
      if (userEmail && toContact.email.toLowerCase() === userEmail) {
        targetContact = fromContact;
      } else if (!targetContact.email && fromContact.email) {
        targetContact = fromContact;
      }

      const recipientEmail = targetContact.email;
      const recipientName = targetContact.name;

      let organizationName = '';
      if (recipientEmail && recipientEmail.includes('@')) {
        const domain = recipientEmail.split('@')[1].toLowerCase();
        if (!['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(domain)) {
          const mainPart = domain.split('.')[0];
          organizationName = mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
        }
      }

      const lowerSubject = subject.toLowerCase() + ' ' + snippet.toLowerCase();
      let recipientRole = 'talent_acquisition';
      if (lowerSubject.includes('founder') || lowerSubject.includes('ceo') || lowerSubject.includes('co-founder')) {
        recipientRole = 'founder';
      } else if (lowerSubject.includes('hiring manager') || lowerSubject.includes('engineering manager') || lowerSubject.includes('vp')) {
        recipientRole = 'hiring_manager';
      } else if (lowerSubject.includes('recruiter') || lowerSubject.includes('talent')) {
        recipientRole = 'recruiter';
      }

      emailsToIngest.push({
        gmailMessageId: msg.id,
        gmailThreadId: msg.threadId,
        recipientEmail,
        recipientName: recipientName || 'Recruiter / Hiring Contact',
        organizationName: organizationName || 'Target Company',
        recipientRole,
        subject,
        snippet,
        bodyText,
        sentAt: dateHeader ? new Date(dateHeader) : new Date(),
        status: 'sent',
        sourceLabel: labelName
      });
    } catch (err) {
      console.error(`[GmailColdEmailSync] Error parsing message ${msg.id}:`, err);
    }
  }

  if (emailsToIngest.length > 0) {
    const ingestRes = await ColdEmailOutreachService.ingestColdEmails({
      userId,
      emails: emailsToIngest,
      source: 'gmail_sync'
    });
    summary.ingested = ingestRes.totalIngested;
    summary.linkedCompanies = ingestRes.linkedCompanies;
    summary.linkedConnections = ingestRes.linkedConnections;
    summary.message = `Synced ${summary.ingested} cold emails from Gmail opportunity label (${summary.linkedCompanies} companies & ${summary.linkedConnections} connections matched).`;
  } else {
    summary.message = `Processed ${messages.length} messages from Gmail but found no valid outreach email content to ingest.`;
  }

  await integration.update({ lastSyncAt: new Date(), status: 'active' });
  return summary;
}
