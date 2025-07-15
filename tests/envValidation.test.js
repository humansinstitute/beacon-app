import {
  validateBeaconAuth,
  validateEnvironment,
} from "../app/utils/envValidation.js";

describe("Environment Validation", () => {
  let originalBeaconAuth;

  beforeEach(() => {
    // Store original environment variable
    originalBeaconAuth = process.env.BEACON_AUTH;
  });

  afterEach(() => {
    // Restore original environment variable
    if (originalBeaconAuth !== undefined) {
      process.env.BEACON_AUTH = originalBeaconAuth;
    } else {
      delete process.env.BEACON_AUTH;
    }
  });

  describe("validateBeaconAuth", () => {
    test("should return success when BEACON_AUTH is properly set", () => {
      process.env.BEACON_AUTH = "valid-secret-token";

      const result = validateBeaconAuth();

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        "BEACON_AUTH environment variable is properly configured"
      );
      expect(result.error).toBeUndefined();
    });

    test("should return failure when BEACON_AUTH is not set", () => {
      delete process.env.BEACON_AUTH;

      const result = validateBeaconAuth();

      expect(result.success).toBe(false);
      expect(result.error).toBe("BEACON_AUTH environment variable is not set");
      expect(result.message).toBeUndefined();
    });

    test("should return failure when BEACON_AUTH is undefined", () => {
      process.env.BEACON_AUTH = undefined;

      const result = validateBeaconAuth();

      expect(result.success).toBe(false);
      expect(result.error).toBe("BEACON_AUTH environment variable is not set");
    });

    test("should return failure when BEACON_AUTH is empty string", () => {
      process.env.BEACON_AUTH = "";

      const result = validateBeaconAuth();

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "BEACON_AUTH environment variable is empty or invalid"
      );
    });

    test("should return failure when BEACON_AUTH is only whitespace", () => {
      process.env.BEACON_AUTH = "   ";

      const result = validateBeaconAuth();

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "BEACON_AUTH environment variable is empty or invalid"
      );
    });

    test("should return failure when BEACON_AUTH is null", () => {
      process.env.BEACON_AUTH = null;

      const result = validateBeaconAuth();

      expect(result.success).toBe(false);
      expect(result.error).toBe("BEACON_AUTH environment variable is not set");
    });

    test("should return success for valid token with special characters", () => {
      process.env.BEACON_AUTH = "token-with-special_chars.123!@#";

      const result = validateBeaconAuth();

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        "BEACON_AUTH environment variable is properly configured"
      );
    });

    test("should return success for long token", () => {
      process.env.BEACON_AUTH = "a".repeat(100);

      const result = validateBeaconAuth();

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        "BEACON_AUTH environment variable is properly configured"
      );
    });

    test("should return success for single character token", () => {
      process.env.BEACON_AUTH = "a";

      const result = validateBeaconAuth();

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        "BEACON_AUTH environment variable is properly configured"
      );
    });
  });

  describe("validateEnvironment", () => {
    test("should return success when all environment variables are valid", () => {
      process.env.BEACON_AUTH = "valid-secret-token";

      const result = validateEnvironment();

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        "All environment variables are properly configured"
      );
      expect(result.errors).toBeUndefined();
    });

    test("should return failure when BEACON_AUTH is missing", () => {
      delete process.env.BEACON_AUTH;

      const result = validateEnvironment();

      expect(result.success).toBe(false);
      expect(result.errors).toEqual([
        "BEACON_AUTH environment variable is not set",
      ]);
      expect(result.message).toBeUndefined();
    });

    test("should return failure when BEACON_AUTH is empty", () => {
      process.env.BEACON_AUTH = "";

      const result = validateEnvironment();

      expect(result.success).toBe(false);
      expect(result.errors).toEqual([
        "BEACON_AUTH environment variable is empty or invalid",
      ]);
    });

    test("should return failure when BEACON_AUTH is whitespace only", () => {
      process.env.BEACON_AUTH = "   ";

      const result = validateEnvironment();

      expect(result.success).toBe(false);
      expect(result.errors).toEqual([
        "BEACON_AUTH environment variable is empty or invalid",
      ]);
    });

    test("should handle multiple validation failures", () => {
      // Currently only BEACON_AUTH is validated, but this test ensures
      // the structure supports multiple validations
      delete process.env.BEACON_AUTH;

      const result = validateEnvironment();

      expect(result.success).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
