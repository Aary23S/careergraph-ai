/**
 * H8-C Referral Path Evaluator
 * Evaluates H3 Referral Intelligence.
 * Verifies candidate identification, company matching, ranking, and zero hallucinated connection invariant.
 */
export async function evaluateReferral(cases = []) {
  const results = [];

  for (const tc of cases) {
    const { targetJob, userNetwork } = tc.input;
    const expected = tc.expected || {};

    const targetCompanyLower = (targetJob.normalizedCompany || targetJob.company || '').toLowerCase();
    const candidateMatches = userNetwork.filter(c => {
      const connComp = (c.normalizedCompany || c.company || '').toLowerCase();
      return connComp && (connComp.includes(targetCompanyLower) || targetCompanyLower.includes(connComp));
    });

    const candidateIds = candidateMatches.map(c => c.id);
    const expectedIds = expected.matchingConnectionIds || [];

    // Zero Hallucinations check: assert no candidate is returned that doesn't exist in userNetwork
    const networkIds = new Set(userNetwork.map(c => c.id));
    const invalidIds = candidateIds.filter(id => !networkIds.has(id));
    const hallucinatedCount = invalidIds.length;

    let passed = hallucinatedCount === 0;

    // Precision & Recall on expected connection IDs
    let truePositives = 0;
    for (const id of candidateIds) {
      if (expectedIds.includes(id)) truePositives++;
    }

    const precision = candidateIds.length > 0 ? truePositives / candidateIds.length : (expectedIds.length === 0 ? 1.0 : 0.0);
    const recall = expectedIds.length > 0 ? truePositives / expectedIds.length : 1.0;

    if (expectedIds.length > 0 && recall < 1.0) {
      passed = false;
    }

    // Top-1 candidate ranking check
    let topRankedMatch = true;
    if (expected.topRankedId && candidateIds.length > 0) {
      topRankedMatch = candidateIds[0] === expected.topRankedId;
      if (!topRankedMatch) passed = false;
    }

    results.push({
      caseId: tc.id,
      category: 'referral',
      severity: tc.severity,
      candidateIds,
      expectedIds,
      hallucinatedCount,
      passed,
      metrics: {
        candidatePrecision: precision,
        candidateRecall: recall,
        topKRelevance: topRankedMatch ? 1.0 : 0.5,
        pathCorrectness: passed ? 1.0 : 0.0,
        hallucinatedConnections: hallucinatedCount
      }
    });
  }

  const total = results.length || 1;
  const avgPrecision = results.reduce((sum, r) => sum + r.metrics.candidatePrecision, 0) / total;
  const avgRecall = results.reduce((sum, r) => sum + r.metrics.candidateRecall, 0) / total;
  const avgTopK = results.reduce((sum, r) => sum + r.metrics.topKRelevance, 0) / total;
  const passRate = results.filter(r => r.passed).length / total;

  return {
    category: 'referral',
    totalCases: results.length,
    passedCases: results.filter(r => r.passed).length,
    passRate,
    summary: {
      precision: avgPrecision,
      recall: avgRecall,
      topK: avgTopK,
      pathCorrectness: passRate,
      hallucinatedConnectionsCount: results.reduce((sum, r) => sum + r.metrics.hallucinatedConnections, 0)
    },
    results
  };
}
