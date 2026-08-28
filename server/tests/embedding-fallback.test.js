import { jest } from '@jest/globals';
import { env } from '../src/config/env.js';
import { aiService } from '../src/services/ai/ai.service.js';
import { mlServiceClient, MLServiceError } from '../src/services/ml-service.client.js';
import { generateEmbeddingVector, resolveEmbeddingModelName } from '../src/services/embedding.service.js';

describe('Embedding generation: Python ML service fallback (Phase 4D)', () => {
  const originalMlServiceEnabled = env.mlServiceEnabled;
  const originalAiEnabled = env.aiEnabled;
  const originalMlModel = env.mlServiceEmbeddingModel;

  afterEach(() => {
    env.mlServiceEnabled = originalMlServiceEnabled;
    env.aiEnabled = originalAiEnabled;
    env.mlServiceEmbeddingModel = originalMlModel;
    jest.restoreAllMocks();
  });

  test('uses the ML service when enabled and it succeeds, never touching the Node path', async () => {
    env.mlServiceEnabled = true;
    jest.spyOn(mlServiceClient, 'embed').mockResolvedValueOnce({
      embedding: [0.1, 0.2, 0.3],
      dimension: 3,
      model: 'all-MiniLM-L6-v2',
    });
    const aiSpy = jest.spyOn(aiService, 'generateEmbedding');

    const vector = await generateEmbeddingVector('hello world', 'all-MiniLM-L6-v2');

    expect(vector).toEqual([0.1, 0.2, 0.3]);
    expect(aiSpy).not.toHaveBeenCalled();
  });

  test('falls back to the Node path when the ML service is enabled but fails', async () => {
    env.mlServiceEnabled = true;
    env.aiEnabled = true;
    jest.spyOn(mlServiceClient, 'embed').mockRejectedValueOnce(new MLServiceError('TIMEOUT', 'timed out'));
    jest.spyOn(aiService, 'generateEmbedding').mockResolvedValueOnce([0.9, 0.8]);

    const vector = await generateEmbeddingVector('hello world', 'mock');

    expect(vector).toEqual([0.9, 0.8]);
  });

  test('does not call the ML service at all when disabled (default, unchanged behavior)', async () => {
    env.mlServiceEnabled = false;
    env.aiEnabled = true;
    const mlSpy = jest.spyOn(mlServiceClient, 'embed');
    jest.spyOn(aiService, 'generateEmbedding').mockResolvedValueOnce([1, 2, 3]);

    const vector = await generateEmbeddingVector('hello world', 'mock');

    expect(mlSpy).not.toHaveBeenCalled();
    expect(vector).toEqual([1, 2, 3]);
  });

  test('resolveEmbeddingModelName follows the ML-service flag so generation and search never disagree', () => {
    env.mlServiceEnabled = true;
    env.mlServiceEmbeddingModel = 'all-MiniLM-L6-v2';
    expect(resolveEmbeddingModelName()).toBe('all-MiniLM-L6-v2');

    env.mlServiceEnabled = false;
    expect(resolveEmbeddingModelName()).toBe(env.ollamaEmbeddingModel || 'mock');
  });
});
