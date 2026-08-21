import { sequelize, models } from '../src/config/database.js';
import { enrichConnectionData } from '../src/services/connection-intelligence.service.js';

async function runBackfill() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  console.log(`Starting backfill. Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}${limit ? `, Limit: ${limit}` : ''}`);

  try {
    const beforeCount = await models.Connection.count();
    console.log(`Connection count before: ${beforeCount}`);

    let lastId = null;
    let processed = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];

    const batchSize = 100;
    const { Op } = sequelize.Sequelize;

    // Distributions
    const seniorityDist = {};
    const roleDist = {};

    let missingCompany = 0;
    let missingTitle = 0;
    let missingEmail = 0;
    let missingUrl = 0;

    // Fetch batch by batch using cursor-based pagination
    while (true) {
      if (limit && processed >= limit) {
        break;
      }

      const currentBatchSize = limit ? Math.min(batchSize, limit - processed) : batchSize;

      const queryOptions = {
        where: lastId ? { id: { [Op.gt]: lastId } } : {},
        order: [['id', 'ASC']],
        limit: currentBatchSize,
      };

      const connections = await models.Connection.findAll(queryOptions);
      if (connections.length === 0) {
        break;
      }

      for (const connection of connections) {
        try {
          const rawCompany = connection.company;
          const rawTitle = connection.title;
          const rawEmail = connection.email;
          const rawUrl = connection.profileUrl;

          // Track missing metrics
          if (!rawCompany) missingCompany++;
          if (!rawTitle) missingTitle++;
          if (!rawEmail) missingEmail++;
          if (!rawUrl) missingUrl++;

          // Perform transformation in-memory
          enrichConnectionData(connection);

          // Track distributions
          seniorityDist[connection.seniorityLevel] = (seniorityDist[connection.seniorityLevel] || 0) + 1;
          roleDist[connection.roleCategory] = (roleDist[connection.roleCategory] || 0) + 1;

          if (dryRun) {
            console.log(`\n[DRY RUN] Connection ID: ${connection.id}`);
            console.log(`Raw company: ${rawCompany} -> Normalized: ${connection.normalizedCompany}`);
            console.log(`Raw title: ${rawTitle} -> Normalized: ${connection.normalizedPosition}`);
            console.log(`Seniority: ${connection.seniorityLevel}`);
            console.log(`Role category: ${connection.roleCategory}`);
            console.log(`Profile completeness: ${connection.profileCompleteness}`);
            console.log(`Connection score: ${connection.connectionScore}`);
            skippedCount++;
          } else {
            // Save to database
            await connection.save();
            
            // Safety check: verify raw fields did not change
            if (connection.company !== rawCompany ||
                connection.title !== rawTitle ||
                connection.email !== rawEmail ||
                connection.profileUrl !== rawUrl) {
              throw new Error('Safety check failed: Raw fields mutated during save!');
            }
            updatedCount++;
          }
        } catch (err) {
          errorCount++;
          errors.push({ id: connection.id, error: err.message });
          console.error(`Error processing connection ${connection.id}: ${err.message}`);
        }

        processed++;
        lastId = connection.id;
      }

      console.log(`Processed ${processed} records...`);
    }

    const afterCount = await models.Connection.count();

    console.log('\n==================================================');
    console.log('FINAL BACKFILL REPORT');
    console.log('==================================================');
    console.log(`Total processed:       ${processed}`);
    console.log(`Updated:               ${updatedCount}`);
    console.log(`Skipped (Dry Run):     ${skippedCount}`);
    console.log(`Errors:                ${errorCount}`);
    console.log(`Before count:          ${beforeCount}`);
    console.log(`After count:           ${afterCount}`);
    console.log('\n--- Missing Fields ---');
    console.log(`Missing Company:       ${missingCompany}`);
    console.log(`Missing Title:         ${missingTitle}`);
    console.log(`Missing Email:         ${missingEmail}`);
    console.log(`Missing Profile URL:   ${missingUrl}`);
    console.log('\n--- Seniority Distribution ---');
    console.log(JSON.stringify(seniorityDist, null, 2));
    console.log('\n--- Role Distribution ---');
    console.log(JSON.stringify(roleDist, null, 2));

    if (errors.length > 0) {
      console.error('\n--- Failure List ---');
      errors.forEach(e => console.error(`ID: ${e.id} | Reason: ${e.error}`));
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error(`Backfill failed with unhandled error: ${err.message}`);
    process.exit(1);
  }
}

runBackfill();
