/**
 * Configuration Index
 * Main export point for the configuration system
 * Initializes and exports configured instance with startup validation
 */

import { ConfigManager, configManager } from "./configManager.js";
import { configSchema, validateSchema } from "./schema.js";

/**
 * Global configuration instance
 */
let globalConfig = null;
let isInitialized = false;

/**
 * Initialize configuration system
 * @param {Object} options - Initialization options
 * @param {boolean} options.validateOnStartup - Whether to validate configuration on startup (default: true)
 * @param {boolean} options.throwOnValidationError - Whether to throw on validation errors (default: true)
 * @param {boolean} options.logWarnings - Whether to log warnings (default: true)
 * @returns {Object} Loaded configuration
 */
export function initializeConfig(options = {}) {
  const {
    validateOnStartup = true,
    throwOnValidationError = true,
    logWarnings = true,
  } = options;

  const result = {
    isValid: false,
    errors: [],
    warnings: [],
    config: null,
  };

  try {
    // Validate schema structure first
    if (validateOnStartup) {
      const schemaValidation = validateSchema();
      if (!schemaValidation.valid) {
        result.errors.push(
          ...schemaValidation.errors.map((err) => ({ message: err }))
        );
        const error = new Error(
          `Configuration schema validation failed: ${schemaValidation.errors.join(
            ", "
          )}`
        );
        if (throwOnValidationError) {
          throw error;
        } else {
          console.error(
            "[Config] Schema validation failed:",
            schemaValidation.errors
          );
        }
      }

      if (logWarnings && schemaValidation.warnings.length > 0) {
        result.warnings.push(...schemaValidation.warnings);
        console.warn("[Config] Schema warnings:", schemaValidation.warnings);
      }
    }

    // Load configuration using the schema
    globalConfig = configManager.loadConfiguration(configSchema);

    // Check for validation errors
    const validationErrors = configManager.getValidationErrors();
    if (validationErrors.length > 0) {
      result.errors.push(...validationErrors.map((err) => ({ message: err })));
      const error = new Error(
        `Configuration validation failed: ${validationErrors.join(", ")}`
      );
      if (throwOnValidationError) {
        throw error;
      } else {
        console.error("[Config] Validation failed:", validationErrors);
      }
    }

    // Log warnings if enabled
    if (logWarnings) {
      const warnings = configManager.getWarnings();
      if (warnings.length > 0) {
        result.warnings.push(...warnings);
        console.warn("[Config] Configuration warnings:", warnings);
      }
    }

    // Log successful initialization
    if (process.env.NODE_ENV !== "test") {
      console.log("[Config] Configuration loaded successfully");

      // Log redacted configuration in development mode
      if (
        process.env.NODE_ENV === "development" ||
        process.env.DEBUG === "true"
      ) {
        console.log(
          "[Config] Loaded configuration:",
          JSON.stringify(configManager.getRedacted(), null, 2)
        );
      }
    }

    isInitialized = true;
    result.isValid = result.errors.length === 0;
    result.config = globalConfig;

    // Check if caller expects structured result (when throwOnValidationError is false)
    const expectStructuredResult = throwOnValidationError === false;
    
    // Return structured result if explicitly requested or if there are errors
    if (expectStructuredResult || result.errors.length > 0) {
      return result;
    }
    
    // For backward compatibility, return the config object for successful cases
    return globalConfig;
  } catch (error) {
    console.error(
      "[Config] Failed to initialize configuration:",
      error.message
    );

    result.errors.push({ message: error.message });

    if (throwOnValidationError) {
      throw error;
    }

    // Return empty configuration on failure if not throwing
    globalConfig = {};
    isInitialized = true;
    result.config = globalConfig;
    return result;
  }
}

/**
 * Get configuration value by path
 * @param {string} path - Dot-separated path (e.g., 'database.mongoUri')
 * @param {*} defaultValue - Default value if path not found
 * @returns {*} Configuration value
 */
export function getConfig(path, defaultValue = null) {
  if (!isInitialized) {
    initializeConfig();
  }

  // If no path provided, return the full configuration
  if (path === undefined || path === null) {
    return globalConfig;
  }

  return configManager.get(path, defaultValue);
}

/**
 * Get configuration value by key (convenience function)
 * @param {string} key - Configuration key (e.g., 'BEACON_AUTH')
 * @param {*} defaultValue - Default value if key not found
 * @returns {*} Configuration value
 */
