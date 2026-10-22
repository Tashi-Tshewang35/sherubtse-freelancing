module.exports = {
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/backups/', '<rootDir>/.cache/', '<rootDir>/delivery/'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.afterEnv.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/backups/', '/.cache/'],
  testTimeout: 30000,
  clearMocks: true,
  collectCoverageFrom: [
    'app.js', 'server.js', 'utils/**/*.js', 'config/**/*.js',
    'controllers/**/*.js', 'middleware/**/*.js', 'models/**/*.js', 'routes/**/*.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html', 'lcov', 'json-summary'],
};
