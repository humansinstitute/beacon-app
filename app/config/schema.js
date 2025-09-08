/**
 * Configuration Schema
 * Defines all configuration parameters with types, defaults, and validation rules
 * Supports nested configuration objects and comprehensive validation
 */

/**
 * Application configuration schema
 * Organized by functional areas for better maintainability
 */
export const configSchema = {
  // Application Core Settings
  app: {
    nodeEnv: {
      envVar: "NODE_ENV",
      type: "string",
      defaultValue: "development",
      constraints: {
        enum: ["development", "production", "test"],
      },
      description: "Application environment mode",
    },
    port: {
      envVar: "PORT",
      type: "number",
      defaultValue: 3000,
      constraints: {
        min: 1,
        max: 65535,
      },
      description: "Application port number",
    },
    apiServerPort: {
      envVar: "API_SERVER_PORT",
      type: "number",
      defaultValue: 3256,
      constraints: {
        min: 1,
        max: 65535,
      },
      description: "API server port number",
    },
    serverUrl: {
      envVar: "SERVER_URL",
      type: "string",
      defaultValue: "http://localhost",
      constraints: {
        pattern: "^https?://.+",
      },
      description: "Base server URL",
    },
    apiBaseUrl: {
      envVar: "API_BASE_URL",
      type: "string",
      defaultValue: null,
      description: "API base URL override",
    },
    debug: {
      envVar: "DEBUG",
      type: "boolean",
      defaultValue: false,
      description: "Enable debug logging",
    },
    logLevel: {
      envVar: "LOG_LEVEL",
      type: "string",
      defaultValue: "info",
      constraints: {
        enum: ["error", "warn", "info", "debug", "trace"],
      },
      description: "Application log level",
    },
  },

  // Database Configuration
  database: {
    mongoUri: {
      envVar: "MONGO_URI",
      secretName: "mongo_uri",
      type: "string",
      defaultValue: "mongodb://localhost:27017/thebeacon",
      required: true,
      constraints: {
        pattern: "^mongodb://.+",
      },
      description: "MongoDB connection URI",
    },
    mongodbUri: {
      envVar: "MONGODB_URI",
      secretName: "mongodb_uri",
      type: "string",
      defaultValue: null,
      constraints: {
        pattern: "^mongodb://.+",
      },
      description: "Alternative MongoDB connection URI",
    },
  },

  // Redis Configuration
  redis: {
    url: {
      envVar: "REDIS_URL",
      secretName: "redis_url",
      type: "string",
      defaultValue: "redis://127.0.0.1:6379",
      required: true,
      constraints: {
        pattern: "^redis://.+",
      },
      description: "Redis connection URL",
    },
  },

  // Authentication & Security
  auth: {
    beaconAuth: {
      envVar: "BEACON_AUTH",
      secretName: "beacon_auth",
      type: "string",
      required: true,
      constraints: {
        minLength: 8,
      },
      description: "Beacon application authentication token",
    },
    password: {
      envVar: "PASSWORD",
      secretName: "password",
      type: "string",
      defaultValue: null,
      description: "Generic password field",
    },
    secretKey: {
      envVar: "SECRET_KEY",
      secretName: "secret_key",
      type: "string",
      defaultValue: null,
      description: "Generic secret key",
    },
  },

  // WhatsApp Gateway Configuration
  whatsapp: {
    gatewayNpub: {
      envVar: "WA_GATEWAY_NPUB",
      secretName: "wa_gateway_npub",
      type: "string",
      required: true,
      description: "WhatsApp gateway Nostr public key",
    },
    webhookUrl: {
      envVar: "WHATSAPP_WEBHOOK_URL",
      type: "string",
      defaultValue: null,
      constraints: {
        pattern: "^https?://.+",
      },
      description: "WhatsApp webhook URL",
    },
    apiToken: {
      envVar: "WHATSAPP_API_TOKEN",
      secretName: "whatsapp_api_token",
      type: "string",
      defaultValue: null,
      description: "WhatsApp API token",
    },
    sharedSession: {
      envVar: "WA_SHARED_SESSION",
      type: "boolean",
      defaultValue: true,
      description: "Enable shared WhatsApp session",
    },
    branchSessions: {
      envVar: "WA_BRANCH_SESSIONS",
      type: "boolean",
      defaultValue: false,
      description: "Enable branch-specific WhatsApp sessions",
    },
    branchDetection: {
      envVar: "WA_BRANCH_DETECTION",
      type: "boolean",
      defaultValue: true,
      description: "Enable automatic branch detection",
    },
    branchPatternStrategy: {
      envVar: "WA_BRANCH_PATTERN_STRATEGY",
      type: "string",
      defaultValue: null,
      constraints: {
        enum: ["prefix", "suffix", "contains"],
      },
      description: "Branch pattern matching strategy",
    },
    autoMigrateSession: {
      envVar: "WA_AUTO_MIGRATE_SESSION",
      type: "boolean",
      defaultValue: true,
      description: "Enable automatic session migration",
    },
    migrationBackup: {
      envVar: "WA_MIGRATION_BACKUP",
      type: "boolean",
      defaultValue: true,
      description: "Enable session migration backup",
    },
    cleanupOnExit: {
      envVar: "WA_CLEANUP_ON_EXIT",
      type: "boolean",
      defaultValue: false,
      description: "Enable session cleanup on application exit",
    },
    teamCollaboration: {
      envVar: "WA_TEAM_COLLABORATION",
      type: "boolean",
      defaultValue: false,
      description: "Enable team collaboration mode",
    },
    teamSessionPrefix: {
      envVar: "WA_TEAM_SESSION_PREFIX",
      type: "string",
      defaultValue: "team",
      description: "Team session prefix",
    },
    sharedBranches: {
      envVar: "WA_SHARED_BRANCHES",
      type: "array",
      defaultValue: ["main", "master", "develop"],
      description: "Branches that use shared sessions",
    },
    disableStrategyManager: {
      envVar: "WA_DISABLE_STRATEGY_MANAGER",
      type: "boolean",
      defaultValue: false,
      description: "Disable WhatsApp strategy manager",
    },

    // New guardrail flags
    sessionProfileMode: {
      envVar: "WA_SESSION_PROFILE_MODE",
      type: "string",
      defaultValue: "wwebjs",
      constraints: {
        enum: ["wwebjs", "chromeProfile"],
      },
      description:
        "Validator profile: wwebjs (LocalAuth artifacts) or chromeProfile (full Chromium Default/*)",
    },
    allowCompleteReset: {
      envVar: "WA_ALLOW_COMPLETE_RESET",
      type: "boolean",
      defaultValue: false,
      description:
        "Allow destructive complete_reset (Level 4). Keep false in production shared sessions.",
    },
    requireManualQr: {
      envVar: "WA_REQUIRE_MANUAL_QR",
      type: "boolean",
      defaultValue: true,
      description:
        "Gate QR display. Only show QR if false or session is definitely expired/nonexistent.",
    },
  },

  // External Services
  services: {
    // NC Tools Configuration
    nctools: {
      apiUrl: {
        envVar: "NCTOOLS_API_URL",
        type: "string",
        defaultValue: "http://localhost:3000",
        constraints: {
          pattern: "^https?://.+",
        },
        description: "NC Tools API URL",
      },
      timeout: {
        envVar: "NCTOOLS_TIMEOUT",
        type: "number",
        defaultValue: 30000,
        constraints: {
          min: 1000,
          max: 300000,
        },
        description: "NC Tools API timeout in milliseconds",
      },
    },

    // Everest AI Service Configuration
    everest: {
      apiBase: {
        envVar: "EVEREST_API_BASE",
        secretName: "everest_api_base",
        type: "string",
        defaultValue: null,
        constraints: {
          pattern: "^https?://.+",
        },
        description: "Everest AI API base URL",
      },
      apiUrl: {
        envVar: "EVEREST_API_URL",
        type: "string",
        defaultValue: "https://api.everest.ai",
        constraints: {
          pattern: "^https?://.+",
        },
        description: "Everest AI API URL",
      },
      apiKey: {
        envVar: "EVEREST_API_KEY",
        secretName: "everest_api_key",
        type: "string",
        defaultValue: null,
        description: "Everest AI API key",
      },
      api: {
        envVar: "EVEREST_API",
        secretName: "everest_api",
        type: "string",
        defaultValue: null,
        description: "Everest AI API token",
      },
    },
  },

  // Cashu Configuration
  cashu: {
    defaultMint: {
      envVar: "CASHU_DEFAULT_MINT",
      type: "string",
      defaultValue: "https://mint.minibits.cash/Bitcoin",
      constraints: {
        pattern: "^https?://.+",
      },
      description: "Default Cashu mint URL",
    },
    minAmount: {
      envVar: "CASHU_MIN_AMOUNT",
      type: "number",
      defaultValue: 1,
      constraints: {
        min: 1,
      },
      description: "Minimum Cashu amount in satoshis",
    },
    maxAmount: {
      envVar: "CASHU_MAX_AMOUNT",
      type: "number",
      defaultValue: 1000000,
      constraints: {
        min: 1,
      },
      description: "Maximum Cashu amount in satoshis",
    },
  },

  // Process Management (PM2)
  pm2: {
    appName: {
      envVar: "PM2_APP_NAME",
      type: "string",
      defaultValue: null,
      description: "PM2 application name",
    },
    instanceId: {
      envVar: "PM2_INSTANCE_ID",
      type: "string",
      defaultValue: null,
      description: "PM2 instance ID",
    },
    processId: {
      envVar: "pm_id",
      type: "string",
      defaultValue: null,
      description: "PM2 process ID",
    },
    nodeAppInstance: {
      envVar: "NODE_APP_INSTANCE",
      type: "string",
      defaultValue: null,
      description: "Node application instance identifier",
    },
    processName: {
      envVar: "name",
      type: "string",
      defaultValue: null,
      description: "Process name",
    },
  },

  // Git Integration
  git: {
    branch: {
      envVar: "GIT_BRANCH",
      type: "string",
      defaultValue: null,
      description: "Git branch name",
    },
    branchName: {
      envVar: "BRANCH_NAME",
      type: "string",
      defaultValue: null,
      description: "Alternative git branch name",
    },
    ciCommitRefName: {
      envVar: "CI_COMMIT_REF_NAME",
      type: "string",
      defaultValue: null,
      description: "CI commit reference name",
    },
    githubRefName: {
      envVar: "GITHUB_REF_NAME",
      type: "string",
      defaultValue: null,
      description: "GitHub reference name",
    },
  },

  // Testing Environment
  testing: {
    jestWorkerId: {
      envVar: "JEST_WORKER_ID",
      type: "string",
      defaultValue: null,
      description: "Jest worker ID for test environment",
    },
  },
};

