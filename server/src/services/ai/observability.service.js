import { env } from '../../config/env.js';

let redisStats = { pending: 0, processing: 0, failed: 0 };

export function updateObservabilityQueueStats(stats) {
  redisStats = {
    pending: stats.pending || 0,
    processing: stats.processing || 0,
    failed: stats.failed || 0
  };
}

class AIObservabilityService {
  constructor() {
    this.metrics = {
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

    this.latencies = []; // Rolling window of recent latencies (max 100)
    this.qualityScores = []; // Rolling window of recent quality scores (max 100)
    this.queueProviders = new Map(); // Dynamic registry for queue stats to avoid circular imports
  }

  registerQueueProvider(name, getStatsFn) {
    this.queueProviders.set(name, getStatsFn);
  }

  recordRequest({ success, timeout, invalidOutput, latencyMs, qualityScore, isRetry }) {
    this.metrics.requests_total++;
    if (success) {
      this.metrics.requests_success++;
    } else {
      this.metrics.requests_failed++;
    }

    if (timeout) this.metrics.requests_timeout++;
    if (invalidOutput) this.metrics.requests_invalid_output++;
    if (isRetry) this.metrics.retry_count++;

    if (latencyMs !== undefined) {
      this.latencies.push(latencyMs);
      if (this.latencies.length > 100) this.latencies.shift();
    }

    if (qualityScore !== undefined) {
      this.qualityScores.push(qualityScore);
      if (this.qualityScores.length > 100) this.qualityScores.shift();
    }
  }

  recordEmbedding(latencyMs) {
    this.metrics.embedding_requests++;
    this.metrics.embedding_latency_sum += latencyMs;
  }

  recordSemanticSearch() {
    this.metrics.semantic_search_requests++;
  }

  recordQualityRegression() {
    this.metrics.quality_regression_count++;
  }

  getLatencyPercentile(p) {
    if (this.latencies.length === 0) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getAverageQuality() {
    if (this.qualityScores.length === 0) return 1.0;
    const sum = this.qualityScores.reduce((acc, v) => acc + v, 0);
    return sum / this.qualityScores.length;
  }

  getQueueSummary() {
    let pending = 0;
    let processing = 0;
    let failed = 0;
    const details = {};

    // 1. If using Redis, fetch from cached stats
    if (env.aiQueueDriver === 'redis') {
      pending = redisStats.pending;
      processing = redisStats.processing;
      failed = redisStats.failed;
      
      details['redis_queue'] = {
        pending,
        processing: processing > 0,
        failed
      };
    }

    // 2. Fallback / legacy in-memory providers
    for (const [name, getStats] of this.queueProviders.entries()) {
      try {
        const stats = getStats();
        pending += stats.pending || 0;
        processing += stats.processing ? 1 : 0;
        failed += stats.failed || 0;
        details[name] = stats;
      } catch (err) {
        console.warn(`[Observability] Failed to read queue stats for ${name}: ${err.message}`);
      }
    }

    return {
      pending,
      processing,
      failed,
      details
    };
  }

  calculateAIState() {
    if (!env.aiEnabled) {
      return 'DISABLED';
    }

    const { requests_total, requests_failed } = this.metrics;
    const failureRate = requests_total > 5 ? (requests_failed / requests_total) : 0;
    const p95Latency = this.getLatencyPercentile(95);

    if (failureRate >= 0.50) {
      return 'FAILED';
    }

    if (failureRate >= 0.10 || p95Latency > 10000 || this.metrics.quality_regression_count > 0) {
      return 'DEGRADED';
    }

    return 'HEALTHY';
  }

  detectAnomalies() {
    const anomalies = [];
    const p95 = this.getLatencyPercentile(95);
    const failureRate = this.metrics.requests_total > 5
      ? (this.metrics.requests_failed / this.metrics.requests_total)
      : 0;

    const queue = this.getQueueSummary();

    if (p95 > 8000) {
      anomalies.push({ type: 'latency_spike', message: `P95 latency is highly elevated at ${(p95 / 1000).toFixed(2)}s` });
    }

    if (failureRate > 0.15) {
      anomalies.push({ type: 'failure_spike', message: `Failure rate is elevated at ${Math.round(failureRate * 100)}%` });
    }

    if (queue.pending > 20) {
      anomalies.push({ type: 'queue_backlog', message: `Queue backlog is high with ${queue.pending} items pending` });
    }

    if (this.metrics.quality_regression_count > 0) {
      anomalies.push({ type: 'evaluation_regression', message: 'An AI evaluation quality regression was detected in this lifecycle.' });
    }

    return anomalies;
  }

  getSummaryReport() {
    const p50 = this.getLatencyPercentile(50);
    const p95 = this.getLatencyPercentile(95);
    const state = this.calculateAIState();
    const queue = this.getQueueSummary();
    const anomalies = this.detectAnomalies();

    return {
      state,
      metrics: { ...this.metrics },
      latency: { p50, p95 },
      averageQuality: this.getAverageQuality(),
      queue,
      anomalies
    };
  }
}

export const aiObservability = new AIObservabilityService();
export default aiObservability;
