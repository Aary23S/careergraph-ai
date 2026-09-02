import { models } from './src/config/database.js';

async function check() {
  try {
    const count = await models.JobIngestionEvent.count({ where: { sourceType: 'linkedin_email' } });
    console.log(`Total JobIngestionEvents for linkedin_email: ${count}`);
    
    // Also check how many integrations exist
    const ints = await models.GmailIntegration.findAll();
    console.log(`Integrations: ${ints.length}`);
    if (ints.length > 0) {
      console.log(`Label in env: ${process.env.GMAIL_JOB_LABEL}`);
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
check();
