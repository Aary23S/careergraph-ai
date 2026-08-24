import { env } from '../config/env.js';
import { models } from '../config/database.js';
import { Op } from 'sequelize';

let isPolling = false;
let pollingTimeoutId = null;
let currentOffset = 0;

// Temporary in-memory cache for linking codes
// Key: code (e.g., "CG-XXXXXX"), Value: { userId, expiresAt }
export const telegramLinkingCodes = new Map();

/**
 * Helper to call Telegram Bot API endpoints
 */
async function callTelegram(method, payload = {}) {
  const token = env.telegramBotToken;
  if (!token) {
    throw new Error('Telegram bot token not configured in environment variables.');
  }

  const url = `https://api.telegram.org/bot${token}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram Bot API Error [${method}]: ${data.description || 'Unknown error'}`);
  }
  return data.result;
}

/**
 * Returns basic bot information
 */
export async function getMe() {
  return callTelegram('getMe');
}

/**
 * Sends a message to a chat
 */
export async function sendMessage(chatId, text, options = {}) {
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...options
  });
}

/**
 * Fetch updates via long polling
 */
export async function getUpdates(offset = 0, limit = 100, timeout = 30) {
  return callTelegram('getUpdates', { offset, limit, timeout });
}

/**
 * Handles incoming message processing
 */
export async function handleTelegramMessage(message) {
  const chatId = message.chat?.id;
  const fromId = message.from?.id?.toString();
  const username = message.from?.username;
  const text = (message.text || message.caption || '').trim();

  if (!chatId || !fromId) return;

  // Handle account linking commands (/start CG-XXXXXX)
  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    const code = parts[1];

    if (!code) {
      // Check if user is already linked
      const link = await models.TelegramIntegration.findOne({
        where: { telegramUserId: fromId }
      });
      if (link) {
        await sendMessage(chatId, `✅ Your account is already linked to CareerGraph!`);
      } else {
        await sendMessage(chatId, `Welcome to CareerGraph Job Tracker!\n\nTo link your account, go to **Settings ➔ Job Sources ➔ Telegram** in your web browser, copy your linking code, and send it here as:\n<code>/start YOUR_CODE</code>`);
      }
      return;
    }

    // Attempt to validate linking code
    const cached = telegramLinkingCodes.get(code);
    if (!cached || cached.expiresAt < Date.now()) {
      await sendMessage(chatId, `❌ Invalid or expired linking code. Please generate a new code from Settings.`);
      return;
    }

    try {
      // Check if this Telegram account is already linked to another user
      const existingLink = await models.TelegramIntegration.findOne({
        where: { telegramUserId: fromId }
      });
      if (existingLink) {
        await sendMessage(chatId, `❌ This Telegram account is already linked to a CareerGraph account.`);
        return;
      }

      // Check if user already has a Telegram integration
      const userLink = await models.TelegramIntegration.findOne({
        where: { user_id: cached.userId }
      });
      if (userLink) {
        await sendMessage(chatId, `❌ You already have a linked Telegram account. Disconnect the old one first.`);
        return;
      }

      // Link accounts
      await models.TelegramIntegration.create({
        user_id: cached.userId,
        telegramUserId: fromId,
        telegramUsername: username || null,
        status: 'connected',
        linkedAt: new Date()
      });

      // Clear the code
      telegramLinkingCodes.delete(code);

      await sendMessage(chatId, `✅ <b>CareerGraph Account Linked successfully!</b>\n\nYou can now forward or paste job postings directly into this chat to track them.`);
    } catch (err) {
      console.error('[TelegramService] Linking error:', err);
      await sendMessage(chatId, `❌ An error occurred during account linking.`);
    }
    return;
  }

  // Verify that the user is linked
  const integration = await models.TelegramIntegration.findOne({
    where: { telegramUserId: fromId }
  });

  if (!integration) {
    await sendMessage(chatId, `⚠️ <b>Account not connected.</b>\n\nPlease link your Telegram account to CareerGraph first by sending:\n<code>/start YOUR_LINKING_CODE</code>`);
    return;
  }

  // Import parser and ingestion service dynamically to prevent cycle issues
  const { classifyMessage, parseTelegramJob } = await import('./telegram-job-parser.service.js');
  const { ingestJob } = await import('./job-ingestion.service.js');
  const { calculateMatchScore } = await import('./intelligence.service.js');

  const classification = classifyMessage(text);
  if (classification === 'NON_JOB') {
    // Silent ignore or polite guidance
    await sendMessage(chatId, `ℹ️ I only process job postings. Forward or paste a job posting to add it to your Tracker!`);
    return;
  }

  const isForwarded = !!(message.forward_date || message.forward_from || message.forward_sender_name);
  const msgId = message.message_id?.toString();

  // Create content hash for pasted messages to check duplicates
  const crypto = await import('crypto');
  const normalizedText = text.toLowerCase().replace(/\s+/g, '');
  const contentHash = crypto.createHash('sha256').update(normalizedText).digest('hex');

  // Idempotency Check (Duplicate message_id or content_hash)
  let duplicateQuery = {
    user_id: integration.user_id,
    [Op.or]: []
  };
  
  if (isForwarded && msgId) {
    duplicateQuery[Op.or].push({ telegramMessageId: msgId });
  }
  // Content hash match check (we can search in incoming_jobs or check existing jobs)
  duplicateQuery[Op.or].push({ rawText: text }); // Match exact same text as a quick duplicate check

  const existingIncoming = await models.IncomingJob.findOne({ where: duplicateQuery });
  if (existingIncoming) {
    await sendMessage(chatId, `ℹ️ This job already exists in CareerGraph.`);
    return;
  }

  const { parsedJob, confidence } = parseTelegramJob(text);

  // Determine if job meets auto-ingestion confidence threshold
  if (classification === 'JOB' && confidence >= 0.7) {
    try {
      const result = await ingestJob(integration.user_id, {
        ...parsedJob,
        source: 'telegram_bot',
        provider: 'telegram',
        sourceJobId: msgId || contentHash,
        sourceUrl: parsedJob.jobUrl || '',
        description: text
      });

      // Save processed incoming job record for counts
      await models.IncomingJob.create({
        user_id: integration.user_id,
        source: 'telegram',
        rawText: text,
        telegramMessageId: msgId || null,
        telegramUserId: fromId,
        status: 'approved',
        parsedData: parsedJob,
        matchScore: result.job?.matchScore || 0,
        receivedAt: new Date()
      });

      if (result.status === 'duplicate') {
        await sendMessage(chatId, `ℹ️ This job already exists in CareerGraph.`);
      } else {
        await sendMessage(chatId, `✅ <b>Added to CareerGraph</b>\n\n<b>${parsedJob.title}</b>\n${parsedJob.companyName}\n${parsedJob.location}\n\nMatch score: ${result.job?.matchScore || 0}`);
      }
    } catch (err) {
      console.error('[TelegramService] Ingestion failed:', err);
      await sendMessage(chatId, `❌ Failed to ingest job posting.`);
    }
  } else {
    // REVIEW_REQUIRED or low confidence - create IncomingJob in pending_review status
    try {
      // Calculate a tentative match score using intelligence metrics on the parser's title
      const profile = await models.Profile.findOne({ where: { user_id: integration.user_id } });
      const mockJob = { title: parsedJob.title || 'Unknown Role', description: text };
      const score = calculateMatchScore(profile, mockJob);

      await models.IncomingJob.create({
        user_id: integration.user_id,
        source: 'telegram',
        rawText: text,
        telegramMessageId: msgId || null,
        telegramUserId: fromId,
        status: 'pending_review',
        parsedData: parsedJob,
        matchScore: score,
        receivedAt: new Date()
      });

      await sendMessage(chatId, `⚠️ I found a possible job posting but couldn't confidently determine all fields.\n\nIt has been added to your review queue.`);
    } catch (err) {
      console.error('[TelegramService] Creating incoming job failed:', err);
    }
  }
}

