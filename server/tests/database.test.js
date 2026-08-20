import { sequelize } from '../src/config/database.js';

describe('database configuration', () => {
  afterAll(async () => {
    if (sequelize) {
      await sequelize.close();
    }
  });

  it('can authenticate with PostgreSQL when configured', async () => {
    await expect(sequelize.authenticate()).resolves.toBeUndefined();
  });
});
