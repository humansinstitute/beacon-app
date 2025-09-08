/**
 * Configuration Manager Unit Tests
 * Tests for core configuration loading, validation, and Docker secrets support
 */

import { jest } from "@jest/globals";
import { ConfigManager } from "../app/config/configManager.js";
import { readFileSync, existsSync } from "fs";

// Mock fs module
jest.mock("fs", () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
}));

describe("ConfigManager", () => {
  let configManager;
  let originalEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };

    // Create fresh config manager instance
    configManager = new ConfigManager();

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("loadValue", () => {
    test("should load value from Docker secret when available", () => {
      const secretContent = "secret-value-from-docker";
      existsSync.mockReturnValue(true);
      readFileSync.mockReturnValue(secretContent + "\n"); // Docker secrets often have trailing newlines

      const result = configManager.loadValue("TEST_KEY", {
        secretName: "test_secret",
        envVar: "TEST_ENV",
      });

      expect(result).toBe(secretContent);
      expect(existsSync).toHaveBeenCalledWith("/run/secrets/test_secret");
      expect(readFileSync).toHaveBeenCalledWith(
        "/run/secrets/test_secret",
        "utf8"
      );
    });

    test("should fallback to environment variable when Docker secret not available", () => {
      const envValue = "env-value";
      existsSync.mockReturnValue(false);
      process.env.TEST_ENV = envValue;

      const result = configManager.loadValue("TEST_KEY", {
        secretName: "test_secret",
        envVar: "TEST_ENV",
      });

      expect(result).toBe(envValue);
      expect(existsSync).toHaveBeenCalledWith("/run/secrets/test_secret");
    });

    test("should use default value when neither secret nor env var available", () => {
      const defaultValue = "default-value";
      existsSync.mockReturnValue(false);
      delete process.env.TEST_ENV;

      const result = configManager.loadValue("TEST_KEY", {
        secretName: "test_secret",
        envVar: "TEST_ENV",
        defaultValue,
      });

      expect(result).toBe(defaultValue);
    });

    test("should throw error for required value when missing", () => {
      existsSync.mockReturnValue(false);
      delete process.env.TEST_ENV;

      expect(() => {
        configManager.loadValue("TEST_KEY", {
          secretName: "test_secret",
          envVar: "TEST_ENV",
          required: true,
        });
      }).toThrow("Required configuration TEST_KEY is missing");
    });

    test("should handle Docker secret read errors gracefully", () => {
      existsSync.mockReturnValue(true);
      readFileSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });
      process.env.TEST_ENV = "fallback-value";

      const result = configManager.loadValue("TEST_KEY", {
        secretName: "test_secret",
        envVar: "TEST_ENV",
      });

      expect(result).toBe("fallback-value");
    });
  });

  describe("convertType", () => {
    test("should convert string values correctly", () => {
      expect(configManager.convertType("hello", "string", "test")).toBe(
        "hello"
      );
      expect(configManager.convertType(123, "string", "test")).toBe("123");
    });

    test("should convert number values correctly", () => {
      expect(configManager.convertType("123", "number", "test")).toBe(123);
      expect(configManager.convertType("123.45", "number", "test")).toBe(
        123.45
      );
      expect(configManager.convertType(456, "number", "test")).toBe(456);
    });

    test("should throw error for invalid number values", () => {
      expect(() => {
        configManager.convertType("not-a-number", "number", "test");
      }).toThrow("Invalid number value for test: not-a-number");
    });

    test("should convert boolean values correctly", () => {
      // Truthy values
      expect(configManager.convertType("true", "boolean", "test")).toBe(true);
      expect(configManager.convertType("1", "boolean", "test")).toBe(true);
      expect(configManager.convertType("yes", "boolean", "test")).toBe(true);
      expect(configManager.convertType("on", "boolean", "test")).toBe(true);
      expect(configManager.convertType(true, "boolean", "test")).toBe(true);

      // Falsy values
      expect(configManager.convertType("false", "boolean", "test")).toBe(false);
      expect(configManager.convertType("0", "boolean", "test")).toBe(false);
      expect(configManager.convertType("no", "boolean", "test")).toBe(false);
      expect(configManager.convertType("off", "boolean", "test")).toBe(false);
      expect(configManager.convertType("", "boolean", "test")).toBe(false);
      expect(configManager.convertType(false, "boolean", "test")).toBe(false);
    });

    test("should throw error for invalid boolean values", () => {
      expect(() => {
        configManager.convertType("maybe", "boolean", "test");
      }).toThrow("Invalid boolean value for test: maybe");
    });

    test("should convert array values correctly", () => {
      expect(configManager.convertType("a,b,c", "array", "test")).toEqual([
        "a",
        "b",
        "c",
      ]);
      expect(configManager.convertType("a, b , c ", "array", "test")).toEqual([
        "a",
        "b",
        "c",
      ]);
      expect(configManager.convertType(["x", "y"], "array", "test")).toEqual([
        "x",
        "y",
      ]);
      expect(configManager.convertType("", "array", "test")).toEqual([]);
    });

    test("should handle null and undefined values", () => {
      expect(configManager.convertType(null, "string", "test")).toBe(null);
      expect(configManager.convertType(undefined, "number", "test")).toBe(
        undefined
      );
    });
  });

  describe("validateConstraints", () => {
    test("should validate number constraints", () => {
      // Valid cases
      expect(
        configManager.validateConstraints(5, { min: 1, max: 10 }, "test")
      ).toBe(true);
      expect(configManager.validateConstraints(1, { min: 1 }, "test")).toBe(
        true
      );
      expect(configManager.validateConstraints(10, { max: 10 }, "test")).toBe(
        true
      );

      // Invalid cases
      expect(() => {
        configManager.validateConstraints(0, { min: 1 }, "test");
      }).toThrow("test must be at least 1, got 0");

      expect(() => {
        configManager.validateConstraints(11, { max: 10 }, "test");
      }).toThrow("test must be at most 10, got 11");
    });

    test("should validate string length constraints", () => {
      // Valid cases
      expect(
        configManager.validateConstraints(
          "hello",
          { minLength: 3, maxLength: 10 },
          "test"
        )
      ).toBe(true);
      expect(
        configManager.validateConstraints("hi", { minLength: 2 }, "test")
      ).toBe(true);

      // Invalid cases
      expect(() => {
        configManager.validateConstraints("a", { minLength: 3 }, "test");
      }).toThrow("test must have at least 3 characters/items, got 1");

      expect(() => {
        configManager.validateConstraints(
          "toolongstring",
          { maxLength: 5 },
          "test"
        );
      }).toThrow("test must have at most 5 characters/items, got 13");
    });

    test("should validate array length constraints", () => {
      expect(
        configManager.validateConstraints(
          ["a", "b"],
          { minLength: 1, maxLength: 5 },
          "test"
        )
      ).toBe(true);

      expect(() => {
        configManager.validateConstraints([], { minLength: 1 }, "test");
      }).toThrow("test must have at least 1 characters/items, got 0");
    });

    test("should validate pattern constraints", () => {
      expect(
        configManager.validateConstraints(
          "test@example.com",
          { pattern: "^[^@]+@[^@]+$" },
          "test"
        )
      ).toBe(true);

      expect(() => {
        configManager.validateConstraints(
          "invalid-email",
          { pattern: "^[^@]+@[^@]+$" },
          "test"
        );
      }).toThrow("test does not match required pattern: ^[^@]+@[^@]+$");
    });

    test("should validate enum constraints", () => {
      expect(
        configManager.validateConstraints(
          "production",
          { enum: ["development", "production", "test"] },
          "test"
        )
      ).toBe(true);

      expect(() => {
        configManager.validateConstraints(
          "staging",
          { enum: ["development", "production", "test"] },
          "test"
        );
      }).toThrow(
        "test must be one of: development, production, test, got staging"
      );
    });

    test("should handle null/undefined values gracefully", () => {
      expect(configManager.validateConstraints(null, { min: 1 }, "test")).toBe(
        true
      );
      expect(
        configManager.validateConstraints(
          undefined,
          { pattern: "test" },
          "test"
        )
      ).toBe(true);
    });
  });

  describe("loadConfiguration", () => {
    test("should load configuration from schema successfully", () => {
      process.env.TEST_STRING = "hello";
      process.env.TEST_NUMBER = "42";
      process.env.TEST_BOOLEAN = "true";

      const schema = {
        section1: {
          stringValue: {
            envVar: "TEST_STRING",
            type: "string",
            required: true,
          },
          numberValue: {
            envVar: "TEST_NUMBER",
            type: "number",
            defaultValue: 0,
          },
          booleanValue: {
            envVar: "TEST_BOOLEAN",
            type: "boolean",
            defaultValue: false,
          },
        },
      };

      const config = configManager.loadConfiguration(schema);

      expect(config.section1.stringValue).toBe("hello");
      expect(config.section1.numberValue).toBe(42);
      expect(config.section1.booleanValue).toBe(true);
      expect(configManager.isValid()).toBe(true);
    });

    test("should handle missing required values", () => {
      delete process.env.REQUIRED_VALUE;

      const schema = {
        section1: {
          requiredValue: {
            envVar: "REQUIRED_VALUE",
            type: "string",
            required: true,
          },
        },
      };

      expect(() => {
        configManager.loadConfiguration(schema);
      }).toThrow("Required configuration REQUIRED_VALUE is missing");
    });

    test("should use default values when environment variables are missing", () => {
      delete process.env.OPTIONAL_VALUE;

      const schema = {
        section1: {
          optionalValue: {
            envVar: "OPTIONAL_VALUE",
            type: "string",
            defaultValue: "default-value",
          },
        },
      };

      const config = configManager.loadConfiguration(schema);

      expect(config.section1.optionalValue).toBe("default-value");
      expect(configManager.getWarnings()).toContain(
        "Using default value for optionalValue: default-value"
      );
    });

    test("should handle optional values that fail to load", () => {
      process.env.INVALID_NUMBER = "not-a-number";

      const schema = {
        section1: {
          invalidNumber: {
            envVar: "INVALID_NUMBER",
            type: "number",
            required: false,
          },
        },
      };

      const config = configManager.loadConfiguration(schema);

      expect(config.section1.invalidNumber).toBe(null);
      expect(
        configManager
          .getWarnings()
          .some((w) =>
            w.includes("Optional configuration invalidNumber failed to load")
          )
      ).toBe(true);
    });
  });

  describe("get", () => {
    beforeEach(() => {
      const schema = {
        section1: {
          value1: { envVar: "VALUE1", type: "string", defaultValue: "test1" },
          value2: { envVar: "VALUE2", type: "number", defaultValue: 42 },
        },
        section2: {
          nested: {
            value3: { envVar: "VALUE3", type: "string", defaultValue: "test3" },
          },
        },
      };
      configManager.loadConfiguration(schema);
    });

    test("should get configuration values by path", () => {
      expect(configManager.get("section1.value1")).toBe("test1");
      expect(configManager.get("section1.value2")).toBe(42);
    });

    test("should return default value for missing paths", () => {
      expect(configManager.get("nonexistent.path", "default")).toBe("default");
      expect(configManager.get("section1.nonexistent", "default")).toBe(
        "default"
      );
    });

    test("should throw error when configuration not loaded", () => {
      const freshManager = new ConfigManager();
      expect(() => {
        freshManager.get("test.path");
      }).toThrow("Configuration not loaded. Call loadConfiguration() first.");
    });
  });

  describe("redactSensitiveData", () => {
    test("should redact sensitive keys", () => {
      const config = {
        auth: {
          password: "secret123",
          apiKey: "key123",
          token: "token123",
        },
        database: {
          host: "localhost",
          port: 5432,
        },
      };

      const redacted = configManager.redactSensitiveData(config);

      expect(redacted.auth.password).toBe("[REDACTED]");
      expect(redacted.auth.apiKey).toBe("[REDACTED]");
      expect(redacted.auth.token).toBe("[REDACTED]");
      expect(redacted.database.host).toBe("localhost");
      expect(redacted.database.port).toBe(5432);
    });

    test("should handle nested objects", () => {
      const config = {
        level1: {
          level2: {
            secret: "hidden",
            public: "visible",
          },
        },
      };

      const redacted = configManager.redactSensitiveData(config);

      expect(redacted.level1.level2.secret).toBe("[REDACTED]");
      expect(redacted.level1.level2.public).toBe("visible");
    });

    test("should handle arrays", () => {
      const config = {
        items: [
          { password: "secret1", name: "item1" },
          { password: "secret2", name: "item2" },
        ],
      };

      const redacted = configManager.redactSensitiveData(config);

      expect(redacted.items[0].password).toBe("[REDACTED]");
      expect(redacted.items[0].name).toBe("item1");
      expect(redacted.items[1].password).toBe("[REDACTED]");
      expect(redacted.items[1].name).toBe("item2");
    });

    test("should not redact empty strings", () => {
      const config = {
        auth: {
          password: "",
          token: null,
          key: undefined,
        },
      };

      const redacted = configManager.redactSensitiveData(config);

      expect(redacted.auth.password).toBe("");
      expect(redacted.auth.token).toBe(null);
      expect(redacted.auth.key).toBe(undefined);
    });
  });

  describe("validation state", () => {
    test("should track validation errors", () => {
      expect(configManager.getValidationErrors()).toEqual([]);
      expect(configManager.isValid()).toBe(true);

      // Force a validation error
      try {
        configManager.convertType("invalid", "number", "test");
      } catch (error) {
        // Expected to throw
      }

      expect(configManager.getValidationErrors().length).toBeGreaterThan(0);
      expect(configManager.isValid()).toBe(false);
    });

    test("should track warnings", () => {
      expect(configManager.getWarnings()).toEqual([]);

      const schema = {
        section1: {
          value: {
            envVar: "MISSING_VALUE",
            type: "string",
            defaultValue: "default",
          },
        },
      };

      configManager.loadConfiguration(schema);

      expect(configManager.getWarnings().length).toBeGreaterThan(0);
    });

    test("should reset state correctly", () => {
      // Load some configuration to create state
      const schema = {
        section1: {
          value: { envVar: "TEST", type: "string", defaultValue: "test" },
        },
      };
      configManager.loadConfiguration(schema);

      expect(configManager.loaded).toBe(true);

      configManager.reset();

      expect(configManager.loaded).toBe(false);
      expect(configManager.config).toEqual({});
      expect(configManager.getValidationErrors()).toEqual([]);
      expect(configManager.getWarnings()).toEqual([]);
    });
  });
});