/**
 * Polling update handler loop
 */
async function pollUpdates() {
  if (!isPolling) return;

  try {
    const updates = await getUpdates(currentOffset, 100, 20);
    for (const update of updates) {
      currentOffset = update.update_id + 1;
      if (update.message) {
        await handleTelegramMessage(update.message);
      }
    }
    // Continue loop instantly
    pollingTimeoutId = setTimeout(pollUpdates, 0);
  } catch (err) {
    console.error('[TelegramService] Polling error:', err.message);
    // Backoff reconnect interval to avoid hammering API
    pollingTimeoutId = setTimeout(pollUpdates, 10000);
  }
}

/**
 * Starts the Telegram polling engine
 */
export function startTelegramPolling() {
  if (!env.telegramEnabled || env.telegramMode !== 'polling') {
    return;
  }

  if (isPolling) return;
  isPolling = true;
  console.log('[TelegramService] Starting Telegram Bot long-polling...');
  pollUpdates();
}

/**
 * Graceful shutdown for long-polling loop
 */
export function stopTelegramPolling() {
  if (!isPolling) return;
  isPolling = false;
  if (pollingTimeoutId) {
    clearTimeout(pollingTimeoutId);
    pollingTimeoutId = null;
  }
  console.log('[TelegramService] Telegram Bot polling stopped.');
}
