import os from 'os';
import { randomUUID } from 'crypto';
import { Worker, UnrecoverableError } from 'bullmq';

import {
  getRedisClient,
  initializeRedis,
  isRedisAvailable,
} from '../config/queue.js';

import { env } from '../config/env.js';

import {
  registerMemoryWorker,
  queueJobSchema,
} from '../queues/ai.queue.js';

import {
  executeEnrichment as executeJobEnrichment,
} from '../services/job-ai-enrichment.service.js';

import {
  executeEnrichment as executeConnectionEnrichment,
} from '../services/connection-ai-enrichment.service.js';

import {
  executeResumeEnrichment,
} from '../services/resume-ai-enrichment.service.js';

import {
  executeJobMatchAnalysis,
} from '../services/job-match-analysis.service.js';

import {
  getOrGenerateEmbedding,
} from '../services/embedding.service.js';

import {
  aiObservability,
} from '../services/ai/observability.service.js';

// Generate a dynamic unique worker ID.
export const workerId =
  env.aiWorkerId ||
  `worker-${os.hostname()}-${randomUUID().slice(0, 8)}`;

const startedAt = new Date().toISOString();

let activeJobsCount = 0;
let processedJobsCount = 0;
let failedJobsCount = 0;

let isShuttingDown = false;
let heartbeatInterval = null;

let bullmqWorker = null;
let bullmqInitializationPromise = null;

function isPermanentError(err) {
  const msg = (err?.message || '').toLowerCase();

  if (
    msg.includes('validation') ||
    msg.includes('joi') ||
    msg.includes('invalid input') ||
    msg.includes('unsupported operation') ||
    msg.includes('malformed') ||
    err?.name === 'ValidationError' ||
    err?.name === 'JoiValidationError'
  ) {
    return true;
  }

  return false;
}

/**
 * Common handler shared by:
 *
 * 1. BullMQ/Redis worker
 * 2. Memory fallback worker
 */
export async function handleJob(jobName, jobData) {
  const { error, value } = queueJobSchema.validate({
    ...jobData,
    jobType: jobName,
  });

  if (error) {
    console.error(
      `[AIWorker] [${workerId}] Queue payload contract mismatch: ${error.message}`
    );

    throw new UnrecoverableError(
      `Payload schema contract violation: ${error.message}`
    );
  }

  const {
    entityId,
    userId,
    text,
    entityType,
  } = value;

  console.log(
    `[AIWorker] [${workerId}] Processing task: ${jobName} ` +
    `for entity: ${entityId} ` +
    `(Trace: ${value.requestId || 'N/A'})`
  );

  activeJobsCount++;

  try {
    switch (jobName) {
      case 'job_enrichment':
        await executeJobEnrichment(entityId);
        break;

      case 'connection_enrichment':
        await executeConnectionEnrichment(entityId);
        break;

      case 'resume_enrichment':
        await executeResumeEnrichment(entityId);
        break;

      case 'job_match_analysis':
        await executeJobMatchAnalysis(entityId);
        break;

      case 'embedding_generation':
        await getOrGenerateEmbedding({
          userId,
          entityType,
          entityId,
          text,
        });
        break;

      default:
        console.warn(
          `[AIWorker] [${workerId}] Unknown task type skipped: ${jobName}`
        );
        break;
    }

    processedJobsCount++;
  } catch (err) {
    failedJobsCount++;

    if (isPermanentError(err)) {
      console.warn(
        `[AIWorker] [${workerId}] Unrecoverable task failure: ${err.message}`
      );

      throw new UnrecoverableError(err.message);
    }

    throw err;
  } finally {
    activeJobsCount = Math.max(0, activeJobsCount - 1);
  }
}

/**
 * Publish worker heartbeat to Redis.
 */
async function writeHeartbeat() {
  if (
    env.aiQueueDriver !== 'redis' ||
    !isRedisAvailable()
  ) {
    return;
  }

  try {
    const redis = getRedisClient();

    if (!redis) {
      return;
    }

    const key = `ai-workers:heartbeat:${workerId}`;

    await redis.hset(key, {
      workerId,
      startedAt,
      lastHeartbeat: new Date().toISOString(),
      activeJobs: activeJobsCount.toString(),
      processedJobs: processedJobsCount.toString(),
      failedJobs: failedJobsCount.toString(),
      status: isShuttingDown
        ? 'shutting-down'
        : 'active',
    });

    await redis.expire(key, 30);
  } catch (err) {
    console.error(
      `[AIWorker] [${workerId}] Failed to write heartbeat: ${err.message}`
    );
  }
}

function startHeartbeat() {
  if (heartbeatInterval) {
    return;
  }

  writeHeartbeat();

  heartbeatInterval = setInterval(
    writeHeartbeat,
    env.aiWorkerHeartbeatIntervalMs
  );
}

/**
 * Initialize the BullMQ worker only after Redis is actually ready.
 *
 * This avoids the startup race where:
 *
 * worker starts
 *   ↓
 * isRedisAvailable() === false
 *   ↓
 * BullMQ worker is never created
 *   ↓
 * Redis connects later
 */
