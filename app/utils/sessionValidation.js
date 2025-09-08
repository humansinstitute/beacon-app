/**
 * WhatsApp Web.js Session Validation Utilities
 * Provides comprehensive validation for WhatsApp Web.js session data integrity
 */

import fs from "fs";
import path from "path";

/**
 * Required files and directories for a valid WhatsApp Web.js session
 * Now supports profile modes via env WA_SESSION_PROFILE_MODE:
 * - wwebjs: minimal LocalAuth artifacts
 * - chromeProfile: full Chromium profile structure (legacy strict mode)
 */
const PROFILE_MODE = (process.env.WA_SESSION_PROFILE_MODE || "wwebjs").trim();

const REQUIRED_SESSION_STRUCTURE =
  PROFILE_MODE === "chromeProfile"
    ? {
        directories: [
          "Default",
          "Default/Local Storage",
          "Default/Session Storage",
          "Default/IndexedDB",
        ],
        files: ["Default/Preferences", "Default/Local State"],
        optionalFiles: [
          "Default/Cookies",
          "Default/Web Data",
          "Default/History",
        ],
      }
    : {
        // wwebjs minimal expectations: we only require the root session folder
        // and at least one of Local Storage LevelDB or IndexedDB to exist.
        directories: [
          // Keep as soft checks under warnings for wwebjs; do not fail validity
        ],
        files: [
          // No hard-required files for wwebjs LocalAuth
        ],
        optionalFiles: [
          "Default",
          "Default/Local Storage",
          "Default/Session Storage",
          "Default/IndexedDB",
          "Default/Preferences",
          "Default/Local State",
          "Default/Cookies",
          "Default/Web Data",
          "Default/History",
        ],
      };

/**
 * Critical session paths that indicate authentication state
 * In wwebjs mode, treat presence of either Local Storage leveldb or IndexedDB as sufficient.
 */
const CRITICAL_AUTH_FILES =
  PROFILE_MODE === "chromeProfile"
    ? [
        "Default/Local Storage/leveldb",
        "Default/IndexedDB/https_web.whatsapp.com_0.indexeddb.leveldb",
      ]
    : [
        // For wwebjs, these are "auth indicators" rather than strict requirements
        "Default/Local Storage/leveldb",
        "Default/IndexedDB",
      ];

/**
 * Validates the integrity of WhatsApp Web.js session data
 * @param {string} sessionPath - Path to the session directory
 * @returns {Object} Validation result with detailed diagnostics
 */
