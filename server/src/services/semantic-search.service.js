import { sequelize, models } from '../config/database.js';
import { aiService } from './ai/ai.service.js';
import { env } from '../config/env.js';

let isVectorExtensionEnabled = null;

/**
 * Checks if the pgvector extension is active in the database.
 */
async function checkVectorExtension() {
  if (isVectorExtensionEnabled !== null) return isVectorExtensionEnabled;
  if (sequelize.options.dialect !== 'postgres') {
    isVectorExtensionEnabled = false;
    return false;
  }
  try {
    const [res] = await sequelize.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'");
    isVectorExtensionEnabled = res.length > 0;
  } catch {
    isVectorExtensionEnabled = false;
  }
  return isVectorExtensionEnabled;
}

/**
 * Calculates cosine similarity between two numeric arrays.
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Executes semantic similarity candidate retrieval.
 */
export async function querySemanticMatches({ userId, queryText, entityTypes, limit = 20 }) {
  if (!env.aiEnabled || env.semanticSearchEnabled === false) {
    return [];
  }

  const modelName = env.ollamaEmbeddingModel || 'mock';
  const queryEmbedding = await aiService.generateEmbedding(queryText, modelName);

  const hasVector = await checkVectorExtension();

  if (hasVector) {
    // 1. Native pgvector similarity search
    const queryEmbeddingStr = `[${queryEmbedding.join(',')}]`;
    const results = await sequelize.query(`
      SELECT entity_id, entity_type, (1 - (embedding <=> :queryEmbeddingStr::vector)) as similarity
      FROM semantic_embeddings
      WHERE user_id = :userId AND entity_type IN (:entityTypes) AND embedding_model = :modelName
      ORDER BY similarity DESC
      LIMIT :limit
    `, {
      replacements: { userId, entityTypes, queryEmbeddingStr, limit, modelName },
      type: sequelize.QueryTypes.SELECT
    });

    return results.map(r => ({
      entityId: r.entity_id,
      entityType: r.entity_type,
      similarity: parseFloat(r.similarity || 0)
    }));
  } else {
    // 2. JS-based Cosine Similarity Fallback
    const embeddings = await models.SemanticEmbedding.findAll({
      where: {
        userId,
        entityType: entityTypes,
        embeddingModel: modelName
      }
    });

    const candidates = embeddings.map(e => {
      let vectorArray = e.embedding;
      if (typeof vectorArray === 'string') {
        try {
          vectorArray = JSON.parse(vectorArray);
        } catch {
          // Ignore
        }
      }
      const similarity = cosineSimilarity(queryEmbedding, vectorArray);
      return {
        entityId: e.entityId,
        entityType: e.entityType,
        similarity
      };
    });

    // Sort descending
    candidates.sort((a, b) => b.similarity - a.similarity);
    return candidates.slice(0, limit);
  }
}
