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
    
    // Explicit instructions to model for JSON output format
    const jsonPrompt = `${prompt}\n\nYou MUST respond with a valid JSON object matching the requested schema. Do not include markdown wraps or code block syntax.`;

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
    } catch (e) {
      return false;
    }
  }
}
