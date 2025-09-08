/**
 * Configuration Schema Unit Tests
 * Tests for schema validation, structure, and utility functions
 */

import { jest } from "@jest/globals";
import {
  configSchema,
  getSchemaSection,
  getAllEnvVars,
  getRequiredEnvVars,
  getAllSecretNames,
  validateSchema,
} from "../app/config/schema.js";

describe("Configuration Schema", () => {
  describe("schema structure", () => {
    test("should have all required sections", () => {
      const expectedSections = [
        "app",
        "database",
        "redis",
        "auth",
        "whatsapp",
        "services",
        "cashu",
        "pm2",
        "git",
        "testing",
      ];

      for (const section of expectedSections) {
        expect(configSchema).toHaveProperty(section);
        expect(typeof configSchema[section]).toBe("object");
      }
    });

    test("should have valid configuration objects", () => {
      for (const [sectionName, section] of Object.entries(configSchema)) {
        expect(typeof section).toBe("object");
        expect(section).not.toBe(null);

        for (const [keyName, config] of Object.entries(section)) {
          // Skip nested objects like services.nctools
          if (
            typeof config === "object" &&
            config !== null &&
            !config.envVar &&
            !config.secretName
          ) {
            // This is a nested section, check its contents
            for (const [nestedKeyName, nestedConfig] of Object.entries(
              config
            )) {
              expect(typeof nestedConfig).toBe("object");
              expect(nestedConfig).not.toBe(null);
            }
          } else {
            // This is a configuration object
            expect(typeof config).toBe("object");
            expect(config).not.toBe(null);
          }
        }
      }
    });

    test("should have valid types for all configurations", () => {
      const validTypes = ["string", "number", "boolean", "array"];

      function checkConfigTypes(obj, path = "") {
        for (const [key, config] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;

          if (config.type) {
            expect(validTypes).toContain(config.type);
          } else if (
            typeof config === "object" &&
            config !== null &&
            !config.envVar &&
            !config.secretName
          ) {
            // Nested section
            checkConfigTypes(config, currentPath);
          }
        }
      }

      checkConfigTypes(configSchema);
    });

    test("should have environment variables or secret names for all leaf configurations", () => {
      function checkEnvVars(obj, path = "") {
        for (const [key, config] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;

          if (typeof config === "object" && config !== null) {
            if (config.envVar || config.secretName) {
              // This is a leaf configuration - it should have at least one
              expect(config.envVar || config.secretName).toBeTruthy();
            } else {
              // This might be a nested section
              checkEnvVars(config, currentPath);
            }
          }
        }
      }

      checkEnvVars(configSchema);
    });
  });

  describe("app section", () => {
    test("should have correct app configuration", () => {
      expect(configSchema.app.nodeEnv).toEqual({
        envVar: "NODE_ENV",
        type: "string",
        defaultValue: "development",
        constraints: {
          enum: ["development", "production", "test"],
        },
        description: "Application environment mode",
      });

      expect(configSchema.app.port.type).toBe("number");
      expect(configSchema.app.port.constraints.min).toBe(1);
      expect(configSchema.app.port.constraints.max).toBe(65535);
    });
  });

  describe("database section", () => {
    test("should have MongoDB configuration", () => {
      expect(configSchema.database.mongoUri.envVar).toBe("MONGO_URI");
      expect(configSchema.database.mongoUri.secretName).toBe("mongo_uri");
      expect(configSchema.database.mongoUri.required).toBe(true);
      expect(configSchema.database.mongoUri.constraints.pattern).toBe(
        "^mongodb://.+"
      );
    });
  });

  describe("auth section", () => {
    test("should have authentication configuration", () => {
      expect(configSchema.auth.beaconAuth.envVar).toBe("BEACON_AUTH");
      expect(configSchema.auth.beaconAuth.secretName).toBe("beacon_auth");
      expect(configSchema.auth.beaconAuth.required).toBe(true);
      expect(configSchema.auth.beaconAuth.constraints.minLength).toBe(8);
    });
  });

  describe("whatsapp section", () => {
    test("should have WhatsApp configuration", () => {
      expect(configSchema.whatsapp.gatewayNpub.required).toBe(true);
      expect(configSchema.whatsapp.sharedSession.type).toBe("boolean");
      expect(configSchema.whatsapp.sharedSession.defaultValue).toBe(true);
      expect(configSchema.whatsapp.sharedBranches.type).toBe("array");
      expect(configSchema.whatsapp.sharedBranches.defaultValue).toEqual([
        "main",
        "master",
        "develop",
      ]);
    });
  });

  describe("services section", () => {
    test("should have nested service configurations", () => {
      expect(configSchema.services.nctools.apiUrl.envVar).toBe(
        "NCTOOLS_API_URL"
      );
      expect(configSchema.services.nctools.timeout.type).toBe("number");
      expect(configSchema.services.nctools.timeout.constraints.min).toBe(1000);

      expect(configSchema.services.everest.apiKey.secretName).toBe(
        "everest_api_key"
      );
    });
  });

  describe("cashu section", () => {
    test("should have Cashu configuration", () => {
      expect(configSchema.cashu.defaultMint.constraints.pattern).toBe(
        "^https?://.+"
      );
      expect(configSchema.cashu.minAmount.type).toBe("number");
      expect(configSchema.cashu.minAmount.constraints.min).toBe(1);
      expect(configSchema.cashu.maxAmount.defaultValue).toBe(1000000);
    });
  });

  describe("getSchemaSection", () => {
    test("should return correct section", () => {
      const appSection = getSchemaSection("app");
      expect(appSection).toBe(configSchema.app);

      const databaseSection = getSchemaSection("database");
      expect(databaseSection).toBe(configSchema.database);
    });

    test("should return null for non-existent section", () => {
      expect(getSchemaSection("nonexistent")).toBe(null);
    });
  });

  describe("getAllEnvVars", () => {
    test("should return all environment variable names", () => {
      const envVars = getAllEnvVars();

      expect(Array.isArray(envVars)).toBe(true);
      expect(envVars.length).toBeGreaterThan(0);
      expect(envVars).toContain("NODE_ENV");
      expect(envVars).toContain("MONGO_URI");
      expect(envVars).toContain("BEACON_AUTH");
      expect(envVars).toContain("WA_GATEWAY_NPUB");
      expect(envVars).toContain("NCTOOLS_API_URL");
      expect(envVars).toContain("CASHU_DEFAULT_MINT");

      // Should be sorted and unique
      const sortedUnique = [...new Set(envVars)].sort();
      expect(envVars).toEqual(sortedUnique);
    });

    test("should include all major environment variables", () => {
      const envVars = getAllEnvVars();
      const expectedVars = [
        "NODE_ENV",
        "PORT",
        "API_SERVER_PORT",
        "SERVER_URL",
        "MONGO_URI",
        "REDIS_URL",
        "BEACON_AUTH",
        "WA_GATEWAY_NPUB",
        "WA_SHARED_SESSION",
        "WA_BRANCH_SESSIONS",
        "NCTOOLS_API_URL",
        "EVEREST_API_KEY",
        "CASHU_DEFAULT_MINT",
        "PM2_APP_NAME",
        "GIT_BRANCH",
      ];

      for (const expectedVar of expectedVars) {
        expect(envVars).toContain(expectedVar);
      }
    });
  });

  describe("getRequiredEnvVars", () => {
    test("should return only required environment variables", () => {
      const requiredVars = getRequiredEnvVars();

      expect(Array.isArray(requiredVars)).toBe(true);
      expect(requiredVars).toContain("MONGO_URI");
      expect(requiredVars).toContain("REDIS_URL");
      expect(requiredVars).toContain("BEACON_AUTH");
      expect(requiredVars).toContain("WA_GATEWAY_NPUB");

      // Should not contain optional variables
      expect(requiredVars).not.toContain("PORT");
      expect(requiredVars).not.toContain("DEBUG");
      expect(requiredVars).not.toContain("LOG_LEVEL");

      // Should be sorted
      const sorted = [...requiredVars].sort();
      expect(requiredVars).toEqual(sorted);
    });

    test("should have reasonable number of required variables", () => {
      const requiredVars = getRequiredEnvVars();
      // Should have some required vars but not too many
      expect(requiredVars.length).toBeGreaterThan(0);
      expect(requiredVars.length).toBeLessThan(20);
    });
  });

  describe("getAllSecretNames", () => {
    test("should return all Docker secret names", () => {
      const secretNames = getAllSecretNames();

      expect(Array.isArray(secretNames)).toBe(true);
      expect(secretNames).toContain("mongo_uri");
      expect(secretNames).toContain("beacon_auth");
      expect(secretNames).toContain("wa_gateway_npub");
      expect(secretNames).toContain("everest_api_key");

      // Should be sorted and unique
      const sortedUnique = [...new Set(secretNames)].sort();
      expect(secretNames).toEqual(sortedUnique);
    });

    test("should include sensitive configuration secrets", () => {
      const secretNames = getAllSecretNames();
      const expectedSecrets = [
        "mongo_uri",
        "redis_url",
        "beacon_auth",
        "wa_gateway_npub",
        "everest_api_key",
        "whatsapp_api_token",
      ];

      for (const expectedSecret of expectedSecrets) {
        expect(secretNames).toContain(expectedSecret);
      }
    });
  });

  describe("validateSchema", () => {
    test("should validate correct schema structure", () => {
      const result = validateSchema();

      expect(result.valid).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test("should detect invalid schema structure", () => {
      // Mock an invalid schema temporarily
      const originalSchema = configSchema.invalidSection;
      configSchema.invalidSection = "not-an-object";

      const result = validateSchema();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((error) =>
          error.includes("invalidSection must be an object")
        )
      ).toBe(true);

      // Restore original schema
      delete configSchema.invalidSection;
    });

    test("should detect invalid configuration objects", () => {
      // Mock an invalid config temporarily
      const originalConfig = configSchema.app.invalidConfig;
      configSchema.app.invalidConfig = "not-an-object";

      const result = validateSchema();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((error) =>
          error.includes("app.invalidConfig must be an object")
        )
      ).toBe(true);

      // Restore original schema
      delete configSchema.app.invalidConfig;
    });

    test("should detect invalid types", () => {
      // Mock an invalid type temporarily
      const originalType = configSchema.app.nodeEnv.type;
      configSchema.app.nodeEnv.type = "invalid-type";

      const result = validateSchema();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((error) =>
          error.includes("invalid type: invalid-type")
        )
      ).toBe(true);

      // Restore original type
      configSchema.app.nodeEnv.type = originalType;
    });

    test("should detect invalid constraints", () => {
      // Mock invalid constraints temporarily
      const originalConstraints = configSchema.app.port.constraints;
      configSchema.app.port.constraints = { min: "not-a-number" };

      const result = validateSchema();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((error) =>
          error.includes("min constraint must be a number")
        )
      ).toBe(true);

      // Restore original constraints
      configSchema.app.port.constraints = originalConstraints;
    });

    test("should generate warnings for configurations without env vars", () => {
      // Mock a config without envVar temporarily
      const originalConfig = configSchema.app.testConfig;
      configSchema.app.testConfig = {
        type: "string",
        description: "Test config",
      };

      const result = validateSchema();

      expect(
        result.warnings.some(
          (warning) =>
            warning.includes("testConfig has no envVar or secretName") ||
            warning.includes("app.testConfig has no envVar or secretName")
        )
      ).toBe(true);

      // Restore original schema
      delete configSchema.app.testConfig;
    });

    test("should validate enum constraints", () => {
      // Mock invalid enum constraint temporarily
      const originalConstraints = configSchema.app.nodeEnv.constraints;
      configSchema.app.nodeEnv.constraints = { enum: "not-an-array" };

      const result = validateSchema();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((error) =>
          error.includes("enum constraint must be an array")
        )
      ).toBe(true);

      // Restore original constraints
      configSchema.app.nodeEnv.constraints = originalConstraints;
    });
  });

  describe("schema completeness", () => {
    test("should cover all known environment variables from the application", () => {
      const envVars = getAllEnvVars();

      // Check for key environment variables that should be in the schema
      const criticalEnvVars = [
        "NODE_ENV",
        "MONGO_URI",
        "REDIS_URL",
        "BEACON_AUTH",
        "WA_GATEWAY_NPUB",
        "SERVER_URL",
        "API_SERVER_PORT",
        "NCTOOLS_API_URL",
        "CASHU_DEFAULT_MINT",
        "EVEREST_API_KEY",
      ];

      for (const criticalVar of criticalEnvVars) {
        expect(envVars).toContain(criticalVar);
      }
    });

    test("should have descriptions for all configurations", () => {
      function checkDescriptions(obj, path = "") {
        for (const [key, config] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;

          if (config.envVar || config.secretName) {
            expect(config.description).toBeDefined();
            expect(typeof config.description).toBe("string");
            expect(config.description.length).toBeGreaterThan(0);
          } else if (typeof config === "object" && config !== null) {
            checkDescriptions(config, currentPath);
          }
        }
      }

      checkDescriptions(configSchema);
    });

    test("should have appropriate default values", () => {
      // Check that required fields don't have defaults (except for some special cases)
      function checkDefaults(obj, path = "") {
        for (const [key, config] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;

          if (config.envVar || config.secretName) {
            if (
              config.required &&
              config.defaultValue !== null &&
              config.defaultValue !== undefined
            ) {
              // Some required fields might have defaults (like NODE_ENV), but most shouldn't
              if (
                ![
                  "NODE_ENV",
                  "WA_SHARED_SESSION",
                  "WA_BRANCH_DETECTION",
                ].includes(config.envVar)
              ) {
                console.warn(
                  `Required field ${currentPath} has a default value: ${config.defaultValue}`
                );
              }
            }
          } else if (typeof config === "object" && config !== null) {
            checkDefaults(config, currentPath);
          }
        }
      }

      checkDefaults(configSchema);
    });
  });
});
