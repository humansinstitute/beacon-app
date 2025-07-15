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

  if (beaconAuth === undefined || beaconAuth === null || beaconAuth === "undefined" || beaconAuth === "null") {
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
 * Validates all required environment variables for the application
 * @returns {Object} Validation result with success status and any error messages
 */
export const validateEnvironment = () => {
  const validations = [validateBeaconAuth()];

  const failures = validations.filter((v) => !v.success);

  if (failures.length > 0) {
    return {
      success: false,
      errors: failures.map((f) => f.error),
    };
  }

  return {
    success: true,
    message: "All environment variables are properly configured",
  };
};