/**
 * Get configuration schema for a specific section
 * @param {string} section - Section name
 * @returns {Object|null} Section schema or null if not found
 */
export function getSchemaSection(section) {
  return configSchema[section] || null;
}

/**
 * Get all environment variable names from schema
 * @returns {Array<string>} Array of environment variable names
 */
export function getAllEnvVars() {
  const envVars = [];

  function extractEnvVars(obj) {
    for (const config of Object.values(obj)) {
      if (config.envVar) {
        envVars.push(config.envVar);
      } else if (
        typeof config === "object" &&
        config !== null &&
        !config.envVar &&
        !config.secretName
      ) {
        // This is a nested section, recurse into it
        extractEnvVars(config);
      }
    }
  }

  for (const section of Object.values(configSchema)) {
    extractEnvVars(section);
  }

  return [...new Set(envVars)].sort();
}

/**
 * Get all required environment variables from schema
 * @returns {Array<string>} Array of required environment variable names
 */
export function getRequiredEnvVars() {
  const requiredVars = [];

  function extractRequiredVars(obj) {
    for (const config of Object.values(obj)) {
      if (config.required && config.envVar) {
        requiredVars.push(config.envVar);
      } else if (
        typeof config === "object" &&
        config !== null &&
        !config.envVar &&
        !config.secretName
      ) {
        // This is a nested section, recurse into it
        extractRequiredVars(config);
      }
    }
  }

  for (const section of Object.values(configSchema)) {
    extractRequiredVars(section);
  }

  return requiredVars.sort();
}

