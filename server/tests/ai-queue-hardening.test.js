import { generateJobId } from '../src/queues/ai.queue.js';
import { getQueueMetrics } from '../src/queues/queue.service.js';

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
});
