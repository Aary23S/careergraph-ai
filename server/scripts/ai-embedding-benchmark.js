import { env } from '../src/config/env.js';
import { aiService } from '../src/services/ai/ai.service.js';
import { mlServiceClient } from '../src/services/ml-service.client.js';

const testTexts = [
  'Senior Python Developer with AWS cloud design and distributed systems expertise.',
  'Technical Project Manager handling software releases and vendor operations.',
  'React Frontend Engineer building premium dashboard user interfaces with CSS modules.',
  'DevOps Specialist optimizing postgres database queries and CI/CD automation pipelines.',
  'Junior Fullstack Intern learning Node.js development and database migrations.'
];

async function pullModelIfNeeded(modelName) {
  console.log(`Checking if model "${modelName}" is available...`);
  try {
    const tagsRes = await fetch(`${env.ollamaBaseUrl}/api/tags`);
    const tags = await tagsRes.json();
    const exists = (tags.models || []).some(m => m.name.startsWith(modelName));
    if (!exists) {
      console.log(`Model "${modelName}" not found. Pulling now (lightweight)...`);
      const pullRes = await fetch(`${env.ollamaBaseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName, stream: false })
      });
      if (!pullRes.ok) {
        throw new Error(`Failed to pull model ${modelName}`);
      }
      console.log(`Successfully pulled model "${modelName}".`);
    } else {
      console.log(`Model "${modelName}" is already available.`);
    }
  } catch (err) {
    console.warn(`Warning: Could not pull or verify model "${modelName}":`, err.message);
  }
}

async function runBenchmark() {
  const models = ['nomic-embed-text', 'all-minilm'];

  // Force settings
  env.aiEnabled = true;
  env.aiProvider = 'ollama';
  env.aiTimeoutMs = 60000;
  env.aiMaxRetries = 0;

  console.log('==================================================');
  console.log(' STARTING CAREERGRAPH EMBEDDING MODEL BENCHMARK');
  console.log('==================================================\n');

  // Resolve Provider
  aiService.provider = aiService._resolveProvider();

  const finalReports = [];

  for (const model of models) {
    console.log(`\nEvaluating Embedding Model: ${model}...`);
    await pullModelIfNeeded(model);

    const latencies = [];
    let dimensions = 0;
    let failureCount = 0;

    for (const text of testTexts) {
      const start = Date.now();
      try {
        const embedding = await aiService.generateEmbedding(text, model);
        const latency = Date.now() - start;
        latencies.push(latency);
        dimensions = embedding.length;
        console.log(`  ✅ Embedding generated successfully (${embedding.length} dims) in ${(latency / 1000).toFixed(3)}s`);
      } catch (err) {
        const latency = Date.now() - start;
        latencies.push(latency);
        failureCount++;
        console.log(`  ❌ Failed to generate embedding after ${(latency / 1000).toFixed(3)}s: ${err.message}`);
      }
    }

    const avgLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length || 0;

    finalReports.push({
      model,
      dimension: dimensions || 'N/A',
      avgLatencySec: `${(avgLatency / 1000).toFixed(3)}s`,
      failures: failureCount,
      status: failureCount === 0 ? 'Passed' : 'Failed'
    });

    // Unload model to save RAM/VRAM
    try {
      await fetch(`${env.ollamaBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, keep_alive: 0 })
      });
    } catch (e) {
      // Ignored
    }
  }

  // Phase 4D: Node (Ollama) vs Python ML service, side by side. Guarded by
  // ML_SERVICE_ENABLED so this benchmark still runs standalone (Node-only)
  // when the Python service isn't set up.
  if (env.mlServiceEnabled) {
    console.log(`\nEvaluating Python ML service (${env.mlServiceUrl})...`);
    const latencies = [];
    let dimensions = 0;
    let failureCount = 0;
    let resolvedModel = env.mlServiceEmbeddingModel;

    for (const text of testTexts) {
      const start = Date.now();
      try {
        const result = await mlServiceClient.embed(text, { model: env.mlServiceEmbeddingModel });
        const latency = Date.now() - start;
        latencies.push(latency);
        dimensions = result.dimension;
        resolvedModel = result.model;
        console.log(`  ✅ Python embedding generated (${result.dimension} dims) in ${(latency / 1000).toFixed(3)}s`);
      } catch (err) {
        const latency = Date.now() - start;
        latencies.push(latency);
        failureCount++;
        console.log(`  ❌ Python embedding failed after ${(latency / 1000).toFixed(3)}s: ${err.message}`);
      }
    }

    const avgLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length || 0;

    finalReports.push({
      model: `python:${resolvedModel}`,
      dimension: dimensions || 'N/A',
      avgLatencySec: `${(avgLatency / 1000).toFixed(3)}s`,
      failures: failureCount,
      status: failureCount === 0 ? 'Passed' : 'Failed'
    });
  } else {
    console.log('\nSkipping Python ML service benchmark (ML_SERVICE_ENABLED=false).');
  }

  console.log('\n==================================================');
  console.log('📊 EMBEDDING BENCHMARK SUMMARY REPORTS');
  console.log('==================================================');
  console.table(finalReports);
}

runBenchmark().catch(console.error);