export const validateSessionData = (sessionPath) => {
  const startTime = Date.now();
  const result = {
    isValid: false,
    sessionPath,
    timestamp: new Date().toISOString(),
    validationDuration: 0,
    issues: [],
    warnings: [],
    details: {
      sessionExists: false,
      requiredDirectories: {
        present: [],
        missing: [],
      },
      requiredFiles: {
        present: [],
        missing: [],
      },
      optionalFiles: {
        present: [],
        missing: [],
      },
      authenticationFiles: {
        present: [],
        missing: [],
      },
      sessionSize: 0,
      lastModified: null,
      profileMode: PROFILE_MODE,
      fileCount: 0,
    },
    canProceed: false,
  };

  try {
    // Check if session directory exists
    if (!fs.existsSync(sessionPath)) {
      result.issues.push(`Session directory does not exist: ${sessionPath}`);
      result.validationDuration = Date.now() - startTime;
      return result;
    }

    result.details.sessionExists = true;

    // Get session directory stats
    const sessionStats = fs.statSync(sessionPath);
    result.details.lastModified = sessionStats.mtime.toISOString();

    // Validate required directories
    for (const dir of REQUIRED_SESSION_STRUCTURE.directories) {
      const dirPath = path.join(sessionPath, dir);
      if (fs.existsSync(dirPath)) {
        result.details.requiredDirectories.present.push(dir);
      } else {
        result.details.requiredDirectories.missing.push(dir);
        if (PROFILE_MODE === "chromeProfile") {
          result.issues.push(`Missing required directory: ${dir}`);
        } else {
          // In wwebjs mode, these are soft requirements
          result.warnings.push(`Optional directory missing: ${dir}`);
        }
      }
    }

    // Validate required files
    for (const file of REQUIRED_SESSION_STRUCTURE.files) {
      const filePath = path.join(sessionPath, file);
      if (fs.existsSync(filePath)) {
        result.details.requiredFiles.present.push(file);
      } else {
        result.details.requiredFiles.missing.push(file);
        if (PROFILE_MODE === "chromeProfile") {
          result.issues.push(`Missing required file: ${file}`);
        } else {
          result.warnings.push(`Optional file missing (wwebjs): ${file}`);
        }
      }
    }

    // Check optional files
    for (const file of REQUIRED_SESSION_STRUCTURE.optionalFiles) {
      const filePath = path.join(sessionPath, file);
      if (fs.existsSync(filePath)) {
        result.details.optionalFiles.present.push(file);
      } else {
        result.details.optionalFiles.missing.push(file);
        result.warnings.push(`Optional file missing: ${file}`);
      }
    }

    // Validate critical authentication files/paths
    for (const authFile of CRITICAL_AUTH_FILES) {
      const authPath = path.join(sessionPath, authFile);
      if (fs.existsSync(authPath)) {
        result.details.authenticationFiles.present.push(authFile);
      } else {
        result.details.authenticationFiles.missing.push(authFile);
        if (PROFILE_MODE === "chromeProfile") {
          result.issues.push(
            `Missing critical authentication file: ${authFile}`
          );
        } else {
          // In wwebjs mode, we'll consider "presence of any" below
          result.warnings.push(
            `Auth indicator missing (wwebjs soft): ${authFile}`
          );
        }
      }
    }

    // In wwebjs mode, consider session valid if:
    // - session dir exists, and
    // - at least one auth indicator path exists (Local Storage leveldb OR IndexedDB), and
    // - size threshold is relaxed (allow small size if auth indicator exists)
    if (PROFILE_MODE !== "chromeProfile") {
      const anyAuthPresent =
        result.details.authenticationFiles.present.length > 0;
      if (anyAuthPresent) {
        // Clear any previously set hard issues related to missing required structures in wwebjs mode
        result.issues = result.issues.filter(
          (msg) =>
            !msg.startsWith("Missing required directory") &&
            !msg.startsWith("Missing required file")
        );
      }
    }

    // Calculate session directory size
    result.details.sessionSize = calculateDirectorySize(sessionPath);

    // Calculate total file count (recursive) to detect effectively empty session dirs
    const countFilesRecursive = (dir) => {
      let total = 0;
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const p = path.join(dir, entry);
          const st = fs.statSync(p);
          if (st.isDirectory()) {
            total += countFilesRecursive(p);
          } else {
            total += 1;
          }
        }
      } catch {
        // ignore
      }
      return total;
    };
    result.details.fileCount = countFilesRecursive(sessionPath);

    // Validate session size
    // In chromeProfile mode, keep 1MB heuristic; in wwebjs mode, downgrade to warning only.
    if (result.details.sessionSize < 1024 * 1024) {
      const msg = `Session directory size is unusually small: ${formatBytes(
        result.details.sessionSize
      )}`;
      if (PROFILE_MODE === "chromeProfile") {
        result.warnings.push(msg);
      } else {
        // still a warning, but explicitly note wwebjs tolerance
        result.warnings.push(`${msg} (wwebjs tolerant)`);
      }
    }

    // Check for corruption indicators
    const corruptionIssues = checkForCorruption(sessionPath);
    result.issues.push(...corruptionIssues);

    // Determine overall validity
    if (PROFILE_MODE === "chromeProfile") {
      result.isValid =
        result.issues.length === 0 &&
        result.details.requiredDirectories.missing.length === 0 &&
        result.details.requiredFiles.missing.length === 0 &&
        result.details.authenticationFiles.missing.length === 0;
    } else {
      // wwebjs: valid if session exists and any auth indicator exists
      const anyAuthPresent =
        result.details.authenticationFiles.present.length > 0;
      result.isValid = result.details.sessionExists && anyAuthPresent;
    }

    // Compute canProceed:
    // - Valid sessions always proceed
    // - In wwebjs mode, allow proceed if session exists even if minimal, to avoid destructive resets;
    //   recovery logic can attempt non-destructive repair.
    result.canProceed =
      result.isValid ||
      (!result.isValid &&
        PROFILE_MODE !== "chromeProfile" &&
        result.details.sessionExists);
  } catch (error) {
    result.issues.push(`Validation error: ${error.message}`);
  }

  result.validationDuration = Date.now() - startTime;
  return result;
};

