import { env } from '../config/env.js';

export class MLServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MLServiceError';
    this.code = code;
  }
}

function isFiniteNumberArray(value) {
  return Array.isArray(value) && value.every((n) => typeof n === 'number' && Number.isFinite(n));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new MLServiceError('TIMEOUT', `ML service request timed out after ${timeoutMs}ms`);
    }
    throw new MLServiceError('UNAVAILABLE', `ML service unreachable: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Thin HTTP client for the Python AI/ML service (Phase 4D). This is the ONLY
 * place in the Node backend that speaks to it directly -- callers (e.g.
 * embedding.service.js) should always go through this client, never `fetch`
 * the service themselves, so the fallback/error-handling story stays in one
 * place.
 */
export class MLServiceClient {
  constructor({ baseUrl = env.mlServiceUrl, timeoutMs = env.mlServiceTimeoutMs } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  async healthCheck() {
    const response = await fetchWithTimeout(`${this.baseUrl}/health`, { method: 'GET' }, this.timeoutMs);
    if (!response.ok) {
      throw new MLServiceError(`HTTP_${response.status}`, `ML service health check failed with status ${response.status}`);
    }
    return this._parseJson(response);
  }

  async embed(text, { model } = {}) {
    const response = await fetchWithTimeout(
      `${this.baseUrl}/v1/embeddings`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model || null, input: text }),
      },
      this.timeoutMs,
    );

    if (response.status === 422) {
      throw new MLServiceError('BAD_REQUEST', 'ML service rejected the embedding request payload');
    }
    if (!response.ok) {
      throw new MLServiceError(`HTTP_${response.status}`, `ML service embeddings request failed with status ${response.status}`);
    }

    const body = await this._parseJson(response);
    if (!isFiniteNumberArray(body.embedding) || typeof body.dimension !== 'number' || !body.model) {
      throw new MLServiceError('BAD_RESPONSE', 'ML service returned a malformed embedding response');
    }
    if (body.embedding.length !== body.dimension) {
      throw new MLServiceError('BAD_RESPONSE', 'ML service embedding length did not match reported dimension');
    }

    return { embedding: body.embedding, dimension: body.dimension, model: body.model };
  }

  async rerank(query, candidates) {
    const response = await fetchWithTimeout(
      `${this.baseUrl}/v1/rerank`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, candidates }),
      },
      this.timeoutMs,
    );

    if (response.status === 422) {
      throw new MLServiceError('BAD_REQUEST', 'ML service rejected the rerank request payload');
    }
    if (!response.ok) {
      throw new MLServiceError(`HTTP_${response.status}`, `ML service rerank request failed with status ${response.status}`);
    }

    const body = await this._parseJson(response);
    if (!Array.isArray(body.results) || !body.model) {
      throw new MLServiceError('BAD_RESPONSE', 'ML service returned a malformed rerank response');
    }
    const validResults = body.results.every(
      (r) => r && typeof r.id === 'string' && typeof r.score === 'number' && Number.isFinite(r.score),
    );
    if (!validResults) {
      throw new MLServiceError('BAD_RESPONSE', 'ML service rerank results were malformed');
    }

    return { results: body.results, model: body.model };
  }

  /**
   * Phase 4F: one-shot MLflow run logging, proxied through the Python
   * service (the only process that actually imports the `mlflow` SDK -- see
   * ai-service/app/tracking/mlflow_client.py). The route itself always
   * returns 200 with a `status` of "logged" or "skipped" -- MLflow being
   * disabled or unreachable is not treated as an HTTP error there, so this
   * method only throws on a genuine ai-service-unreachable/malformed-response
   * case. Callers (ai-evaluate.js, ai-mlflow-benchmark.js) must still wrap
   * this in try/catch and treat any failure as "skip logging, continue" --
   * an experiment-tracking outage must never fail an evaluation run.
   */
  async logExperimentRun({ experiment, params, metrics, tags, artifacts, runName } = {}) {
    const response = await fetchWithTimeout(
      `${this.baseUrl}/v1/tracking/runs`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experiment,
          runName: runName || null,
          params: params || {},
          metrics: metrics || {},
          tags: tags || {},
          artifacts: artifacts || [],
        }),
      },
      this.timeoutMs,
    );

    if (response.status === 422) {
      throw new MLServiceError('BAD_REQUEST', 'ML service rejected the tracking run payload');
    }
    if (!response.ok) {
      throw new MLServiceError(`HTTP_${response.status}`, `ML service tracking run request failed with status ${response.status}`);
    }

    const body = await this._parseJson(response);
    if (typeof body.status !== 'string') {
      throw new MLServiceError('BAD_RESPONSE', 'ML service returned a malformed tracking run response');
    }
    return body;
  }

  async getTrackingStatus() {
    const response = await fetchWithTimeout(`${this.baseUrl}/v1/tracking/status`, { method: 'GET' }, this.timeoutMs);
    if (!response.ok) {
      throw new MLServiceError(`HTTP_${response.status}`, `ML service tracking status request failed with status ${response.status}`);
    }
    return this._parseJson(response);
  }

  async predictOpportunity(features, modelVersion = null) {
    const response = await fetchWithTimeout(
      `${this.baseUrl}/v1/models/opportunity-ranker/predict`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features, modelVersion }),
      },
      this.timeoutMs,
    );

    if (response.status === 422) {
      throw new MLServiceError('BAD_REQUEST', 'ML service rejected the prediction request payload');
    }
    if (!response.ok) {
      const body = await this._parseJson(response).catch(() => ({}));
      throw new MLServiceError(
        body.status || `HTTP_${response.status}`,
        body.reason || `ML service prediction request failed with status ${response.status}`
      );
    }

    const body = await this._parseJson(response);
    if (body.status !== 'scored' || !Array.isArray(body.predictions) || body.predictions.length === 0) {
      throw new MLServiceError(body.status || 'BAD_RESPONSE', body.reason || 'ML service returned an invalid prediction response');
    }

    const pred = body.predictions[0];
    return {
      score: pred.score,
      modelName: pred.modelName,
      modelVersion: pred.modelVersion,
      featureSet: pred.featureSet,
      featureVersion: pred.featureVersion,
      isDevelopmentOnly: pred.isDevelopmentOnly,
      modelRegistryId: pred.modelRegistryId || null,
    };
  }

  async _parseJson(response) {
    try {
      return await response.json();
    } catch (err) {
      throw new MLServiceError('BAD_RESPONSE', `ML service returned invalid JSON: ${err.message}`);
    }
  }
}

export const mlServiceClient = new MLServiceClient();
