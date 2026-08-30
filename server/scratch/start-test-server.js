import { startServer } from '../src/start.js';

async function run() {
  try {
    const server = await startServer({ port: 5001 });
    console.log('Server started successfully on port 5001.');
  } catch (err) {
    console.error('Server failed to start:', err);
  }
}

run();
