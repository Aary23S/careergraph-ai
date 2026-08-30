import { env } from '../../config/env.js';
import { MockProvider } from './mock-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { GroqProvider } from './groq-provider.js';
import { models } from '../../config/database.js';
import { detectAndSanitizePromptInjection, validateClaims } from './guardrails.service.js';
import { aiObservability } from './observability.service.js';
import { findRegistryMatch } from '../model-registry.service.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retries previously fired back-to-back with zero delay, which is actively
// counterproductive against a rate-limit (429) failure: it burns the whole
// retry budget in milliseconds without ever giving the provider's rate-limit
// window a chance to clear. When the provider's own error message includes a
// "try again in Xs" hint (e.g. Groq's tokens-per-minute limit response), honor
// it directly; otherwise fall back to exponential backoff off AI_JOB_BACKOFF_MS.
function computeRetryDelayMs(err, attempt) {
  const message = err?.message || '';
  const hintMatch = message.match(/try again in\s*([\d.]+)\s*s/i);
  if (hintMatch) {
    return Math.ceil(parseFloat(hintMatch[1]) * 1000) + 250;
  }
  const baseDelayMs = env.aiJobBackoffMs || 1000;
  return baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
}

/**
 * Best-effort, registry-enabled-only lookup so AI audit logs can be traced
 * back to a specific model_registry row (Phase 4E). Never throws: a failed
 * or empty lookup just leaves modelRegistryId/modelVersion null, and the
 * existing provider/promptVersion/schemaVersion fields are unaffected.
 */
async function resolveAuditModelMeta(modelString) {
  if (!env.modelRegistryEnabled) {
    return { modelRegistryId: null, modelVersion: null };
  }
  const match = await findRegistryMatch({ modelType: 'generation', provider: env.aiProvider, modelString });
  return match ? { modelRegistryId: match.id, modelVersion: match.version } : { modelRegistryId: null, modelVersion: null };
}

export class AIService {
  constructor() {
    this.provider = this._resolveProvider();
  }

  _resolveProvider() {
    const providerName = env.aiProvider;
    if (providerName === 'ollama') {
      return new OllamaProvider();
    }
    if (providerName === 'groq') {
      return new GroqProvider();
    }
    return new MockProvider();
  }

