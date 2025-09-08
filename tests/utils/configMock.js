// tests/utils/configMock.js
// Configuration mocking utilities for testing

import { jest } from "@jest/globals";

/**
 * Configuration mock utilities for testing
 * Provides isolated configuration testing with predictable values
 */
export class ConfigMock {
  constructor() {
    this.originalEnv = {};
    this.mockConfig = {};
    this.configModule = null;
  }

  /**
   * Initialize configuration mocking
   * @param {Object} mockValues - Configuration values to mock
   * @param {Object} options - Mocking options
   */
  async setup(mockValues = {}, options = {}) {
    const {
      preserveEnv = false,
      resetConfig = true,
      mockModule = true,
    } = options;

    // Store original environment if needed
    if (preserveEnv) {
      this.originalEnv = { ...process.env };
    }

    // Set up mock configuration values
    this.mockConfig = {
      // Default test configuration
      NODE_ENV: "test",
      BEACON_AUTH: "test-beacon-auth-token-12345",
      MONGO_URI: "mongodb://localhost:27017/beacon_test",
      REDIS_URL: "redis://127.0.0.1:6379",
      WA_GATEWAY_NPUB: "test-npub-12345",
      PORT: "3001",
      API_SERVER_PORT: "3257",
      SERVER_URL: "http://localhost",
      DEBUG: "false",
      LOG_LEVEL: "error",

      // WhatsApp session configuration
      WA_SHARED_SESSION: "true",
      WA_BRANCH_SESSIONS: "false",
      WA_BRANCH_DETECTION: "true",
      WA_AUTO_MIGRATE_SESSION: "true",
      WA_MIGRATION_BACKUP: "true",
      WA_CLEANUP_ON_EXIT: "false",

      // Cashu configuration
      NCTOOLS_API_URL: "http://localhost:4000",
      NCTOOLS_TIMEOUT: "30000",
      CASHU_DEFAULT_MINT: "https://mint.minibits.cash/Bitcoin",
      CASHU_MIN_AMOUNT: "1",
      CASHU_MAX_AMOUNT: "1000000",

      // Override with provided values
      ...mockValues,
    };

    // Apply environment variables
    Object.entries(this.mockConfig).forEach(([key, value]) => {
      process.env[key] = value;
    });

    // Mock the configuration module if requested
    if (mockModule) {
      await this.mockConfigModule();
    }

    // Reset configuration if requested
    if (resetConfig) {
      const { resetConfig } = await import("../../app/config/index.js");
      resetConfig();
    }
  }

  /**
   * Mock the configuration module
   */
  async mockConfigModule() {
    // Dynamic import to avoid circular dependencies
    const configModule = await import("../../app/config/index.js");
    this.configModule = configModule;

    // Create spies for configuration functions

    jest.spyOn(configModule, "getAllConfig").mockImplementation(() => {
      return this.createMockConfigObject();
    });

    // Mock getConfig to handle both path-based and full config access
    jest
      .spyOn(configModule, "getConfig")
      .mockImplementation((path, defaultValue) => {
        // If no path provided, return the full configuration
        if (path === undefined || path === null) {
          return this.createMockConfigObject();
        }

        // Handle null/undefined path
        if (!path) {
          return defaultValue;
        }

        // Handle dot notation paths like "database.mongoUri"
        const keys = path.split(".");
        let value = this.createMockConfigObject();

        for (const key of keys) {
          if (value && typeof value === "object" && key in value) {
            value = value[key];
          } else {
            return defaultValue;
          }
        }

        return value ?? defaultValue;
      });

    jest.spyOn(configModule, "getRawConfig").mockImplementation(() => {
      return this.createMockConfigObject();
    });

    jest.spyOn(configModule, "isConfigValid").mockImplementation(() => {
      return true;
    });

    jest.spyOn(configModule, "getConfigErrors").mockImplementation(() => {
      return [];
    });

    jest.spyOn(configModule, "getConfigWarnings").mockImplementation(() => {
      return [];
    });

    // Mock the get() convenience function
    jest.spyOn(configModule, "get").mockImplementation((key, defaultValue) => {
      if (!key) {
        return defaultValue;
      }
      return this.mockConfig[key] ?? defaultValue;
    });

    // Mock the has() convenience function
    jest.spyOn(configModule, "has").mockImplementation((key) => {
      if (!key) {
        return false;
      }
      return key in this.mockConfig;
    });
  }