async function initializeBullMQWorker() {
  if (bullmqWorker) {
    return bullmqWorker;
  }

  if (bullmqInitializationPromise) {
    return bullmqInitializationPromise;
  }

  bullmqInitializationPromise = (async () => {
    if (env.aiQueueDriver !== 'redis') {
      console.log(
        `[AIWorker] [${workerId}] Redis queue driver disabled. ` +
        'Using memory worker mode.'
      );

      return null;
    }

    try {
      await initializeRedis();

      const waitStartedAt = Date.now();
      const maxWaitMs = 5000;

      while (
        !isRedisAvailable() &&
        Date.now() - waitStartedAt < maxWaitMs
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, 50)
        );
      }

      if (!isRedisAvailable()) {
        console.warn(
          `[AIWorker] [${workerId}] Redis unavailable after ` +
          `${maxWaitMs}ms. Using memory worker mode.`
        );

        return null;
      }

      const redis = getRedisClient();

      if (!redis) {
        console.warn(
          `[AIWorker] [${workerId}] Redis client unavailable. ` +
          'Using memory worker mode.'
        );

        return null;
      }

      bullmqWorker = new Worker(
        'ai-tasks',
        async (job) => {
          await handleJob(job.name, job.data);
        },
        {
          connection: redis,

          concurrency:
            env.aiWorkerConcurrency,

          limiter: {
            max:
              env.aiQueueRateLimitMax,

            duration:
              env.aiQueueRateLimitDuration,
          },
        }
      );

      bullmqWorker.on('completed', (job) => {
        const waitTime =
          (job.processedOn || Date.now()) -
          (job.timestamp || Date.now());

        const processingTime =
          (job.finishedOn || Date.now()) -
          (job.processedOn || Date.now());

        const totalTime =
          (job.finishedOn || Date.now()) -
          (job.timestamp || Date.now());

        console.log(
          `[AIWorker] [${workerId}] Completed queue task: ${job.id} ` +
          `(Wait: ${waitTime}ms, ` +
          `Process: ${processingTime}ms, ` +
          `Total: ${totalTime}ms)`
        );

        aiObservability.recordQueueJobLatency(
          waitTime,
          processingTime,
          totalTime
        );
      });

      bullmqWorker.on('failed', (job, err) => {
        console.error(
          `[AIWorker] [${workerId}] Failed queue task: ` +
          `${job?.id || 'unknown'}. Error: ${err.message}`
        );
      });

      bullmqWorker.on('error', (err) => {
        console.error(
          `[AIWorker] [${workerId}] BullMQ worker error: ${err.message}`
        );
      });

      bullmqWorker.on('ready', () => {
        console.log(
          `[AIWorker] [${workerId}] BullMQ worker is ready.`
        );
      });

      console.log(
        `[AIWorker] [${workerId}] BullMQ worker connected to Redis successfully.`
      );

      return bullmqWorker;
    } catch (err) {
      console.warn(
        `[AIWorker] [${workerId}] Failed to initialize BullMQ worker. ` +
        `Using memory worker mode: ${err.message}`
      );

      bullmqWorker = null;

      return null;
    }
  })();

  try {
    return await bullmqInitializationPromise;
  } catch (err) {
    console.warn(
      `[AIWorker] [${workerId}] Unexpected BullMQ initialization failure. ` +
      `Using memory worker mode: ${err.message}`
    );

    bullmqWorker = null;

    return null;
  }
}

/**
 * Memory fallback worker.
 *
 * This remains active for environments where Redis/BullMQ is disabled
 * or unavailable.
 */
registerMemoryWorker(async (job) => {
  await handleJob(
    job.name,
    job.data
  );
});

/**
 * Graceful worker shutdown.
 */
export async function shutdownWorker() {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(
    `[AIWorker] [${workerId}] Initiating graceful shutdown...`
  );

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  if (
    env.aiQueueDriver === 'redis' &&
    isRedisAvailable()
  ) {
    try {
      const redis = getRedisClient();

      if (redis) {
        const key =
          `ai-workers:heartbeat:${workerId}`;

        await redis.hset(
          key,
          'status',
          'shutting-down'
        );

        await redis.del(key);
      }
    } catch {
      // Ignore Redis shutdown cleanup failures.
    }
  }

  const timeout =
    env.aiWorkerShutdownTimeoutMs;

  const checkInterval = 100;
  let elapsed = 0;

  while (
    activeJobsCount > 0 &&
    elapsed < timeout
  ) {
    await new Promise((resolve) =>
      setTimeout(resolve, checkInterval)
    );

    elapsed += checkInterval;
  }

  if (activeJobsCount > 0) {
    console.warn(
      `[AIWorker] [${workerId}] Shutdown timeout exceeded. ` +
      `${activeJobsCount} jobs still active.`
    );
  } else {
    console.log(
      `[AIWorker] [${workerId}] All active jobs finished.`
    );
  }

  if (bullmqWorker) {
    try {
      await bullmqWorker.close();
    } catch (err) {
      console.warn(
        `[AIWorker] [${workerId}] Failed to close BullMQ worker: ${err.message}`
      );
    }

    bullmqWorker = null;
  }

  if (bullmqInitializationPromise) {
    bullmqInitializationPromise = null;
  }
}

/**
 * Bind process shutdown events.
 */
process.once('SIGTERM', async () => {
  await shutdownWorker();
  process.exit(0);
});

process.once('SIGINT', async () => {
  await shutdownWorker();
  process.exit(0);
});

/**
 * Check if this file is being executed directly.
 */
const isMain =
  process.argv[1] &&
  (
    process.argv[1].endsWith('ai.worker.js') ||
    process.argv[1].endsWith('ai-worker.js')
  );

if (isMain) {
  console.log(
    `[AIWorker] [${workerId}] Starting dedicated service daemon...`
  );

  try {
    const {
      connectDatabase,
    } = await import(
      '../config/database.js'
    );

    await connectDatabase();

    console.log(
      `[AIWorker] [${workerId}] Database connected successfully.`
    );

    await initializeBullMQWorker();

    if (
      env.aiQueueDriver === 'redis' &&
      isRedisAvailable()
    ) {
      startHeartbeat();
    }
  } catch (err) {
    console.error(
      `[AIWorker] [${workerId}] Startup failed:`,
      err
    );

    process.exit(1);
  }
}