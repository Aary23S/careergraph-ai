/**
 * Abstract base class for AI model providers
 */
export class AIProvider {
  /**
   * Generates a structured JSON output matching a schema.
   * @param {string} prompt - The text prompt.
   * @param {object} schema - Joi schema or validation rules.
   * @returns {Promise<object>} Parsed JSON result.
   */
  async generateStructured(prompt, schema) {
    throw new Error('Method not implemented: generateStructured');
  }

  /**
   * Generates a plain unstructured text output.
   * @param {string} prompt - The text prompt.
   * @returns {Promise<string>} Plain text result.
   */
  async generateText(prompt) {
    throw new Error('Method not implemented: generateText');
  }

  /**
   * Verifies provider connectivity and capability.
   * @returns {Promise<boolean>} Healthy state flag.
   */
  async healthCheck() {
    throw new Error('Method not implemented: healthCheck');
  }
}
