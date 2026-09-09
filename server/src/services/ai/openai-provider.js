import { env } from '../../config/env.js';
import { AIProvider } from './provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { MockProvider } from './mock-provider.js';

export class OpenAIProvider extends AIProvider {
  constructor() {
    super();
    this.apiKey = env.openaiApiKey;
    this.baseUrl = 'https://api.openai.com/v1';
    this.modelName = env.openaiModel || 'gpt-4o-mini';
    this.ollamaFallback = new OllamaProvider();
    this.mockFallback = new MockProvider();
  }

  async generateStructured(prompt, schema) {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured in environment.');
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
      throw new Error(`OpenAI generation failed with status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    return JSON.parse(content);
  }

  async generateText(prompt) {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured in environment.');
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
      throw new Error(`OpenAI request failed with status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
}
