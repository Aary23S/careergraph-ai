import fs from 'fs';
import path from 'path';
import { env } from '../src/config/env.js';
import { connectDatabase, models, sequelize } from '../src/config/database.js';

export async function resetDemoDataset() {
  const isDemo = env.demoMode || process.env.DEMO_MODE === 'true' || process.argv.includes('--force');
  if (!isDemo && env.nodeEnv === 'production') {
    throw new Error('Demo reset refused: DEMO_MODE must be enabled and environment cannot be production.');
  }

  console.log('Connecting to database...');
  await connectDatabase();
  await sequelize.sync();

  const root = path.join(process.cwd(), 'tests', 'demo', 'fixtures');
  const userFixture = JSON.parse(fs.readFileSync(path.join(root, 'demo-user.json'), 'utf8'));
  const jobsFixture = JSON.parse(fs.readFileSync(path.join(root, 'demo-jobs.json'), 'utf8'));
  const connectionsFixture = JSON.parse(fs.readFileSync(path.join(root, 'demo-connections.json'), 'utf8'));
  const applicationsFixture = JSON.parse(fs.readFileSync(path.join(root, 'demo-applications.json'), 'utf8'));
  const resumeFixture = JSON.parse(fs.readFileSync(path.join(root, 'demo-resume.json'), 'utf8'));

  const demoUserId = userFixture.id;

  console.log(`Cleaning existing demo data for user ${demoUserId}...`);
  await models.ApplicationEvent.destroy({ where: { user_id: demoUserId } }).catch(() => {});
  await models.Application.destroy({ where: { user_id: demoUserId } }).catch(() => {});
  await models.OutreachEvent.destroy({ where: { user_id: demoUserId } }).catch(() => {});
  await models.Outreach.destroy({ where: { user_id: demoUserId } }).catch(() => {});
  await models.Note.destroy({ where: { user_id: demoUserId } }).catch(() => {});
  await models.Connection.destroy({ where: { user_id: demoUserId } }).catch(() => {});
  await models.Job.destroy({ where: { user_id: demoUserId } }).catch(() => {});
  await models.ResumeAiEnrichment.destroy({ where: { userId: demoUserId } }).catch(() => {});
  await models.Resume.destroy({ where: { user_id: demoUserId } }).catch(() => {});
  await models.User.destroy({ where: { id: demoUserId } }).catch(() => {});

  console.log('Seeding deterministic demo user...');
  const user = await models.User.create({
    id: userFixture.id,
    email: userFixture.email,
    passwordHash: userFixture.passwordHash,
    name: userFixture.name
  });

  console.log('Seeding deterministic demo resume...');
  const resume = await models.Resume.create({
    id: resumeFixture.id,
    user_id: user.id,
    fileName: resumeFixture.fileName,
    storageKey: resumeFixture.storageKey,
    contentType: resumeFixture.contentType,
    sizeBytes: resumeFixture.sizeBytes,
    isActive: resumeFixture.isActive
  });

  if (resumeFixture.enrichment) {
    await models.ResumeAiEnrichment.create({
      userId: user.id,
      resumeId: resume.id,
      provider: 'demo',
      model: 'deterministic',
      promptVersion: 1,
      schemaVersion: 1,
      inputHash: 'demo_resume_hash_123',
      status: 'completed',
      roleCategory: resumeFixture.enrichment.roleCategory,
      seniority: resumeFixture.enrichment.seniority,
      skills: resumeFixture.enrichment.skills,
      domains: resumeFixture.enrichment.domains,
      experienceYears: resumeFixture.enrichment.experienceYears
    });
  }

  console.log('Seeding deterministic demo companies...');
  const [companyCloudScale] = await models.Company.findOrCreate({
    where: { normalizedName: 'cloudscale' },
    defaults: { name: 'CloudScale Inc', normalizedName: 'cloudscale' }
  });
  const [companyDataScale] = await models.Company.findOrCreate({
    where: { normalizedName: 'datascale' },
    defaults: { name: 'DataScale Systems', normalizedName: 'datascale' }
  });
  const companyMap = {
    cloudscale: companyCloudScale.id,
    datascale: companyDataScale.id
  };

  console.log('Seeding deterministic demo jobs...');
  for (const j of jobsFixture) {
    await models.Job.create({
      id: j.id,
      user_id: user.id,
      company_id: companyMap[j.normalizedCompany] || companyCloudScale.id,
      title: j.title,
      company: j.company,
      normalizedCompany: j.normalizedCompany,
      description: j.description,
      location: j.location,
      employmentType: j.employmentType,
      experienceMin: j.experienceMin,
      experienceMax: j.experienceMax,
      status: j.status
    });
  }

  console.log('Seeding deterministic demo connections...');
  for (const c of connectionsFixture) {
    await models.Connection.create({
      id: c.id,
      user_id: user.id,
      name: c.name,
      title: c.title,
      company: c.company,
      normalizedCompany: c.normalizedCompany,
      email: c.email,
      relationshipStatus: c.relationshipStatus,
      notes: c.notes || null
    });
  }

  console.log('Seeding deterministic demo applications...');
  for (const a of applicationsFixture) {
    await models.Application.create({
      id: a.id,
      user_id: user.id,
      job_id: a.job_id,
      status: a.status,
      appliedAt: new Date(a.appliedAt),
      lastStatusAt: new Date(a.lastStatusAt),
      notes: a.notes || null,
      resumeId: resume.id
    });
  }

  console.log('✅ Demo dataset reset and re-seeded successfully.');
  return { demoUserId, user, resume };
}

if (process.argv[1]?.includes('demo-reset.js')) {
  resetDemoDataset()
    .then(async () => {
      await sequelize.close().catch(() => {});
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Demo reset failed:', err.message);
      await sequelize.close().catch(() => {});
      process.exit(1);
    });
}
