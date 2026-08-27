import { aiQueue } from './ai.queue.js';
import { isRedisAvailable } from '../config/queue.js';

let cachedMetrics = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };

export function getCachedQueueMetrics() {
  return {
    ...cachedMetrics,
    driver: isRedisAvailable() ? 'redis' : 'memory'
  };
}

export async function updateCachedQueueMetrics() {
  try {
    if (typeof aiQueue.getJobCounts === 'function') {
      const counts = await aiQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      cachedMetrics = {
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0
      };

      // Push updates to observability layer synchronously
      const { updateObservabilityQueueStats } = await import('../services/ai/observability.service.js');
      updateObservabilityQueueStats({
        pending: cachedMetrics.waiting + cachedMetrics.delayed,
        processing: cachedMetrics.active,
        failed: cachedMetrics.failed
      });
    }
  } catch (err) {
    console.warn('[QueueService] Failed to update cached metrics:', err.message);
  }
}

export async function getQueueMetrics() {
  await updateCachedQueueMetrics();
  return getCachedQueueMetrics();
}

export default {
  getQueueMetrics,
  getCachedQueueMetrics,
  updateCachedQueueMetrics
};
