import { Worker } from 'bullmq';
import { getRedisClient, isRedisAvailable } from '../config/queue.js';
import { env } from '../config/env.js';
import { registerMemoryWorker } from '../queues/ai.queue.js';
import { executeEnrichment as executeJobEnrichment } from '../services/job-ai-enrichment.service.js';
import { executeEnrichment as executeConnectionEnrichment } from '../services/connection-ai-enrichment.service.js';
import { executeResumeEnrichment } from '../services/resume-ai-enrichment.service.js';
import { getOrGenerateEmbedding } from '../services/embedding.service.js';

/**
 * Common handler to process both Redis queue jobs and memory fallbacks.
 */
export async function handleJob(jobName, jobData) {
  const { entityId, userId, text } = jobData;
  console.log(`[AIWorker] Processing task: ${jobName} for entity: ${entityId}`);

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
      console.warn(`[AIWorker] Unknown task type skipped: ${jobName}`);
  }
}

let bullmqWorker = null;

if (env.aiQueueDriver === 'redis' && isRedisAvailable()) {
  try {
    bullmqWorker = new Worker('ai-tasks', async (job) => {
      await handleJob(job.name, job.data);
    }, {
      connection: getRedisClient(),
      concurrency: 1
    });

    bullmqWorker.on('completed', (job) => {
      console.log(`[AIWorker] Completed queue task: ${job.id}`);
    });

    bullmqWorker.on('failed', (job, err) => {
      console.error(`[AIWorker] Failed queue task: ${job?.id || 'unknown'}. Error: ${err.message}`);
    });
  } catch (err) {
    console.warn('[AIWorker] Failed to spin up BullMQ worker, defaulting to memory worker handler:', err.message);
  }
}

// Register memory fallback handler
registerMemoryWorker(async (job) => {
  await handleJob(job.name, job.data);
});

export async function shutdownWorker() {
  if (bullmqWorker) {
    console.log('[AIWorker] Gracefully closing worker connections...');
    await bullmqWorker.close();
  }
}

// Bind process event lifecycle hooks
process.once('SIGTERM', async () => {
  await shutdownWorker();
});

process.once('SIGINT', async () => {
  await shutdownWorker();
});
