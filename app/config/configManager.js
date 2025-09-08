/**
 * Configuration Manager
 * Centralized configuration loading with Docker secrets support
 * Provides environment variable fallback mechanism, validation, and sensitive data redaction
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Docker secrets base path
 */
const DOCKER_SECRETS_PATH = "/run/secrets";

/**
 * Sensitive configuration keys that should be redacted in logs
 */
const SENSITIVE_KEYS = [
  "auth",
  "token",
  "key",
  "secret",
  "password",
  "pass",
  "pwd",
  "credential",
  "cert",
  "private",
  "api_key",
  "apikey",
];

/**
 * Configuration Manager class
 * Handles loading, validation, and management of application configuration
 */
export class ConfigManager {
  constructor() {
    this.config = {};
    this.loaded = false;
    this.validationErrors = [];
    this.warnings = [];
  }

  /**
   * Load configuration from Docker secrets with environment variable fallback
   * @param {string} key - Configuration key
   * @param {Object} options - Loading options
   * @param {string} options.secretName - Docker secret name (defaults to key)
   * @param {string} options.envVar - Environment variable name (defaults to key)
   * @param {*} options.defaultValue - Default value if neither secret nor env var exists
   * @param {boolean} options.required - Whether this configuration is required
   * @returns {string|null} Configuration value
   */
  loadValue(key, options = {}) {
    const {
      secretName = key.toLowerCase(),
      envVar = key,
      defaultValue = null,
      required = false,
    } = options;

    let value = null;

    // Try Docker secrets first
    try {
      const secretPath = join(DOCKER_SECRETS_PATH, secretName);
      if (existsSync(secretPath)) {
        value = readFileSync(secretPath, "utf8").trim();
        this.logDebug(`Loaded ${key} from Docker secret: ${secretName}`);
      }
    } catch (error) {
      this.logDebug(
        `Failed to read Docker secret ${secretName}: ${error.message}`
      );
    }

    // Fallback to environment variable
    if (value === null && process.env[envVar] !== undefined) {
      value = process.env[envVar];
      this.logDebug(`Loaded ${key} from environment variable: ${envVar}`);
    }

    // Use default value if provided
    if (value === null && defaultValue !== null) {
      value = defaultValue;
      this.logDebug(`Using default value for ${key}`);
    }

    // Check if required value is missing
    if (required && (value === null || value === undefined || value === "")) {
      const error = `Required configuration ${key} is missing. Check Docker secret '${secretName}' or environment variable '${envVar}'`;
      this.validationErrors.push(error);
      throw new Error(error);
    }

    return value;
  }

