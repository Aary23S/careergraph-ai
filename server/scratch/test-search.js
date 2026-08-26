import { querySemanticMatches } from '../src/services/semantic-search.service.js';
import { models, connectDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';

async function test() {
  env.aiEnabled = true;
  
  await connectDatabase();
  console.log('Connected to database.');

  const userId = '1df830db-bca5-450f-9210-0768017509ae'; // Use a dummy or first user ID from DB
  const user = await models.User.findOne();
  if (!user) {
    console.error('No users found in database to run search test.');
    process.exit(1);
  }

  console.log(`Running test search for User: ${user.email} (${user.id})`);

  try {
    const matches = await querySemanticMatches({
      userId: user.id,
      queryText: 'React frontend engineer',
      entityTypes: ['job'],
      limit: 5
    });

    console.log('Query matches successfully returned:', matches);
    
    // Simulate routes result mapper
    const results = [];
    for (const match of matches) {
      const job = await models.Job.findOne({
        where: { id: match.entityId, user_id: user.id },
        include: [{ model: models.JobAiEnrichment, as: 'aiEnrichment' }]
      });

      if (!job) continue;

      results.push({
        job: job.title,
        similarity: match.similarity
      });
    }

    console.log('Successfully completed mapping results:', results);
  } catch (err) {
    console.error('Error during semantic search execution:', err);
  }

  process.exit(0);
}

test().catch(console.error);
