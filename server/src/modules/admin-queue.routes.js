import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { aiQueue } from '../queues/ai.queue.js';
import { isRedisAvailable, getRedisClient } from '../config/queue.js';

const router = Router();

// Middleware to authorize operators only
function requireOperator(req, res, next) {
  const userEmail = req.auth?.user?.email;
  const operatorEmails = env.aiOperatorEmails ? env.aiOperatorEmails.split(',') : [];
  
  if (!userEmail || !operatorEmails.includes(userEmail)) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Operator privilege required.'
    });
  }
  next();
}

// Apply authentication and operator checks to all routes
router.use(requireAuth);
router.use(requireOperator);

// GET /api/admin/ai-queue/status
router.get('/status', async (req, res) => {
  try {
    const isRedis = isRedisAvailable() && typeof aiQueue.isPaused === 'function';
    const isPaused = isRedis ? await aiQueue.isPaused() : false;
    const counts = typeof aiQueue.getJobCounts === 'function' 
      ? await aiQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed')
      : { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };

    const activeWorkers = [];
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient();
        const keys = await redis.keys('ai-workers:heartbeat:*');
        for (const key of keys) {
          const stats = await redis.hgetall(key);
          if (stats && stats.workerId) {
            activeWorkers.push({
              workerId: stats.workerId,
              startedAt: stats.startedAt,
              lastHeartbeat: stats.lastHeartbeat,
              activeJobs: parseInt(stats.activeJobs || '0', 10),
              processedJobs: parseInt(stats.processedJobs || '0', 10),
              failedJobs: parseInt(stats.failedJobs || '0', 10),
              status: stats.status || 'active'
            });
          }
        }
      } catch (err) {
        console.error('[AdminQueueRoutes] Failed to fetch active workers heartbeats:', err);
      }
    }

    return res.json({
      success: true,
      data: {
        isPaused,
        counts,
        driver: isRedis ? 'redis' : 'memory',
        activeWorkers
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/ai-queue/failed
router.get('/failed', async (req, res) => {
  try {
    if (isRedisAvailable() && typeof aiQueue.getFailed === 'function') {
      const failedJobs = await aiQueue.getFailed();
      return res.json({
        success: true,
        data: failedJobs.map(job => ({
          id: job.id,
          name: job.name,
          data: job.data,
          failedReason: job.failedReason,
          stacktrace: job.stacktrace,
          processedOn: job.processedOn
        }))
      });
    }
    return res.json({ success: true, data: [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/ai-queue/:jobId/retry
router.post('/:jobId/retry', async (req, res) => {
  try {
    const { jobId } = req.params;
    if (isRedisAvailable() && typeof aiQueue.getJob === 'function') {
      const job = await aiQueue.getJob(jobId);
      if (!job) {
        return res.status(404).json({ success: false, error: 'Job not found.' });
      }
      await job.retry();
      return res.json({ success: true, message: `Job ${jobId} successfully enqueued for retry.` });
    }
    return res.status(400).json({ success: false, error: 'Queue is not running in redis mode.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/ai-queue/retry-all
router.post('/retry-all', async (req, res) => {
  try {
    if (isRedisAvailable() && typeof aiQueue.getFailed === 'function') {
      const failedJobs = await aiQueue.getFailed();
      for (const job of failedJobs) {
        await job.retry();
      }
      return res.json({ success: true, message: `Retried ${failedJobs.length} failed jobs.` });
    }
    return res.json({ success: true, message: 'No jobs retried.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/ai-queue/pause
router.post('/pause', async (req, res) => {
  try {
    if (isRedisAvailable() && typeof aiQueue.pause === 'function') {
      await aiQueue.pause();
      return res.json({ success: true, message: 'Queue paused successfully.' });
    }
    return res.status(400).json({ success: false, error: 'Queue driver does not support pausing.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/ai-queue/resume
router.post('/resume', async (req, res) => {
  try {
    if (isRedisAvailable() && typeof aiQueue.resume === 'function') {
      await aiQueue.resume();
      return res.json({ success: true, message: 'Queue resumed successfully.' });
    }
    return res.status(400).json({ success: false, error: 'Queue driver does not support resuming.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/ai-queue/clean
router.post('/clean', async (req, res) => {
  try {
    if (isRedisAvailable() && typeof aiQueue.clean === 'function') {
      await aiQueue.clean(0, 1000, 'completed');
      await aiQueue.clean(0, 1000, 'failed');
      return res.json({ success: true, message: 'Cleaned completed and failed jobs.' });
    }
    return res.json({ success: true, message: 'No cleanup performed.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