/**
 * Get all Docker secret names from schema
 * @returns {Array<string>} Array of Docker secret names
 */
export function getAllSecretNames() {
  const secretNames = [];

  function extractSecretNames(obj) {
    for (const config of Object.values(obj)) {
      if (config.secretName) {
        secretNames.push(config.secretName);
      } else if (
        typeof config === "object" &&
        config !== null &&
        !config.envVar &&
        !config.secretName
      ) {
        // This is a nested section, recurse into it
        extractSecretNames(config);
      }
    }
  }

  for (const section of Object.values(configSchema)) {
    extractSecretNames(section);
  }

  return [...new Set(secretNames)].sort();
}

/**
 * Validate schema structure
 * @returns {Object} Validation result
 */
export function validateSchema() {
  const errors = [];
  const warnings = [];

  function validateSection(obj, path = "") {
    for (const [keyName, config] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${keyName}` : keyName;

      if (typeof config !== "object" || config === null) {
        errors.push(`Configuration ${currentPath} must be an object`);
        continue;
      }

      // Check if this is a leaf configuration or nested section
      if (config.envVar || config.secretName) {
        // This is a leaf configuration

        // Check type validity
        if (
          config.type &&
          !["string", "number", "boolean", "array"].includes(config.type)
        ) {
          errors.push(
            `Configuration ${currentPath} has invalid type: ${config.type}`
          );
        }

        // Check constraint validity
        if (config.constraints) {
          if (config.type === "number") {
            if (
              config.constraints.min !== undefined &&
              typeof config.constraints.min !== "number"
            ) {
              errors.push(
                `Configuration ${currentPath} min constraint must be a number`
              );
            }
            if (
              config.constraints.max !== undefined &&
              typeof config.constraints.max !== "number"
            ) {
              errors.push(
                `Configuration ${currentPath} max constraint must be a number`
              );
            }
          }

          if (
            config.constraints.enum &&
            !Array.isArray(config.constraints.enum)
          ) {
            errors.push(
              `Configuration ${currentPath} enum constraint must be an array`
            );
          }
        }
      } else if (config.type || config.description) {
        // This looks like a configuration but has no envVar or secretName
        warnings.push(
          `Configuration ${currentPath} has no envVar or secretName`
        );
      } else {
        // This might be a nested section, recurse into it
        validateSection(config, currentPath);
      }
    }
  }

  for (const [sectionName, section] of Object.entries(configSchema)) {
    if (typeof section !== "object" || section === null) {
      errors.push(`Section ${sectionName} must be an object`);
      continue;
    }

    validateSection(section, sectionName);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export default configSchema;
