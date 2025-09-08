// tests/setup.js
// Global test setup that runs after environment setup

import { resetConfig } from "../app/config/index.js";
import { configMock } from "./utils/configMock.js";

// Global test configuration
const GLOBAL_TEST_TIMEOUT = 15000;

// Reset configuration before each test to ensure clean state
beforeEach(async () => {
  // Clean up any existing configuration mocks
  configMock.cleanup();

  // Reset the configuration system
  resetConfig();
});

// Clean up after each test
afterEach(() => {
  // Ensure configuration mocks are cleaned up
  configMock.cleanup();

  // Clear any Jest mocks
  jest.clearAllMocks();
});

// Global cleanup after all tests
afterAll(() => {
  // Final cleanup of configuration mocks
  configMock.cleanup();
});

// Global test timeout for configuration loading
jest.setTimeout(GLOBAL_TEST_TIMEOUT);

// Global error handling for unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit the process in tests, just log the error
});

// Suppress console warnings in tests unless explicitly enabled
if (process.env.JEST_VERBOSE !== "true") {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    // Only show configuration-related warnings
    const message = args.join(" ");
    if (
      message.includes("config") ||
      message.includes("Config") ||
      message.includes("environment") ||
      message.includes("validation")
    ) {
      originalWarn.apply(console, args);
    }
  };
}

// Enhanced error reporting for configuration issues
const originalError = console.error;
console.error = (...args) => {
  const message = args.join(" ");

  // Add context for configuration errors
  if (
    message.includes("config") ||
    message.includes("Config") ||
    message.includes("validation") ||
    message.includes("schema")
  ) {
    originalError.apply(console, ["[CONFIG ERROR]", ...args]);
  } else {
    originalError.apply(console, args);
  }
};
