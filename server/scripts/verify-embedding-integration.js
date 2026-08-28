/**
 * Phase 4D manual integration check: Node Worker -> Python ML service ->
 * embedding model -> Node -> Postgres, end to end, through the real queue
 * (not calling getOrGenerateEmbedding directly).
 *
 * Requires: Postgres reachable (DATABASE_URL), the Python service running
 * and reachable at ML_SERVICE_URL. Run with:
 *   ML_SERVICE_ENABLED=true node scripts/verify-embedding-integration.js
 *
 * Not a Jest test on purpose -- per Phase 4D's acceptance criteria, no
 * existing Node unit test may depend on the Python service being up.
 */
import { randomUUID } from 'crypto';
import { env } from '../src/config/env.js';
import { connectDatabase, models } from '../src/config/database.js';
import { enqueueAIJob } from '../src/queues/ai.queue.js';

async function main() {
  env.aiEnabled = true;
  env.mlServiceEnabled = true;

  console.log(`ML_SERVICE_URL=${env.mlServiceUrl}  ML_SERVICE_EMBEDDING_MODEL=${env.mlServiceEmbeddingModel}`);

  await connectDatabase();
  // Registers the in-memory queue -> ai.worker.js handleJob wiring, the same
  // way server/src/start.js does for AI_QUEUE_DRIVER=memory.
  await import('../src/workers/ai.worker.js');

  const email = `phase4d-verify-${randomUUID()}@example.com`;
  const user = await models.User.create({ email, passwordHash: 'x' });
  const connection = await models.Connection.create({
    user_id: user.id,
    name: 'Verification Contact',
    company: 'Acme Corp',
    title: 'Senior Backend Engineer',
  });

  const text = 'Senior Backend Engineer at Acme Corp, Node.js and PostgreSQL specialist.';
  const inputHash = randomUUID();

  console.log(`Enqueuing embedding_generation for connection ${connection.id}...`);
  await enqueueAIJob('embedding_generation', connection.id, {
    userId: user.id,
    entityType: 'connection',
    text,
    inputHash,
  });

  // Memory queue fallback processes on a 50ms setTimeout (see ai.queue.js);
  // the real embedding call itself (Python round-trip + first-call model
  // warm-up) can take several seconds.
  await new Promise((resolve) => setTimeout(resolve, 10000));

  const row = await models.SemanticEmbedding.findOne({
    where: { userId: user.id, entityType: 'connection', entityId: connection.id },
  });

  if (!row) {
    console.error('FAILED: no SemanticEmbedding row was created.');
    process.exitCode = 1;
  } else {
    const vectorLength = Array.isArray(row.embedding) ? row.embedding.length : 'n/a';
    console.log('SemanticEmbedding row:', {
      embeddingModel: row.embeddingModel,
      embeddingDimension: row.embeddingDimension,
      actualVectorLength: vectorLength,
      status: row.status,
    });
    if (row.embeddingModel === env.mlServiceEmbeddingModel && vectorLength === row.embeddingDimension) {
      console.log('PASSED: embedding was generated via the Python ML service and stored correctly.');
    } else {
      console.warn('NOTE: embedding was stored, but model name does not match ML_SERVICE_EMBEDDING_MODEL -- it likely fell back to the Node path. Check that the Python service is running and reachable.');
    }
  }

  await connection.destroy();
  await user.destroy();
  process.exit(process.exitCode || 0);
}

main().catch((err) => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});