  /**
   * Create a mock configuration object
   */
  createMockConfigObject() {
    return {
      // Application configuration
      app: {
        nodeEnv: this.mockConfig.NODE_ENV || "test",
        port: parseInt(this.mockConfig.PORT || "3000"),
        apiServerPort: parseInt(this.mockConfig.API_SERVER_PORT || "3257"),
        serverUrl: this.mockConfig.SERVER_URL || "http://localhost",
        debug: this.mockConfig.DEBUG === "true",
        logLevel: this.mockConfig.LOG_LEVEL || "error",
      },

      // Server configuration (for test compatibility)
      server: {
        nodeEnv: this.mockConfig.NODE_ENV || "test",
        port: parseInt(this.mockConfig.PORT || "3000"),
        apiServerPort: parseInt(this.mockConfig.API_SERVER_PORT || "3257"),
        serverUrl: this.mockConfig.SERVER_URL || "http://localhost",
      },

      // Logging configuration (for test compatibility)
      logging: {
        level: this.mockConfig.LOG_LEVEL || "info",
        debug: this.mockConfig.DEBUG === "true",
      },

      // Database configuration
      database: {
        mongoUri:
          this.mockConfig.MONGO_URI || "mongodb://localhost:27017/beacon_test",
        mongodbUri: this.mockConfig.MONGODB_URI || null,
      },

      // Redis configuration
      redis: {
        url: this.mockConfig.REDIS_URL || "redis://127.0.0.1:6379",
      },

      // Authentication configuration
      auth: {
        beaconAuth:
          this.mockConfig.BEACON_AUTH || "test-beacon-auth-token-12345",
        password: this.mockConfig.PASSWORD || null,
        secretKey: this.mockConfig.SECRET_KEY || null,
      },

      // WhatsApp configuration
      whatsapp: {
        gatewayNpub: this.mockConfig.WA_GATEWAY_NPUB || "test-npub-12345",
        webhookUrl: this.mockConfig.WHATSAPP_WEBHOOK_URL || null,
        apiToken: this.mockConfig.WHATSAPP_API_TOKEN || null,
        sharedSession: this.mockConfig.WA_SHARED_SESSION === "true",
        branchSessions: this.mockConfig.WA_BRANCH_SESSIONS === "true",
        branchDetection: this.mockConfig.WA_BRANCH_DETECTION === "true",
        branchPatternStrategy:
          this.mockConfig.WA_BRANCH_PATTERN_STRATEGY || null,
        autoMigrateSession: this.mockConfig.WA_AUTO_MIGRATE_SESSION === "true",
        migrationBackup: this.mockConfig.WA_MIGRATION_BACKUP === "true",
        cleanupOnExit: this.mockConfig.WA_CLEANUP_ON_EXIT === "true",
        teamCollaboration: this.mockConfig.WA_TEAM_COLLABORATION === "true",
        teamSessionPrefix: this.mockConfig.WA_TEAM_SESSION_PREFIX || "team",
        sharedBranches: this.mockConfig.WA_SHARED_BRANCHES
          ? this.mockConfig.WA_SHARED_BRANCHES.split(",")
          : ["main", "master", "develop"],
        disableStrategyManager:
          this.mockConfig.WA_DISABLE_STRATEGY_MANAGER === "true",
      },

      // Services configuration
      services: {
        nctools: {
          apiUrl: this.mockConfig.NCTOOLS_API_URL || "http://localhost:3000",
          timeout: parseInt(this.mockConfig.NCTOOLS_TIMEOUT || "30000"),
        },
        everest: {
          apiBase: this.mockConfig.EVEREST_API_BASE || null,
          apiUrl: this.mockConfig.EVEREST_API_URL || "https://api.everest.ai",
          apiKey: this.mockConfig.EVEREST_API_KEY || null,
          api: this.mockConfig.EVEREST_API || null,
        },
      },

      // Cashu configuration
      cashu: {
        defaultMint:
          this.mockConfig.CASHU_DEFAULT_MINT ||
          "https://mint.minibits.cash/Bitcoin",
        minAmount: parseInt(this.mockConfig.CASHU_MIN_AMOUNT || "1"),
        maxAmount: parseInt(this.mockConfig.CASHU_MAX_AMOUNT || "1000000"),
        nctoolsApiUrl:
          this.mockConfig.NCTOOLS_API_URL || "http://localhost:4000",
      },

      // PM2 configuration
      pm2: {
        appName: this.mockConfig.PM2_APP_NAME || null,
        instanceId: this.mockConfig.PM2_INSTANCE_ID || null,
        processId: this.mockConfig.pm_id || null,
        nodeAppInstance: this.mockConfig.NODE_APP_INSTANCE || null,
        processName: this.mockConfig.name || null,
      },

      // Git configuration
      git: {
        branch: this.mockConfig.GIT_BRANCH || null,
        branchName: this.mockConfig.BRANCH_NAME || null,
        ciCommitRefName: this.mockConfig.CI_COMMIT_REF_NAME || null,
        githubRefName: this.mockConfig.GITHUB_REF_NAME || null,
      },

      // Testing configuration
      testing: {
        jestWorkerId: this.mockConfig.JEST_WORKER_ID || null,
      },
    };
  }

