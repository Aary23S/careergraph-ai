import { aiObservability } from '../src/services/ai/observability.service.js';
import { env } from '../src/config/env.js';

describe('Phase 3I — AI Observability & AIOps Foundation Tests', () => {
  beforeEach(() => {
    // Reset metrics before each test
    aiObservability.metrics = {
      requests_total: 0,
      requests_success: 0,
      requests_failed: 0,
      requests_timeout: 0,
      requests_invalid_output: 0,
      retry_count: 0,
      semantic_search_requests: 0,
      embedding_requests: 0,
      embedding_latency_sum: 0,
      quality_regression_count: 0
    };
    aiObservability.latencies = [];
    aiObservability.qualityScores = [];
    env.aiEnabled = true;
  });

  describe('Metric Telemetry Aggregation', () => {
    it('records success and latency telemetry correctly', () => {
      aiObservability.recordRequest({
        success: true,
        latencyMs: 1200,
        qualityScore: 0.95
      });

      expect(aiObservability.metrics.requests_total).toBe(1);
      expect(aiObservability.metrics.requests_success).toBe(1);
      expect(aiObservability.metrics.requests_failed).toBe(0);
      expect(aiObservability.getLatencyPercentile(50)).toBe(1200);
      expect(aiObservability.getAverageQuality()).toBe(0.95);
    });

    it('handles multiple requests and calculates percentiles', () => {
      const sampleLatencies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      sampleLatencies.forEach(lat => {
        aiObservability.recordRequest({
          success: true,
          latencyMs: lat,
          qualityScore: 0.90
        });
      });

      expect(aiObservability.metrics.requests_total).toBe(10);
      expect(aiObservability.getLatencyPercentile(50)).toBe(500);
      expect(aiObservability.getLatencyPercentile(95)).toBe(1000);
    });
  });

  describe('Anomaly Detection & SLO Compliance', () => {
    it('detects latency spike anomalies when P95 exceeds 8 seconds', () => {
      aiObservability.recordRequest({ success: true, latencyMs: 9000 });
      const anomalies = aiObservability.detectAnomalies();
      expect(anomalies.some(a => a.type === 'latency_spike')).toBe(true);
    });

    it('detects failure spike anomalies', () => {
      // Record 6 failed requests to exceed the > 5 requests threshold
      for (let i = 0; i < 6; i++) {
        aiObservability.recordRequest({ success: false });
      }
      const anomalies = aiObservability.detectAnomalies();
      expect(anomalies.some(a => a.type === 'failure_spike')).toBe(true);
    });
  });

  describe('AI Health States', () => {
    it('returns DISABLED when global kill switch is active', () => {
      env.aiEnabled = false;
      expect(aiObservability.calculateAIState()).toBe('DISABLED');
    });

    it('returns FAILED when failure rate exceeds 50% on >5 requests', () => {
      for (let i = 0; i < 4; i++) aiObservability.recordRequest({ success: false });
      for (let i = 0; i < 2; i++) aiObservability.recordRequest({ success: true });
      expect(aiObservability.calculateAIState()).toBe('FAILED');
    });

    it('returns DEGRADED when P95 latency is over 10 seconds', () => {
      for (let i = 0; i < 10; i++) {
        aiObservability.recordRequest({ success: true, latencyMs: 11000 });
      }
      expect(aiObservability.calculateAIState()).toBe('DEGRADED');
    });

    it('returns HEALTHY under normal conditions', () => {
      aiObservability.recordRequest({ success: true, latencyMs: 500 });
      expect(aiObservability.calculateAIState()).toBe('HEALTHY');
    });
  });
});