  /**
   * Generates structured JSON matching a validation schema with fail-safes.
   * @param {string} prompt - Prompt to pass to the model.
   * @param {object} schema - Joi schema to validate structure.
   * @returns {Promise<object>} Clean validated JSON.
   */
  async generateStructured(prompt, schema, options = {}) {
    if (!env.aiEnabled) {
      throw new Error('AI layer is currently disabled. Toggle AI_ENABLED to true.');
    }

    const op = options.operation || 'generic';
    if (op === 'job_enrichment' && env.aiJobEnrichmentEnabled === false) {
      throw new Error('Job enrichment AI is disabled via feature flag.');
    }
    if (op === 'resume_enrichment' && env.aiResumeEnabled === false) {
      throw new Error('Resume AI is disabled via feature flag.');
    }
    if (op === 'connection_enrichment' && env.aiConnectionEnabled === false) {
      throw new Error('Connection AI is disabled via feature flag.');
    }

    // Shield against prompt injection (3H-12)
    const sanitizedPrompt = detectAndSanitizePromptInjection(prompt);

    // 3I-3: Trace Correlation ID
    const correlationId = options.correlationId || crypto.randomUUID();
    const auditModelMeta = await resolveAuditModelMeta(this.provider.modelName || 'mock');

    let attempt = 0;
    const maxRetries = env.aiMaxRetries || 0;
    const timeoutMs = options.timeoutMs || env.aiTimeoutMs || 15000;

    let lastError = null;
    const start = Date.now();

    while (attempt <= maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // Setup a promise timeout racer
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI request timeout exceeded.')), timeoutMs)
        );

        // Execute generation
        const responseData = await Promise.race([
          this.provider.generateStructured(sanitizedPrompt, schema),
          timeoutPromise
        ]);
        
        clearTimeout(timeoutId);

        // Perform schema validation check if schema exists
        if (schema) {
          if (responseData && typeof responseData === 'object') {
            if (responseData.domainCategories && !responseData.domain) {
              responseData.domain = responseData.domainCategories;
            }
            if (responseData.domain_categories && !responseData.domain) {
              responseData.domain = responseData.domain_categories;
            }
          }

          const { error, value } = schema.validate(responseData, { abortEarly: false, stripUnknown: true });
          if (error) {
            aiObservability.recordRequest({
              success: false,
              invalidOutput: true,
              isRetry: attempt > 0
            });
            throw new Error(`Structured output schema validation failed: ${error.message}`);
          }

          // 3H-4: Hallucination Verification
          if (options.evidenceText) {
            const claimCheck = validateClaims(options.evidenceText, value);
            if (!claimCheck.passed) {
              value.confidence = 0.40; // review status marker
              value.guardrailErrors = claimCheck.errors;
            } else {
              value.confidence = value.confidence || 0.95;
            }
          } else {
            value.confidence = value.confidence || 0.95;
          }

          // 3I-1: Record success telemetry
          const latency = Date.now() - start;
          aiObservability.recordRequest({
            success: true,
            latencyMs: latency,
            qualityScore: value.confidence,
            isRetry: attempt > 0
          });

          // 3H-14: Audit Logging on success
          if (models.AiAuditLog) {
            await models.AiAuditLog.create({
              userId: options.userId || '00000000-0000-0000-0000-000000000000',
              operation: op,
              entityType: options.entityType || null,
              entityId: options.entityId || null,
              provider: env.aiProvider,
              model: this.provider.modelName || 'mock',
              promptVersion: options.promptVersion || 1,
              schemaVersion: options.schemaVersion || 1,
              ...auditModelMeta,
              latencyMs: latency,
              status: 'success',
              evaluationScore: value.confidence,
              correlationId
            }).catch(() => {});
          }

          return value;
        }

        return responseData;
      } catch (err) {
        lastError = err;
        attempt++;
        console.warn(`[AIService] Attempt ${attempt} failed: ${err.message}`);
        if (attempt > maxRetries) {
          break;
        }
        await sleep(computeRetryDelayMs(err, attempt));
      }
    }

    // 3I-1: Record failure telemetry
    const latency = Date.now() - start;
    const isTimeout = lastError?.message?.includes('timeout');
    aiObservability.recordRequest({
      success: false,
      timeout: isTimeout,
      latencyMs: latency,
      isRetry: attempt > 0
    });

    // 3H-14: Audit Logging on failure
    if (models.AiAuditLog) {
      await models.AiAuditLog.create({
        userId: options.userId || '00000000-0000-0000-0000-000000000000',
        operation: op,
        entityType: options.entityType || null,
        entityId: options.entityId || null,
        provider: env.aiProvider,
        model: this.provider.modelName || 'mock',
        promptVersion: options.promptVersion || 1,
        schemaVersion: options.schemaVersion || 1,
        ...auditModelMeta,
        latencyMs: latency,
        status: 'failed',
        evaluationScore: 0.0,
        correlationId
      }).catch(() => {});
    }

    throw new Error(`AI generation pipeline failed after ${attempt} attempts. Last error: ${lastError?.message}`);
  }

  async generateText(prompt, options = {}) {
    if (!env.aiEnabled) {
      throw new Error('AI layer is currently disabled. Toggle AI_ENABLED to true.');
    }

    const op = options.operation || 'generic';
    if (op === 'outreach' && env.aiOutreachEnabled === false) {
      throw new Error('Outreach AI is disabled via feature flag.');
    }

    // Shield against prompt injection (3H-12)
    const sanitizedPrompt = detectAndSanitizePromptInjection(prompt);

    // 3I-3: Trace Correlation ID
    const correlationId = options.correlationId || crypto.randomUUID();
    const auditModelMeta = await resolveAuditModelMeta(this.provider.modelName || 'mock');

    let attempt = 0;
    const maxRetries = env.aiMaxRetries || 0;
    const timeoutMs = options.timeoutMs || env.aiTimeoutMs || 15000;

    let lastError = null;
    const start = Date.now();

    while (attempt <= maxRetries) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI request timeout exceeded.')), timeoutMs)
        );

        const responseData = await Promise.race([
          this.provider.generateText(sanitizedPrompt),
          timeoutPromise
        ]);

        const latency = Date.now() - start;

        // 3I-1: Record success telemetry
        aiObservability.recordRequest({
          success: true,
          latencyMs: latency,
          isRetry: attempt > 0
        });

        // 3H-14: Audit Logging on success
        if (models.AiAuditLog) {
          await models.AiAuditLog.create({
            userId: options.userId || '00000000-0000-0000-0000-000000000000',
            operation: op,
            entityType: options.entityType || null,
            entityId: options.entityId || null,
            provider: env.aiProvider,
            model: this.provider.modelName || 'mock',
            promptVersion: options.promptVersion || 1,
            schemaVersion: options.schemaVersion || 1,
            ...auditModelMeta,
            latencyMs: latency,
            status: 'success',
            evaluationScore: 1.0,
            correlationId
          }).catch(() => {});
        }

        return responseData;
      } catch (err) {
        lastError = err;
        attempt++;
        console.warn(`[AIService] Attempt ${attempt} failed: ${err.message}`);
        if (attempt > maxRetries) {
          break;
        }
        await sleep(computeRetryDelayMs(err, attempt));
      }
    }

    const latency = Date.now() - start;
    const isTimeout = lastError?.message?.includes('timeout');

    // 3I-1: Record failure telemetry
    aiObservability.recordRequest({
      success: false,
      timeout: isTimeout,
      latencyMs: latency,
      isRetry: attempt > 0
    });

    // 3H-14: Audit Logging on failure
    if (models.AiAuditLog) {
      await models.AiAuditLog.create({
        userId: options.userId || '00000000-0000-0000-0000-000000000000',
        operation: op,
        entityType: options.entityType || null,
        entityId: options.entityId || null,
        provider: env.aiProvider,
        model: this.provider.modelName || 'mock',
        promptVersion: options.promptVersion || 1,
        schemaVersion: options.schemaVersion || 1,
        ...auditModelMeta,
        latencyMs: latency,
        status: 'failed',
        evaluationScore: 0.0,
        correlationId
      }).catch(() => {});
    }

    throw new Error(`AI generation pipeline failed after ${attempt} attempts. Last error: ${lastError?.message}`);
  }

  async generateEmbedding(text, model) {
    if (!env.aiEnabled) {
      throw new Error('AI layer is currently disabled. Toggle AI_ENABLED to true.');
    }

    let attempt = 0;
    const maxRetries = env.aiMaxRetries || 0;
    const timeoutMs = env.aiTimeoutMs || 15000;

    let lastError = null;
    const start = Date.now();

    while (attempt <= maxRetries) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI request timeout exceeded.')), timeoutMs)
        );

        const responseData = await Promise.race([
          this.provider.generateEmbedding(text, model),
          timeoutPromise
        ]);

        const latency = Date.now() - start;
        aiObservability.recordEmbedding(latency);

        return responseData;
      } catch (err) {
        lastError = err;
        attempt++;
        console.warn(`[AIService] Embedding Attempt ${attempt} failed: ${err.message}`);
        if (attempt > maxRetries) {
          break;
        }
        await sleep(computeRetryDelayMs(err, attempt));
      }
    }

    throw new Error(`AI embedding pipeline failed after ${attempt} attempts. Last error: ${lastError?.message}`);
  }

  async healthCheck() {
    if (!env.aiEnabled) return false;
    return this.provider.healthCheck();
  }
}

export const aiService = new AIService();
