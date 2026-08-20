import { jest } from '@jest/globals';

describe('environment validation', () => {
  it('accepts a valid database URL', async () => {
    const previousUrl = process.env.DATABASE_URL;
    const previousDialect = process.env.DATABASE_DIALECT;
    const previousEnv = process.env.NODE_ENV;

    process.env.DATABASE_DIALECT = 'postgres';
    process.env.DATABASE_URL = `postgresql://postgres:aary234786@localhost:5432/careergraph_test`;
    process.env.NODE_ENV = 'test';

    await jest.isolateModulesAsync(async () => {
      await expect(import('../src/config/env.js')).resolves.not.toThrow();
    });

    process.env.DATABASE_URL = previousUrl;
    process.env.DATABASE_DIALECT = previousDialect;
    process.env.NODE_ENV = previousEnv;
  });
});
