// tests/configuration.performance.test.js
// Performance and security tests for configuration management

import { jest } from "@jest/globals";
import { configTestHelpers } from "./utils/configMock.js";
import {
  initializeConfig,
  getConfig,
  get,
  resetConfig,
} from "../app/config/index.js";

describe("Configuration Performance Tests", () => {
  afterEach(() => {
    configTestHelpers.cleanup();
  });

  describe("Configuration Loading Performance", () => {
    test("should load configuration within acceptable time limits", async () => {
      await configTestHelpers.setupConfig({
        NODE_ENV: "test",
        BEACON_AUTH: "test-auth-token-12345",
        MONGO_URI: "mongodb://localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
        WA_GATEWAY_NPUB: "test-npub-12345",
      });

      const startTime = performance.now();
      initializeConfig({ throwOnValidationError: false });
      const endTime = performance.now();

      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(100); // Should load in under 100ms
    });

    test("should handle multiple rapid configuration initializations", async () => {
      await configTestHelpers.setupConfig({
        NODE_ENV: "test",
        BEACON_AUTH: "test-auth-token-12345",
        MONGO_URI: "mongodb://localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
        WA_GATEWAY_NPUB: "test-npub-12345",
      });

      const iterations = 50;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        resetConfig();
        initializeConfig({ throwOnValidationError: false });
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      expect(averageTime).toBeLessThan(10); // Average should be under 10ms per initialization
    });

    test("should efficiently access configuration values", async () => {
      await configTestHelpers.setupConfig({
        NODE_ENV: "test",
        BEACON_AUTH: "test-auth-token-12345",
        MONGO_URI: "mongodb://localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
        WA_GATEWAY_NPUB: "test-npub-12345",
        PORT: "3001",
        DEBUG: "true",
      });

      initializeConfig();

      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        get("BEACON_AUTH");
        get("PORT");
        get("DEBUG");
        getConfig();
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      expect(averageTime).toBeLessThan(1); // Should be very fast - under 1ms per access
    });

    test("should handle large configuration schemas efficiently", async () => {
      // Create a large configuration object
      const largeConfig = {};
      for (let i = 0; i < 100; i++) {
        largeConfig[`TEST_VAR_${i}`] = `value_${i}`;
      }

      await configTestHelpers.setupConfig({
        NODE_ENV: "test",
        BEACON_AUTH: "test-auth-token-12345",
        MONGO_URI: "mongodb://localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
        WA_GATEWAY_NPUB: "test-npub-12345",
        ...largeConfig,
      });

      const startTime = performance.now();
      initializeConfig({ throwOnValidationError: false });
      const endTime = performance.now();

      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(200); // Should still load quickly even with many variables
    });
  });

  describe("Memory Usage Tests", () => {
    test("should not leak memory during configuration resets", async () => {
      await configTestHelpers.setupConfig({
        NODE_ENV: "test",
        BEACON_AUTH: "test-auth-token-12345",
        MONGO_URI: "mongodb://localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
        WA_GATEWAY_NPUB: "test-npub-12345",
      });

      // Measure memory before
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many configuration operations
      for (let i = 0; i < 100; i++) {
        initializeConfig({ throwOnValidationError: false });
        getConfig();
        resetConfig();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });
  });
});

describe("Configuration Security Tests", () => {
  afterEach(() => {
    configTestHelpers.cleanup();
  });

  describe("Sensitive Data Protection", () => {
    test("should redact sensitive configuration values in logs", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await configTestHelpers.setupConfig({
        NODE_ENV: "development",
        BEACON_AUTH: "super-secret-auth-token-12345",
        PASSWORD: "secret-password",
        SECRET_KEY: "secret-key-123",
        MONGO_URI: "mongodb://user:password@localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
        WA_GATEWAY_NPUB: "test-npub-12345",
      });

      initializeConfig({ logWarnings: true });

      // Check that sensitive values are redacted in logs
      const logCalls = consoleSpy.mock.calls;
      const logOutput = logCalls.map((call) => call.join(" ")).join(" ");

      expect(logOutput).not.toContain("super-secret-auth-token-12345");
      expect(logOutput).not.toContain("secret-password");
      expect(logOutput).not.toContain("secret-key-123");

      // Should contain redacted versions
      expect(logOutput).toMatch(/\*{3,}/); // Should contain asterisks for redaction

      consoleSpy.mockRestore();
    });

    test("should not expose sensitive data in error messages", async () => {
      await configTestHelpers.setupConfig({
        NODE_ENV: "test",
        BEACON_AUTH: "super-secret-auth-token-12345",
        // Missing required fields to trigger validation errors
        MONGO_URI: "mongodb://localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
      });

      const result = initializeConfig({ throwOnValidationError: false });

      expect(result.isValid).toBe(false);

      // Check that error messages don't contain sensitive data
      const errorMessages = result.errors
        .map((error) => error.message)
        .join(" ");
      expect(errorMessages).not.toContain("super-secret-auth-token-12345");
    });

    test("should handle configuration injection attempts", async () => {
      // Test potential injection through environment variables
      await configTestHelpers.setupConfig({
        NODE_ENV: "test",
        BEACON_AUTH: "test-auth-token-12345",
        MONGO_URI: "mongodb://localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
        WA_GATEWAY_NPUB: "test-npub-12345",
        // Potential injection attempts
        MALICIOUS_SCRIPT: '<script>alert("xss")</script>',
        SQL_INJECTION: "'; DROP TABLE users; --",
        COMMAND_INJECTION: "$(rm -rf /)",
      });

      const result = initializeConfig({ throwOnValidationError: false });

      // Configuration should load but malicious values should be handled safely
      expect(result.isValid).toBe(true);

      // Values should be stored as-is but not executed
      expect(get("MALICIOUS_SCRIPT")).toBe('<script>alert("xss")</script>');
      expect(get("SQL_INJECTION")).toBe("'; DROP TABLE users; --");
      expect(get("COMMAND_INJECTION")).toBe("$(rm -rf /)");
    });
  });

  describe("Configuration Validation Security", () => {
    test("should validate configuration types to prevent type confusion", async () => {
      await configTestHelpers.setupConfig({
        NODE_ENV: "test",
        BEACON_AUTH: "test-auth-token-12345",
        MONGO_URI: "mongodb://localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
        WA_GATEWAY_NPUB: "test-npub-12345",
        PORT: "not-a-number", // Should be a number
        DEBUG: "not-a-boolean", // Should be a boolean
      });

      const result = initializeConfig({ throwOnValidationError: false });

      // Should handle type validation properly
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some(
          (error) =>
            error.message.includes("PORT") || error.message.includes("number")
        )
      ).toBe(true);
    });

    test("should enforce configuration constraints for security", async () => {
      await configTestHelpers.setupConfig({
        NODE_ENV: "test",
        BEACON_AUTH: "short", // Too short - security risk
        MONGO_URI: "mongodb://localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
        WA_GATEWAY_NPUB: "test-npub-12345",
        PORT: "99999", // Invalid port range
      });

      const result = initializeConfig({ throwOnValidationError: false });

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((error) => error.message.includes("BEACON_AUTH"))
      ).toBe(true);
      expect(
        result.errors.some((error) => error.message.includes("PORT"))
      ).toBe(true);
    });

    test("should prevent configuration tampering during runtime", async () => {
      await configTestHelpers.setupConfig({
        NODE_ENV: "test",
        BEACON_AUTH: "test-auth-token-12345",
        MONGO_URI: "mongodb://localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
        WA_GATEWAY_NPUB: "test-npub-12345",
      });

      initializeConfig();
      const config = getConfig();

      // Attempt to modify configuration object
      const originalAuth = config.auth.beaconAuth;
      config.auth.beaconAuth = "tampered-value";

      // Configuration should be protected from modification
      const configAfterTampering = getConfig();
      expect(configAfterTampering.auth.beaconAuth).toBe(originalAuth);
    });
  });

  describe("Environment Isolation", () => {
    test("should isolate test environment from other environments", async () => {
      await configTestHelpers.setupConfig({
        NODE_ENV: "test",
        BEACON_AUTH: "test-auth-token-12345",
        MONGO_URI: "mongodb://localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
        WA_GATEWAY_NPUB: "test-npub-12345",
      });

      initializeConfig();
      const config = getConfig();

      // Test environment should use test-specific values
      expect(config.server.nodeEnv).toBe("test");
      expect(config.database.mongoUri).toContain("beacon_test");

      // Should not accidentally use production values
      expect(config.database.mongoUri).not.toContain("beacon_prod");
      expect(config.database.mongoUri).not.toContain("beacon_production");
    });

    test("should prevent cross-environment configuration leakage", async () => {
      // Simulate production environment variables being present
      const originalNodeEnv = process.env.NODE_ENV;
      const originalProdAuth = process.env.PROD_BEACON_AUTH;

      try {
        process.env.PROD_BEACON_AUTH = "production-secret-token";

        await configTestHelpers.setupConfig({
          NODE_ENV: "test",
          BEACON_AUTH: "test-auth-token-12345",
          MONGO_URI: "mongodb://localhost:27017/beacon_test",
          REDIS_URL: "redis://127.0.0.1:6379",
          WA_GATEWAY_NPUB: "test-npub-12345",
        });

        initializeConfig();

        // Should not accidentally use production values
        expect(get("BEACON_AUTH")).toBe("test-auth-token-12345");
        expect(get("BEACON_AUTH")).not.toBe("production-secret-token");
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalProdAuth) {
          process.env.PROD_BEACON_AUTH = originalProdAuth;
        } else {
          delete process.env.PROD_BEACON_AUTH;
        }
      }
    });
  });
});
