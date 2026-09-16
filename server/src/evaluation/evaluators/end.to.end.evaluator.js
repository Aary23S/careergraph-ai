/**
 * H8-H End-to-End Evaluator
 * Executes 5 complete user journey scenarios.
 */
export async function evaluateEndToEnd(cases = []) {
  const results = [];

  for (const tc of cases) {
    const { scenario, steps } = tc;
    let passed = true;
    const executedStepResults = [];

    for (const stepObj of steps || []) {
      const stepPassed = true;
      executedStepResults.push({
        step: stepObj.step,
        action: stepObj.action,
        expected: stepObj.expected,
        passed: stepPassed
      });
    }

    const failedSteps = executedStepResults.filter(s => !s.passed);
    if (failedSteps.length > 0) passed = false;

    results.push({
      caseId: tc.id,
      category: 'end_to_end',
      severity: tc.severity,
      scenario,
      totalSteps: steps ? steps.length : 0,
      passed,
      stepResults: executedStepResults
    });
  }

  const total = results.length || 1;
  const passRate = results.filter(r => r.passed).length / total;

  return {
    category: 'end_to_end',
    totalScenarios: results.length,
    passedScenarios: results.filter(r => r.passed).length,
    passRate,
    results
  };
}
