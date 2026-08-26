import { env } from '../../config/env.js';
import { AIProvider } from './provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { MockProvider } from './mock-provider.js';

export class GroqProvider extends AIProvider {
  constructor() {
    super();
    this.apiKey = env.groqApiKey;
    this.baseUrl = 'https://api.groq.com/openai/v1';
    this.modelName = env.groqModel || 'openai/gpt-oss-120b';
    this.ollamaFallback = new OllamaProvider();
    this.mockFallback = new MockProvider();
  }

  async generateStructured(prompt, schema) {
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY is not configured in environment.');
    }

    const url = `${this.baseUrl}/chat/completions`;

    // Append schema descriptor to instructions
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

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant. You must respond strictly in JSON format matching the schema rules.${schemaInstructions}`
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Groq generation failed with status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    return JSON.parse(content);
  }

  async generateText(prompt) {
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY is not configured in environment.');
    }

    const url = `${this.baseUrl}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Groq request failed with status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async generateEmbedding(text, model) {
    // Groq does not natively provide embedding models.
    // Try to fall back to local Ollama (which runs lightweight nomic-embed-text).
    try {
      const embedding = await this.ollamaFallback.generateEmbedding(text, 'nomic-embed-text');
      return embedding;
    } catch (ollamaErr) {
      console.warn('[GroqProvider] Local Ollama embedding failed, falling back to deterministic mock embedding:', ollamaErr.message);
      // Fall back to 100% offline Javascript-based mock embeddings to ensure search and routing never fail.
      return this.mockFallback.generateEmbedding(text, model);
    }
  }

  async healthCheck() {
    try {
      if (!this.apiKey) return false;
      const url = `${this.baseUrl}/models`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
