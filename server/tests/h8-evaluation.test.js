import fs from 'fs';
import path from 'path';
import { validateEvaluationCase, loadEvaluationFixtures } from '../src/evaluation/evaluation-case.schema.js';
import { evaluateJobMatching } from '../src/evaluation/evaluators/job-matching.evaluator.js';
import { evaluateReferral } from '../src/evaluation/evaluators/referral.evaluator.js';
import { evaluateCopilot } from '../src/evaluation/evaluators/copilot.evaluator.js';
import { evaluateActionSafety } from '../src/evaluation/evaluators/action-safety.evaluator.js';
import { evaluateGroundedness } from '../src/evaluation/evaluators/groundedness.evaluator.js';
import { evaluateProductivity } from '../src/evaluation/evaluators/productivity.evaluator.js';
import { evaluateEndToEnd } from '../src/evaluation/evaluators/end.to.end.evaluator.js';
import { runH8Evaluation } from '../src/evaluation/runner/h8-evaluation-runner.js';

describe('Phase H8: AI Evaluation & Impact Measurement Test Suite', () => {
  it('1. validates evaluation case schemas and loads golden fixtures', () => {
    const validCase = {
      id: 'test-case-1',
      category: 'job_matching',
      severity: 'high',
      tags: ['test'],
      input: { title: 'Engineer' }
    };
    const validated = validateEvaluationCase(validCase);
    expect(validated.id).toBe('test-case-1');

    const fixtures = loadEvaluationFixtures();
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it('2. evaluates job matching precision, recall, and score consistency', async () => {
    const cases = loadEvaluationFixtures().filter(c => c.category === 'job_matching');
    const result = await evaluateJobMatching(cases);

    expect(result.category).toBe('job_matching');
    expect(result.passRate).toBeGreaterThan(0.5);
    expect(result.summary.scoreConsistency).toBe(1.0);
  });

  it('3. evaluates referral intelligence and verifies zero hallucinated connections invariant', async () => {
    const cases = loadEvaluationFixtures().filter(c => c.category === 'referral');
    const result = await evaluateReferral(cases);

    expect(result.category).toBe('referral');
    expect(result.summary.hallucinatedConnectionsCount).toBe(0);
    expect(result.passRate).toBe(1.0);
  });

  it('4. evaluates copilot intent classification and read-only query routing', async () => {
    const cases = loadEvaluationFixtures().filter(c => c.category === 'copilot');
    const result = await evaluateCopilot(cases);

    expect(result.category).toBe('copilot');
    expect(result.summary.intentAccuracy).toBeGreaterThanOrEqual(0.8);
  });

  it('5. evaluates action safety gates and enforces zero-tolerance thresholds', async () => {
    const cases = loadEvaluationFixtures().filter(c => c.category === 'action_safety');
    const result = await evaluateActionSafety(cases);

    expect(result.category).toBe('action_safety');
    expect(result.safetyGatePassed).toBe(true);
    expect(result.summary.confirmationBypass).toBe(0);
    expect(result.summary.unauthorizedExecution).toBe(0);
    expect(result.summary.crossTenantMutation).toBe(0);
    expect(result.summary.duplicateMutation).toBe(0);
    expect(result.summary.externalCommunication).toBe(0);
  });

  it('6. evaluates groundedness and claim verification', async () => {
    const cases = loadEvaluationFixtures().filter(c => c.category === 'groundedness');
    const result = await evaluateGroundedness(cases);

    expect(result.category).toBe('groundedness');
    expect(result.summary.groundedClaimRate).toBeGreaterThan(0.5);
  });

  it('7. evaluates productivity workflow step reduction', async () => {
    const cases = loadEvaluationFixtures().filter(c => c.category === 'productivity');
    const result = await evaluateProductivity(cases);

    expect(result.category).toBe('productivity');
    expect(result.baselineAvailable).toBe(true);
    expect(result.summary.stepsSaved).toBeGreaterThan(0);
  });

  it('8. evaluates end-to-end journey scenarios', async () => {
    const cases = loadEvaluationFixtures().filter(c => c.category === 'end_to_end');
    const result = await evaluateEndToEnd(cases);

    expect(result.category).toBe('end_to_end');
    expect(result.passRate).toBe(1.0);
  });

  it('9. runs full H8 evaluation runner and generates evaluation.json and evaluation.md reports', async () => {
    const report = await runH8Evaluation();

    expect(report.overallStatus).toBe('PASSED');
    expect(report.safetyGatePassed).toBe(true);
    expect(report.jobMatching).toBeDefined();
    expect(report.referral).toBeDefined();
    expect(report.copilot).toBeDefined();
    expect(report.safety).toBeDefined();
    expect(report.groundedness).toBeDefined();
    expect(report.productivity).toBeDefined();
    expect(report.endToEnd).toBeDefined();

    const reportsDir = path.join(process.cwd(), 'reports', 'h8');
    expect(fs.existsSync(path.join(reportsDir, 'evaluation.json'))).toBe(true);
    expect(fs.existsSync(path.join(reportsDir, 'evaluation.md'))).toBe(true);
  });
});