  /**
   * Update mock configuration values
   * @param {Object} updates - Configuration updates
   */
  updateConfig(updates) {
    Object.entries(updates).forEach(([key, value]) => {
      this.mockConfig[key] = value;
      process.env[key] = value;
    });

    // Update mocked functions if they exist
    if (this.configModule) {
      this.configModule.getConfig.mockReturnValue(
        this.createMockConfigObject()
      );
    }
  }

  /**
   * Remove configuration values
   * @param {string[]} keys - Keys to remove
   */
  removeConfig(keys) {
    keys.forEach((key) => {
      delete this.mockConfig[key];
      delete process.env[key];
    });

    // Update mocked functions if they exist
    if (this.configModule) {
      this.configModule.getConfig.mockReturnValue(
        this.createMockConfigObject()
      );
    }
  }

  /**
   * Create a configuration scenario for testing
   * @param {string} scenario - Scenario name
   */
  applyScenario(scenario) {
    const scenarios = {
      minimal: {
        NODE_ENV: "test",
        BEACON_AUTH: "test-auth",
        MONGO_URI: "mongodb://localhost:27017/test",
        REDIS_URL: "redis://localhost:6379",
      },

      development: {
        NODE_ENV: "development",
        DEBUG: "true",
        LOG_LEVEL: "debug",
        WA_SHARED_SESSION: "false",
        WA_BRANCH_SESSIONS: "true",
      },

      production: {
        NODE_ENV: "production",
        DEBUG: "false",
        LOG_LEVEL: "warn",
        WA_SHARED_SESSION: "true",
        WA_BRANCH_SESSIONS: "false",
      },

      "team-collaboration": {
        WA_TEAM_COLLABORATION: "true",
        WA_SHARED_SESSION: "false",
        WA_BRANCH_SESSIONS: "true",
        WA_BRANCH_PATTERN_STRATEGY: "prefix",
      },

      "cashu-enabled": {
        NCTOOLS_API_URL: "http://localhost:4000",
        CASHU_DEFAULT_MINT: "https://mint.example.com",
        CASHU_MIN_AMOUNT: "10",
        CASHU_MAX_AMOUNT: "50000",
      },

      "invalid-config": {
        BEACON_AUTH: "", // Invalid - empty
        PORT: "99999", // Invalid - too high
        MONGO_URI: "invalid-uri", // Invalid format
      },
    };

    const scenarioConfig = scenarios[scenario];
    if (!scenarioConfig) {
      throw new Error(`Unknown scenario: ${scenario}`);
    }

    this.updateConfig(scenarioConfig);
  }

