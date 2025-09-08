import {
  validateBeaconAuth,
  validateEnvironment,
} from "../app/utils/envValidation.js";
import { resetConfig } from "../app/config/index.js";

describe("Environment Validation", () => {
  let originalEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };

    // Reset configuration system
    resetConfig();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    resetConfig();
  });

  describe("validateBeaconAuth", () => {
    test("should return success when BEACON_AUTH is properly set", () => {
      process.env.BEACON_AUTH = "valid-secret-token-12345";
      process.env.WA_GATEWAY_NPUB = "test-npub";
      process.env.MONGO_URI = "mongodb://localhost:27017/test";
      process.env.REDIS_URL = "redis://localhost:6379";

      const result = validateBeaconAuth();

      expect(result.success).toBe(true);
      expect(result.message).toBe("BEACON_AUTH configuration is properly set");
      expect(result.error).toBeUndefined();
    });

    test("should return failure when BEACON_AUTH is not set", () => {
      delete process.env.BEACON_AUTH;

      const result = validateBeaconAuth();

      expect(result.success).toBe(false);
      expect(result.error).toContain("BEACON_AUTH");
      expect(result.message).toBeUndefined();
    });

    test("should return failure when BEACON_AUTH is undefined", () => {
      process.env.BEACON_AUTH = undefined;

      const result = validateBeaconAuth();

      expect(result.success).toBe(false);
      expect(result.error).toContain("BEACON_AUTH");
    });

    test("should return failure when BEACON_AUTH is empty string", () => {
      process.env.BEACON_AUTH = "";

      const result = validateBeaconAuth();

      expect(result.success).toBe(false);
      expect(result.error).toContain("BEACON_AUTH");
    });

    test("should return failure when BEACON_AUTH is only whitespace", () => {
      process.env.BEACON_AUTH = "   ";

      const result = validateBeaconAuth();

      expect(result.success).toBe(false);
      expect(result.error).toContain("8 characters");
    });

    test("should return failure when BEACON_AUTH is too short", () => {
      process.env.BEACON_AUTH = "short";

      const result = validateBeaconAuth();

      expect(result.success).toBe(false);
      expect(result.error).toContain("8 characters");
    });

    test("should return success for valid token with special characters", () => {
      process.env.BEACON_AUTH = "token-with-special_chars.123!@#";
      process.env.WA_GATEWAY_NPUB = "test-npub";
      process.env.MONGO_URI = "mongodb://localhost:27017/test";
      process.env.REDIS_URL = "redis://localhost:6379";

      const result = validateBeaconAuth();

      expect(result.success).toBe(true);
      expect(result.message).toBe("BEACON_AUTH configuration is properly set");
    });

    test("should return success for long token", () => {
      process.env.BEACON_AUTH = "a".repeat(100);
      process.env.WA_GATEWAY_NPUB = "test-npub";
      process.env.MONGO_URI = "mongodb://localhost:27017/test";
      process.env.REDIS_URL = "redis://localhost:6379";

      const result = validateBeaconAuth();

      expect(result.success).toBe(true);
      expect(result.message).toBe("BEACON_AUTH configuration is properly set");
    });
  });

  describe("validateEnvironment", () => {
    test("should return success when all environment variables are valid", () => {
      process.env.BEACON_AUTH = "valid-secret-token-12345";
      process.env.WA_GATEWAY_NPUB = "test-npub";
      process.env.MONGO_URI = "mongodb://localhost:27017/test";
      process.env.REDIS_URL = "redis://localhost:6379";

      const result = validateEnvironment();

      expect(result.success).toBe(true);
      expect(result.message).toBe("All configuration is properly set");
      expect(result.errors).toBeUndefined();
    });

    test("should return failure when BEACON_AUTH is missing", () => {
      delete process.env.BEACON_AUTH;

      const result = validateEnvironment();

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.some((error) => error.includes("BEACON_AUTH"))).toBe(
        true
      );
      expect(result.message).toBeUndefined();
    });

    test("should return failure when BEACON_AUTH is empty", () => {
      process.env.BEACON_AUTH = "";

      const result = validateEnvironment();

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.some((error) => error.includes("BEACON_AUTH"))).toBe(
        true
      );
    });

    test("should return failure when BEACON_AUTH is too short", () => {
      process.env.BEACON_AUTH = "short";

      const result = validateEnvironment();

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors.some((error) => error.includes("8 characters"))
      ).toBe(true);
    });

    test("should handle multiple validation failures", () => {
      // Remove multiple required configuration values
      delete process.env.BEACON_AUTH;
      delete process.env.WA_GATEWAY_NPUB;

      const result = validateEnvironment();

      expect(result.success).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test("should include warnings for default values", () => {
      process.env.BEACON_AUTH = "valid-secret-token-12345";
      process.env.WA_GATEWAY_NPUB = "test-npub";
      process.env.MONGO_URI = "mongodb://localhost:27017/test";
      process.env.REDIS_URL = "redis://localhost:6379";
      // Don't set optional values to trigger warnings

      const result = validateEnvironment();

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
