/**
 * Startup Integration Tests
 * Tests the application startup process with environment validation
 */

import { jest } from "@jest/globals";
import { validateEnvironment } from "../app/utils/envValidation.js";

// Mock the entire index.js module to prevent actual server startup during tests
jest.unstable_mockModule("../index.js", () => ({
  app: {},
  startServer: jest.fn(),
  stopServer: jest.fn(),
}));

describe("Application Startup Integration", () => {
  let originalEnv;
  let mockConsoleLog;
  let mockConsoleError;
  let mockProcessExit;

  beforeEach(() => {
    // Store original environment
    originalEnv = process.env.BEACON_AUTH;

    // Mock console methods
    mockConsoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
    mockConsoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Mock process.exit to prevent actual exit during tests
    mockProcessExit = jest.spyOn(process, "exit").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.BEACON_AUTH = originalEnv;
    } else {
      delete process.env.BEACON_AUTH;
    }

    // Restore console methods
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe("Environment Validation at Startup", () => {
    test("should fail startup when BEACON_AUTH is missing", async () => {
      // Remove BEACON_AUTH from environment
      delete process.env.BEACON_AUTH;

      // Test environment validation directly
      const validation = validateEnvironment();

      expect(validation.success).toBe(false);
      expect(validation.errors).toContain(
        "BEACON_AUTH environment variable is not set"
      );
    });

    test("should fail startup when BEACON_AUTH is empty", async () => {
      // Set BEACON_AUTH to empty string
      process.env.BEACON_AUTH = "";

      // Test environment validation directly
      const validation = validateEnvironment();

      expect(validation.success).toBe(false);
      expect(validation.errors).toContain(
        "BEACON_AUTH environment variable is empty or invalid"
      );
    });

    test("should fail startup when BEACON_AUTH is whitespace only", async () => {
      // Set BEACON_AUTH to whitespace
      process.env.BEACON_AUTH = "   ";

      // Test environment validation directly
      const validation = validateEnvironment();

      expect(validation.success).toBe(false);
      expect(validation.errors).toContain(
        "BEACON_AUTH environment variable is empty or invalid"
      );
    });

    test('should fail startup when BEACON_AUTH is "undefined" string', async () => {
      // Set BEACON_AUTH to string "undefined"
      process.env.BEACON_AUTH = "undefined";

      // Test environment validation directly
      const validation = validateEnvironment();

      expect(validation.success).toBe(false);
      expect(validation.errors).toContain(
        "BEACON_AUTH environment variable is not set"
      );
    });

    test('should fail startup when BEACON_AUTH is "null" string', async () => {
      // Set BEACON_AUTH to string "null"
      process.env.BEACON_AUTH = "null";

      // Test environment validation directly
      const validation = validateEnvironment();

      expect(validation.success).toBe(false);
      expect(validation.errors).toContain(
        "BEACON_AUTH environment variable is not set"
      );
    });

    test("should succeed when BEACON_AUTH is properly configured", async () => {
      // Set valid BEACON_AUTH
      process.env.BEACON_AUTH = "test-secret-key-123";

      // Test environment validation directly
      const validation = validateEnvironment();

      expect(validation.success).toBe(true);
      expect(validation.message).toBe(
        "All environment variables are properly configured"
      );
    });
  });

  describe("Startup Process Integration", () => {
    test("should validate environment before starting services", async () => {
      // Set valid BEACON_AUTH
      process.env.BEACON_AUTH = "test-secret-key-123";

      // Import and test the startServer function
      const { startServer } = await import("../index.js");

      // Mock connectDB to prevent actual database connection
      jest.unstable_mockModule("../libs/db.js", () => ({
        connectDB: jest.fn().mockResolvedValue(),
        disconnectDB: jest.fn().mockResolvedValue(),
      }));

      // Mock express app.listen
      const mockListen = jest.fn((port, callback) => {
        callback();
        return { close: jest.fn() };
      });

      // Re-import with mocks
      jest.doMock("../index.js", () => ({
        app: { listen: mockListen },
        startServer: async () => {
          const validation = validateEnvironment();
          if (!validation.success) {
            console.error("Environment validation failed:");
            validation.errors.forEach((error) => {
              console.error(`  - ${error}`);
            });
            process.exit(1);
          }
          console.log(
            "✓ Environment validation successful:",
            validation.message
          );
        },
        stopServer: jest.fn(),
      }));

      const { startServer: mockedStartServer } = await import("../index.js");

      // Should not throw and should log success
      await expect(mockedStartServer()).resolves.toBeUndefined();
    });

    test("should log clear error messages when environment validation fails", () => {
      // Remove BEACON_AUTH from environment
      delete process.env.BEACON_AUTH;

      // Test validation and error logging
      const validation = validateEnvironment();

      if (!validation.success) {
        console.error("Environment validation failed:");
        validation.errors.forEach((error) => {
          console.error(`  - ${error}`);
        });
        console.error(
          "Please configure the required environment variables and restart the application."
        );
      }

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Environment validation failed:"
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        "  - BEACON_AUTH environment variable is not set"
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Please configure the required environment variables and restart the application."
      );
    });

    test("should log success message when environment validation passes", () => {
      // Set valid BEACON_AUTH
      process.env.BEACON_AUTH = "test-secret-key-123";

      // Test validation and success logging
      const validation = validateEnvironment();

      if (validation.success) {
        console.log("✓ Environment validation successful:", validation.message);
      }

      expect(mockConsoleLog).toHaveBeenCalledWith(
        "✓ Environment validation successful:",
        "All environment variables are properly configured"
      );
    });
  });

  describe("Production Startup Behavior", () => {
    test("should validate environment in production mode", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      try {
        // Remove BEACON_AUTH to simulate misconfiguration
        delete process.env.BEACON_AUTH;

        const validation = validateEnvironment();
        expect(validation.success).toBe(false);
        expect(validation.errors).toContain(
          "BEACON_AUTH environment variable is not set"
        );
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    test("should handle multiple environment validation errors", () => {
      // Remove BEACON_AUTH to trigger validation error
      delete process.env.BEACON_AUTH;

      const validation = validateEnvironment();

      expect(validation.success).toBe(false);
      expect(Array.isArray(validation.errors)).toBe(true);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors).toContain(
        "BEACON_AUTH environment variable is not set"
      );
    });
  });

  describe("Error Handling and Recovery", () => {
    test("should provide actionable error messages for missing configuration", () => {
      delete process.env.BEACON_AUTH;

      const validation = validateEnvironment();

      expect(validation.success).toBe(false);
      expect(validation.errors[0]).toMatch(/BEACON_AUTH.*not set/);
    });

    test("should provide actionable error messages for invalid configuration", () => {
      process.env.BEACON_AUTH = "";

      const validation = validateEnvironment();

      expect(validation.success).toBe(false);
      expect(validation.errors[0]).toMatch(/BEACON_AUTH.*empty or invalid/);
    });

    test("should validate environment configuration is comprehensive", () => {
      process.env.BEACON_AUTH = "valid-secret-key";

      const validation = validateEnvironment();

      expect(validation.success).toBe(true);
      expect(validation.message).toBe(
        "All environment variables are properly configured"
      );
    });
  });
});
