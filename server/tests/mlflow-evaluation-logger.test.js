import { jest } from '@jest/globals';
import { env } from '../src/config/env.js';
import { mlServiceClient } from '../src/services/ml-service.client.js';
import { logEvaluationResultsToMlflow } from '../src/services/mlflow-evaluation-logger.service.js';

describe('MLflow evaluation logging (Phase 4F)', () => {
  const originalMlflowEnabled = env.mlflowEnabled;

  afterEach(() => {
    env.mlflowEnabled = originalMlflowEnabled;
    jest.restoreAllMocks();
  });

  const jobResults = [
    {
      operation: 'job_enrichment',
      passed: true,
      latency: 100,
      metrics: { jsonValidity: 1, schemaValidity: 1, fieldAccuracy: 0.8, precision: 1, recall: 1 },
    },
    {
      operation: 'job_enrichment',
      passed: false,
      latency: 200,
      metrics: { jsonValidity: 1, schemaValidity: 0.5, fieldAccuracy: 0.2, precision: 0.5, recall: 0.5 },
    },
  ];

  test('does nothing at all when MLFLOW_ENABLED is false (byte-identical to pre-4F behavior)', async () => {
    env.mlflowEnabled = false;
    const spy = jest.spyOn(mlServiceClient, 'logExperimentRun');

    const result = await logEvaluationResultsToMlflow(jobResults, { modelToUse: 'mock' });

    expect(result).toEqual({ attempted: false, logged: [], skipped: [] });
    expect(spy).not.toHaveBeenCalled();
  });

  test('logs one run per operation category present, with correctly mapped/aggregated metrics', async () => {
    env.mlflowEnabled = true;
    const spy = jest
      .spyOn(mlServiceClient, 'logExperimentRun')
      .mockResolvedValue({ status: 'logged', runId: 'run-1', experiment: 'careergraph-job-enrichment' });

    const result = await logEvaluationResultsToMlflow(jobResults, { modelToUse: 'mock' });

    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0][0];
    expect(call.experiment).toBe('job-enrichment');
    expect(call.metrics.json_validity).toBeCloseTo(1);
    expect(call.metrics.schema_validity).toBeCloseTo(0.75);
    expect(call.metrics.field_accuracy).toBeCloseTo(0.5);
    expect(call.metrics.latency_ms).toBeCloseTo(150);
    expect(call.metrics.failure_rate).toBeCloseTo(0.5);
    expect(call.params.model).toBe('mock');
    expect(call.params.datasetVersion).toBe('evaluation-suite-v1');
    expect(call.tags.requestId).toBeDefined();
    expect(call.artifacts[0].name).toBe('evaluation-results.json');

    expect(result.attempted).toBe(true);
    expect(result.logged).toEqual([{ operation: 'job_enrichment', runId: 'run-1', experiment: 'careergraph-job-enrichment' }]);
    expect(result.skipped).toEqual([]);
  });

  test('derives connection_enrichment metrics (role_accuracy/technology_precision/false_inference_rate) from the shared extraction metrics', async () => {
    env.mlflowEnabled = true;
    const spy = jest
      .spyOn(mlServiceClient, 'logExperimentRun')
      .mockResolvedValue({ status: 'logged', runId: 'run-2', experiment: 'careergraph-connection-enrichment' });

    const connectionResults = [
      {
        operation: 'connection_enrichment',
        passed: true,
        latency: 50,
        metrics: { fieldAccuracy: 0.9, precision: 0.8, recall: 1 },
      },
    ];

    await logEvaluationResultsToMlflow(connectionResults, { modelToUse: 'mock' });

    const call = spy.mock.calls[0][0];
    expect(call.metrics.role_accuracy).toBeCloseTo(0.9);
    expect(call.metrics.technology_precision).toBeCloseTo(0.8);
    expect(call.metrics.false_inference_rate).toBeCloseTo(0.2);
  });

  test('a per-run ai-service failure is caught and reported as skipped, never thrown', async () => {
    env.mlflowEnabled = true;
    jest.spyOn(mlServiceClient, 'logExperimentRun').mockRejectedValue(new Error('ML service unreachable'));

    const result = await logEvaluationResultsToMlflow(jobResults, { modelToUse: 'mock' });

    expect(result.attempted).toBe(true);
    expect(result.logged).toEqual([]);
    expect(result.skipped).toEqual([{ operation: 'job_enrichment', reason: 'ML service unreachable' }]);
  });

  test('an ai-service "skipped" response (MLflow disabled/unavailable server-side) is surfaced as skipped, not logged', async () => {
    env.mlflowEnabled = true;
    jest
      .spyOn(mlServiceClient, 'logExperimentRun')
      .mockResolvedValue({ status: 'skipped', reason: 'mlflow_disabled_or_unavailable', runId: null, experiment: null });

    const result = await logEvaluationResultsToMlflow(jobResults, { modelToUse: 'mock' });

    expect(result.logged).toEqual([]);
    expect(result.skipped).toEqual([{ operation: 'job_enrichment', reason: 'mlflow_disabled_or_unavailable' }]);
  });

  test('skips operations with no cases and logs a separate run per operation that does have cases', async () => {
    env.mlflowEnabled = true;
    const spy = jest
      .spyOn(mlServiceClient, 'logExperimentRun')
      .mockResolvedValue({ status: 'logged', runId: 'run-x', experiment: 'x' });

    const mixedResults = [
      ...jobResults,
      { operation: 'outreach', passed: true, latency: 30, metrics: { factualCorrectness: 1, intentAdherence: 1, personalization: 1, hallucinationRate: 0 } },
    ];

    await logEvaluationResultsToMlflow(mixedResults, { modelToUse: 'mock' });

    expect(spy).toHaveBeenCalledTimes(2);
    const experiments = spy.mock.calls.map((call) => call[0].experiment);
    expect(experiments).toEqual(expect.arrayContaining(['job-enrichment', 'outreach']));
  });
});
