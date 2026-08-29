import { Router } from 'express';
import { aiService } from '../services/ai/ai.service.js';
import { env } from '../config/env.js';
import { aiObservability } from '../services/ai/observability.service.js';
import { aiQueue } from '../queues/ai.queue.js';
import { mlServiceClient } from '../services/ml-service.client.js';
import { resolveRankingModel } from '../services/model-resolver.service.js';
import { models } from '../config/database.js';
import { Op } from 'sequelize';

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

/**
 * Fulfills Phase 4L requirements for Model Lineage, Prediction logging,
 * Drift monitoring and Champion/Challenger tracking on the AI Ops dashboard.
 */
async function getMlopsDashboardSummary() {
  const summary = {
    champion: 'none',
    challenger: 'none',
    datasetVersion: 'unknown',
    featureVersion: 'unknown',
    modelVersion: 'unknown',
    mlflowRun: 'unknown',
    predictionMetrics: { totalCount: 0, averageScore: 0, averageLatencyMs: 0 },
    driftStatus: { driftDetected: false, features: {} },
    modelQuality: { accuracy: 1.0, totalLinkedOutcomes: 0 },
    deploymentStatus: 'unknown'
  };

  try {
    // 1. Resolve champion model
    const resolved = await resolveRankingModel();
    if (resolved) {
      summary.champion = resolved.model;
      summary.modelVersion = resolved.model.split(':')[1] || resolved.model;
      
      // Load registry metadata
      if (resolved.modelRegistryId) {
        const registryRow = await models.ModelRegistry.findByPk(resolved.modelRegistryId);
        if (registryRow) {
          summary.datasetVersion = registryRow.metadata?.datasetVersion || 'unknown';
          summary.featureVersion = registryRow.metadata?.featureVersion || 'unknown';
          summary.mlflowRun = registryRow.metadata?.mlflowRunId || 'unknown';
        }
      }
    }

    // 2. Resolve challenger model (find any candidate or staging models)
    const challengerRow = await models.ModelRegistry.findOne({
      where: {
        status: { [Op.in]: ['candidate', 'staging'] }
      },
      order: [['created_at', 'DESC']]
    });
    if (challengerRow) {
      summary.challenger = `${challengerRow.name}:${challengerRow.version}`;
    }

    // 3. Query prediction metrics
    const totalPredictions = await models.MlPrediction.count();
    summary.predictionMetrics.totalCount = totalPredictions;
    if (totalPredictions > 0) {
      const avgScore = await models.MlPrediction.mean('predictionScore');
      const avgTime = await models.MlPrediction.mean('predictionTime');
      summary.predictionMetrics.averageScore = Number(Number(avgScore || 0).toFixed(2));
      summary.predictionMetrics.averageLatencyMs = Number(Number(avgTime || 0).toFixed(1));
    }

    // 4. Query drift status from python service
    try {
      const drift = await mlServiceClient.getDriftStatus(summary.modelVersion !== 'unknown' ? summary.modelVersion : undefined);
      summary.driftStatus = {
        driftDetected: drift.drift_detected,
        features: drift.features
      };
    } catch {
      summary.driftStatus = { driftDetected: false, features: {}, error: 'ML service unreachable' };
    }

    // 5. Compute model quality metrics (Outcome linkage)
    const predictions = await models.MlPrediction.findAll({
      limit: 100,
      order: [['created_at', 'DESC']]
    });
    let correct = 0;
    let totalLinked = 0;
    for (const pred of predictions) {
      const app = await models.Application.findOne({
        where: {
          user_id: pred.userId,
          job_id: pred.entityId
        }
      });
      if (app) {
        totalLinked++;
        const isPositiveOutcome = ['interview', 'offer', 'accepted'].includes(app.status);
        const isHighPrediction = pred.predictionScore > 0.7;
        if (isPositiveOutcome === isHighPrediction) {
          correct++;
        }
      }
    }
    summary.modelQuality.totalLinkedOutcomes = totalLinked;
    summary.modelQuality.accuracy = totalLinked > 0 ? Number((correct / totalLinked).toFixed(2)) : 1.0;

    // 6. Query deployment status
    try {
      const readiness = await mlServiceClient.readinessCheck();
      summary.deploymentStatus = readiness.status === 'ready' ? 'healthy' : 'degraded';
    } catch {
      summary.deploymentStatus = 'unavailable';
    }

  } catch (err) {
    console.error('[MlopsDashboard] Failed to build MLOps summary:', err.message);
  }

  return summary;
}

router.get('/health', async (req, res) => {
  try {
    const available = await aiService.healthCheck();

    const { updateCachedQueueMetrics } = await import('../queues/queue.service.js');
    await updateCachedQueueMetrics();

    const summary = aiObservability.getSummaryReport();
    const mlflow = await getMlflowStatusSummary();
    const mlops = await getMlopsDashboardSummary();
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
        mlflow,
        mlops
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
        mlflow: { status: env.mlflowEnabled ? 'unavailable' : 'disabled' },
        mlops: { deploymentStatus: 'unavailable', champion: 'none', challenger: 'none' }
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
