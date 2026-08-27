import { generateJobId, registerMemoryWorker } from '../src/queues/ai.queue.js';
import { getQueueMetrics } from '../src/queues/queue.service.js';
import { handleJob } from '../src/workers/ai.worker.js';

describe('AI Queue & Worker Integration', () => {
  test('generateJobId produces stable, deterministic IDs', () => {
    const id1 = generateJobId('job_enrichment', 'job-123', 'hash-abc');
    const id2 = generateJobId('job_enrichment', 'job-123', 'hash-abc');
    const id3 = generateJobId('job_enrichment', 'job-123', 'hash-xyz');

    expect(id1).toBe('ai-job_enrichment-job-123-hash-abc');
    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
  });

  test('Memory fallback queue routes jobs correctly to worker handlers', (done) => {
    const mockHandler = jest.fn().mockImplementation(({ name, data }) => {
      expect(name).toBe('job_enrichment');
      expect(data.entityId).toBe('job-123');
      done();
    });

    registerMemoryWorker(mockHandler);

    // Trigger local simulation directly
    registerMemoryWorker(async (job) => {
      await mockHandler({ name: job.name, data: job.data });
    });

    // Enqueue a job on the fallback provider
    import('../src/queues/ai.queue.js').then(({ aiQueue }) => {
      aiQueue.add('job_enrichment', { entityId: 'job-123' }, { jobId: 'ai-job-123' });
    });
  });

  test('getQueueMetrics returns structured status values', async () => {
    const metrics = await getQueueMetrics();
    expect(metrics).toHaveProperty('waiting');
    expect(metrics).toHaveProperty('active');
    expect(metrics).toHaveProperty('completed');
    expect(metrics).toHaveProperty('failed');
    expect(metrics).toHaveProperty('driver');
  });

  test('Worker handleJob fails gracefully for unknown jobs', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await handleJob('unknown_job_type', { entityId: 'test-id' });
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown task type skipped'));
    consoleWarnSpy.mockRestore();
  });
});
