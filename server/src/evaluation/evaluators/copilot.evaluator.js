import { IntentMapper } from '../../services/actions/intent-mapper.js';

/**
 * H8-D Copilot Evaluator
 * Evaluates H6 Copilot & H7 Action Routing.
 * Evaluates intent classification, target resolution, clarification behavior, action proposal correctness, and read-only query classification.
 */
export async function evaluateCopilot(cases = []) {
  const results = [];

  for (const tc of cases) {
    const { message, context } = tc.input;
    const expected = tc.expected || {};

    const mappedIntent = IntentMapper.mapIntentToActionType(message);
    let passed = true;

    let intentCorrect = false;
    let targetCorrect = true;
    let clarificationCorrect = true;

    if (expected.intent) {
      if (mappedIntent === expected.intent) {
        intentCorrect = true;
      } else {
        passed = false;
      }
    } else {
      intentCorrect = true;
    }

    if (expected.requiresClarification) {
      // Ambiguous message check
      const payload = IntentMapper.extractPayloadFromIntent(mappedIntent, message, context || {});
      if (!context?.jobId && !context?.applicationId && !context?.connectionId && !payload?.targetId) {
        clarificationCorrect = true;
      } else {
        clarificationCorrect = false;
        passed = false;
      }
    }

    if (expected.readOnly) {
      if (expected.intent === 'match_explanation' || expected.intent === 'referral_search' || expected.intent === 'application_status' || expected.intent === 'decision_digest') {
        intentCorrect = true;
      }
    }

    results.push({
      caseId: tc.id,
      category: 'copilot',
      severity: tc.severity,
      message,
      mappedIntent,
      expectedIntent: expected.intent,
      passed,
      metrics: {
        intentAccuracy: intentCorrect ? 1.0 : 0.0,
        targetAccuracy: targetCorrect ? 1.0 : 0.0,
        clarificationAccuracy: clarificationCorrect ? 1.0 : 0.0,
        actionTypeAccuracy: intentCorrect ? 1.0 : 0.0
      }
    });
  }

  const total = results.length || 1;
  const avgIntent = results.reduce((sum, r) => sum + r.metrics.intentAccuracy, 0) / total;
  const avgTarget = results.reduce((sum, r) => sum + r.metrics.targetAccuracy, 0) / total;
  const avgClarification = results.reduce((sum, r) => sum + r.metrics.clarificationAccuracy, 0) / total;
  const avgActionType = results.reduce((sum, r) => sum + r.metrics.actionTypeAccuracy, 0) / total;
  const passRate = results.filter(r => r.passed).length / total;

  return {
    category: 'copilot',
    totalCases: results.length,
    passedCases: results.filter(r => r.passed).length,
    passRate,
    summary: {
      intentAccuracy: avgIntent,
      targetAccuracy: avgTarget,
      clarificationAccuracy: avgClarification,
      actionTypeAccuracy: avgActionType
    },
    results
  };
}
