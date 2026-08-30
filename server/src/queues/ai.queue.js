import { Queue } from 'bullmq';
import { getRedisClient, isRedisAvailable } from '../config/queue.js';
import { env } from '../config/env.js';
import Joi from 'joi';

let activeQueue = null;
let memoryWorkerHandler = null;
let queueInitializationPromise = null;

// Memory queue fallback provider. Unlike the real BullMQ+Redis queue (which
// enforces `concurrency`/`limiter` in ai.worker.js), this in-process queue
// previously fired every enqueued job immediately with no concurrency or
// rate limiting. This scheduler enforces the same
// `AI_WORKER_CONCURRENCY` / `AI_QUEUE_RATE_LIMIT_MAX` per
// `AI_QUEUE_RATE_LIMIT_DURATION` config the Redis path already respects.
class MemoryQueueFallback {
  constructor() {
    this._pending = [];
    this._active = 0;
    this._dispatchTimestamps = [];
    this._scheduled = false;
  }

  async add(name, data, opts = {}) {
    const jobId = opts.jobId || `mem-${Date.now()}`;

    console.log(
      `[MemoryQueue] Enqueued memory job: ${name} (id: ${jobId})`
    );

    this._pending.push({
      name,
      data,
      id: jobId,
    });

    this._scheduleDispatch(0);

    return {
      id: jobId,
    };
  }

  _scheduleDispatch(delayMs) {
    if (this._scheduled) {
      return;
    }

    this._scheduled = true;

    setTimeout(() => {
      this._scheduled = false;
      this._dispatch();
    }, delayMs);
  }

  _dispatch() {
    const maxConcurrent = Math.max(
      1,
      env.aiWorkerConcurrency || 1
    );

    const rateMax = Math.max(
      1,
      env.aiQueueRateLimitMax || 10
    );

    const rateDuration = Math.max(
      1,
      env.aiQueueRateLimitDuration || 60000
    );

    const now = Date.now();

    this._dispatchTimestamps = this._dispatchTimestamps.filter(
      (timestamp) => now - timestamp < rateDuration
    );

    while (
      this._pending.length > 0 &&
      this._active < maxConcurrent &&
      this._dispatchTimestamps.length < rateMax
    ) {
      const job = this._pending.shift();

      this._dispatchTimestamps.push(Date.now());
      this._active++;

      this._runJob(job);
    }

    if (this._pending.length === 0) {
      return;
    }

    // Work remains because the rate limit window is full.
    if (this._dispatchTimestamps.length >= rateMax) {
      const oldest = this._dispatchTimestamps[0];

      const waitMs = Math.max(
        50,
        rateDuration - (now - oldest) + 25
      );

      this._scheduleDispatch(waitMs);
    }
  }

  async _runJob(job) {
    try {
      if (memoryWorkerHandler) {
        await memoryWorkerHandler(job);
      }
    } catch (err) {
      console.error(
        `[MemoryQueue] Fallback execution failed for job ${job.name}:`,
        err.message
      );
    } finally {
      this._active--;
      this._dispatch();
    }
  }

  async getJobCounts() {
    return {
      waiting: this._pending.length,
      active: this._active,
      completed: 0,
      failed: 0,
      delayed: 0,
    };
  }
}

export function registerMemoryWorker(handler) {
  memoryWorkerHandler = handler;
}

/**
 * Initialize the active queue.
 *
 * Redis connects asynchronously, so queue initialization must wait for
 * the Redis connection to become ready before deciding whether to use
 * BullMQ or the in-memory fallback.
 */
async function initializeQueue() {
  if (activeQueue) {
    return activeQueue;
  }

  if (queueInitializationPromise) {
    return queueInitializationPromise;
  }

  queueInitializationPromise = (async () => {
    if (env.aiQueueDriver === 'redis') {
      const waitStartedAt = Date.now();
      const maxWaitMs = 5000;

      while (
        !isRedisAvailable() &&
        Date.now() - waitStartedAt < maxWaitMs
      ) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (isRedisAvailable()) {
        try {
          activeQueue = new Queue('ai-tasks', {
            connection: getRedisClient(),
            defaultJobOptions: {
              attempts: env.aiJobAttempts,
              backoff: {
                type: 'exponential',
                delay: env.aiJobBackoffMs,
              },
              removeOnComplete: {
                count: env.aiJobRemoveOnComplete,
              },
              removeOnFail: {
                count: env.aiJobRemoveOnFail,
              },
            },
          });

          console.log(
            '[AIQueue] Redis/BullMQ queue activated.'
          );

          return activeQueue;
        } catch (err) {
          console.warn(
            `[AIQueue] Failed to initialize Redis queue, falling back to memory: ${err.message}`
          );
        }
      }
    }

    console.log(
      '[AIQueue] Using MemoryQueueFallback.'
    );

    activeQueue = new MemoryQueueFallback();

    return activeQueue;
  })();

  try {
    return await queueInitializationPromise;
  } catch (err) {
    // Defensive fallback in case initialization itself unexpectedly
    // rejects. Core CareerGraph should remain available.
    console.warn(
      `[AIQueue] Queue initialization failed, falling back to memory: ${err.message}`
    );

    activeQueue = new MemoryQueueFallback();

    return activeQueue;
  }
}

export { initializeQueue };

export async function getAIQueue() {
  return initializeQueue();
}

export const queueJobSchema = Joi.object({
  jobSchemaVersion: Joi.number().integer().required(),

  jobType: Joi.string().required(),

  entityId: Joi.string().required(),

  userId: Joi.string()
    .allow('', null)
    .optional(),

  inputHash: Joi.string()
    .allow('', null)
    .optional(),

  requestedAt: Joi.date()
    .iso()
    .optional(),

  requestId: Joi.string()
    .allow('', null)
    .optional(),

  entityType: Joi.string()
    .allow('', null)
    .optional(),

  text: Joi.string()
    .allow('', null)
    .optional(),
}).unknown(true);

/**
 * Helper to generate a deterministic Job ID to prevent duplicate work.
 */
export function generateJobId(
  jobType,
  entityId,
  inputHash = ''
) {
  return `ai-${jobType}-${entityId}${inputHash ? `-${inputHash}` : ''
    }`;
}

/**
 * Enqueue an AI job using the configured queue driver.
 *
 * The caller does not need to know whether Redis/BullMQ or the
 * in-memory fallback is active.
 */
export async function enqueueAIJob(
  jobType,
  entityId,
  additionalData = {},
  opts = {}
) {
  const payload = {
    jobSchemaVersion: 1,
    jobType,

    entityId,

    userId: additionalData.userId || null,

    inputHash: additionalData.inputHash || null,

    requestedAt: new Date().toISOString(),

    requestId:
      additionalData.requestId ||
      `req-${Date.now()}`,

    entityType:
      additionalData.entityType || null,

    text:
      additionalData.text || null,
  };

  const { error, value } =
    queueJobSchema.validate(payload);

  if (error) {
    throw new Error(
      `[AIQueue] Payload contract validation failed: ${error.message}`
    );
  }

  const stableJobId =
    opts.jobId ||
    generateJobId(
      jobType,
      entityId,
      payload.inputHash
    );

  const queue = await initializeQueue();

  return await queue.add(
    jobType,
    value,
    {
      ...opts,
      jobId: stableJobId,
    }
  );
}

export const aiQueue = {
  async add(name, data, opts = {}) {
    const queue = await initializeQueue();
    return queue.add(name, data, opts);
  },

  async getJobCounts() {
    const queue = await initializeQueue();
    return queue.getJobCounts();
  },
};

export default aiQueue;