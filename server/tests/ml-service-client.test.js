import { jest } from '@jest/globals';
import { MLServiceClient } from '../src/services/ml-service.client.js';

describe('MLServiceClient', () => {
  let client;
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    client = new MLServiceClient({ baseUrl: 'http://localhost:9999', timeoutMs: 200 });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('embed() returns a validated embedding on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ embedding: [0.1, 0.2], dimension: 2, model: 'all-MiniLM-L6-v2' }),
    });

    const result = await client.embed('hello', { model: 'all-MiniLM-L6-v2' });
    expect(result).toEqual({ embedding: [0.1, 0.2], dimension: 2, model: 'all-MiniLM-L6-v2' });
  });

  test('embed() throws HTTP_<status> on a non-2xx response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(client.embed('hello')).rejects.toMatchObject({ code: 'HTTP_500' });
  });

  test('embed() throws BAD_REQUEST on a 422 response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({}) });
    await expect(client.embed('hello')).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('embed() throws BAD_RESPONSE on malformed JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('unexpected token');
      },
    });
    await expect(client.embed('hello')).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  test('embed() throws BAD_RESPONSE when the response is missing required fields', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ embedding: [0.1, 0.2], model: 'x' }), // no dimension
    });
    await expect(client.embed('hello')).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  test('embed() throws BAD_RESPONSE when embedding length disagrees with dimension', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ embedding: [0.1, 0.2, 0.3], dimension: 2, model: 'x' }),
    });
    await expect(client.embed('hello')).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  test('embed() throws TIMEOUT when the request is aborted', async () => {
    global.fetch = jest.fn().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );
    client = new MLServiceClient({ baseUrl: 'http://localhost:9999', timeoutMs: 20 });

    await expect(client.embed('hello')).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  test('embed() throws UNAVAILABLE on a network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(client.embed('hello')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  test('rerank() returns validated results on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ id: 'a', score: 0.9 }], model: 'cosine-similarity/x' }),
    });

    const result = await client.rerank('query', [{ id: 'a', text: 'text' }]);
    expect(result.results).toEqual([{ id: 'a', score: 0.9 }]);
  });

  test('rerank() throws BAD_RESPONSE on malformed results', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ id: 'a' }], model: 'x' }), // missing score
    });
    await expect(client.rerank('query', [{ id: 'a', text: 'text' }])).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
  });

  test('healthCheck() returns the parsed body on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'ok' }) });
    const result = await client.healthCheck();
    expect(result.status).toBe('ok');
  });

  test('healthCheck() throws HTTP_<status> on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(client.healthCheck()).rejects.toMatchObject({ code: 'HTTP_503' });
  });

  test('logExperimentRun() returns the parsed body on a "logged" response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'logged', runId: 'run-1', experiment: 'careergraph-embeddings' }),
    });
    const result = await client.logExperimentRun({ experiment: 'embeddings', metrics: { latency_ms: 10 } });
    expect(result).toEqual({ status: 'logged', runId: 'run-1', experiment: 'careergraph-embeddings' });
  });

  test('logExperimentRun() returns the parsed body on a "skipped" response (not an error)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'skipped', reason: 'mlflow_disabled_or_unavailable', runId: null, experiment: null }),
    });
    const result = await client.logExperimentRun({ experiment: 'embeddings' });
    expect(result.status).toBe('skipped');
  });

  test('logExperimentRun() throws BAD_RESPONSE when the response has no status field', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await expect(client.logExperimentRun({ experiment: 'embeddings' })).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  test('logExperimentRun() throws UNAVAILABLE when ai-service is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(client.logExperimentRun({ experiment: 'embeddings' })).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  test('getTrackingStatus() returns the parsed body on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ enabled: true, connected: true, lastRun: { experiment: 'careergraph-embeddings', runId: 'r1', status: 'FINISHED', model: 'x' } }),
    });
    const result = await client.getTrackingStatus();
    expect(result.connected).toBe(true);
  });

  test('getTrackingStatus() throws HTTP_<status> on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(client.getTrackingStatus()).rejects.toMatchObject({ code: 'HTTP_503' });
  });

  test('predictOpportunity() returns prediction details on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'scored',
        predictions: [{
          score: 0.85,
          modelName: 'career-opportunity-ranker',
          modelVersion: 'v1',
          featureSet: 'opportunity-ranking',
          featureVersion: 'v1',
          isDevelopmentOnly: true,
          modelRegistryId: 'reg-uuid-123'
        }]
      }),
    });

    const result = await client.predictOpportunity({ skill_overlap: 0.5 });
    expect(result).toEqual({
      score: 0.85,
      modelName: 'career-opportunity-ranker',
      modelVersion: 'v1',
      featureSet: 'opportunity-ranking',
      featureVersion: 'v1',
      isDevelopmentOnly: true,
      modelRegistryId: 'reg-uuid-123'
    });
  });

  test('predictOpportunity() throws exception with code matching error status on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        status: 'MODEL_NOT_PRODUCTION_READY',
        reason: 'The model is development-only.'
      }),
    });
    await expect(client.predictOpportunity({ skill_overlap: 0.5 })).rejects.toMatchObject({
      code: 'MODEL_NOT_PRODUCTION_READY',
      message: 'The model is development-only.'
    });
  });
});
