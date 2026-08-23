import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';

function startSyncScheduler() {
  if (!env.adzunaEnabled) return;

  // Run every 4 hours
  const intervalMs = 4 * 60 * 60 * 1000;

  setInterval(async () => {
    console.log('[Scheduler] Starting background Adzuna job sync...');
    try {
      const { models } = await import('./config/database.js');
      const { syncAdzunaJobs } = await import('./services/adzuna-sync.service.js');

      const users = await models.User.findAll();
      for (const user of users) {
        await syncAdzunaJobs(user.id);
      }
      console.log('[Scheduler] Background Adzuna job sync complete.');
    } catch (err) {
      console.error('[Scheduler] Error in background Adzuna sync:', err);
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

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      console.log(`CareerGraph API listening on port ${port}`);
      resolve(server);
    });

    server.once('error', reject);
  });
}
