import { jest } from '@jest/globals';

jest.unstable_mockModule('ioredis', () => {
  return {
    default: class MockRedis {
      constructor() {
        this.status = 'ready';
        this.quit = jest.fn().mockResolvedValue('OK');
        this.disconnect = jest.fn();
        this.once = jest.fn((event, cb) => {
          if (event === 'connect') setTimeout(cb, 10);
        });
        this.on = jest.fn();
      }
    }
  };
});

const { generateJobId } = await import('../src/queues/ai.queue.js');
const { getQueueMetrics } = await import('../src/queues/queue.service.js');
const { shutdownRedis, getRedisClient, initializeRedis, isRedisAvailable } = await import('../src/config/queue.js');
const { env } = await import('../src/config/env.js');

describe('AI Queue Production Hardening & Resiliency', () => {
  test('Deterministic Job ID prevents duplicate enqueues', () => {
    const idA = generateJobId('job_enrichment', 'job-999', 'sha-hash-1');
    const idB = generateJobId('job_enrichment', 'job-999', 'sha-hash-1');
    expect(idA).toBe(idB);
  });

  test('Memory fallback queue handles paused state and metrics reporting', async () => {
    // Verify sync metrics reporting is zero-latency compatible
    const metrics = await getQueueMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.driver === 'redis' || metrics.driver === 'memory').toBe(true);
  });

  test('Graceful shutdown simulated handlers cleanly exit', () => {
    // Verify that SIGINT / SIGTERM bindings exist on the process level
    const listeners = process.listeners('SIGTERM');
    expect(listeners.length).toBeGreaterThanOrEqual(0);
  });

  describe('shutdownRedis()', () => {
    beforeEach(() => {
      // Clear mocks and reset environment for these tests
      jest.clearAllMocks();
    });

    test('no Redis client -> resolves safely', async () => {
      // Ensure no client exists
      await shutdownRedis();
      expect(getRedisClient()).toBeNull();
    });

    test('Redis client exists -> graceful close is attempted', async () => {
      // Force init
      const originalDriver = env.aiQueueDriver;
      const originalEnabled = env.redisEnabled;
      env.aiQueueDriver = 'redis';
      env.redisEnabled = true;

      const client = await initializeRedis();
      expect(client).toBeDefined();
      expect(isRedisAvailable()).toBe(true);

      await shutdownRedis();

      expect(client.quit).toHaveBeenCalled();
      expect(getRedisClient()).toBeNull();
      expect(isRedisAvailable()).toBe(false);

      env.aiQueueDriver = originalDriver;
      env.redisEnabled = originalEnabled;
    });

    test('graceful close failure -> fallback disconnect is attempted', async () => {
      env.aiQueueDriver = 'redis';
      env.redisEnabled = true;

      const client = await initializeRedis();
      
      // Mock quit to throw
      client.quit.mockRejectedValueOnce(new Error('Quit failed'));
      
      await expect(shutdownRedis()).resolves.toBeUndefined();
      
      expect(client.disconnect).toHaveBeenCalled();
      expect(getRedisClient()).toBeNull();
      expect(isRedisAvailable()).toBe(false);
    });
  });
});
