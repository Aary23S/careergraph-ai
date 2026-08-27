import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';

function startSyncScheduler() {
  if (!env.adzunaEnabled) return;

  // Run every 4 hours
  const intervalMs = 4 * 60 * 60 * 1000;

  setInterval(async () => {
    console.log('[Scheduler] Starting background job sync (Adzuna + Gmail)...');
    try {
      const { models } = await import('./config/database.js');
      const { syncAdzunaJobs } = await import('./services/adzuna-sync.service.js');
      const { syncGmailJobs } = await import('./services/gmail-sync.service.js');

      const users = await models.User.findAll();
      for (const user of users) {
        // Run Adzuna discovery sync
        await syncAdzunaJobs(user.id);
        // Run Gmail LinkedIn alerts discovery sync
        if (env.gmailEnabled) {
          await syncGmailJobs(user.id);
        }
      }
      console.log('[Scheduler] Background job sync complete.');
    } catch (err) {
      console.error('[Scheduler] Error in background job sync:', err);
    }
  }, intervalMs);
}

export async function startServer({
  app = createApp(),
  connect = connectDatabase,
  port = env.port,
  host = '0.0.0.0',
} = {}) {
  await connect();

  startSyncScheduler();

  // Initialize Telegram Bot Long-Polling
  try {
    const { startTelegramPolling } = await import('./services/telegram.service.js');
    startTelegramPolling();
  } catch (err) {
    console.error('[Start] Failed to initialize Telegram Polling:', err);
  }

  // Initialize AI Worker
  if (env.aiQueueDriver === 'memory') {
    try {
      await import('./workers/ai.worker.js');
      console.log('[Start] AI Worker module initialized (In-Memory fallback mode).');
    } catch (err) {
      console.error('[Start] Failed to initialize AI Worker:', err);
    }
  } else {
    console.log('[Start] Dedicated AI Worker Service mode enabled. Skipping worker initialization in API server process.');
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      console.log(`CareerGraph API listening on port ${port}`);
      resolve(server);
    });
    server.timeout = 300000;

    server.once('error', reject);
  });
}
