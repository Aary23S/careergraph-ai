import request from 'supertest';
import Joi from 'joi';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase, models } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { aiService } from '../src/services/ai/ai.service.js';
import * as registry from '../src/services/model-registry.service.js';
import { resolveGenerationModel, resolveEmbeddingModel, resolveRerankerModel } from '../src/services/model-resolver.service.js';
import { resolveEmbeddingModelName } from '../src/services/embedding.service.js';

describe('Model Registry & Lifecycle Management (Phase 4E)', () => {
  let app;
  let operatorToken;
  let operatorUserId;
  let regularToken;
  const operatorEmail = 'registry-operator@example.com';

  const originalOperatorEmails = env.aiOperatorEmails;
  const originalRegistryEnabled = env.modelRegistryEnabled;
  const originalAiEnabled = env.aiEnabled;

  beforeAll(async () => {
    env.aiOperatorEmails = operatorEmail;
    env.aiEnabled = true;

    app = createApp();
    await resetDatabase();

    const opRes = await request(app)
      .post('/api/auth/register')
      .send({ email: operatorEmail, password: 'Password123!', name: 'Operator' });
    operatorToken = opRes.body.data.tokens.accessToken;
    operatorUserId = opRes.body.data.user.id;

    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'registry-regular@example.com', password: 'Password123!', name: 'Regular' });
    regularToken = regRes.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    env.aiOperatorEmails = originalOperatorEmails;
    env.modelRegistryEnabled = originalRegistryEnabled;
    env.aiEnabled = originalAiEnabled;
    await sequelize.close();
  });

  afterEach(() => {
    env.modelRegistryEnabled = originalRegistryEnabled;
  });

  describe('registration', () => {
    test('registers a new model as a candidate by default', async () => {
      const model = await registry.registerModel({
        name: 'test-gen-model',
        version: '1',
        modelType: 'generation',
        provider: 'ollama',
      });
      expect(model.status).toBe('candidate');
      expect(model.id).toBeDefined();
    });

    test('rejects a duplicate provider + name + version + modelType', async () => {
      await registry.registerModel({ name: 'dup-model', version: '1', modelType: 'embedding', provider: 'ollama' });
      await expect(
        registry.registerModel({ name: 'dup-model', version: '1', modelType: 'embedding', provider: 'ollama' })
      ).rejects.toMatchObject({ statusCode: 409, code: 'MODEL_ALREADY_REGISTERED' });
    });

    test('rejects an unknown model_type', async () => {
      await expect(
        registry.registerModel({ name: 'bad-type', version: '1', modelType: 'summarizer', provider: 'ollama' })
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_MODEL_TYPE' });
    });
  });

  describe('listing', () => {
    test('lists models filtered by type', async () => {
      await registry.registerModel({ name: 'list-embed', version: '1', modelType: 'embedding', provider: 'ollama' });
      const rows = await registry.listModels({ modelType: 'embedding' });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.modelType === 'embedding')).toBe(true);
    });
  });

  describe('lifecycle transitions', () => {
    test('rejects an invalid direct transition (candidate -> production)', async () => {
      const model = await registry.registerModel({ name: 'skip-transition', version: '1', modelType: 'generation', provider: 'ollama' });
      await expect(registry.transitionStatus(model.id, 'production')).rejects.toMatchObject({
        statusCode: 409,
        code: 'INVALID_TRANSITION',
      });
    });

    test('allows the forward chain production -> deprecated -> archived', async () => {
      const model = await registry.registerModel({ name: 'chain-model', version: '1', modelType: 'generation', provider: 'ollama', status: 'production' });
      const deprecated = await registry.transitionStatus(model.id, 'deprecated');
      expect(deprecated.status).toBe('deprecated');
      const archived = await registry.transitionStatus(model.id, 'archived');
      expect(archived.status).toBe('archived');
    });

    test('refuses to archive a model that is still the active assignment', async () => {
      const model = await registry.registerModel({ name: 'in-use-model', version: '1', modelType: 'generation', provider: 'ollama', status: 'production' });
      await models.ModelAssignment.create({
        modelType: 'generation',
        environment: 'production',
        modelRegistryId: model.id,
        assignedAt: new Date(),
        assignedBy: 'test-setup',
      });
      const deprecated = await registry.transitionStatus(model.id, 'deprecated');
      expect(deprecated.status).toBe('deprecated');
      await expect(registry.transitionStatus(model.id, 'archived')).rejects.toMatchObject({ code: 'MODEL_IN_USE' });
    });
  });

  describe('evaluation', () => {
    test('records an evaluation for a registered model', async () => {
      const model = await registry.registerModel({ name: 'eval-model', version: '1', modelType: 'generation', provider: 'ollama' });
      const evaluation = await registry.recordEvaluation(model.id, {
        evaluationType: 'generation_benchmark',
        overallScore: 0.9,
        status: 'passed',
        metrics: { avgLatencySec: '1.2s' },
      });
      expect(evaluation.status).toBe('passed');
      expect(evaluation.modelRegistryId).toBe(model.id);
    });

    test('rejects an evaluation for a non-existent model', async () => {
      await expect(
        registry.recordEvaluation('00000000-0000-0000-0000-000000000000', { evaluationType: 'x' })
      ).rejects.toMatchObject({ statusCode: 404, code: 'MODEL_NOT_FOUND' });
    });
  });

  describe('promotion', () => {
    test('requires a passed evaluation before promotion', async () => {
      const model = await registry.registerModel({ name: 'no-eval-model', version: '1', modelType: 'generation', provider: 'ollama' });
      await expect(
        registry.promoteModel(model.id, { environment: 'staging', operatorEmail })
      ).rejects.toMatchObject({ statusCode: 409, code: 'EVALUATION_REQUIRED' });
    });

    test('promotes candidate -> staging -> production with a passed evaluation', async () => {
      const model = await registry.registerModel({ name: 'promote-model', version: '1', modelType: 'generation', provider: 'ollama' });
      await registry.recordEvaluation(model.id, { evaluationType: 'generation_benchmark', status: 'passed', overallScore: 1 });

      const stagingAssignment = await registry.promoteModel(model.id, { environment: 'staging', operatorEmail });
      expect(stagingAssignment.environment).toBe('staging');
      const afterStaging = await registry.getModel(model.id);
      expect(afterStaging.status).toBe('staging');

      const productionAssignment = await registry.promoteModel(model.id, { environment: 'production', operatorEmail });
      expect(productionAssignment.environment).toBe('production');
      const afterProduction = await registry.getModel(model.id);
      expect(afterProduction.status).toBe('production');

      const current = await registry.getCurrentAssignment('generation', 'production');
      expect(current.modelRegistryId).toBe(model.id);
    });
  });

  describe('rollback', () => {
    test('switches the active assignment back to the previously known-good model', async () => {
      const modelA = await registry.registerModel({ name: 'rollback-a', version: '1', modelType: 'generation', provider: 'ollama' });
      const modelB = await registry.registerModel({ name: 'rollback-b', version: '1', modelType: 'generation', provider: 'ollama' });
      for (const model of [modelA, modelB]) {
        await registry.recordEvaluation(model.id, { evaluationType: 'x', status: 'passed', overallScore: 1 });
        await registry.promoteModel(model.id, { environment: 'staging', operatorEmail });
      }
      await registry.promoteModel(modelA.id, { environment: 'production', operatorEmail });
      await registry.promoteModel(modelB.id, { environment: 'production', operatorEmail });

      let current = await registry.getCurrentAssignment('generation', 'production');
      expect(current.modelRegistryId).toBe(modelB.id);

      const rolledBack = await registry.rollbackAssignment({ modelType: 'generation', environment: 'production', operatorEmail });
      expect(rolledBack.modelRegistryId).toBe(modelA.id);

      current = await registry.getCurrentAssignment('generation', 'production');
      expect(current.modelRegistryId).toBe(modelA.id);

      // Rollback never deletes history -- the registry rows and prior
      // assignment rows must still exist.
      expect(await registry.getModel(modelA.id)).toBeTruthy();
      expect(await registry.getModel(modelB.id)).toBeTruthy();
    });

    test('fails when there is no previous assignment to roll back to', async () => {
      const model = await registry.registerModel({ name: 'rollback-only', version: '1', modelType: 'reranker', provider: 'internal' });
      await registry.recordEvaluation(model.id, { evaluationType: 'x', status: 'passed', overallScore: 1 });
      await registry.promoteModel(model.id, { environment: 'development', operatorEmail });

      await expect(
        registry.rollbackAssignment({ modelType: 'reranker', environment: 'development', operatorEmail })
      ).rejects.toMatchObject({ statusCode: 409, code: 'NO_PREVIOUS_ASSIGNMENT' });
    });
  });

  describe('embedding dimension compatibility', () => {
    test('blocks silently replacing an embedding model with a different dimension', async () => {
      const modelA = await registry.registerModel({
        name: 'embed-384', version: '1', modelType: 'embedding', provider: 'sentence-transformers', metadata: { dimension: 384 },
      });
      const modelB = await registry.registerModel({
        name: 'embed-768', version: '1', modelType: 'embedding', provider: 'sentence-transformers', metadata: { dimension: 768 },
      });
      for (const model of [modelA, modelB]) {
        await registry.recordEvaluation(model.id, { evaluationType: 'x', status: 'passed', overallScore: 1 });
      }
      await registry.promoteModel(modelA.id, { environment: 'staging', operatorEmail });
      await registry.promoteModel(modelA.id, { environment: 'production', operatorEmail });

      await registry.promoteModel(modelB.id, { environment: 'staging', operatorEmail });
      await expect(
        registry.promoteModel(modelB.id, { environment: 'production', operatorEmail })
      ).rejects.toMatchObject({ statusCode: 409, code: 'EMBEDDING_DIMENSION_MISMATCH' });

      // Explicit re-index acknowledgement allows it through.
      const assignment = await registry.promoteModel(modelB.id, { environment: 'production', operatorEmail, confirmReindex: true });
      expect(assignment.modelRegistryId).toBe(modelB.id);
    });
  });

  describe('model resolver', () => {
    test('registry disabled: resolves exactly what the pre-4E code paths already resolve to', async () => {
      env.modelRegistryEnabled = false;

      const generation = await resolveGenerationModel('production');
      expect(generation.source).toBe('env');
      expect(generation.model).toBe(aiService.provider?.modelName || 'mock');

      const embedding = await resolveEmbeddingModel('production');
      expect(embedding.source).toBe('env');
      expect(embedding.model).toBe(resolveEmbeddingModelName());

      const reranker = await resolveRerankerModel('production');
      expect(reranker.source).toBe('env');
      expect(reranker.model).toBe('cosine-similarity');
    });

    test('registry enabled but no assignment for that environment: falls back instead of throwing', async () => {
      // No earlier test in this file assigns a "generation" model to the
      // "development" slot (promotion/rollback tests above only touch
      // staging/production), so this exercises the genuine no-assignment path.
      env.modelRegistryEnabled = true;
      const result = await resolveGenerationModel('development');
      expect(result.source).toBe('env');
      expect(result.model).toBe(aiService.provider?.modelName || 'mock');
    });

    test('registry enabled with an assignment: resolves the registered model', async () => {
      const model = await registry.registerModel({ name: 'resolver-model', version: '9', modelType: 'reranker', provider: 'internal' });
      await registry.recordEvaluation(model.id, { evaluationType: 'x', status: 'passed', overallScore: 1 });
      await registry.promoteModel(model.id, { environment: 'development', operatorEmail });

      env.modelRegistryEnabled = true;
      const result = await resolveRerankerModel('development');
      expect(result.source).toBe('registry');
      expect(result.modelRegistryId).toBe(model.id);
      expect(result.model).toBe('resolver-model:9');
    });
  });

  describe('operator authorization / admin boundaries', () => {
    test('unauthenticated requests are rejected', async () => {
      const res = await request(app).get('/api/admin/models');
      expect(res.status).toBe(401);
    });

    test('authenticated non-operator users are forbidden', async () => {
      const res = await request(app).get('/api/admin/models').set('Authorization', `Bearer ${regularToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('OPERATOR_REQUIRED');
    });

    test('operators can list and register models over the API', async () => {
      const listRes = await request(app).get('/api/admin/models').set('Authorization', `Bearer ${operatorToken}`);
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.data)).toBe(true);

      const registerRes = await request(app)
        .post('/api/admin/models')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ name: 'api-registered', version: '1', modelType: 'generation', provider: 'ollama' });
      expect(registerRes.status).toBe(201);
      expect(registerRes.body.data.name).toBe('api-registered');
    });

    test('non-operators cannot promote or roll back models', async () => {
      const model = await registry.registerModel({ name: 'route-guard-model', version: '1', modelType: 'generation', provider: 'ollama' });
      const promoteRes = await request(app)
        .post(`/api/admin/models/${model.id}/promote`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ environment: 'staging' });
      expect(promoteRes.status).toBe(403);

      const rollbackRes = await request(app)
        .post('/api/admin/models/rollback')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ modelType: 'generation', environment: 'production' });
      expect(rollbackRes.status).toBe(403);
    });
  });

  describe('AI audit metadata', () => {
    afterEach(() => {
      env.modelRegistryEnabled = originalRegistryEnabled;
    });

    test('leaves modelRegistryId/modelVersion null when the registry is disabled', async () => {
      env.modelRegistryEnabled = false;
      await aiService.generateStructured(
        'Audit metadata disabled test prompt',
        Joi.object({ status: Joi.string() }).unknown(true),
        { userId: operatorUserId, operation: 'generic' }
      );
      const log = await models.AiAuditLog.findOne({ where: { userId: operatorUserId, operation: 'generic' }, order: [['created_at', 'DESC']] });
      expect(log).toBeTruthy();
      expect(log.modelRegistryId).toBeNull();
    });

    test('attaches modelRegistryId/modelVersion when the registry is enabled and a matching model exists', async () => {
      const modelString = aiService.provider?.modelName || 'mock';
      const separatorIndex = modelString.lastIndexOf(':');
      const name = separatorIndex > 0 ? modelString.slice(0, separatorIndex) : modelString;
      const version = separatorIndex > 0 ? modelString.slice(separatorIndex + 1) : '1';

      const registered = await registry.registerModel({
        name,
        version,
        modelType: 'generation',
        provider: env.aiProvider,
      });

      env.modelRegistryEnabled = true;
      await aiService.generateStructured(
        'Audit metadata enabled test prompt',
        Joi.object({ status: Joi.string() }).unknown(true),
        { userId: operatorUserId, operation: 'audit_meta_test' }
      );
      const log = await models.AiAuditLog.findOne({ where: { userId: operatorUserId, operation: 'audit_meta_test' }, order: [['created_at', 'DESC']] });
      expect(log).toBeTruthy();
      expect(log.modelRegistryId).toBe(registered.id);
      expect(log.provider).toBe(env.aiProvider);
      expect(log.promptVersion).toBe(1);
      expect(log.schemaVersion).toBe(1);
    });
  });
});
