import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';

export async function startServer({
  app = createApp(),
  connect = connectDatabase,
  port = env.port,
  host = '0.0.0.0',
} = {}) {
  await connect();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      console.log(`CareerGraph API listening on port ${port}`);
      resolve(server);
    });

    server.once('error', reject);
  });
}
