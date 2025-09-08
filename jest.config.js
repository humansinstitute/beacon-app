export default {
  // ES Modules configuration
  preset: null,
  transform: {
    "^.+\\.js$": "babel-jest",
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  // Enhanced ES modules support
  transformIgnorePatterns: [
    "/node_modules/(?!(uuid|@jest/transform|@jest/environment|@babel/runtime)/)/",
  ],

  // Test environment configuration
  testEnvironment: "node",

  // Global setup and teardown
  setupFiles: ["<rootDir>/tests/env.setup.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],

  // Test file patterns
  testMatch: ["<rootDir>/tests/**/*.test.js", "<rootDir>/tests/**/*.spec.js"],

  // Coverage configuration
  collectCoverageFrom: [
    "app/**/*.js",
    "libs/**/*.js",
    "!app/**/*.test.js",
    "!app/**/*.spec.js",
    "!**/node_modules/**",
  ],

  // Test timeout for configuration loading
  testTimeout: 15000,

  // Verbose output for configuration debugging
  verbose: process.env.NODE_ENV === "development",

  // Clear mocks between tests for configuration isolation
  clearMocks: true,
  restoreMocks: true,

  // Configuration-specific test environment variables
  testEnvironmentOptions: {
    NODE_ENV: "test",
  },

  // Module directories for configuration utilities
  moduleDirectories: [
    "node_modules",
    "<rootDir>/tests/utils",
    "<rootDir>/app",
    "<rootDir>/libs",
  ],

  // Global variables for configuration testing
  globals: {
    "process.env.NODE_ENV": "test",
  },
};
