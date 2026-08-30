process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '5000';

// A local `npm test` run must always use an isolated, disposable database -
// never a real Postgres instance a developer's shell happens to have
// DATABASE_DIALECT / DATABASE_URL exported for (e.g. left over from running
// db:migrate or the dev server in the same terminal) - that previously
// caused `npm test` to run destructive `sequelize.sync({force})` calls
// against a real database instead of an in-memory SQLite one.
//
// CI is different: .github/workflows/ci.yml deliberately provisions a fresh,
// ephemeral Postgres service container and runs migrations against it so
// tests exercise real Postgres-only SQL behavior (e.g. ILIKE) before merge.
// That DATABASE_DIALECT=postgres/DATABASE_URL is intentional workflow
// config, not stale shell state, so it must be respected there instead of
// being overridden to sqlite.
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

if (isCI) {
    process.env.DATABASE_DIALECT = process.env.DATABASE_DIALECT || 'sqlite';
    process.env.DATABASE_STORAGE = process.env.DATABASE_STORAGE || ':memory:';
} else {
    process.env.DATABASE_DIALECT = 'sqlite';
    process.env.DATABASE_STORAGE = ':memory:';
    delete process.env.DATABASE_URL;
}

process.env.CORS_ORIGIN =
    process.env.CORS_ORIGIN || 'http://localhost:5173';

process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET || 'ci-test-access-secret';

process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET || 'ci-test-refresh-secret';

// AI_JOB_BACKOFF_MS defaults to 5000ms (production value) via config/env.js's
// Joi schema. tests/ai-foundation.test.js exercises 2 REAL retries through
// the actual AIService retry/backoff logic (not mocked), which at the
// production default (5000ms + 10000ms exponential backoff) exceeds Jest's
// 5000ms per-test timeout. This must live here (tracked in git) rather than
// only in the git-ignored, developer-local .env.test, since CI's workflow
// env block does not set it and would otherwise silently fall back to the
// slow production default and time out.
process.env.AI_JOB_BACKOFF_MS =
    process.env.AI_JOB_BACKOFF_MS || '5';
