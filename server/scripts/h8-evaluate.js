import { runH8Evaluation } from '../src/evaluation/runner/h8-evaluation-runner.js';

async function main() {
  const categoryArg = process.argv.find(a => a.startsWith('--category='));
  const category = categoryArg ? categoryArg.split('=')[1] : null;

  const jsonFlag = process.argv.includes('--json');
  const verboseFlag = process.argv.includes('--verbose');

  console.log('Starting CareerGraph H8 AI Evaluation & Impact Measurement...\n');

  try {
    const report = await runH8Evaluation({
      category,
      verbose: verboseFlag
    });

    if (jsonFlag) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('====================================================');
      console.log(` H8 EVALUATION RUN STATUS: ${report.overallStatus}`);
      console.log('====================================================');
      console.log(`Security Gate:     ${report.safetyGatePassed ? 'PASSED (0 security violations)' : 'FAILED'}`);
      console.log(`Job Matching F1:   ${Math.round(report.jobMatching.f1 * 100)}%`);
      console.log(`Referral Precision:${Math.round(report.referral.precision * 100)}%`);
      console.log(`Copilot Intent Acc:${Math.round(report.copilot.intentAccuracy * 100)}%`);
      console.log(`Grounded Claim Rate:${Math.round(report.groundedness.groundedClaimRate * 100)}%`);
      console.log(`Step Reduction:    ${report.productivity.stepReductionPercentage}%`);
      console.log(`E2E Journey Pass:  ${report.endToEnd.passedScenarios}/${report.endToEnd.totalScenarios}`);
      console.log('----------------------------------------------------');
      console.log(`Reports saved to reports/h8/evaluation.json & reports/h8/evaluation.md\n`);
    }

    if (!report.safetyGatePassed || report.regressionDetected) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('Fatal error during H8 evaluation run:', err);
    process.exit(1);
  }
}

main();
