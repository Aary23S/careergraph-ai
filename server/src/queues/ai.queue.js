import { Queue } from 'bullmq';
import { getRedisClient, isRedisAvailable } from '../config/queue.js';
import { env } from '../config/env.js';

let activeQueue = null;
let memoryWorkerHandler = null;

// Memory queue fallback provider
class MemoryQueueFallback {
  async add(name, data, opts = {}) {
    const jobId = opts.jobId || `mem-${Date.now()}`;
    console.log(`[MemoryQueue] Enqueued memory job: ${name} (id: ${jobId})`);
    
    // Defer processing to next event tick
    setTimeout(async () => {
      if (memoryWorkerHandler) {
        try {
          await memoryWorkerHandler({ name, data, id: jobId });
        } catch (err) {
          console.error(`[MemoryQueue] Fallback execution failed for job ${name}:`, err.message);
        }
      }
    }, 50);

    return { id: jobId };
  }

  async getJobCounts() {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
  }
}

export function registerMemoryWorker(handler) {
  memoryWorkerHandler = handler;
}

// Initialize the active queue
if (env.aiQueueDriver === 'redis' && isRedisAvailable()) {
  try {
    activeQueue = new Queue('ai-tasks', {
      connection: getRedisClient(),
      defaultJobOptions: {
        attempts: env.aiJobAttempts,
        backoff: {
          type: 'exponential',
          delay: env.aiJobBackoffMs
        },
        removeOnComplete: { count: env.aiJobRemoveOnComplete },
        removeOnFail: { count: env.aiJobRemoveOnFail }
      }
    });
  } catch (err) {
    console.warn('[AIQueue] Failed to initialize Redis queue, falling back to MemoryQueueFallback:', err.message);
    activeQueue = new MemoryQueueFallback();
  }
} else {
  console.log('[AIQueue] Redis queue driver is not active. Using memory fallback.');
  activeQueue = new MemoryQueueFallback();
}

import Joi from 'joi';

export const queueJobSchema = Joi.object({
  jobSchemaVersion: Joi.number().integer().required(),
  jobType: Joi.string().required(),
  entityId: Joi.string().required(),
  userId: Joi.string().allow('', null).optional(),
  inputHash: Joi.string().allow('', null).optional(),
  requestedAt: Joi.date().iso().optional(),
  requestId: Joi.string().allow('', null).optional()
}).unknown(true);

/**
 * Helper to generate a deterministic Job ID to prevent duplicate work.
 */
export function generateJobId(jobType, entityId, inputHash = '') {
  return `ai-${jobType}-${entityId}${inputHash ? `-${inputHash}` : ''}`;
}

export async function enqueueAIJob(jobType, entityId, additionalData = {}, opts = {}) {
  const payload = {
    jobSchemaVersion: 1,
    jobType,
    entityId,
    userId: additionalData.userId || null,
    inputHash: additionalData.inputHash || null,
    requestedAt: new Date().toISOString(),
    requestId: additionalData.requestId || `req-${Date.now()}`
  };

  const { error, value } = queueJobSchema.validate(payload);
  if (error) {
    throw new Error(`[AIQueue] Payload contract validation failed: ${error.message}`);
  }

  const stableJobId = opts.jobId || generateJobId(jobType, entityId, payload.inputHash);
  return await activeQueue.add(jobType, value, {
    ...opts,
    jobId: stableJobId
  });
}

export const aiQueue = activeQueue;
export default aiQueue;