  /**
   * Convert string value to specified type
   * @param {string} value - String value to convert
   * @param {string} type - Target type ('string', 'number', 'boolean', 'array')
   * @param {string} key - Configuration key for error reporting
   * @returns {*} Converted value
   */
  convertType(value, type, key) {
    if (value === null || value === undefined) {
      return value;
    }

    try {
      switch (type) {
        case "string":
          return String(value);

        case "number":
          const num = Number(value);
          if (isNaN(num)) {
            throw new Error(`Invalid number value for ${key}: ${value}`);
          }
          return num;

        case "boolean":
          if (typeof value === "boolean") return value;
          const lowerValue = String(value).toLowerCase();
          if (["true", "1", "yes", "on"].includes(lowerValue)) return true;
          if (["false", "0", "no", "off", ""].includes(lowerValue))
            return false;
          throw new Error(`Invalid boolean value for ${key}: ${value}`);

        case "array":
          if (Array.isArray(value)) return value;
          return String(value)
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item);

        default:
          return value;
      }
    } catch (error) {
      this.validationErrors.push(
        `Type conversion failed for ${key}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Validate configuration value against constraints
   * @param {*} value - Value to validate
   * @param {Object} constraints - Validation constraints
   * @param {string} key - Configuration key for error reporting
   * @returns {boolean} Whether validation passed
   */
  validateConstraints(value, constraints, key) {
    if (!constraints || value === null || value === undefined) {
      return true;
    }

    try {
      // Min/Max validation for numbers
      if (typeof value === "number") {
        if (constraints.min !== undefined && value < constraints.min) {
          throw new Error(
            `${key} must be at least ${constraints.min}, got ${value}`
          );
        }
        if (constraints.max !== undefined && value > constraints.max) {
          throw new Error(
            `${key} must be at most ${constraints.max}, got ${value}`
          );
        }
      }

      // Length validation for strings and arrays
      if (typeof value === "string" || Array.isArray(value)) {
        if (
          constraints.minLength !== undefined &&
          value.length < constraints.minLength
        ) {
          throw new Error(
            `${key} must have at least ${constraints.minLength} characters/items, got ${value.length}`
          );
        }
        if (
          constraints.maxLength !== undefined &&
          value.length > constraints.maxLength
        ) {
          throw new Error(
            `${key} must have at most ${constraints.maxLength} characters/items, got ${value.length}`
          );
        }
      }

      // Pattern validation for strings
      if (typeof value === "string" && constraints.pattern) {
        const regex = new RegExp(constraints.pattern);
        if (!regex.test(value)) {
          throw new Error(
            `${key} does not match required pattern: ${constraints.pattern}`
          );
        }
      }

      // Enum validation
      if (constraints.enum && !constraints.enum.includes(value)) {
        throw new Error(
          `${key} must be one of: ${constraints.enum.join(", ")}, got ${value}`
        );
      }

      return true;
    } catch (error) {
      this.validationErrors.push(
        `Validation failed for ${key}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Load and validate configuration from schema
   * @param {Object} schema - Configuration schema
   * @returns {Object} Loaded and validated configuration
   */
  loadConfiguration(schema) {
    this.config = {};
    this.validationErrors = [];
    this.warnings = [];

    for (const [section, sectionConfig] of Object.entries(schema)) {
      this.config[section] = this.loadSection(sectionConfig, section);
    }

    this.loaded = true;
    return this.config;
  }

  /**
   * Load a configuration section (handles nested sections)
   * @param {Object} sectionConfig - Section configuration
   * @param {string} sectionPath - Path to this section for error reporting
   * @returns {Object} Loaded section configuration
   */
  loadSection(sectionConfig, sectionPath) {
    const result = {};

    for (const [key, keyConfig] of Object.entries(sectionConfig)) {
      const fullPath = `${sectionPath}.${key}`;

      // Check if this is a leaf configuration (has envVar, secretName, or type)
      if (
        keyConfig.envVar ||
        keyConfig.secretName ||
        keyConfig.type ||
        keyConfig.defaultValue !== undefined
      ) {
        try {
          // DEBUG: Add comprehensive logging for configuration loading
          const envVarToUse = keyConfig.envVar || key;
          console.log(`[ConfigManager] DEBUG - Loading ${fullPath}:`, {
            key,
            envVar: keyConfig.envVar,
            envVarToUse,
            secretName: keyConfig.secretName,
            defaultValue: keyConfig.defaultValue,
            required: keyConfig.required,
            processEnvValue: process.env[envVarToUse],
          });

          // Load raw value
          const rawValue = this.loadValue(envVarToUse, {
            secretName: keyConfig.secretName,
            envVar: keyConfig.envVar || key,
            defaultValue: keyConfig.defaultValue,
            required: keyConfig.required || false,
          });

          console.log(`[ConfigManager] DEBUG - Loaded value for ${fullPath}:`, {
            rawValue,
            willUseDefault: rawValue === keyConfig.defaultValue,
          });

          // Convert type
          const typedValue = this.convertType(
            rawValue,
            keyConfig.type || "string",
            fullPath
          );

          // Validate constraints
          this.validateConstraints(typedValue, keyConfig.constraints, fullPath);

          // Store in config
          result[key] = typedValue;

          // Add warning if using default
          if (
            rawValue === keyConfig.defaultValue &&
            keyConfig.defaultValue !== null
          ) {
            this.warnings.push(
              `Using default value for ${key}: ${keyConfig.defaultValue}`
            );
          }
        } catch (error) {
          // For non-required fields, continue with null value
          if (!keyConfig.required) {
            result[key] = null;
            this.warnings.push(
              `Optional configuration ${key} failed to load: ${error.message}`
            );
          } else {
            throw error;
          }
        }
      } else {
        // This is a nested section, recurse into it
        result[key] = this.loadSection(keyConfig, fullPath);
      }
    }

    return result;
  }

  /**
   * Get configuration value by path
   * @param {string} path - Dot-separated path (e.g., 'database.mongoUri')
   * @param {*} defaultValue - Default value if path not found
   * @returns {*} Configuration value
   */
  get(path, defaultValue = null) {
    if (!this.loaded) {
      throw new Error(
        "Configuration not loaded. Call loadConfiguration() first."
      );
    }

    const keys = path.split(".");
    let value = this.config;

    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  /**
   * Get all configuration with sensitive data redacted
   * @returns {Object} Redacted configuration object
   */
  getRedacted() {
    return this.redactSensitiveData(this.config);
  }

  /**
   * Redact sensitive data from configuration object
   * @param {Object} obj - Object to redact
   * @returns {Object} Redacted object
   */
  redactSensitiveData(obj) {
    if (typeof obj !== "object" || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactSensitiveData(item));
    }

    const redacted = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_KEYS.some((sensitiveKey) =>
        lowerKey.includes(sensitiveKey)
      );

      if (isSensitive && typeof value === "string" && value.length > 0) {
        redacted[key] = "[REDACTED]";
      } else if (typeof value === "object") {
        redacted[key] = this.redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  /**
   * Get validation errors
   * @returns {Array} Array of validation error messages
   */
  getValidationErrors() {
    return [...this.validationErrors];
  }

  /**
   * Get warnings
   * @returns {Array} Array of warning messages
   */
  getWarnings() {
    return [...this.warnings];
  }

  /**
   * Check if configuration is valid
   * @returns {boolean} Whether configuration is valid
   */
  isValid() {
    return this.validationErrors.length === 0;
  }

  /**
   * Log debug message (only in development or when DEBUG=true)
   * @param {string} message - Debug message
   */
  logDebug(message) {
    if (
      process.env.NODE_ENV === "development" ||
      process.env.DEBUG === "true"
    ) {
      console.log(`[ConfigManager] ${message}`);
    }
  }

  /**
   * Reset configuration manager state
   */
  reset() {
    this.config = {};
    this.loaded = false;
    this.validationErrors = [];
    this.warnings = [];
  }
}

/**
 * Default configuration manager instance
 */
export const configManager = new ConfigManager();
