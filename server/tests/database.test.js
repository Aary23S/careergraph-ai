import { sequelize, models, resetDatabase } from '../src/config/database.js';

describe('database configuration', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    if (sequelize) {
      await sequelize.close();
    }
  });

  it('can authenticate with database when configured', async () => {
    await expect(sequelize.authenticate()).resolves.toBeUndefined();
  });

  it('does not fail when a job has no user owner (hook check)', async () => {
    const job = await models.Job.create({
      title: 'Unowned Test Job',
      company: 'Example Corp',
      location: 'Remote',
    });

    expect(job).toBeDefined();
    expect(job.matchScore).toBe(0);
  });
});
