import { env } from '../config/env.js';
import { aiService } from './ai/ai.service.js';
import { resolveEmbeddingModelName } from './embedding.service.js';
import { getCurrentAssignment, getModel } from './model-registry.service.js';

/**
 * Model resolution, Phase 4E. When MODEL_REGISTRY_ENABLED is false (the
 * default), every resolver here returns exactly what the pre-4E code paths
 * already resolve to -- this file is additive read-only metadata, it never
 * changes which model actually gets called. When enabled, it looks up the
 * current model_assignments row for (model_type, environment) and, if one
 * exists, resolves to that registered model instead; if no assignment
 * exists yet it still falls back to the existing .env-driven value rather
 * than erroring, so enabling the flag can never break generation/embedding.
 */

function defaultEnvironment(environment) {
  return environment || env.modelRegistryDefaultEnvironment;
}

async function resolveFromRegistry(modelType, environment, fallback) {
  if (!env.modelRegistryEnabled) {
    return { ...fallback, source: 'env' };
  }

  try {
    const assignment = await getCurrentAssignment(modelType, environment);
    if (!assignment) {
      console.warn(`[ModelResolver] Registry enabled but no ${modelType} assignment for environment "${environment}". Falling back to .env configuration.`);
      return { ...fallback, source: 'env' };
    }
    const model = await getModel(assignment.modelRegistryId);
    return {
      source: 'registry',
      provider: model.provider,
      model: model.version ? `${model.name}:${model.version}` : model.name,
      modelRegistryId: model.id,
      modelName: model.name,
      modelVersion: model.version,
      framework: model.framework || null,
      dimension: model.metadata?.dimension ?? null,
    };
  } catch (err) {
    console.warn(`[ModelResolver] Failed to resolve ${modelType} from registry (${err.message}). Falling back to .env configuration.`);
    return { ...fallback, source: 'env' };
  }
}

export async function resolveGenerationModel(environment) {
  const fallback = {
    provider: env.aiProvider,
    model: aiService.provider?.modelName || 'mock',
    modelRegistryId: null,
    modelName: aiService.provider?.modelName || 'mock',
    modelVersion: null,
    framework: null,
    dimension: null,
  };
  return resolveFromRegistry('generation', defaultEnvironment(environment), fallback);
}

export async function resolveEmbeddingModel(environment) {
  const modelName = resolveEmbeddingModelName();
  const fallback = {
    provider: env.mlServiceEnabled ? 'python-ml-service' : 'ollama',
    model: modelName,
    modelRegistryId: null,
    modelName,
    modelVersion: null,
    framework: null,
    dimension: null,
  };
  return resolveFromRegistry('embedding', defaultEnvironment(environment), fallback);
}

export async function resolveRerankerModel(environment) {
  const fallback = {
    provider: 'internal',
    model: 'cosine-similarity',
    modelRegistryId: null,
    modelName: 'cosine-similarity',
    modelVersion: null,
    framework: null,
    dimension: null,
  };
  return resolveFromRegistry('reranker', defaultEnvironment(environment), fallback);
}
