import { sequelize, models } from '../src/config/database.js';

async function runAudit() {
  console.log('=== CAREERGRAPH DATABASE INTEGRITY AUDIT ===');
  await sequelize.authenticate();

  // 1. Row Counts
  const connectionCount = await models.Connection.count();
  const jobCount = await models.Job.count();
  const appCount = await models.Application.count();
  const outreachCount = await models.Outreach.count();
  const noteCount = await models.Note.count();
  const viewCount = await models.SavedConnectionView.count();

  console.log(`Connections: ${connectionCount}`);
  console.log(`Jobs: ${jobCount}`);
  console.log(`Applications: ${appCount}`);
  console.log(`Outreach: ${outreachCount}`);
  console.log(`Notes: ${noteCount}`);
  console.log(`Saved Views: ${viewCount}`);

  // 2. Score bounds audits
  const invalidScores = await models.Connection.count({
    where: {
      [sequelize.Sequelize.Op.or]: [
        { connectionScore: { [sequelize.Sequelize.Op.lt]: 0 } },
        { connectionScore: { [sequelize.Sequelize.Op.gt]: 100 } },
        { profileCompleteness: { [sequelize.Sequelize.Op.lt]: 0 } },
        { profileCompleteness: { [sequelize.Sequelize.Op.gt]: 100 } }
      ]
    }
  });
  console.log(`Connections with invalid score ranges (expected 0): ${invalidScores}`);

  // 3. Ownership / Orphan audits
  const orphanConnections = await models.Connection.count({
    where: { user_id: null }
  });
  const orphanJobs = await models.Job.count({
    where: { user_id: null }
  });
  const orphanOutreach = await models.Outreach.count({
    where: { user_id: null }
  });
  const orphanViews = await models.SavedConnectionView.count({
    where: { user_id: null }
  });

  console.log(`Orphan Connections: ${orphanConnections}`);
  console.log(`Orphan Jobs: ${orphanJobs}`);
  console.log(`Orphan Outreach: ${orphanOutreach}`);
  console.log(`Orphan Saved Views: ${orphanViews}`);

  // 4. Foreign Key Integrity checks
  const orphanOutreachConnection = await models.Outreach.count({
    where: { connection_id: null }
  });
  console.log(`Outreach missing connection association (expected 0): ${orphanOutreachConnection}`);

  console.log('============================================');
  await sequelize.close();
}

runAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
