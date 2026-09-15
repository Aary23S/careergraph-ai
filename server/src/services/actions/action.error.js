/**
 * Custom error class for Action Validation failures.
 * Isolates domain validation from HTTP layer errors.
 */
export class ActionValidationError extends Error {
  constructor(message, code = 'INVALID_ACTION') {
    super(message);
    this.name = 'ActionValidationError';
    this.code = code;
  }
}