export function get(key, defaultValue = undefined) {
  if (!isInitialized) {
    initializeConfig();
  }

  // For direct environment variable access
  return process.env[key] ?? defaultValue;
}

/**
 * Check if configuration key exists
 * @param {string} key - Configuration key to check
 * @returns {boolean} Whether key exists
 */
export function has(key) {
  if (!isInitialized) {
    initializeConfig();
  }

  return key in process.env;
}

/**
 * Get all configuration (redacted)
 * @returns {Object} Complete configuration object with sensitive data redacted
 */
export function getAllConfig() {
  if (!isInitialized) {
    initializeConfig();
  }

  return configManager.getRedacted();
}

/**
 * Get raw configuration (unredacted) - use with caution
 * @returns {Object} Complete configuration object with sensitive data
 */
export function getRawConfig() {
  if (!isInitialized) {
    initializeConfig();
  }

  return globalConfig;
}

/**
 * Check if configuration is valid
 * @returns {boolean} Whether configuration is valid
 */
export function isConfigValid() {
  if (!isInitialized) {
    initializeConfig();
  }

  return configManager.isValid();
}

/**
 * Get configuration validation errors
 * @returns {Array<string>} Array of validation error messages
 */
export function getConfigErrors() {
  if (!isInitialized) {
    initializeConfig();
  }

  return configManager.getValidationErrors();
}

/**
 * Get configuration warnings
 * @returns {Array<string>} Array of warning messages
 */
export function getConfigWarnings() {
  if (!isInitialized) {
    initializeConfig();
  }

  return configManager.getWarnings();
}

/**
 * Reset configuration system (useful for testing)
 */
export function resetConfig() {
  configManager.reset();
  globalConfig = null;
  isInitialized = false;
}

/**
 * Reload configuration from environment
 * @param {Object} options - Reload options
 * @returns {Object} Reloaded configuration
 */
export function reloadConfig(options = {}) {
  resetConfig();
  return initializeConfig(options);
}

/**
 * Get configuration manager instance (for advanced usage)
 * @returns {ConfigManager} Configuration manager instance
 */
export function getConfigManager() {
  return configManager;
}

// Convenience exports for common configuration sections
export const config = {
  /**
   * Get application configuration
   * @returns {Object} Application configuration
   */
  get app() {
    return getConfig("app", {});
  },

  /**
   * Get database configuration
   * @returns {Object} Database configuration
   */
  get database() {
    return getConfig("database", {});
  },

  /**
   * Get Redis configuration
   * @returns {Object} Redis configuration
   */
  get redis() {
    return getConfig("redis", {});
  },

  /**
   * Get authentication configuration
   * @returns {Object} Authentication configuration
   */
  get auth() {
    return getConfig("auth", {});
  },

  /**
   * Get WhatsApp configuration
   * @returns {Object} WhatsApp configuration
   */
  get whatsapp() {
    return getConfig("whatsapp", {});
  },

  /**
   * Get services configuration
   * @returns {Object} Services configuration
   */
  get services() {
    return getConfig("services", {});
  },

  /**
   * Get Cashu configuration
   * @returns {Object} Cashu configuration
   */
  get cashu() {
    return getConfig("cashu", {});
  },

  /**
   * Get PM2 configuration
   * @returns {Object} PM2 configuration
   */
  get pm2() {
    return getConfig("pm2", {});
  },

  /**
   * Get Git configuration
   * @returns {Object} Git configuration
   */
  get git() {
    return getConfig("git", {});
  },

  /**
   * Get testing configuration
   * @returns {Object} Testing configuration
   */
  get testing() {
    return getConfig("testing", {});
  },
};

// Export schema and manager for advanced usage
export { configSchema } from "./schema.js";
export { ConfigManager } from "./configManager.js";

// Auto-initialize configuration if not in test environment
// Skip auto-initialization if we're in a test environment or if explicitly disabled
if (
  process.env.NODE_ENV !== "test" &&
  !process.env.JEST_WORKER_ID &&
  process.env.CONFIG_DISABLE_AUTO_INIT !== "true"
) {
  try {
    initializeConfig({
      throwOnValidationError: process.env.NODE_ENV === "production",
    });
  } catch (error) {
    console.error(
      "[Config] Failed to auto-initialize configuration:",
      error.message
    );

    // In production, we should fail fast
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
}

// Default export
export default config;
