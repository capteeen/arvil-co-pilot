module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  // Skip tests in src/commands
  testPathIgnorePatterns: [
    '/node_modules/',
    '/src/commands/'
  ],
  verbose: true,
  // Set a longer timeout for CLI tests
  testTimeout: 30000
}; 