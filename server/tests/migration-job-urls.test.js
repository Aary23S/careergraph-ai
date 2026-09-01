import migration from '../src/database/migrations/20260901000000-change-job-urls-to-text.cjs';
import { sequelize, models, resetDatabase } from '../src/config/database.js';
import { Sequelize } from 'sequelize';

describe('Migration: change-job-urls-to-text', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    if (sequelize) {
      await sequelize.close();
    }
  });

  it('runs up and down migration cleanly', async () => {
    const queryInterface = sequelize.getQueryInterface();

    // Test up migration
    await expect(migration.up(queryInterface, Sequelize)).resolves.not.toThrow();

    // Test down migration
    await expect(migration.down(queryInterface, Sequelize)).resolves.not.toThrow();

    // Re-run up migration to leave DB in updated state
    await migration.up(queryInterface, Sequelize);
  });

  it('stores job URLs exceeding 255 characters', async () => {
    const longUrl = 'https://www.linkedin.com/comm/jobs/view/4456824148?' + 'x'.repeat(300);
    const job = await models.Job.create({
      title: 'DevOps Engineer',
      company: 'Test Company',
      location: 'Remote',
      url: longUrl,
      sourceUrl: longUrl,
    });

    expect(job).toBeDefined();
    expect(job.url).toBe(longUrl);
    expect(job.sourceUrl).toBe(longUrl);
    expect(job.url.length).toBeGreaterThan(255);
    expect(job.sourceUrl.length).toBeGreaterThan(255);
  });
});
