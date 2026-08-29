import { env } from '../src/config/env.js';

const BACKEND_URL = process.env.SMOKE_BACKEND_URL || 'http://localhost:5002';
const AI_SERVICE_URL = process.env.SMOKE_AI_SERVICE_URL || 'http://localhost:8002';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok && res.status !== 503) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  return { status: res.status, body: await res.json() };
}

async function run() {
  console.log('Starting staging environment smoke tests...');
  console.log(`Backend API URL: ${BACKEND_URL}`);
  console.log(`AI Microservice URL: ${AI_SERVICE_URL}`);

  let failed = false;

  // 1. Verify Node.js API Server Health
  try {
    const { status, body } = await fetchJson(`${BACKEND_URL}/api/health`);
    if (status === 200 && body.status === 'ok') {
      console.log('✅ Backend API Health check passed.');
    } else {
      console.error('❌ Backend API Health check returned unexpected body:', body);
      failed = true;
    }
  } catch (err) {
    console.error('❌ Backend API Health check failed to connect:', err.message);
    failed = true;
  }

  // 2. Verify Python AI Microservice Health
  try {
    const { status, body } = await fetchJson(`${AI_SERVICE_URL}/health`);
    if (status === 200 && body.status === 'ok') {
      console.log('✅ AI Service Health check passed.');
    } else {
      console.error('❌ AI Service Health check returned unexpected body:', body);
      failed = true;
    }
  } catch (err) {
    console.error('❌ AI Service Health check failed to connect:', err.message);
    failed = true;
  }

  // 3. Verify Python AI Microservice Readiness Probe
  try {
    const { status, body } = await fetchJson(`${AI_SERVICE_URL}/readiness`);
    if (status === 200 && body.status === 'ready') {
      console.log(`✅ AI Service Readiness check passed (Model ready: ${body.modelVersion}).`);
    } else if (status === 503 && body.status === 'not_ready') {
      console.log(`ℹ️ AI Service Readiness probe is active and returned expected 503 status (Reason: ${body.reason}).`);
    } else {
      console.error('❌ AI Service Readiness check returned unexpected response:', status, body);
      failed = true;
    }
  } catch (err) {
    console.error('❌ AI Service Readiness check failed to connect:', err.message);
    failed = true;
  }

  if (failed) {
    console.error('\n❌ Staging smoke tests failed.');
    process.exit(1);
  }

  console.log('\n✅ All staging smoke tests completed successfully.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error during smoke test:', err);
  process.exit(1);
});
