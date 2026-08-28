import fs from 'fs';
import path from 'path';
import Joi from 'joi';
import { env } from '../src/config/env.js';
import { aiService } from '../src/services/ai/ai.service.js';
import { querySemanticMatches } from '../src/services/semantic-search.service.js';
import { resolveEmbeddingModelName } from '../src/services/embedding.service.js';
import { models, connectDatabase, sequelize } from '../src/config/database.js';
import { evaluateExtraction, evaluateOutreach, evaluateSearch } from '../src/services/ai/evaluator.service.js';
import { findRegistryMatch, recordEvaluation } from '../src/services/model-registry.service.js';
import { logEvaluationResultsToMlflow } from '../src/services/mlflow-evaluation-logger.service.js';

// Load Joi schemas matching production AI enrichment validations
const jobSchema = Joi.object({
  roleCategory: Joi.string().required(),
  seniority: Joi.string().required(),
  requiredSkills: Joi.array().items(Joi.string()).required(),
  preferredSkills: Joi.array().items(Joi.string()).optional(),
  domain: Joi.array().items(Joi.string()).required(),
  remoteType: Joi.string().required()
});

const resumeSchema = Joi.object({
  roleCategory: Joi.string().required(),
  seniority: Joi.string().required(),
  skills: Joi.array().items(Joi.string()).required(),
  domains: Joi.array().items(Joi.string()).required(),
  experienceYears: Joi.number().required()
});

const connectionSchema = Joi.object({
  roleCategory: Joi.string().required(),
  seniority: Joi.string().required(),
  skills: Joi.array().items(Joi.string()).required(),
  domains: Joi.array().items(Joi.string()).required()
});

