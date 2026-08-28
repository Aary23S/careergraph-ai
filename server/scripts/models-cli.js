/**
 * Phase 4E model registry lifecycle CLI. Subcommands:
 *   node scripts/models-cli.js list [--type=generation|embedding|reranker] [--status=candidate|...]
 *   node scripts/models-cli.js register --name=X --version=Y --type=generation --provider=ollama [--framework=..] [--artifactUri=..] [--metadata='{"dimension":384}'] [--status=candidate]
 *   node scripts/models-cli.js register --seed-defaults
 *   node scripts/models-cli.js promote --id=<uuid> --environment=staging|production|development --operator=you@example.com [--confirmReindex=true]
 *   node scripts/models-cli.js rollback --modelType=embedding --environment=production --operator=you@example.com
 *   node scripts/models-cli.js evaluate --id=<uuid> --type=embedding_benchmark [--dataset=v1] [--score=0.92] [--status=passed] [--metrics='{"avgLatencyMs":120}']
 *
 * CLI is the preferred surface for lifecycle administration per Phase 4E --
 * the HTTP endpoints exist mainly for the AI Ops UI.
 */
import { connectDatabase, sequelize } from '../src/config/database.js';
import * as registry from '../src/services/model-registry.service.js';
import { models } from '../src/config/database.js';

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=?(.*)$/);
    if (match) out[match[1]] = match[2] === '' ? true : match[2];
  }
  return out;
}

// The three models actively in production use as of Phase 4D. Registering
// them does not change any runtime behavior -- MODEL_REGISTRY_ENABLED
// defaults to false, and even when enabled, the resolver falls back to this
// exact same model when no assignment exists, or resolves to this exact
// same model via the assignment created below.
const DEFAULT_MODELS = [
  {
    name: 'qwen2.5-coder',
    version: '7b',
    modelType: 'generation',
    provider: 'ollama',
    framework: 'ollama',
    metadata: { note: 'Current AI_PROVIDER=ollama / OLLAMA_MODEL generation model as of Phase 4D.' },
  },
  {
    name: 'all-MiniLM-L6-v2',
    version: '1',
    modelType: 'embedding',
    provider: 'sentence-transformers',
    framework: 'sentence-transformers',
    metadata: { dimension: 384, note: 'Served via the Phase 4D Python ai-service; current ML_SERVICE_EMBEDDING_MODEL.' },
  },
  {
    name: 'cosine-similarity-reranker',
    version: '1',
    modelType: 'reranker',
    provider: 'internal',
    framework: 'numpy',
    metadata: { note: 'Phase 4D EmbeddingSimilarityReranker: cosine similarity over all-MiniLM-L6-v2 vectors.' },
  },
];

async function seedDefaults() {
  for (const def of DEFAULT_MODELS) {
    let model;
    try {
      model = await registry.registerModel({ ...def, status: 'production' });
      console.log(`Registered ${def.modelType}/${def.name}:${def.version} as production.`);
    } catch (err) {
      if (err.code === 'MODEL_ALREADY_REGISTERED') {
        model = await models.ModelRegistry.findOne({ where: { provider: def.provider, name: def.name, version: def.version, modelType: def.modelType } });
        console.log(`${def.modelType}/${def.name}:${def.version} already registered, skipping registration.`);
      } else {
        throw err;
      }
    }

    const hasBootstrapEvaluation = await models.ModelEvaluation.findOne({ where: { modelRegistryId: model.id, evaluationType: 'bootstrap_registration' } });
    if (!hasBootstrapEvaluation) {
      await registry.recordEvaluation(model.id, {
        evaluationType: 'bootstrap_registration',
        status: 'passed',
        overallScore: 1.0,
        metrics: { note: 'Pre-existing production model at Phase 4E rollout time; not a new promotion decision.' },
      });
    }

    for (const environment of registry.ENVIRONMENTS) {
      const current = await registry.getCurrentAssignment(def.modelType, environment);
      if (current && current.modelRegistryId === model.id) continue;
      await models.ModelAssignment.create({
        modelType: def.modelType,
        environment,
        modelRegistryId: model.id,
        assignedAt: new Date(),
        assignedBy: 'system:phase4e-bootstrap',
      });
      console.log(`  assigned to ${environment}`);
    }
  }
}

async function cmdList(args) {
  const rows = await registry.listModels({ modelType: args.type, status: args.status, provider: args.provider });
  console.table(rows.map((r) => ({
    id: r.id,
    name: r.name,
    version: r.version,
    type: r.modelType,
    provider: r.provider,
    status: r.status,
    createdAt: r.createdAt?.toISOString?.() || r.createdAt,
  })));
}

async function cmdRegister(args) {
  if (args['seed-defaults']) {
    await seedDefaults();
    return;
  }
  const metadata = args.metadata ? JSON.parse(args.metadata) : undefined;
  const model = await registry.registerModel({
    name: args.name,
    version: args.version,
    modelType: args.type,
    provider: args.provider,
    framework: args.framework,
    artifactUri: args.artifactUri,
    metadata,
    status: args.status,
  });
  console.log(`Registered model ${model.id} (${model.modelType}/${model.name}:${model.version}, status=${model.status}).`);
}

async function cmdPromote(args) {
  const assignment = await registry.promoteModel(args.id, {
    environment: args.environment,
    operatorEmail: args.operator,
    confirmReindex: args.confirmReindex === 'true' || args.confirmReindex === true,
  });
  console.log(`Promoted model ${args.id} to ${args.environment} (assignment ${assignment.id}).`);
}

async function cmdRollback(args) {
  const assignment = await registry.rollbackAssignment({
    modelType: args.modelType,
    environment: args.environment,
    operatorEmail: args.operator,
  });
  console.log(`Rolled back ${args.modelType}/${args.environment} to model ${assignment.modelRegistryId} (assignment ${assignment.id}).`);
}

async function cmdEvaluate(args) {
  const metrics = args.metrics ? JSON.parse(args.metrics) : undefined;
  const evaluation = await registry.recordEvaluation(args.id, {
    evaluationType: args.type,
    datasetVersion: args.dataset,
    overallScore: args.score !== undefined ? Number(args.score) : undefined,
    status: args.status,
    metrics,
  });
  console.log(`Recorded evaluation ${evaluation.id} for model ${args.id} (status=${evaluation.status}).`);
}

async function main() {
  const [, , subcommand, ...rest] = process.argv;
  const args = parseArgs(rest);

  await connectDatabase();

  switch (subcommand) {
    case 'list':
      await cmdList(args);
      break;
    case 'register':
      await cmdRegister(args);
      break;
    case 'promote':
      await cmdPromote(args);
      break;
    case 'rollback':
      await cmdRollback(args);
      break;
    case 'evaluate':
      await cmdEvaluate(args);
      break;
    default:
      console.error(`Unknown subcommand "${subcommand}". Expected one of: list, register, promote, rollback, evaluate.`);
      process.exitCode = 1;
  }

  await sequelize.close();
}

main().catch(async (err) => {
  console.error(`models-cli failed: ${err.message}`);
  await sequelize.close().catch(() => {});
  process.exitCode = 1;
});
