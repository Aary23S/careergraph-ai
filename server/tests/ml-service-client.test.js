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
});
