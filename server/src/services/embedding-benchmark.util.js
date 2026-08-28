import { mlServiceClient } from './ml-service.client.js';

/**
 * Versioned, synthetic (non-user) fixture -- safe to log as an MLflow
 * artifact or dataset tag. Bump EMBEDDING_BENCHMARK_DATASET_VERSION whenever
 * the sentence list changes so historical runs stay comparable.
 */
export const EMBEDDING_BENCHMARK_DATASET_VERSION = 'embedding-benchmark-v1';
export const DEFAULT_BENCHMARK_SENTENCES = [
  'Senior Python Developer with AWS cloud design and distributed systems expertise.',
  'Technical Project Manager handling software releases and vendor operations.',
  'React Frontend Engineer building premium dashboard user interfaces with CSS modules.',
  'DevOps Specialist optimizing postgres database queries and CI/CD automation pipelines.',
  'Junior Fullstack Intern learning Node.js development and database migrations.',
];

/**
 * Shared "embed each sample sentence via the Python ML service, time it"
 * loop -- used by both ai-embedding-benchmark.js (Node-vs-Python comparison)
 * and ai-mlflow-benchmark.js (Phase 4F), so the benchmark logic exists in
 * exactly one place rather than being copy-pasted between scripts.
 */
export async function benchmarkPythonEmbeddings(testTexts) {
  const latencies = [];
  let dimension = 0;
  let resolvedModel = null;
  let failureCount = 0;

  for (const text of testTexts) {
    const start = Date.now();
    try {
      const result = await mlServiceClient.embed(text, {});
      latencies.push(Date.now() - start);
      dimension = result.dimension;
      resolvedModel = result.model;
    } catch {
      latencies.push(Date.now() - start);
      failureCount++;
    }
  }

  const avgLatencyMs = latencies.reduce((sum, val) => sum + val, 0) / latencies.length || 0;

  return {
    model: resolvedModel,
    dimension,
    avgLatencyMs,
    sampleCount: testTexts.length,
    failures: failureCount,
    status: failureCount === 0 ? 'passed' : 'failed',
  };
}
