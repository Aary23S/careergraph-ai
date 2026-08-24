import { env } from '../../config/env.js';
import { MockProvider } from './mock-provider.js';
import { OllamaProvider } from './ollama-provider.js';

export class AIService {
  constructor() {
    this.provider = this._resolveProvider();
  }

  _resolveProvider() {
    const providerName = env.aiProvider;
    if (providerName === 'ollama') {
      return new OllamaProvider();
    }
    return new MockProvider();
  }

  /**
   * Generates structured JSON matching a validation schema with fail-safes.
   * @param {string} prompt - Prompt to pass to the model.
   * @param {object} schema - Joi schema to validate structure.
   * @returns {Promise<object>} Clean validated JSON.
   */
  async generateStructured(prompt, schema) {
    if (!env.aiEnabled) {
      throw new Error('AI layer is currently disabled. Toggle AI_ENABLED to true.');
    }

    let attempt = 0;
    const maxRetries = env.aiMaxRetries || 0;
    const timeoutMs = env.aiTimeoutMs || 15000;

    let lastError = null;

    while (attempt <= maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // Setup a promise timeout racer
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI request timeout exceeded.')), timeoutMs)
        );

        // Execute generation
        const start = Date.now();
        const responseData = await Promise.race([
          this.provider.generateStructured(prompt, schema),
          timeoutPromise
        ]);
        
        clearTimeout(timeoutId);
        const duration = Date.now() - start;

        // Perform schema validation check if schema exists
        if (schema) {
          const { error, value } = schema.validate(responseData, { abortEarly: false });
          if (error) {
            throw new Error(`Structured output schema validation failed: ${error.message}`);
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
      }
    }

    throw new Error(`AI generation pipeline failed after ${attempt} attempts. Last error: ${lastError?.message}`);
  }

  async healthCheck() {
    if (!env.aiEnabled) return false;
    return this.provider.healthCheck();
  }
}

export const aiService = new AIService();
