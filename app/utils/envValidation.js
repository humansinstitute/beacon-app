/**
 * Environment validation utilities
 * Validates configuration using the centralized configuration system
 */

import {
  isConfigValid,
  getConfigErrors,
  getConfigWarnings,
} from "../config/index.js";

/**
 * Validates that the BEACON_AUTH configuration is properly set
 * @returns {Object} Validation result with success status and error message if applicable
 */
export const validateBeaconAuth = () => {
  try {
    // The configuration system handles validation internally
    // We just need to check if the configuration is valid
    if (!isConfigValid()) {
      const errors = getConfigErrors();
      const beaconAuthError = errors.find((error) =>
        error.includes("BEACON_AUTH")
      );

      if (beaconAuthError) {
        return {
          success: false,
          error: beaconAuthError,
        };
      }
    }

    return {
      success: true,
      message: "BEACON_AUTH configuration is properly set",
    };
  } catch (error) {
    return {
      success: false,
      error: `Configuration validation failed: ${error.message}`,
    };
  }
};

/**
 * Validates NC Tools configuration
 * @returns {Object} Validation result with success status and any warnings
 */
export const validateNCToolsConfig = () => {
  try {
    const warnings = getConfigWarnings();
    const nctoolsWarnings = warnings.filter(
      (warning) =>
        warning.includes("NCTOOLS") ||
        warning.includes("nctools") ||
        warning.includes("apiUrl") ||
        warning.includes("timeout")
    );

    return {
      success: true,
      message: "NC Tools configuration validated",
      warnings: nctoolsWarnings.length > 0 ? nctoolsWarnings : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: `NC Tools configuration validation failed: ${error.message}`,
    };
  }
};

/**
 * Validates Cashu configuration
 * @returns {Object} Validation result with success status and any warnings
 */
export const validateCashuConfig = () => {
  try {
    const warnings = getConfigWarnings();
    const cashuWarnings = warnings.filter(
      (warning) =>
        warning.includes("CASHU") ||
        warning.includes("cashu") ||
        warning.includes("defaultMint") ||
        warning.includes("minAmount") ||
        warning.includes("maxAmount")
    );

    return {
      success: true,
      message: "Cashu configuration validated",
      warnings: cashuWarnings.length > 0 ? cashuWarnings : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: `Cashu configuration validation failed: ${error.message}`,
    };
  }
};

/**
 * Validates all required configuration for the application
 * @returns {Object} Validation result with success status and any error messages
 */
export const validateEnvironment = () => {
  try {
    // Check overall configuration validity
    if (!isConfigValid()) {
      const errors = getConfigErrors();
      return {
        success: false,
        errors: errors,
        warnings: getConfigWarnings(),
      };
    }

    // Run individual validations for detailed reporting
    const validations = [
      validateBeaconAuth(),
      validateNCToolsConfig(),
      validateCashuConfig(),
    ];

    const failures = validations.filter((v) => !v.success);
    const allWarnings = validations
      .filter((v) => v.warnings)
      .flatMap((v) => v.warnings);

    if (failures.length > 0) {
      return {
        success: false,
        errors: failures.map((f) => f.error),
        warnings: allWarnings.length > 0 ? allWarnings : undefined,
      };
    }

    return {
      success: true,
      message: "All configuration is properly set",
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Environment validation failed: ${error.message}`],
    };
  }
};
