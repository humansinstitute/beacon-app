/**
 * Environment validation utilities
 * Validates required environment variables for the application
 */

/**
 * Validates that the BEACON_AUTH environment variable is set and non-empty
 * @returns {Object} Validation result with success status and error message if applicable
 */
export const validateBeaconAuth = () => {
  const beaconAuth = process.env.BEACON_AUTH;

  if (
    beaconAuth === undefined ||
    beaconAuth === null ||
    beaconAuth === "undefined" ||
    beaconAuth === "null"
  ) {
    return {
      success: false,
      error: "BEACON_AUTH environment variable is not set",
    };
  }

  if (typeof beaconAuth !== "string" || beaconAuth.trim() === "") {
    return {
      success: false,
      error: "BEACON_AUTH environment variable is empty or invalid",
    };
  }

  return {
    success: true,
    message: "BEACON_AUTH environment variable is properly configured",
  };
};

/**
 * Validates NC Tools configuration with defaults
 * @returns {Object} Validation result with success status and any warnings
 */
export const validateNCToolsConfig = () => {
  const warnings = [];

  // Set defaults for NC Tools configuration
  if (!process.env.NCTOOLS_API_URL) {
    process.env.NCTOOLS_API_URL = "http://localhost:3000";
    warnings.push(
      "NCTOOLS_API_URL not set, using default: http://localhost:3000"
    );
  }

  if (!process.env.NCTOOLS_TIMEOUT) {
    process.env.NCTOOLS_TIMEOUT = "30000";
    warnings.push("NCTOOLS_TIMEOUT not set, using default: 30000ms");
  } else {
    const timeout = parseInt(process.env.NCTOOLS_TIMEOUT);
    if (isNaN(timeout) || timeout <= 0) {
      process.env.NCTOOLS_TIMEOUT = "30000";
      warnings.push("NCTOOLS_TIMEOUT invalid, using default: 30000ms");
    }
  }

  return {
    success: true,
    message: "NC Tools configuration validated",
    warnings: warnings.length > 0 ? warnings : undefined,
  };
};

/**
 * Validates Cashu configuration with defaults
 * @returns {Object} Validation result with success status and any warnings
 */
export const validateCashuConfig = () => {
  const warnings = [];

  // Set defaults for Cashu configuration
  if (!process.env.CASHU_DEFAULT_MINT) {
    process.env.CASHU_DEFAULT_MINT = "https://mint.minibits.cash/Bitcoin";
    warnings.push(
      "CASHU_DEFAULT_MINT not set, using default: https://mint.minibits.cash/Bitcoin"
    );
  }

  if (!process.env.CASHU_MIN_AMOUNT) {
    process.env.CASHU_MIN_AMOUNT = "1";
    warnings.push("CASHU_MIN_AMOUNT not set, using default: 1 sat");
  } else {
    const minAmount = parseInt(process.env.CASHU_MIN_AMOUNT);
    if (isNaN(minAmount) || minAmount <= 0) {
      process.env.CASHU_MIN_AMOUNT = "1";
      warnings.push("CASHU_MIN_AMOUNT invalid, using default: 1 sat");
    }
  }

  if (!process.env.CASHU_MAX_AMOUNT) {
    process.env.CASHU_MAX_AMOUNT = "1000000";
    warnings.push("CASHU_MAX_AMOUNT not set, using default: 1000000 sats");
  } else {
    const maxAmount = parseInt(process.env.CASHU_MAX_AMOUNT);
    if (isNaN(maxAmount) || maxAmount <= 0) {
      process.env.CASHU_MAX_AMOUNT = "1000000";
      warnings.push("CASHU_MAX_AMOUNT invalid, using default: 1000000 sats");
    }
  }

  return {
    success: true,
    message: "Cashu configuration validated",
    warnings: warnings.length > 0 ? warnings : undefined,
  };
};

/**
 * Validates all required environment variables for the application
 * @returns {Object} Validation result with success status and any error messages
 */
export const validateEnvironment = () => {
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
    message: "All environment variables are properly configured",
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
  };
};
