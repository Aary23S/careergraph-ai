process.env.NODE_ENV = 'development';
process.env.PORT = '5000';
process.env.DATABASE_DIALECT = 'postgres';
process.env.DATABASE_URL = 'postgresql://postgres:ci_test_password@localhost:5432/careergraph_test';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET = 'REMOVED_SECRET_JWT_ACCESS';
process.env.JWT_REFRESH_SECRET = 'REMOVED_SECRET_JWT_REFRESH';
