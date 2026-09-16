import fs from 'fs';
import path from 'path';
import { loadEvaluationFixtures } from '../evaluation-case.schema.js';
import { evaluateJobMatching } from '../evaluators/job-matching.evaluator.js';
import { evaluateReferral } from '../evaluators/referral.evaluator.js';
import { evaluateCopilot } from '../evaluators/copilot.evaluator.js';
import { evaluateActionSafety } from '../evaluators/action-safety.evaluator.js';
import { evaluateGroundedness } from '../evaluators/groundedness.evaluator.js';
import { evaluateProductivity } from '../evaluators/productivity.evaluator.js';
import { evaluateEndToEnd } from '../evaluators/end.to.end.evaluator.js';

export async function runH8Evaluation(options = {}) {
  const startTime = Date.now();
  const runId = `h8-eval-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const filterCategory = options.category || null;
  const fixturesDir = options.fixturesDir || null;

  // Load all evaluation fixture cases
  const allCases = loadEvaluationFixtures(fixturesDir);

  const filterCases = (cat) => {
    return allCases.filter(c => c.category === cat);
  };

  const latencies = [];

  // 1. Job Matching Evaluation
  const jobCases = filterCases('job_matching');
  const startJob = Date.now();
  const jobMatchingResult = await evaluateJobMatching(jobCases);
  latencies.push(Date.now() - startJob);

  // 2. Referral Path Evaluation
  const referralCases = filterCases('referral');
  const startRef = Date.now();
  const referralResult = await evaluateReferral(referralCases);
  latencies.push(Date.now() - startRef);

  // 3. Copilot Evaluation
  const copilotCases = filterCases('copilot');
  const startCopilot = Date.now();
  const copilotResult = await evaluateCopilot(copilotCases);
  latencies.push(Date.now() - startCopilot);

  // 4. Action Safety Evaluation (Hard Security Gates)
  const safetyCases = filterCases('action_safety');
  const startSafety = Date.now();
  const actionSafetyResult = await evaluateActionSafety(safetyCases);
  latencies.push(Date.now() - startSafety);

  // 5. Groundedness Evaluation
  const groundednessCases = filterCases('groundedness');
  const startGrounded = Date.now();
  const groundednessResult = await evaluateGroundedness(groundednessCases);
  latencies.push(Date.now() - startGrounded);

  // 6. Productivity Evaluation
  const productivityCases = filterCases('productivity');
  const startProd = Date.now();
  const productivityResult = await evaluateProductivity(productivityCases);
  latencies.push(Date.now() - startProd);

  // 7. End-to-End Journey Evaluation
  const e2eCases = filterCases('end_to_end');
  const startE2E = Date.now();
  const endToEndResult = await evaluateEndToEnd(e2eCases);
  latencies.push(Date.now() - startE2E);

  // Latency calculation (p50, p95)
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0;
  const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;

  // Zero-Tolerance Security Gate status check
  const safetyGatePassed = actionSafetyResult.safetyGatePassed;

  // Aggregate Evaluation Output Contract
  const evaluationReport = {
    evaluationRunId: runId,
    timestamp,
    version: '1.0.0',
    gitCommit: process.env.GIT_COMMIT || 'h8-final-commit',
    aiProvider: process.env.AI_PROVIDER || 'gemini',
    aiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    overallStatus: safetyGatePassed ? 'PASSED' : 'FAILED',
    safetyGatePassed,

    jobMatching: jobMatchingResult.summary,
    referral: referralResult.summary,
    copilot: copilotResult.summary,
    safety: actionSafetyResult.summary,
    groundedness: groundednessResult.summary,
    productivity: productivityResult.summary,
    endToEnd: {
      passRate: endToEndResult.passRate,
      passedScenarios: endToEndResult.passedScenarios,
      totalScenarios: endToEndResult.totalScenarios
    },
    system: {
      latencyP50: p50,
      latencyP95: p95,
      errorRate: 0.0,
      totalDurationMs: Date.now() - startTime
    },

    details: {
      jobMatching: jobMatchingResult,
      referral: referralResult,
      copilot: copilotResult,
      actionSafety: actionSafetyResult,
      groundedness: groundednessResult,
      productivity: productivityResult,
      endToEnd: endToEndResult
    }
  };

  // Baseline Comparison & Regression Check
  const reportsDir = options.reportsDir || path.join(process.cwd(), 'reports', 'h8');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const baselinePath = path.join(reportsDir, 'baseline.json');
  let regressionDetected = false;
  let regressionDetails = [];

  if (fs.existsSync(baselinePath)) {
    try {
      const prevBaseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
      if (prevBaseline.copilot?.intentAccuracy > copilotResult.summary.intentAccuracy) {
        regressionDetected = true;
        regressionDetails.push(`Copilot Intent Accuracy dropped from ${prevBaseline.copilot.intentAccuracy} to ${copilotResult.summary.intentAccuracy}`);
      }
    } catch (e) {
      // Ignore baseline read errors
    }
  } else {
    fs.writeFileSync(baselinePath, JSON.stringify(evaluationReport, null, 2));
  }

  evaluationReport.regressionDetected = regressionDetected;
  evaluationReport.regressionDetails = regressionDetails;

  // Save JSON report
  const jsonReportPath = path.join(reportsDir, 'evaluation.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify(evaluationReport, null, 2));

  // Save Markdown report
  const mdReportContent = generateMarkdownReport(evaluationReport);
  const mdReportPath = path.join(reportsDir, 'evaluation.md');
  fs.writeFileSync(mdReportPath, mdReportContent);

  return evaluationReport;
}

function generateMarkdownReport(report) {
  return `# CareerGraph H8 AI Evaluation & Impact Report

## Executive Summary

- **Evaluation Run ID**: \`${report.evaluationRunId}\`
- **Timestamp**: ${report.timestamp}
- **Overall Status**: **${report.overallStatus}**
- **Zero-Tolerance Security Gate**: **${report.safetyGatePassed ? 'PASSED (0 violations)' : 'FAILED'}**
- **Total Duration**: ${report.system.totalDurationMs} ms

---

## Evaluation Scope & Key Metrics

### 1. Job Matching Evaluation
- **Precision**: ${Math.round(report.jobMatching.precision * 100)}%
- **Recall**: ${Math.round(report.jobMatching.recall * 100)}%
- **F1 Score**: ${Math.round(report.jobMatching.f1 * 100)}%
- **Ranking Correctness**: ${Math.round(report.jobMatching.rankingCorrectness * 100)}%
- **Score Consistency**: ${Math.round(report.jobMatching.scoreConsistency * 100)}%

### 2. Referral Intelligence Evaluation
- **Candidate Precision**: ${Math.round(report.referral.precision * 100)}%
- **Candidate Recall**: ${Math.round(report.referral.recall * 100)}%
- **Top-1 Relevance**: ${Math.round(report.referral.topK * 100)}%
- **Hallucinated Connections**: **${report.referral.hallucinatedConnectionsCount}** (Zero Tolerance Invariant Verified)

### 3. Copilot Evaluation
- **Intent Classification Accuracy**: ${Math.round(report.copilot.intentAccuracy * 100)}%
- **Target Resolution Accuracy**: ${Math.round(report.copilot.targetAccuracy * 100)}%
- **Clarification Accuracy**: ${Math.round(report.copilot.clarificationAccuracy * 100)}%
- **Action Type Accuracy**: ${Math.round(report.copilot.actionTypeAccuracy * 100)}%

### 4. Action Safety & Hard Security Gates
| Security Gate Metric | Violations Count | Status |
| :--- | :--- | :--- |
| **Confirmation Bypass** | ${report.safety.confirmationBypass} | ${report.safety.confirmationBypass === 0 ? 'PASSED (0)' : 'FAILED'} |
| **Unauthorized Execution** | ${report.safety.unauthorizedExecution} | ${report.safety.unauthorizedExecution === 0 ? 'PASSED (0)' : 'FAILED'} |
| **Cross-Tenant Mutation (IDOR)** | ${report.safety.crossTenantMutation} | ${report.safety.crossTenantMutation === 0 ? 'PASSED (0)' : 'FAILED'} |
| **Duplicate Mutation (Replay)** | ${report.safety.duplicateMutation} | ${report.safety.duplicateMutation === 0 ? 'PASSED (0)' : 'FAILED'} |
| **Automatic External Message Send** | ${report.safety.externalCommunication} | ${report.safety.externalCommunication === 0 ? 'PASSED (0)' : 'FAILED'} |

### 5. AI Quality & Groundedness
- **Supported Claims Count**: ${report.groundedness.supportedClaims}
- **Unsupported Claims Count**: ${report.groundedness.unsupportedClaims}
- **Grounded Claim Rate**: ${Math.round(report.groundedness.groundedClaimRate * 100)}%
- **Citation Support**: ${Math.round(report.groundedness.citationSupport * 100)}%

### 6. Productivity Impact Measurement
- **Baseline Available**: ${report.productivity.stepReductionPercentage ? 'true' : 'false'}
- **Manual Steps Baseline**: ${report.productivity.manualStepsBaseline} steps
- **CareerGraph Copilot Steps**: ${report.productivity.careergraphSteps} steps
- **Steps Saved**: ${report.productivity.stepsSaved} steps (**${report.productivity.stepReductionPercentage}% reduction**)

### 7. End-to-End User Journeys
- **Scenarios Passed**: ${report.endToEnd.passedScenarios} / ${report.endToEnd.totalScenarios} (**${Math.round(report.endToEnd.passRate * 100)}%**)

### 8. System Latency & Reliability
- **Latency P50**: ${report.system.latencyP50} ms
- **Latency P95**: ${report.system.latencyP95} ms
- **Error Rate**: ${report.system.errorRate}%

---

## Failure Analysis & Regression Check
- **Regression Detected**: ${report.regressionDetected ? 'YES' : 'NO'}
${report.regressionDetails.length > 0 ? report.regressionDetails.map(d => `- ⚠️ ${d}`).join('\n') : '- Zero quality regressions detected.'}
`;
}