  /**
   * Clean up mocks and restore environment
   */
  cleanup() {
    // Restore original environment if preserved
    if (Object.keys(this.originalEnv).length > 0) {
      process.env = { ...this.originalEnv };
    } else {
      // Clear test environment variables
      Object.keys(this.mockConfig).forEach((key) => {
        delete process.env[key];
      });
    }

    // Restore mocked functions
    if (this.configModule) {
      Object.values(this.configModule).forEach((fn) => {
        if (fn && typeof fn.mockRestore === "function") {
          fn.mockRestore();
        }
      });
    }

    // Reset internal state
    this.originalEnv = {};
    this.mockConfig = {};
    this.configModule = null;
  }
}

/**
 * Global configuration mock instance
 */
export const configMock = new ConfigMock();

/**
 * Jest helper functions for configuration testing
 */
export const configTestHelpers = {
  /**
   * Set up configuration for a test
   * @param {Object} config - Configuration values
   * @param {Object} options - Setup options
   */
  async setupConfig(config = {}, options = {}) {
    await configMock.setup(config, options);
  },

  /**
   * Apply a configuration scenario
   * @param {string} scenario - Scenario name
   */
  applyScenario(scenario) {
    configMock.applyScenario(scenario);
  },

  /**
   * Update configuration during test
   * @param {Object} updates - Configuration updates
   */
  updateConfig(updates) {
    configMock.updateConfig(updates);
  },

  /**
   * Remove configuration keys
   * @param {string[]} keys - Keys to remove
   */
  removeConfig(keys) {
    configMock.removeConfig(keys);
  },

  /**
   * Clean up configuration mocks
   */
  cleanup() {
    configMock.cleanup();
  },

  /**
   * Create a test with isolated configuration
   * @param {string} name - Test name
   * @param {Object} config - Configuration for test
   * @param {Function} testFn - Test function
   */
  testWithConfig(name, config, testFn) {
    test(name, async () => {
      await configMock.setup(config);
      try {
        await testFn();
      } finally {
        configMock.cleanup();
      }
    });
  },

  /**
   * Create a describe block with configuration setup
   * @param {string} name - Describe block name
   * @param {Object} config - Configuration for all tests
   * @param {Function} describeFn - Describe function
   */
  describeWithConfig(name, config, describeFn) {
    describe(name, () => {
      beforeEach(async () => {
        await configMock.setup(config);
      });

      afterEach(() => {
        configMock.cleanup();
      });

      describeFn();
    });
  },
};

/**
 * Configuration validation test helpers
 */
export const configValidationHelpers = {
  /**
   * Test configuration validation
   * @param {Object} config - Configuration to validate
   * @param {boolean} shouldPass - Whether validation should pass
   */
  async testValidation(config, shouldPass = true) {
    await configMock.setup(config);

    try {
      const { initializeConfig, isConfigValid, getConfigErrors } = await import(
        "../../app/config/index.js"
      );
      const result = initializeConfig({ throwOnValidationError: false });

      const isValid = isConfigValid();
      const errors = getConfigErrors();

      if (shouldPass) {
        expect(isValid).toBe(true);
        expect(errors).toHaveLength(0);
      } else {
        expect(isValid).toBe(false);
        expect(errors.length).toBeGreaterThan(0);
      }

      return { isValid, errors, config: result };
    } finally {
      configMock.cleanup();
    }
  },

  /**
   * Test configuration error scenarios
   * @param {Object} invalidConfig - Invalid configuration
   * @param {string[]} expectedErrors - Expected error messages
   */
  async testErrorScenario(invalidConfig, expectedErrors = []) {
    const result = await this.testValidation(invalidConfig, false);

    expectedErrors.forEach((expectedError) => {
      expect(result.errors.some((error) => error.includes(expectedError))).toBe(
        true
      );
    });

    return result;
  },
};

export default {
  ConfigMock,
  configMock,
  configTestHelpers,
  configValidationHelpers,
};
