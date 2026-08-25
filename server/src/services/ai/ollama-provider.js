import { env } from '../../config/env.js';
import { AIProvider } from './provider.js';

export class OllamaProvider extends AIProvider {
  constructor() {
    super();
    this.baseUrl = env.ollamaBaseUrl;
    this.modelName = env.ollamaModel;
  }

  async generateStructured(prompt, schema) {
    const url = `${this.baseUrl}/api/generate`;
    
    let schemaTemplateStr = '';
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
        schemaTemplateStr = `\n\nYou MUST return a JSON object with the following keys and structure:\n${JSON.stringify(template, null, 2)}`;
      } catch (err) {
        // fallback if schema describe fails
      }
    }

    const jsonPrompt = `${prompt}${schemaTemplateStr}\n\nDo not include markdown wraps or code block syntax. Respond with raw JSON only.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.modelName,
        prompt: jsonPrompt,
        format: 'json',
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama generation request failed with status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.response) {
      throw new Error('Invalid or empty response field returned from Ollama API.');
    }

    try {
      return JSON.parse(data.response);
    } catch (err) {
      throw new Error(`Failed to parse structured JSON response from Ollama: ${err.message}\nRaw response: ${data.response}`);
    }
  }

  async generateText(prompt) {
    const url = `${this.baseUrl}/api/generate`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.modelName,
        prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama generation request failed with status: ${response.status}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
