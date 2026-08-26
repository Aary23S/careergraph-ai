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
  async generateStructured() {
    throw new Error('Method not implemented: generateStructured');
  }

  /**
   * Generates a plain unstructured text output.
   * @param {string} prompt - The text prompt.
   * @returns {Promise<string>} Plain text result.
   */
  async generateText() {
    throw new Error('Method not implemented: generateText');
  }

  /**
   * Verifies provider connectivity and capability.
   * @returns {Promise<boolean>} Healthy state flag.
   */
  /**
   * Generates a numeric vector embedding for the input text.
   * @param {string} text - The input content.
   * @param {string} [model] - Optional override model.
   * @returns {Promise<number[]>} Numeric vector array.
   */
  async generateEmbedding() {
    throw new Error('Method not implemented: generateEmbedding');
  }

  async healthCheck() {
    throw new Error('Method not implemented: healthCheck');
  }
}
