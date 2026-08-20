export default {
  testEnvironment: 'node',
  transform: {},
  setupFiles: ['./jest.setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  maxWorkers: 1,
};
