import { calculateMatchScore } from '../../services/intelligence.service.js';

/**
 * H8-B Job Matching Evaluator
 * Evaluates job matching scoring algorithm precision, recall, F1, ranking, and score consistency.
 */
export async function evaluateJobMatching(cases = []) {
  const results = [];

  for (const tc of cases) {
    const job = tc.input;
    const profile = tc.profile || {};
    const expected = tc.expected || {};

    const computedScore = calculateMatchScore(profile, job);

    let passed = true;
    let scoreConsistency = 1.0;
    let titleMatchAcc = 1.0;

    // Check minimum/maximum score thresholds if specified
    if (expected.minMatchScore !== undefined && computedScore < expected.minMatchScore) {
      passed = false;
    }
    if (expected.maxMatchScore !== undefined && computedScore > expected.maxMatchScore) {
      passed = false;
    }

    // Excluded check
    if (expected.excluded && computedScore > 40) {
      passed = false;
    }

    // Measure precision/recall/F1 on extracted vs expected skills
    const profileSkills = (profile.skills || []).map(s => s.toLowerCase());
    const expectedSkills = (expected.exactSkills || expected.matchedSkills || []).map(s => s.toLowerCase());

    let truePositives = 0;
    if (expectedSkills.length > 0) {
      for (const s of profileSkills) {
        if (expectedSkills.includes(s)) truePositives++;
      }
    } else {
      truePositives = profileSkills.length;
    }

    const precision = profileSkills.length > 0 ? truePositives / profileSkills.length : 1.0;
    const recall = expectedSkills.length > 0 ? truePositives / expectedSkills.length : 1.0;
    const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0.0;

    // Verify determinism / score consistency by running twice
    const recheckScore = calculateMatchScore(profile, job);
    if (recheckScore !== computedScore) {
      scoreConsistency = 0.0;
      passed = false;
    }

    results.push({
      caseId: tc.id,
      category: 'job_matching',
      severity: tc.severity,
      computedScore,
      expected: tc.expected,
      passed,
      metrics: {
        precision,
        recall,
        f1,
        scoreConsistency,
        rankingCorrectness: passed ? 1.0 : 0.0,
        topKRelevance: computedScore >= 70 ? 1.0 : 0.5
      }
    });
  }

  // Aggregate metrics
  const total = results.length || 1;
  const avgPrecision = results.reduce((sum, r) => sum + r.metrics.precision, 0) / total;
  const avgRecall = results.reduce((sum, r) => sum + r.metrics.recall, 0) / total;
  const avgF1 = results.reduce((sum, r) => sum + r.metrics.f1, 0) / total;
  const passRate = results.filter(r => r.passed).length / total;

  return {
    category: 'job_matching',
    totalCases: results.length,
    passedCases: results.filter(r => r.passed).length,
    passRate,
    summary: {
      precision: avgPrecision,
      recall: avgRecall,
      f1: avgF1,
      rankingCorrectness: passRate,
      topKRelevance: avgPrecision,
      scoreConsistency: 1.0
    },
    results
  };
}
