import { models } from '../config/database.js';
import { AppError } from '../lib/http.js';

export const MODEL_TYPES = ['generation', 'embedding', 'reranker'];
export const MODEL_STATUSES = ['candidate', 'staging', 'production', 'deprecated', 'archived'];
export const ENVIRONMENTS = ['development', 'staging', 'production'];
export const EVALUATION_STATUSES = ['passed', 'failed', 'error'];

// Forward-only lifecycle. Rollback deliberately does not go through this map
// -- it works by appending a new model_assignments row pointing back at a
// previously active model, not by mutating model_registry.status.
const ALLOWED_TRANSITIONS = {
  candidate: ['staging'],
  staging: ['production'],
  production: ['deprecated'],
  deprecated: ['archived'],
  archived: [],
};

function assertKnownType(modelType) {
  if (!MODEL_TYPES.includes(modelType)) {
    throw new AppError(400, 'INVALID_MODEL_TYPE', `model_type must be one of: ${MODEL_TYPES.join(', ')}`);
  }
}

function assertKnownEnvironment(environment) {
  if (!ENVIRONMENTS.includes(environment)) {
    throw new AppError(400, 'INVALID_ENVIRONMENT', `environment must be one of: ${ENVIRONMENTS.join(', ')}`);
  }
}

export async function registerModel({ name, version, modelType, provider, framework, artifactUri, metadata, status }) {
  assertKnownType(modelType);
  if (!name || !version || !provider) {
    throw new AppError(400, 'MISSING_FIELDS', 'name, version, and provider are required.');
  }
  if (status && !MODEL_STATUSES.includes(status)) {
    throw new AppError(400, 'INVALID_STATUS', `status must be one of: ${MODEL_STATUSES.join(', ')}`);
  }

  const existing = await models.ModelRegistry.findOne({
    where: { provider, name, version, modelType },
  });
  if (existing) {
    throw new AppError(409, 'MODEL_ALREADY_REGISTERED', 'A model with this provider + name + version + model_type already exists.');
  }

  try {
    return await models.ModelRegistry.create({
      name,
      version,
      modelType,
      provider,
      framework: framework || null,
      artifactUri: artifactUri || null,
      metadata: metadata || null,
      status: status || 'candidate',
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      throw new AppError(409, 'MODEL_ALREADY_REGISTERED', 'A model with this provider + name + version + model_type already exists.');
    }
    throw err;
  }
}

export async function listModels({ modelType, status, provider } = {}) {
  const where = {};
  if (modelType) where.modelType = modelType;
  if (status) where.status = status;
  if (provider) where.provider = provider;
  return models.ModelRegistry.findAll({ where, order: [['created_at', 'DESC']] });
}

/**
 * Same as listModels(), but each row also carries its latest evaluation and
 * which environments currently have it as their active assignment -- what
 * the AI Ops "Models" table needs to render without N+1 detail calls.
 */
export async function listModelsWithSummary(filters = {}) {
  const rows = await listModels(filters);

  return Promise.all(
    rows.map(async (model) => {
      const [latestEvaluation, assignments] = await Promise.all([
        models.ModelEvaluation.findOne({ where: { modelRegistryId: model.id }, order: [['created_at', 'DESC']] }),
        models.ModelAssignment.findAll({ where: { modelType: model.modelType }, order: [['assignedAt', 'DESC']] }),
      ]);

      const seenEnvironments = new Set();
      const currentEnvironments = [];
      for (const row of assignments) {
        if (seenEnvironments.has(row.environment)) continue;
        seenEnvironments.add(row.environment);
        if (row.modelRegistryId === model.id) currentEnvironments.push(row.environment);
      }

      return {
        ...model.toJSON(),
        latestEvaluation: latestEvaluation
          ? { evaluationType: latestEvaluation.evaluationType, overallScore: latestEvaluation.overallScore, status: latestEvaluation.status }
          : null,
        currentEnvironments,
      };
    })
  );
}

export async function getModel(modelId) {
  const model = await models.ModelRegistry.findByPk(modelId);
  if (!model) {
    throw new AppError(404, 'MODEL_NOT_FOUND', 'Model registry entry not found.');
  }
  return model;
}

export async function getModelWithDetails(modelId) {
  const model = await getModel(modelId);
  const [evaluations, assignments] = await Promise.all([
    models.ModelEvaluation.findAll({ where: { modelRegistryId: modelId }, order: [['created_at', 'DESC']] }),
    models.ModelAssignment.findAll({ where: { modelRegistryId: modelId }, order: [['assignedAt', 'DESC']] }),
  ]);
  return { model, evaluations, assignments };
}

export async function recordEvaluation(modelId, { evaluationType, datasetVersion, metrics, overallScore, status, evaluatedAt }) {
  await getModel(modelId);
  if (!evaluationType) {
    throw new AppError(400, 'MISSING_FIELDS', 'evaluationType is required.');
  }
  const evalStatus = status || 'completed';
  if (![...EVALUATION_STATUSES, 'completed'].includes(evalStatus)) {
    throw new AppError(400, 'INVALID_EVALUATION_STATUS', `status must be one of: ${EVALUATION_STATUSES.join(', ')}`);
  }

  return models.ModelEvaluation.create({
    modelRegistryId: modelId,
    evaluationType,
    datasetVersion: datasetVersion || null,
    metrics: metrics || null,
    overallScore: overallScore ?? null,
    status: evalStatus,
    evaluatedAt: evaluatedAt || new Date(),
  });
}

/**
 * Generic, validated lifecycle transition (candidate -> staging -> production
 * -> deprecated -> archived). Used directly for demotions (production ->
 * deprecated -> archived); promotions into staging/production normally go
 * through promoteModel() below since those also require an assignment.
 */
export async function transitionStatus(modelId, targetStatus) {
  if (!MODEL_STATUSES.includes(targetStatus)) {
    throw new AppError(400, 'INVALID_STATUS', `status must be one of: ${MODEL_STATUSES.join(', ')}`);
  }
  const model = await getModel(modelId);
  const allowed = ALLOWED_TRANSITIONS[model.status] || [];
  if (!allowed.includes(targetStatus)) {
    throw new AppError(409, 'INVALID_TRANSITION', `Cannot transition model from "${model.status}" to "${targetStatus}".`);
  }

  if (targetStatus === 'archived' && (await isCurrentlyAssigned(model))) {
    throw new AppError(409, 'MODEL_IN_USE', 'Model is still the active assignment for an environment; reassign or roll back before archiving.');
  }

  model.status = targetStatus;
  await model.save();
  return model;
}

/**
 * Returns the most recent (i.e. current) assignment row for a
 * (model_type, environment) pair, or null if that slot has never been
 * assigned.
 */
export async function getCurrentAssignment(modelType, environment) {
  const row = await models.ModelAssignment.findOne({
    where: { modelType, environment },
    order: [['assignedAt', 'DESC']],
  });
  return row || null;
}

/**
 * True if `model` is the current assignment for any (model_type,
 * environment) slot -- used to guard against archiving a model still in
 * active use.
 */
async function isCurrentlyAssigned(model) {
  const rows = await models.ModelAssignment.findAll({
    where: { modelType: model.modelType },
    order: [['assignedAt', 'DESC']],
  });
  const seenEnvironments = new Set();
  for (const row of rows) {
    if (seenEnvironments.has(row.environment)) continue;
    seenEnvironments.add(row.environment);
    if (row.modelRegistryId === model.id) return true;
  }
  return false;
}

function getEmbeddingDimension(model) {
  const dim = model.metadata?.dimension;
  return typeof dim === 'number' ? dim : null;
}

/**
 * Operator-only promotion. Requires a passed evaluation and, for embedding
 * models being promoted into production, an explicit acknowledgement
 * (confirmReindex) if production's currently assigned embedding model has a
 * different vector dimension -- swapping embedding models silently would
 * leave the pgvector space full of incompatible vectors. Development/staging
 * are exempt on purpose: staging a differently-shaped candidate there to
 * evaluate it (e.g. against a shadow index) is the normal way to build up
 * the passed evaluation this function itself requires before a production
 * promotion is even allowed.
 */
export async function promoteModel(modelId, { environment, operatorEmail, confirmReindex = false }) {
  assertKnownEnvironment(environment);
  if (!operatorEmail) {
    throw new AppError(400, 'MISSING_OPERATOR', 'operatorEmail is required to promote a model.');
  }

  const model = await getModel(modelId);

  const passedEvaluation = await models.ModelEvaluation.findOne({
    where: { modelRegistryId: modelId, status: 'passed' },
    order: [['created_at', 'DESC']],
  });
  if (!passedEvaluation) {
    throw new AppError(409, 'EVALUATION_REQUIRED', 'Model must have at least one passed evaluation before promotion.');
  }

  if (model.modelType === 'embedding' && environment === 'production') {
    const newDimension = getEmbeddingDimension(model);
    const currentAssignment = await getCurrentAssignment('embedding', environment);
    if (currentAssignment && currentAssignment.modelRegistryId !== model.id) {
      const currentModel = await getModel(currentAssignment.modelRegistryId);
      const currentDimension = getEmbeddingDimension(currentModel);
      if (currentDimension != null && newDimension !== currentDimension) {
        if (!confirmReindex) {
          throw new AppError(
            409,
            'EMBEDDING_DIMENSION_MISMATCH',
            `Cannot silently replace embedding model: current dimension ${currentDimension} != new dimension ${newDimension}. ` +
              'Re-run promotion with confirmReindex=true once a re-index strategy is in place.'
          );
        }
      }
    }
  }

  // Status transition only applies to staging/production; a development
  // assignment is allowed to point at any non-archived model without
  // changing its lifecycle status.
  if (environment === 'staging' && model.status !== 'staging') {
    const allowed = ALLOWED_TRANSITIONS[model.status] || [];
    if (!allowed.includes('staging')) {
      throw new AppError(409, 'INVALID_TRANSITION', `Cannot promote model from "${model.status}" to "staging".`);
    }
    model.status = 'staging';
    await model.save();
  } else if (environment === 'production' && model.status !== 'production') {
    const allowed = ALLOWED_TRANSITIONS[model.status] || [];
    if (!allowed.includes('production')) {
      throw new AppError(409, 'INVALID_TRANSITION', `Cannot promote model from "${model.status}" to "production". Model must be "staging" first.`);
    }
    model.status = 'production';
    await model.save();
  } else if (environment === 'development' && model.status === 'archived') {
    throw new AppError(409, 'INVALID_TRANSITION', 'Cannot assign an archived model.');
  }

  return models.ModelAssignment.create({
    modelType: model.modelType,
    environment,
    modelRegistryId: model.id,
    assignedAt: new Date(),
    assignedBy: operatorEmail,
  });
}

/**
 * Operator-only rollback. Switches the active assignment for
 * (modelType, environment) back to the most recent prior model in that
 * slot's assignment history. Never deletes model_registry rows or prior
 * model_assignments rows -- rollback is itself just a new history entry.
 */
export async function rollbackAssignment({ modelType, environment, operatorEmail }) {
  assertKnownType(modelType);
  assertKnownEnvironment(environment);
  if (!operatorEmail) {
    throw new AppError(400, 'MISSING_OPERATOR', 'operatorEmail is required to roll back an assignment.');
  }

  const history = await models.ModelAssignment.findAll({
    where: { modelType, environment },
    order: [['assignedAt', 'DESC']],
  });

  if (history.length === 0) {
    throw new AppError(404, 'NO_ACTIVE_ASSIGNMENT', `No assignment exists for ${modelType}/${environment}.`);
  }

  const current = history[0];
  const previous = history.find((row) => row.modelRegistryId !== current.modelRegistryId);

  if (!previous) {
    throw new AppError(409, 'NO_PREVIOUS_ASSIGNMENT', 'No previously known-good model exists to roll back to.');
  }

  return models.ModelAssignment.create({
    modelType,
    environment,
    modelRegistryId: previous.modelRegistryId,
    assignedAt: new Date(),
    assignedBy: operatorEmail,
  });
}

/**
 * Best-effort lookup used to attach modelRegistryId/modelVersion onto AI
 * audit log rows (Phase 4E section 12) without requiring generation calls
 * to be rewired through the registry. Never throws -- callers should treat
 * a null result as "no registry match," not an error.
 */
export async function findRegistryMatch({ modelType, provider, modelString }) {
  try {
    if (!modelString) return null;
    const separatorIndex = modelString.lastIndexOf(':');
    const name = separatorIndex > 0 ? modelString.slice(0, separatorIndex) : modelString;
    const version = separatorIndex > 0 ? modelString.slice(separatorIndex + 1) : null;

    const where = { modelType, provider, name };
    if (version) where.version = version;

    return await models.ModelRegistry.findOne({ where, order: [['created_at', 'DESC']] });
  } catch {
    return null;
  }
}

export async function compareEvaluations({ modelIds, datasetVersion }) {
  if (!Array.isArray(modelIds) || modelIds.length < 2) {
    throw new AppError(400, 'INVALID_COMPARISON', 'At least two modelIds are required to compare.');
  }
  const where = { modelRegistryId: modelIds };
  if (datasetVersion) where.datasetVersion = datasetVersion;

  const evaluations = await models.ModelEvaluation.findAll({
    where,
    order: [['created_at', 'DESC']],
    include: [{ model: models.ModelRegistry, as: 'model' }],
  });

  const byModel = new Map();
  for (const evaluation of evaluations) {
    if (!byModel.has(evaluation.modelRegistryId)) {
      byModel.set(evaluation.modelRegistryId, []);
    }
    byModel.get(evaluation.modelRegistryId).push(evaluation);
  }
  return Object.fromEntries(byModel);
}
