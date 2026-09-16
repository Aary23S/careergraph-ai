import { env } from '../../config/env.js';
import { AIProvider } from './provider.js';
import { GoogleGenAI } from '@google/genai';

export class GeminiProvider extends AIProvider {
  constructor() {
    super();
    this.apiKey = env.geminiApiKey;
    this.modelName = env.geminiModel || 'gemini-2.5-flash';
    this.isEnabled = env.geminiEnabled;
    
    if (this.isEnabled && this.apiKey) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  async generateStructured(prompt, schema) {
    this._checkEnabled();

    let schemaInstructions = '';
    if (schema && typeof schema.describe === 'function') {
      try {
        const desc = schema.describe();
        const keys = desc.keys || {};
        const template = {};
        Object.entries(keys).forEach(([key, val]) => {
          if (val.type === 'array') {
            template[key] = ['string'];
          } else if (val.type === 'number') {
            template[key] = 0.0;
          } else {
            template[key] = 'string';
          }
        });
        schemaInstructions = `\n\nYou MUST return a JSON object with the following keys and structure:\n${JSON.stringify(template, null, 2)}`;
      } catch {
        // Ignore
      }
    }

    try {
      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: `You are a helpful assistant. You must respond strictly in JSON format matching the schema rules.${schemaInstructions}\n\n${prompt}`,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });
      
      const content = response.text || '{}';
      return JSON.parse(content);
    } catch (err) {
      this._normalizeError(err);
    }
  }

  async generateText(prompt) {
    this._checkEnabled();

    try {
      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          temperature: 0.2
        }
      });
      
      return response.text || '';
    } catch (err) {
      this._normalizeError(err);
    }
  }

  async generateEmbedding(text, model = 'text-embedding-004') {
    this._checkEnabled();
    try {
      let modelId = 'text-embedding-004';
      if (model && (model.includes('text-embedding') || model.includes('gemini'))) {
        modelId = model.replace(/^models\//, '');
      }
      const response = await this.client.models.embedContent({
        model: modelId,
        contents: text
      });
      return response.embedding?.values || response.embedding || [];
    } catch (err) {
      this._normalizeError(err);
    }
  }

  async healthCheck() {
    if (!this.isEnabled || !this.apiKey) return false;
    return true; // Simplified for provider pattern
  }

  _checkEnabled() {
    if (!this.isEnabled) {
      throw new Error('GEMINI_ENABLED is false.');
    }
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in environment.');
    }
  }

  _normalizeError(err) {
    const errorMsg = err.message?.toLowerCase() || '';
    
    // Normalize rate limit errors for AI Service automatic retries
    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('rate limit')) {
      const rateLimitError = new Error(`Rate limit exceeded: ${err.message}`);
      rateLimitError.status = 429;
      throw rateLimitError;
    }
    
    // Authentication errors (do not leak API key)
    if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('api_key') || errorMsg.includes('auth')) {
      throw new Error(`Authentication failed with Gemini API. Check API key configuration.`);
    }

    // Network and timeout errors
    if (errorMsg.includes('timeout') || errorMsg.includes('abort') || errorMsg.includes('network') || errorMsg.includes('fetch')) {
      throw new Error(`Network or timeout error with Gemini API: ${err.message}`);
    }

    // Standard fallback
    throw new Error(`Gemini API error: ${err.message}`);
  }
}
