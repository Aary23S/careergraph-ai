import { aiQueue } from './ai.queue.js';
import { isRedisAvailable } from '../config/queue.js';

export async function getQueueMetrics() {
  try {
    if (typeof aiQueue.getJobCounts === 'function') {
      const counts = await aiQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      return {
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
        driver: isRedisAvailable() ? 'redis' : 'memory'
      };
    }
  } catch (err) {
    console.warn('[QueueService] Failed to fetch queue stats:', err.message);
  }

  return {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    driver: 'memory'
  };
}

export default {
  getQueueMetrics
};
