process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '5000';

process.env.DATABASE_DIALECT =
    process.env.DATABASE_DIALECT || 'sqlite';

process.env.DATABASE_STORAGE =
    process.env.DATABASE_STORAGE || ':memory:';

process.env.CORS_ORIGIN =
    process.env.CORS_ORIGIN || 'http://localhost:5173';

process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET || 'ci-test-access-secret';

process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET || 'ci-test-refresh-secret';
