import os from 'os';
import { randomUUID } from 'crypto';
import { Worker, UnrecoverableError } from 'bullmq';
import { getRedisClient, isRedisAvailable } from '../config/queue.js';
import { env } from '../config/env.js';
import { registerMemoryWorker, queueJobSchema } from '../queues/ai.queue.js';
import { executeEnrichment as executeJobEnrichment } from '../services/job-ai-enrichment.service.js';
import { executeEnrichment as executeConnectionEnrichment } from '../services/connection-ai-enrichment.service.js';
import { executeResumeEnrichment } from '../services/resume-ai-enrichment.service.js';
import { getOrGenerateEmbedding } from '../services/embedding.service.js';
import { aiObservability } from '../services/ai/observability.service.js';

// Generate dynamic unique worker ID
export const workerId = env.aiWorkerId || `worker-${os.hostname()}-${randomUUID().slice(0, 8)}`;

const startedAt = new Date().toISOString();
let activeJobsCount = 0;
let processedJobsCount = 0;
let failedJobsCount = 0;
let isShuttingDown = false;
let heartbeatInterval = null;

function isPermanentError(err) {
  const msg = (err.message || '').toLowerCase();
  if (
    msg.includes('validation') ||
    msg.includes('joi') ||
    msg.includes('invalid input') ||
    msg.includes('unsupported operation') ||
    msg.includes('malformed') ||
    err.name === 'ValidationError' ||
    err.name === 'JoiValidationError'
  ) {
    return true;
  }
  return false;
}

/**
 * Common handler to process both Redis queue jobs and memory fallbacks.
 */
export async function handleJob(jobName, jobData) {
  const { error, value } = queueJobSchema.validate({ ...jobData, jobType: jobName });
  if (error) {
    console.error(`[AIWorker] [${workerId}] Queue payload contract mismatch: ${error.message}`);
    throw new UnrecoverableError(`Payload schema contract violation: ${error.message}`);
  }

  const { entityId, userId, text } = value;
  console.log(`[AIWorker] [${workerId}] Processing task: ${jobName} for entity: ${entityId} (Trace: ${value.requestId || 'N/A'})`);

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
      case 'embedding_generation':
        await getOrGenerateEmbedding({
          userId,
          entityType: jobData.entityType,
          entityId,
          text
        });
        break;
      default:
        console.warn(`[AIWorker] [${workerId}] Unknown task type skipped: ${jobName}`);
        break;
    }
    processedJobsCount++;
  } catch (err) {
    failedJobsCount++;
    if (isPermanentError(err)) {
      console.warn(`[AIWorker] [${workerId}] Unrecoverable task failure: ${err.message}`);
      throw new UnrecoverableError(err.message);
    }
    throw err;
  } finally {
    activeJobsCount = Math.max(0, activeJobsCount - 1);
  }
}

async function writeHeartbeat() {
  if (env.aiQueueDriver !== 'redis' || !isRedisAvailable()) return;
  try {
    const redis = getRedisClient();
    const key = `ai-workers:heartbeat:${workerId}`;
    await redis.hset(key, {
      workerId,
      startedAt,
      lastHeartbeat: new Date().toISOString(),
      activeJobs: activeJobsCount.toString(),
      processedJobs: processedJobsCount.toString(),
      failedJobs: failedJobsCount.toString(),
      status: isShuttingDown ? 'shutting-down' : 'active'
    });
    await redis.expire(key, 30); // 30 seconds TTL
  } catch (err) {
    console.error(`[AIWorker] [${workerId}] Failed to write heartbeat: ${err.message}`);
  }
}

function startHeartbeat() {
  writeHeartbeat();
  heartbeatInterval = setInterval(writeHeartbeat, env.aiWorkerHeartbeatIntervalMs);
}

let bullmqWorker = null;

if (env.aiQueueDriver === 'redis' && isRedisAvailable()) {
  try {
    bullmqWorker = new Worker('ai-tasks', async (job) => {
      await handleJob(job.name, job.data);
    }, {
      connection: getRedisClient(),
      concurrency: env.aiWorkerConcurrency,
      limiter: {
        max: env.aiQueueRateLimitMax,
        duration: env.aiQueueRateLimitDuration
      }
    });

    bullmqWorker.on('completed', (job) => {
      const waitTime = (job.processedOn || Date.now()) - (job.timestamp || Date.now());
      const processingTime = (job.finishedOn || Date.now()) - (job.processedOn || Date.now());
      const totalTime = (job.finishedOn || Date.now()) - (job.timestamp || Date.now());

      console.log(`[AIWorker] [${workerId}] Completed queue task: ${job.id} (Wait: ${waitTime}ms, Process: ${processingTime}ms, Total: ${totalTime}ms)`);
      aiObservability.recordQueueJobLatency(waitTime, processingTime, totalTime);
    });

    bullmqWorker.on('failed', (job, err) => {
      console.error(`[AIWorker] [${workerId}] Failed queue task: ${job?.id || 'unknown'}. Error: ${err.message}`);
    });
  } catch (err) {
    console.warn(`[AIWorker] [${workerId}] Failed to spin up BullMQ worker, defaulting to memory worker handler:`, err.message);
  }
}

// Register memory fallback handler
registerMemoryWorker(async (job) => {
  await handleJob(job.name, job.data);
});

export async function shutdownWorker() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[AIWorker] [${workerId}] Initiating graceful shutdown...`);

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  // Set worker status to shutting-down and delete heartbeat key from Redis
  if (env.aiQueueDriver === 'redis' && isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      const key = `ai-workers:heartbeat:${workerId}`;
      await redis.hset(key, 'status', 'shutting-down');
      await redis.del(key);
    } catch {
      // Ignore
    }
  }

  // Graceful wait period for active jobs to drain
  const timeout = env.aiWorkerShutdownTimeoutMs;
  const checkInterval = 100;
  let elapsed = 0;
  while (activeJobsCount > 0 && elapsed < timeout) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    elapsed += checkInterval;
  }

  if (activeJobsCount > 0) {
    console.warn(`[AIWorker] [${workerId}] Shutdown timeout exceeded. ${activeJobsCount} jobs still active.`);
  } else {
    console.log(`[AIWorker] [${workerId}] All active jobs finished.`);
  }

  if (bullmqWorker) {
    await bullmqWorker.close();
  }
}

// Bind process events
process.once('SIGTERM', async () => {
  await shutdownWorker();
  process.exit(0);
});

process.once('SIGINT', async () => {
  await shutdownWorker();
  process.exit(0);
});

// Check if this script is run directly
const isMain = process.argv[1] && (process.argv[1].endsWith('ai.worker.js') || process.argv[1].endsWith('ai-worker.js'));
if (isMain) {
  console.log(`[AIWorker] [${workerId}] Starting dedicated service daemon...`);
  try {
    const { connectDatabase } = await import('../config/database.js');
    await connectDatabase();
    console.log(`[AIWorker] [${workerId}] Database connected successfully.`);
    startHeartbeat();
  } catch (err) {
    console.error(`[AIWorker] [${workerId}] Startup failed:`, err);
    process.exit(1);
  }
}
