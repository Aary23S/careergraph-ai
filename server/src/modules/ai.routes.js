import { Router } from 'express';
import { aiService } from '../services/ai/ai.service.js';
import { env } from '../config/env.js';
import { aiObservability } from '../services/ai/observability.service.js';
import { aiQueue } from '../queues/ai.queue.js';
import { mlServiceClient } from '../services/ml-service.client.js';

const router = Router();

/**
 * Best-effort MLflow status for the AI Ops "MLflow" card (Phase 4F section
 * 15). Never throws -- an unreachable ai-service/MLflow just reports
 * status "unavailable", same as the rest of this health endpoint's
 * philosophy of degrading gracefully rather than failing the whole response.
 */
async function getMlflowStatusSummary() {
  if (!env.mlflowEnabled) {
    return { status: 'disabled' };
  }
  try {
    const tracking = await mlServiceClient.getTrackingStatus();
    if (!tracking.connected) {
      return { status: 'unavailable', enabled: tracking.enabled };
    }
    return {
      status: 'connected',
      lastExperiment: tracking.lastRun?.experiment || null,
      lastRun: tracking.lastRun?.runId || null,
      lastRunStatus: tracking.lastRun?.status || null,
      lastRunModel: tracking.lastRun?.model || null,
    };
  } catch {
    return { status: 'unavailable' };
  }
}

router.get('/health', async (req, res) => {
  try {
    const available = await aiService.healthCheck();

    const { updateCachedQueueMetrics } = await import('../queues/queue.service.js');
    await updateCachedQueueMetrics();

    const summary = aiObservability.getSummaryReport();
    const mlflow = await getMlflowStatusSummary();
    return res.json({
      success: true,
      data: {
        enabled: env.aiEnabled,
        provider: env.aiProvider,
        model: env.groqModel || env.ollamaModel || 'mock',
        available,
        state: summary.state,
        queue: summary.queue,
        latency: summary.latency,
        averageQuality: summary.averageQuality,
        anomalies: summary.anomalies,
        mlflow
      }
    });
  } catch (err) {
    return res.json({
      success: false,
      data: {
        enabled: env.aiEnabled,
        provider: env.aiProvider,
        model: env.groqModel || env.ollamaModel || 'mock',
        available: false,
        state: 'FAILED',
        queue: { pending: 0, processing: 0, failed: 0, details: {} },
        latency: { p50: 0, p95: 0 },
        averageQuality: 0.0,
        anomalies: [{ type: 'health_check_failed', message: err.message }],
        mlflow: { status: env.mlflowEnabled ? 'unavailable' : 'disabled' }
      },
      error: err.message
    });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    const { updateCachedQueueMetrics } = await import('../queues/queue.service.js');
    await updateCachedQueueMetrics();
    
    const summary = aiObservability.getSummaryReport();
    return res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/workers/health', async (req, res) => {
  try {
    const isAvailable = typeof aiQueue.getJobCounts === 'function';
    let active = 0, waiting = 0, failed = 0;
    
    if (isAvailable) {
      const counts = await aiQueue.getJobCounts('active', 'waiting', 'failed');
      active = counts.active || 0;
      waiting = counts.waiting || 0;
      failed = counts.failed || 0;
    }
    
    return res.json({
      status: 'healthy',
      workers: env.aiWorkerConcurrency,
      activeJobs: active,
      waitingJobs: waiting,
      failedJobs: failed
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

export default router;
