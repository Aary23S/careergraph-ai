import { sequelize, models } from './src/config/database.js';
import { getPagination } from './src/lib/pagination.js';
import { calculateMatchScore } from './src/services/intelligence.service.js';

async function run() {
  try {
    await sequelize.authenticate();
    const jobId = 'ce099a0c-b22f-440f-9f05-6ad6b2fb4bd5';
    
    console.time('fetchJob');
    const job = await models.Job.findOne({
      where: { id: jobId },
      include: [
        { model: models.Company, as: 'company' },
        { model: models.JobAiEnrichment, as: 'aiEnrichment' }
      ],
    });
    console.timeEnd('fetchJob');

    if (!job) {
      console.log('Job not found locally.');
      process.exit(0);
    }

    const userId = job.user_id;

    console.time('fetchProfile');
    const profile = await models.Profile.findOne({ where: { user_id: userId } });
    console.timeEnd('fetchProfile');

    console.time('fetchResume');
    const activeResume = await models.Resume.findOne({
        where: { user_id: userId, isActive: true },
        include: [{ model: models.ResumeAiEnrichment, as: 'aiEnrichment' }]
    });
    console.timeEnd('fetchResume');

    const mergedProfile = profile ? profile.toJSON() : { skills: [], targetRoles: [] };
    
    console.time('matchScore');
    let matchScore = calculateMatchScore(mergedProfile, job, {
      resumeEnrichment: activeResume?.aiEnrichment,
      jobEnrichment: job.aiEnrichment,
    });
    console.timeEnd('matchScore');

    console.time('fetchConnections');
    const allConnections = await models.Connection.findAll({
      where: {
        user_id: userId
      }
    });
    console.log('Total connections:', allConnections.length);
    console.timeEnd('fetchConnections');

    console.time('filterConnections');
    let connections = [];
    if (job.company) {
      const cleanCompanyName = str => (str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const targetCompanyKey = cleanCompanyName(job.company.normalizedName || job.company.name);
      connections = allConnections.filter(conn => {
        return cleanCompanyName(conn.company) === targetCompanyKey || cleanCompanyName(conn.normalizedCompany) === targetCompanyKey;
      });
    }
    console.timeEnd('filterConnections');

    console.time('application');
    const app = await models.Application.findOne({
      where: { job_id: job.id, user_id: userId },
      include: [{ model: models.ApplicationEvent, as: 'events' }]
    });
    console.timeEnd('application');
    
    console.log('Done!');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
