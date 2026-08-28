/**
 * Phase 4F "ai:mlflow:benchmark" -- loads a versioned dataset, benchmarks
 * the current Python-served embedding model, evaluates it, and logs one
 * MLflow run (params/metrics/artifacts) under the "embeddings" experiment.
 *
 * Requires ML_SERVICE_ENABLED=true (the Python service is what actually
 * serves embeddings). MLflow logging itself degrades gracefully: if
 * MLFLOW_ENABLED is false on the Python side, or the tracking server is
 * unreachable, ai-service's /v1/tracking/runs still responds 200 with
 * status "skipped" -- this script reports that plainly rather than failing.
 */
import { env } from '../src/config/env.js';
import { connectDatabase, sequelize } from '../src/config/database.js';
import { mlServiceClient } from '../src/services/ml-service.client.js';
import { findRegistryMatch } from '../src/services/model-registry.service.js';
import {
  benchmarkPythonEmbeddings,
  DEFAULT_BENCHMARK_SENTENCES,
  EMBEDDING_BENCHMARK_DATASET_VERSION,
} from '../src/services/embedding-benchmark.util.js';

async function run() {
  if (!env.mlServiceEnabled) {
    console.log('ML_SERVICE_ENABLED=false -- nothing to benchmark (this command benchmarks the Python-served embedding model). Exiting.');
    return;
  }

  await connectDatabase();

  console.log('==================================================');
  console.log(' CAREERGRAPH MLFLOW EMBEDDING BENCHMARK');
  console.log('==================================================\n');
  console.log(`Dataset: ${EMBEDDING_BENCHMARK_DATASET_VERSION} (${DEFAULT_BENCHMARK_SENTENCES.length} sentences)`);

  const result = await benchmarkPythonEmbeddings(DEFAULT_BENCHMARK_SENTENCES);
  console.log(`Model: ${result.model || 'unknown'} | dimension: ${result.dimension} | avg latency: ${result.avgLatencyMs.toFixed(1)}ms | failures: ${result.failures}/${result.sampleCount}`);

  const registryMatch = await findRegistryMatch({
    modelType: 'embedding',
    provider: 'sentence-transformers',
    modelString: `${result.model}:1`,
  }).catch(() => null);

  try {
    const response = await mlServiceClient.logExperimentRun({
      experiment: 'embeddings',
      runName: 'ai-mlflow-benchmark',
      params: {
        model: result.model,
        provider: 'sentence-transformers',
        modelRegistryId: registryMatch?.id || null,
        modelVersion: registryMatch?.version || null,
        promptVersion: 1,
        schemaVersion: 1,
        datasetVersion: EMBEDDING_BENCHMARK_DATASET_VERSION,
      },
      metrics: {
        dimension: result.dimension,
        avg_latency_ms: result.avgLatencyMs,
        failure_rate: result.sampleCount > 0 ? result.failures / result.sampleCount : 0,
      },
      tags: {
        modelName: result.model,
        datasetVersion: EMBEDDING_BENCHMARK_DATASET_VERSION,
      },
      artifacts: [
        {
          name: 'benchmark-results.json',
          content: { sentences: DEFAULT_BENCHMARK_SENTENCES, ...result },
        },
        {
          name: 'model-config.json',
          content: { model: result.model, provider: 'sentence-transformers', dimension: result.dimension, framework: 'sentence-transformers' },
        },
      ],
    });

    if (response.status === 'logged') {
      console.log(`\nMLflow: logged run ${response.runId} under experiment "${response.experiment}".`);
    } else {
      console.log(`\nMLflow: skipped (${response.reason || 'tracking disabled/unavailable'}).`);
    }
  } catch (err) {
    console.warn(`\nMLflow: failed to log run (${err.message}) -- benchmark results above are still valid.`);
  }

  await sequelize.close();
}

run().catch(async (err) => {
  console.error('ai-mlflow-benchmark failed:', err);
  await sequelize.close().catch(() => {});
  process.exitCode = 1;
});
