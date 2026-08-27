import { Router } from 'express';
import { aiService } from '../services/ai/ai.service.js';
import { env } from '../config/env.js';
import { aiObservability } from '../services/ai/observability.service.js';

const router = Router();

router.get('/health', async (req, res) => {
  try {
    const available = await aiService.healthCheck();
    const summary = await aiObservability.getSummaryReport();
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
        anomalies: summary.anomalies
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
        anomalies: [{ type: 'health_check_failed', message: err.message }]
      },
      error: err.message
    });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    const summary = await aiObservability.getSummaryReport();
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

export default router;
