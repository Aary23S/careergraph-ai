/**
 * Standard Grounding Contract & Response Formatter for Copilot
 */

export const GroundingStatuses = {
  GROUNDED: 'grounded',
  PARTIAL: 'partial',
  CLARIFICATION_REQUIRED: 'clarification_required',
  NO_DATA: 'no_data',
  DRAFT: 'draft',
  UNAVAILABLE: 'unavailable'
};

export class GroundingContract {
  /**
   * Builds a standardized grounded response contract.
   * 
   * @param {Object} params
   * @param {string} params.answerType
   * @param {string} params.message
   * @param {Object} params.data
   * @param {Array<Object>} [params.references]
   * @param {string} [params.status]
   * @param {number} [params.sourceCount]
   * @param {boolean} [params.fallbackUsed]
   * @param {number} [params.confidence]
   * @param {Array<Object>} [params.nextActions]
   * @param {Object} [params.suggestedPrompts]
   * @returns {Object} Grounded response object
   */
  static format({
    answerType = 'general',
    message = '',
    data = {},
    references = [],
    status = GroundingStatuses.GROUNDED,
    sourceCount = 0,
    fallbackUsed = false,
    confidence = 1.0,
    nextActions = [],
    suggestedPrompts = ['What should I focus on today?']
  }) {
    return {
      answerType,
      message,
      data,
      references: references.map(ref => ({
        type: ref.type || 'record',
        id: ref.id || 'system',
        fields: ref.fields || ['name', 'company', 'title']
      })),
      grounding: {
        status,
        sourceCount: typeof sourceCount === 'number' ? sourceCount : references.length,
        fallbackUsed: Boolean(fallbackUsed)
      },
      confidence,
      nextActions,
      suggestedPrompts
    };
  }
}
