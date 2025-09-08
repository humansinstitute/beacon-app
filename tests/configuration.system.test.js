// tests/configuration.system.test.js
// Comprehensive tests for the configuration system functionality

import { jest } from "@jest/globals";
import {
  configTestHelpers,
  configValidationHelpers,
} from "./utils/configMock.js";
import {
  initializeConfig,
  getConfig,
  get,
  has,
  resetConfig,
} from "../app/config/index.js";

describe("Configuration System", () => {
  afterEach(() => {
    configTestHelpers.cleanup();
  });

  describe("Configuration Loading", () => {
    test("should load configuration successfully with valid environment", async () => {
      await configTestHelpers.setupConfig({
        NODE_ENV: "test",
        BEACON_AUTH: "test-auth-token-12345",
        MONGO_URI: "mongodb://localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
        WA_GATEWAY_NPUB: "test-npub-12345",
      });

      const result = initializeConfig({ throwOnValidationError: false });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);

      const config = getConfig();
      expect(config).toBeDefined();
      expect(config.auth.beaconAuth).toBe("test-auth-token-12345");
      expect(config.database.mongoUri).toBe(
        "mongodb://localhost:27017/beacon_test"
      );
    });

    test("should handle missing required configuration", async () => {
      await configTestHelpers.setupConfig({
        NODE_ENV: "test",
        // Missing BEACON_AUTH
        MONGO_URI: "mongodb://localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
      });

      const result = initializeConfig({ throwOnValidationError: false });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some((error) => error.message.includes("BEACON_AUTH"))
      ).toBe(true);
    });

    test("should apply default values for optional configuration", async () => {
      await configTestHelpers.setupConfig({
        NODE_ENV: "test",
        BEACON_AUTH: "test-auth-token-12345",
        MONGO_URI: "mongodb://localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
        WA_GATEWAY_NPUB: "test-npub-12345",
        // PORT not set - should use default
      });

      initializeConfig({ throwOnValidationError: false });
      const config = getConfig();

      expect(config.server.port).toBe(3000); // Default value
      expect(config.logging.level).toBe("info"); // Default value
    });

    test("should validate configuration constraints", async () => {
      const result = await configValidationHelpers.testErrorScenario(
        {
          NODE_ENV: "test",
          BEACON_AUTH: "short", // Too short
          PORT: "99999", // Too high
          MONGO_URI: "mongodb://localhost:27017/beacon_test",
          REDIS_URL: "redis://127.0.0.1:6379",
          WA_GATEWAY_NPUB: "test-npub-12345",
        },
        ["BEACON_AUTH", "PORT"]
      );

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Configuration Access Methods", () => {
    beforeEach(async () => {
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
    });

    test("should get configuration values using get()", () => {
      expect(get("BEACON_AUTH")).toBe("test-auth-token-12345");
      expect(get("PORT")).toBe("3001");
      expect(get("DEBUG")).toBe("true");
    });

    test("should return default values for missing keys", () => {
      expect(get("NONEXISTENT_KEY", "default-value")).toBe("default-value");
      expect(get("ANOTHER_MISSING_KEY")).toBeUndefined();
    });

    test("should check key existence using has()", () => {
      expect(has("BEACON_AUTH")).toBe(true);
      expect(has("PORT")).toBe(true);
      expect(has("NONEXISTENT_KEY")).toBe(false);
    });

    test("should get structured configuration using getConfig()", () => {
      const config = getConfig();

      expect(config.auth.beaconAuth).toBe("test-auth-token-12345");
      expect(config.server.port).toBe(3001);
      expect(config.database.mongoUri).toBe(
        "mongodb://localhost:27017/beacon_test"
      );
      expect(config.logging.debug).toBe(true);
    });
  });

  describe("Configuration Scenarios", () => {
    test("should handle development environment", () => {
      configTestHelpers.applyScenario("development");
      initializeConfig({ throwOnValidationError: false });

      const config = getConfig();
      expect(config.server.nodeEnv).toBe("development");
      expect(config.logging.debug).toBe(true);
      expect(config.whatsapp.branchSessions).toBe(true);
    });

    test("should handle production environment", () => {
      configTestHelpers.applyScenario("production");
      initializeConfig({ throwOnValidationError: false });

      const config = getConfig();
      expect(config.server.nodeEnv).toBe("production");
      expect(config.logging.debug).toBe(false);
      expect(config.whatsapp.sharedSession).toBe(true);
    });

    test("should handle team collaboration scenario", () => {
      configTestHelpers.applyScenario("team-collaboration");
      initializeConfig({ throwOnValidationError: false });

      const config = getConfig();
      expect(config.whatsapp.branchSessions).toBe(true);
    });

    test("should handle Cashu-enabled scenario", () => {
      configTestHelpers.applyScenario("cashu-enabled");
      initializeConfig({ throwOnValidationError: false });

      const config = getConfig();
      expect(config.cashu.nctoolsApiUrl).toBe("http://localhost:4000");
      expect(config.cashu.minAmount).toBe(10);
      expect(config.cashu.maxAmount).toBe(50000);
    });
  });

  describe("Configuration Reset and Isolation", () => {
    test("should reset configuration properly", async () => {
      await configTestHelpers.setupConfig({
        NODE_ENV: "test",
        BEACON_AUTH: "test-auth-token-12345",
        MONGO_URI: "mongodb://localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
        WA_GATEWAY_NPUB: "test-npub-12345",
      });

      initializeConfig();
      expect(getConfig()).toBeDefined();

      resetConfig();

      // After reset, configuration should be cleared
      expect(() => getConfig()).toThrow();
    });

    test("should maintain test isolation between configuration changes", async () => {
      // First configuration
      await configTestHelpers.setupConfig({
        BEACON_AUTH: "first-token",
        PORT: "3001",
      });
      initializeConfig({ throwOnValidationError: false });
      expect(get("BEACON_AUTH")).toBe("first-token");
      expect(get("PORT")).toBe("3001");

      // Change configuration
      configTestHelpers.updateConfig({
        BEACON_AUTH: "second-token",
        PORT: "3002",
      });
      resetConfig();
      initializeConfig({ throwOnValidationError: false });

      expect(get("BEACON_AUTH")).toBe("second-token");
      expect(get("PORT")).toBe("3002");
    });
  });

  describe("Error Handling", () => {
    test("should handle configuration validation errors gracefully", async () => {
      configTestHelpers.applyScenario("invalid-config");

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = initializeConfig({ throwOnValidationError: false });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });

    test("should throw errors when configured to do so", async () => {
      configTestHelpers.applyScenario("invalid-config");

      expect(() => {
        initializeConfig({ throwOnValidationError: true });
      }).toThrow();
    });

    test("should handle missing configuration gracefully", () => {
      resetConfig();

      expect(() => getConfig()).toThrow("Configuration not initialized");
      expect(get("ANY_KEY", "default")).toBe("default");
      expect(has("ANY_KEY")).toBe(false);
    });
  });

  describe("Configuration Logging", () => {
    test("should log configuration in development mode", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await configTestHelpers.setupConfig({
        NODE_ENV: "development",
        BEACON_AUTH: "test-auth-token-12345",
        MONGO_URI: "mongodb://localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
        WA_GATEWAY_NPUB: "test-npub-12345",
      });

      initializeConfig({ logWarnings: true });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test("should suppress detailed logging in production", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await configTestHelpers.setupConfig({
        NODE_ENV: "production",
        BEACON_AUTH: "test-auth-token-12345",
        MONGO_URI: "mongodb://localhost:27017/beacon_test",
        REDIS_URL: "redis://127.0.0.1:6379",
        WA_GATEWAY_NPUB: "test-npub-12345",
      });

      initializeConfig({ logWarnings: false });

      // Should not log detailed configuration in production
      const logCalls = consoleSpy.mock.calls.filter((call) =>
        call.some(
          (arg) =>
            typeof arg === "string" && arg.includes("Configuration loaded")
        )
      );
      expect(logCalls.length).toBe(0);

      consoleSpy.mockRestore();
    });
  });
});
