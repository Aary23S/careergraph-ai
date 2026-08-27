import { queueJobSchema } from '../src/queues/ai.queue.js';
import { workerId } from '../src/workers/ai.worker.js';

describe('Dedicated AI Worker Service', () => {
  test('Worker ID is dynamically generated with hostname', () => {
    expect(workerId).toBeDefined();
    expect(workerId.startsWith('worker-')).toBe(true);
  });

  test('Joi schema validates conforming payload contract', () => {
    const validPayload = {
      jobSchemaVersion: 1,
      jobType: 'job_enrichment',
      entityId: 'test-uuid-1234',
      userId: 'user-uuid-5678',
      inputHash: 'some-sha-hash',
      requestedAt: new Date().toISOString(),
      requestId: 'req-abc-999'
    };

    const { error, value } = queueJobSchema.validate(validPayload);
    expect(error).toBeUndefined();
    expect(value.jobSchemaVersion).toBe(1);
    expect(value.entityId).toBe('test-uuid-1234');
  });

  test('Joi schema rejects payloads violating version contract', () => {
    const invalidPayload = {
      jobType: 'job_enrichment',
      entityId: 'test-uuid-1234'
    };

    const { error } = queueJobSchema.validate(invalidPayload);
    expect(error).toBeDefined();
    expect(error.message).toContain('"jobSchemaVersion" is required');
  });

  test('Joi schema rejects payloads violating job type options', () => {
    const invalidPayload = {
      jobSchemaVersion: 1,
      jobType: 'invalid_task_type',
      entityId: 'test-uuid-1234'
    };

    const { error } = queueJobSchema.validate(invalidPayload);
    expect(error).toBeDefined();
    expect(error.message).toContain('"jobType" must be one of');
  });
});
