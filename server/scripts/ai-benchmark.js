import fs from 'fs';
import path from 'path';
import Joi from 'joi';
import { env } from '../src/config/env.js';
import { aiService } from '../src/services/ai/ai.service.js';
import { connectDatabase, sequelize } from '../src/config/database.js';
import { findRegistryMatch, recordEvaluation } from '../src/services/model-registry.service.js';

// Define the structured schema target
const schema = Joi.object({
  role: Joi.string().required(),
  seniority: Joi.string().required(),
  skills: Joi.array().items(Joi.string()).required(),
  confidence: Joi.any().optional()
});

// Configure cases with expected evaluation attributes
const testCases = [
  {
    fileName: 'job-01.txt',
    expected: {
      role: 'Backend Engineer',
      seniority: 'Senior',
      skills: ['Ruby', 'Go', 'PostgreSQL', 'Docker']
    }
  },
  {
    fileName: 'job-02.txt',
    expected: {
      role: 'Staff Software Engineer',
      seniority: 'Staff',
      skills: ['JavaScript', 'NodeJS', 'Express', 'AWS Serverless']
    }
  },
  {
    fileName: 'job-03.txt',
    expected: {
      role: 'Competitive Programmer',
      seniority: 'Junior',
      skills: ['React', 'TailwindCSS', 'JavaScript', 'CSS', 'HTML']
    }
  },
  {
    fileName: 'job-04.txt',
    expected: {
      role: 'Python Script Helper',
      seniority: 'Junior',
      skills: ['Python']
    }
  },
  {
    fileName: 'job-05.txt',
    expected: {
      role: 'Fintech Lead',
      seniority: 'Lead',
      skills: []
    }
  }
];

// Helper to grade model extraction quality on a 1-10 scale
function evaluateExtraction(output, expected) {
  let score = 0;

  // 1. Role similarity (simple check)
  const outRole = (output.role || '').toLowerCase();
  const expRole = expected.role.toLowerCase();
  if (outRole === expRole) score += 3;
  else if (outRole.includes(expRole.split(' ')[0]) || expRole.includes(outRole.split(' ')[0])) score += 2;
  else if (outRole.length > 0) score += 1;

  // 2. Seniority similarity
  const outSeniority = (output.seniority || '').toLowerCase();
  const expSeniority = expected.seniority.toLowerCase();
  if (outSeniority === expSeniority) score += 3;
  else if (outSeniority.includes(expSeniority) || expSeniority.includes(outSeniority)) score += 2;
  else if (outSeniority.length > 0) score += 1;

  // 3. Skills recall
  const outSkills = (output.skills || []).map(s => s.toLowerCase());
  const expSkills = expected.skills.map(s => s.toLowerCase());

  if (expSkills.length === 0) {
    if (outSkills.length === 0) score += 4;
    else score += Math.max(0, 4 - outSkills.length);
  } else {
    let matched = 0;
    for (const expSkill of expSkills) {
      if (outSkills.some(os => os.includes(expSkill) || expSkill.includes(os))) {
        matched++;
      }
    }
    score += Math.round((matched / expSkills.length) * 4);
  }

  return score;
}

async function recordBenchmarkEvaluation(modelString, report) {
  try {
    const match = await findRegistryMatch({ modelType: 'generation', provider: 'ollama', modelString });
    if (!match) return;
    const gradeMatch = /^([\d.]+)/.exec(report.avgExtractionGrade || '');
    const overallScore = gradeMatch ? Number(gradeMatch[1]) / 10 : null;
    const status = report.failures === 0 && report.timeouts === 0 ? 'passed' : 'failed';
    await recordEvaluation(match.id, {
      evaluationType: 'generation_benchmark',
      metrics: report,
      overallScore,
      status,
    });
    console.log(`  Recorded generation_benchmark evaluation against registry model ${match.id}.`);
  } catch (err) {
    console.warn(`  Skipped recording registry evaluation for ${modelString}: ${err.message}`);
  }
}

async function runBenchmark() {
  await connectDatabase();
  const models = ['qwen2.5-coder:7b', 'mistral:latest'];
  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures', 'ai');

  // Hardcode force AI mode for benchmarking
  env.aiEnabled = true;
  env.aiProvider = 'ollama';
  env.aiTimeoutMs = 60000;
  env.aiMaxRetries = 0;

  console.log('==================================================');
  console.log(' STARTING CAREERGRAPH AI MODEL BENCHMARK RUNNER');
  console.log('==================================================\n');

  const finalReports = [];

  for (const model of models) {
    console.log(`Evaluating Model: ${model}...`);
    env.ollamaModel = model;

    // Re-resolve provider to update selected model
    aiService.provider = aiService._resolveProvider();

    const latencies = [];
    let successCount = 0;
    let totalScore = 0;
    let jsonValidCount = 0;
    let timeoutCount = 0;
    let failureCount = 0;

    for (const testCase of testCases) {
      const filePath = path.join(fixturesDir, testCase.fileName);
      const fileContent = fs.readFileSync(filePath, 'utf8');

      const prompt = `Analyze the following job post:\n\n${fileContent}\n\nExtract structural fields matching: role, seniority, skills, and confidence.`;

      const start = Date.now();
      try {
        const res = await aiService.generateStructured(prompt, schema);
        const latency = Date.now() - start;
        latencies.push(latency);

        successCount++;
        jsonValidCount++; // Joi validation passed

        const score = evaluateExtraction(res, testCase.expected);
        totalScore += score;

        console.log(`  ✅ Case ${testCase.fileName} finished in ${(latency / 1000).toFixed(2)}s | Grade: ${score}/10`);
      } catch (err) {
        const latency = Date.now() - start;
        latencies.push(latency);

        if (err.message.includes('timeout')) {
          timeoutCount++;
        } else {
          failureCount++;
        }
        console.log(`  ❌ Case ${testCase.fileName} failed after ${(latency / 1000).toFixed(2)}s | Error: ${err.message}`);
      }
    }

    // Compute metrics
    latencies.sort((a, b) => a - b);
    const avgLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length || 0;
    const medianLatency = latencies[Math.floor(latencies.length / 2)] || 0;
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0;

    const report = {
      model,
      validJsonRate: `${((jsonValidCount / testCases.length) * 100).toFixed(0)}%`,
      avgLatencySec: `${(avgLatency / 1000).toFixed(2)}s`,
      medianLatencySec: `${(medianLatency / 1000).toFixed(2)}s`,
      p95LatencySec: `${(p95Latency / 1000).toFixed(2)}s`,
      avgExtractionGrade: successCount > 0 ? `${(totalScore / successCount).toFixed(1)}/10` : 'N/A',
      failures: failureCount,
      timeouts: timeoutCount
    };

    finalReports.push(report);
    await recordBenchmarkEvaluation(model, report);
    console.log(`\nModel ${model} evaluation finished.\n`);

    // Unload model to free VRAM for the next model evaluation
    try {
      console.log(`Unloading model ${model} from VRAM...`);
      await fetch(`${env.ollamaBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, keep_alive: 0 })
      });
    } catch (e) {
      console.warn(`Failed to unload model ${model}: ${e.message}`);
    }
  }

  console.log('==================================================');
  console.log('📊 FINAL BENCHMARK SUMMARY REPORTS');
  console.log('==================================================');
  console.table(finalReports);
  await sequelize.close();
}

runBenchmark().catch(async (err) => {
  console.error(err);
  await sequelize.close().catch(() => {});
  process.exitCode = 1;
});
