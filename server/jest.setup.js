process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '5000';

// Tests must always run against an isolated, disposable database - never a
// real Postgres instance a developer's shell happens to have DATABASE_DIALECT
// / DATABASE_URL exported for (e.g. left over from running db:migrate or the
// dev server in the same terminal). Force these unconditionally rather than
// falling back with `||`, since inheriting a stale Postgres override here
// previously caused `npm test` to run destructive `sequelize.sync({force})`
// calls against a real database instead of an in-memory SQLite one.
process.env.DATABASE_DIALECT = 'sqlite';
process.env.DATABASE_STORAGE = ':memory:';
delete process.env.DATABASE_URL;

process.env.CORS_ORIGIN =
    process.env.CORS_ORIGIN || 'http://localhost:5173';

process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET || 'ci-test-access-secret';

process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET || 'ci-test-refresh-secret';