async function run() {
  console.log('Connecting to database...');
  await connectDatabase();

  const modelArg = process.argv.find(arg => arg.startsWith('--model='));
  const modelToUse = modelArg ? modelArg.split('=')[1] : (env.groqModel || env.ollamaModel || 'mock');
  
  console.log(`Evaluating AI capabilities using Model: ${modelToUse}\n`);

  env.aiEnabled = true;
  env.aiTimeoutMs = 15000;
  env.aiMaxRetries = 0;

  // Read case files
  const root = path.join(process.cwd(), 'tests', 'evaluation');
  const jobsCases = JSON.parse(fs.readFileSync(path.join(root, 'jobs', 'cases.json'), 'utf8'));
  const resumesCases = JSON.parse(fs.readFileSync(path.join(root, 'resumes', 'cases.json'), 'utf8'));
  const connectionsCases = JSON.parse(fs.readFileSync(path.join(root, 'connections', 'cases.json'), 'utf8'));
  const outreachCases = JSON.parse(fs.readFileSync(path.join(root, 'outreach', 'cases.json'), 'utf8'));
  const searchCases = JSON.parse(fs.readFileSync(path.join(root, 'semantic-search', 'cases.json'), 'utf8'));

  const results = [];

  // --- 1. Evaluate Job Enrichment ---
  for (const tc of jobsCases) {
    const prompt = `Analyze the following job post:\n\n${JSON.stringify(tc.input)}\n\nExtract: roleCategory, seniority, requiredSkills, preferredSkills, domain, remoteType.`;
    const start = Date.now();
    let actual = {};
    let passed = false;
    let metrics = {};
    try {
      actual = await aiService.generateStructured(prompt, jobSchema);
      const evalRes = evaluateExtraction(actual, tc.expected);
      passed = evalRes.passed;
      metrics = evalRes.metrics;
    } catch {
      metrics = { jsonValidity: 0.0, schemaValidity: 0.0, fieldAccuracy: 0.0, precision: 0.0, recall: 0.0 };
    }
    results.push({
      caseId: tc.caseId,
      operation: 'job_enrichment',
      input: tc.input,
      expected: tc.expected,
      actual,
      metrics,
      passed,
      latency: Date.now() - start
    });
  }

  // --- 2. Evaluate Resume Enrichment ---
  for (const tc of resumesCases) {
    const prompt = `Analyze the following resume:\n\n${JSON.stringify(tc.input)}\n\nExtract: roleCategory, seniority, skills, domains, experienceYears.`;
    const start = Date.now();
    let actual = {};
    let passed = false;
    let metrics = {};
    try {
      actual = await aiService.generateStructured(prompt, resumeSchema);
      const evalRes = evaluateExtraction(actual, tc.expected);
      passed = evalRes.passed;
      metrics = evalRes.metrics;
    } catch {
      metrics = { jsonValidity: 0.0, schemaValidity: 0.0, fieldAccuracy: 0.0, precision: 0.0, recall: 0.0 };
    }
    results.push({
      caseId: tc.caseId,
      operation: 'resume_enrichment',
      input: tc.input,
      expected: tc.expected,
      actual,
      metrics,
      passed,
      latency: Date.now() - start
    });
  }

  // --- 3. Evaluate Connection Enrichment ---
  for (const tc of connectionsCases) {
    const prompt = `Analyze this professional profile:\n\n${JSON.stringify(tc.input)}\n\nExtract: roleCategory, seniority, skills, domains.`;
    const start = Date.now();
    let actual = {};
    let passed = false;
    let metrics = {};
    try {
      actual = await aiService.generateStructured(prompt, connectionSchema);
      const evalRes = evaluateExtraction(actual, tc.expected);
      passed = evalRes.passed;
      metrics = evalRes.metrics;
    } catch {
      metrics = { jsonValidity: 0.0, schemaValidity: 0.0, fieldAccuracy: 0.0, precision: 0.0, recall: 0.0 };
    }
    results.push({
      caseId: tc.caseId,
      operation: 'connection_enrichment',
      input: tc.input,
      expected: tc.expected,
      actual,
      metrics,
      passed,
      latency: Date.now() - start
    });
  }

  // --- 4. Evaluate Outreach Drafts ---
  for (const tc of outreachCases) {
    const prompt = `Draft a personalized outreach to ${tc.input.connectionName} at ${tc.input.companyName} for the ${tc.input.jobTitle} job. Relationship context: ${tc.input.relationshipHistory}.`;
    const start = Date.now();
    let actual = '';
    let passed = false;
    let metrics = {};
    try {
      actual = await aiService.provider.generateText(prompt);
      const evalRes = evaluateOutreach(actual, tc.expected);
      passed = evalRes.passed;
      metrics = evalRes.metrics;
    } catch {
      metrics = { factualCorrectness: 0.0, intentAdherence: 0.0, personalization: 0.0, hallucinationRate: 1.0, toneQuality: 0.0 };
    }
    results.push({
      caseId: tc.caseId,
      operation: 'outreach',
      input: tc.input,
      expected: tc.expected,
      actual: { draft: actual },
      metrics,
      passed,
      latency: Date.now() - start
    });
  }

  // --- 5. Evaluate Semantic Search (requires mock database seeding) ---
  let tempUser;
  let tempConnection;
  try {
    tempUser = await models.User.create({
      email: 'eval-search@example.com',
      passwordHash: 'dummyhash',
      name: 'Evaluation Search User'
    });

    tempConnection = await models.Connection.create({
      user_id: tempUser.id,
      name: 'Sarah Architect',
      title: 'DevOps Architect',
      company: 'CloudGroup'
    });

    // Populate mock vector embedding for search case
    const mockVector = new Array(384).fill(0);
    // Simple deterministic signature for matching queryText 'DevOps'
    mockVector[0] = 0.95;

    await models.SemanticEmbedding.create({
      userId: tempUser.id,
      entityType: 'connection',
      entityId: tempConnection.id,
      embedding: mockVector,
      contentHash: 'mockhash',
      // Must match exactly what querySemanticMatches() resolves the query
      // embedding to below, or this seeded row is simply invisible to the
      // search it's meant to test (pre-existing bug: comparing modelToUse,
      // a model *name*, to the literal string 'groq' can never be true).
      embeddingModel: resolveEmbeddingModelName(),
      embeddingDimension: 384
    });

    for (const tc of searchCases) {
      const start = Date.now();
      let actualResults = [];
      let passed = false;
      let metrics = {};
      try {
        // Run querySemanticMatches
        const matches = await querySemanticMatches({
          userId: tempUser.id,
          queryText: tc.input.query,
          entityTypes: tc.input.entityTypes,
          limit: 5
        });

        // Resolve names
        actualResults = await Promise.all(matches.map(async m => {
          const conn = await models.Connection.findByPk(m.entityId);
          return { title: conn?.name || '' };
        }));

        const evalRes = evaluateSearch(actualResults, tc.expected);
        passed = evalRes.passed;
        metrics = evalRes.metrics;
      } catch {
        metrics = { precisionAt5: 0.0, precisionAt10: 0.0, recall: 0.0 };
      }
      results.push({
        caseId: tc.caseId,
        operation: 'semantic_search',
        input: tc.input,
        expected: tc.expected,
        actual: actualResults,
        metrics,
        passed,
        latency: Date.now() - start
      });
    }
  } finally {
    // Clean up temporary search database data
    if (tempConnection) await tempConnection.destroy().catch(() => {});
    if (tempUser) await tempUser.destroy().catch(() => {});
  }

  // --- Aggregate Metrics & Print Reports ---
  console.log('\nCareerGraph AI Evaluation');
  console.log('──────────────────────────\n');

  const printGroup = (title, ops) => {
    const list = results.filter(r => ops.includes(r.operation));
    if (list.length === 0) return;
    
    console.log(`${title}`);
    const validRate = list.reduce((sum, r) => sum + (r.metrics.jsonValidity !== undefined ? r.metrics.jsonValidity : r.metrics.factualCorrectness), 0) / list.length;
    const schemaRate = list.reduce((sum, r) => sum + (r.metrics.schemaValidity !== undefined ? r.metrics.schemaValidity : r.metrics.toneQuality), 0) / list.length;
    const accuracyRate = list.reduce((sum, r) => sum + (r.metrics.fieldAccuracy !== undefined ? r.metrics.fieldAccuracy : r.metrics.personalization), 0) / list.length;
    const passRate = list.filter(r => r.passed).length / list.length;

    console.log(`  JSON/Factuality Validity: ${Math.round(validRate * 100)}%`);
    console.log(`  Schema/Tone Validity:     ${Math.round(schemaRate * 100)}%`);
    console.log(`  Field/Context Accuracy:   ${Math.round(accuracyRate * 100)}%`);
    console.log(`  Overall Passed Cases:     ${Math.round(passRate * 100)}%\n`);
  };

  printGroup('Job Enrichment', ['job_enrichment']);
  printGroup('Resume Enrichment', ['resume_enrichment']);
  printGroup('Connection Enrichment', ['connection_enrichment']);
  printGroup('Outreach Drafting', ['outreach']);

  const searchList = results.filter(r => r.operation === 'semantic_search');
  if (searchList.length > 0) {
    console.log('Semantic Search');
    const p5 = searchList.reduce((sum, r) => sum + r.metrics.precisionAt5, 0) / searchList.length;
    const recall = searchList.reduce((sum, r) => sum + r.metrics.recall, 0) / searchList.length;
    console.log(`  Precision@5:              ${Math.round(p5 * 100)}%`);
    console.log(`  Recall:                   ${Math.round(recall * 100)}%\n`);
  }

  // --- Baseline Regression Check (3H-7) ---
  const baselinePath = path.join(root, 'baseline.json');
  let hasRegression = false;

  if (fs.existsSync(baselinePath)) {
    console.log('Comparing against stored baseline metrics...');
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    for (const res of results) {
      const baseRes = baseline.find(b => b.caseId === res.caseId && b.operation === res.operation);
      if (baseRes) {
        // Compare passed status or key accuracy metric
        const prevAcc = baseRes.metrics.fieldAccuracy || baseRes.metrics.precisionAt5 || baseRes.metrics.toneQuality || 0;
        const currAcc = res.metrics.fieldAccuracy || res.metrics.precisionAt5 || res.metrics.toneQuality || 0;
        
        if (currAcc < prevAcc - 0.05) {
          console.warn(`⚠️ Regression detected on Case ${res.caseId} (${res.operation}): Accuracy dropped from ${prevAcc} to ${currAcc}`);
          hasRegression = true;
        }
      }
    }
  } else {
    console.log('No baseline found. Saving current metrics as baseline reference...');
    fs.writeFileSync(baselinePath, JSON.stringify(results, null, 2));
  }

  // Save audit logs to database for records (3H-14)
  console.log('Saving audit log records...');
  const firstUser = await models.User.findOne();
  if (firstUser) {
    for (const res of results) {
      await models.AiAuditLog.create({
        userId: firstUser.id,
        operation: res.operation,
        entityType: res.operation.includes('search') ? 'connection' : res.operation.split('_')[0],
        provider: env.aiProvider,
        model: modelToUse,
        promptVersion: 1,
        schemaVersion: 1,
        latencyMs: res.latency,
        status: res.passed ? 'success' : 'failed',
        evaluationScore: res.metrics.fieldAccuracy || res.metrics.precisionAt5 || res.metrics.toneQuality || 1.0
      });
    }
  }

  // Connect this run to the model registry, if the evaluated model happens
  // to be registered (Phase 4E section 6). Best-effort: a missing registry
  // entry never fails the evaluation run itself.
  try {
    const registryMatch = await findRegistryMatch({ modelType: 'generation', provider: env.aiProvider, modelString: modelToUse });
    if (registryMatch) {
      const passRate = results.filter((r) => r.passed).length / results.length;
      await recordEvaluation(registryMatch.id, {
        evaluationType: 'ai_evaluate',
        datasetVersion: 'evaluation-suite-v1',
        overallScore: passRate,
        status: hasRegression ? 'failed' : 'passed',
        metrics: { passRate, totalCases: results.length, hasRegression },
      });
      console.log(`Recorded ai_evaluate evaluation against registry model ${registryMatch.id}.`);
    }
  } catch (err) {
    console.warn(`Skipped recording registry evaluation: ${err.message}`);
  }

  // Phase 4F: also log per-category runs to MLflow when enabled. No-ops
  // entirely (zero network calls) when MLFLOW_ENABLED is false, and never
  // throws -- a tracking-server outage must never fail this script.
  const mlflowResult = await logEvaluationResultsToMlflow(results, { modelToUse });
  if (mlflowResult.attempted) {
    console.log(`MLflow: logged ${mlflowResult.logged.length} run(s), skipped ${mlflowResult.skipped.length}.`);
  }

  await sequelize.close();

  if (hasRegression) {
    console.error('\n❌ Evaluation failed: Quality regression detected.');
    process.exit(1);
  }

  console.log('✅ Evaluation run finished successfully.');
  process.exit(0);
}

run().catch(async (err) => {
  console.error('Fatal error during evaluation run:', err);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