/**
 * Validates multiple session directories
 * @param {string[]} sessionPaths - Array of session directory paths
 * @returns {Object} Combined validation results
 */
export const validateMultipleSessions = (sessionPaths) => {
  const startTime = Date.now();
  const results = {
    timestamp: new Date().toISOString(),
    totalSessions: sessionPaths.length,
    validSessions: 0,
    invalidSessions: 0,
    validationDuration: 0,
    sessions: [],
  };

  for (const sessionPath of sessionPaths) {
    const validation = validateSessionData(sessionPath);
    results.sessions.push(validation);

    if (validation.isValid) {
      results.validSessions++;
    } else {
      results.invalidSessions++;
    }
  }

  results.validationDuration = Date.now() - startTime;
  return results;
};

/**
 * Discovers existing WhatsApp Web.js session directories
 * @param {string} baseDirectory - Base directory to search for sessions
 * @returns {string[]} Array of discovered session paths
 */
export const discoverSessionDirectories = (baseDirectory = process.cwd()) => {
  const sessionPaths = [];

  try {
    const files = fs.readdirSync(baseDirectory);

    for (const file of files) {
      if (file.startsWith(".wwebjs_auth_")) {
        const fullPath = path.join(baseDirectory, file);
        if (fs.statSync(fullPath).isDirectory()) {
          sessionPaths.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error discovering session directories: ${error.message}`);
  }

  return sessionPaths.sort();
};

/**
 * Calculates the total size of a directory recursively
 * @param {string} dirPath - Directory path
 * @returns {number} Size in bytes
 */
function calculateDirectorySize(dirPath) {
  let totalSize = 0;

  try {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        totalSize += calculateDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    // Ignore errors for inaccessible files/directories
  }

  return totalSize;
}

/**
 * Checks for common corruption patterns in session data
 * @param {string} sessionPath - Path to session directory
 * @returns {string[]} Array of corruption issues found
 */
function checkForCorruption(sessionPath) {
  const issues = [];

  try {
    // Check for empty critical directories
    const localStoragePath = path.join(sessionPath, "Default/Local Storage");
    if (fs.existsSync(localStoragePath)) {
      const localStorageFiles = fs.readdirSync(localStoragePath);
      if (localStorageFiles.length === 0) {
        issues.push(
          "Local Storage directory is empty - indicates potential corruption"
        );
      }
    }

    // Check for IndexedDB corruption
    const indexedDBPath = path.join(sessionPath, "Default/IndexedDB");
    if (fs.existsSync(indexedDBPath)) {
      const indexedDBFiles = fs.readdirSync(indexedDBPath);
      if (indexedDBFiles.length === 0) {
        issues.push(
          "IndexedDB directory is empty - indicates potential corruption"
        );
      }
    }

    // Check for lock files that might indicate incomplete operations
    const lockFiles = ["LOCK", "LOG", "LOG.old"];
    for (const lockFile of lockFiles) {
      const lockPath = path.join(
        sessionPath,
        "Default/Local Storage/leveldb",
        lockFile
      );
      if (fs.existsSync(lockPath)) {
        const stats = fs.statSync(lockPath);
        const ageHours =
          (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        if (ageHours > 24) {
          issues.push(
            `Stale lock file detected: ${lockFile} (${ageHours.toFixed(
              1
            )} hours old)`
          );
        }
      }
    }
  } catch (error) {
    issues.push(`Error checking for corruption: ${error.message}`);
  }

  return issues;
}

/**
 * Formats bytes into human-readable format
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Quick validation check for session existence and basic structure
 * @param {string} sessionPath - Path to session directory
 * @returns {boolean} True if session appears to be valid
 */
export const quickValidateSession = (sessionPath) => {
  try {
    if (!fs.existsSync(sessionPath)) {
      return false;
    }

    // Check for essential directories
    const defaultPath = path.join(sessionPath, "Default");
    const localStoragePath = path.join(sessionPath, "Default/Local Storage");

    return fs.existsSync(defaultPath) && fs.existsSync(localStoragePath);
  } catch (error) {
    return false;
  }
};
