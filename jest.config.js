/**
 * Jest configuration for testluy-payment-sdk
 */

export default {
  // Use Node.js as the test environment
  testEnvironment: 'node',
  
  // Handle ES modules
  transform: {},
  
  // Map imports to handle .js extension in imports
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  
  // Collect coverage information
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'http/**/*.js',
    '!**/node_modules/**'
  ],
  
  // Test files pattern
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  
  // Display test results with colors
  verbose: true,
  
  // Display individual test results
  reporters: ['default']
};