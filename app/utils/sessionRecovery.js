/**
 * Session Recovery Manager
 * Provides automatic session recovery and cleanup mechanisms for WhatsApp Web.js
 */

import fs from "fs";
import path from "path";
import {
  validateSessionData,
  quickValidateSession,
} from "./sessionValidation.js";
import { logDiagnostic } from "./sessionDiagnostics.js";
import { SessionBackupManager, createQuickBackup } from "./sessionBackup.js";

/**
 * Recovery strategy levels (least to most destructive)
 */
export const RECOVERY_LEVELS = {
  LEVEL_1: "clear_cache", // Clear browser cache and temporary files
  LEVEL_2: "reset_browser_state", // Reset browser state but preserve auth
  LEVEL_3: "partial_reset", // Full session reset with auth backup
  LEVEL_4: "complete_reset", // Complete fresh start
};

/**
 * Corruption severity levels
 */
export const CORRUPTION_SEVERITY = {
  MINOR: "minor", // Minor issues that can be fixed with cache clearing
  MODERATE: "moderate", // Moderate issues requiring browser state reset
  MAJOR: "major", // Major corruption requiring partial reset
  CRITICAL: "critical", // Critical corruption requiring complete reset
};

/**
 * Session Recovery Manager
 * Handles automatic detection and recovery from corrupted session data
 */
export class SessionRecoveryManager {
  constructor(options = {}) {
    this.sessionPath = options.sessionPath;
    this.backupManager = options.backupManager || new SessionBackupManager();
    this.maxRecoveryTime = options.maxRecoveryTime || 30000; // 30 seconds
    this.enableProgressiveRecovery =
      options.enableProgressiveRecovery !== false;
    this.autoBackupBeforeRecovery = options.autoBackupBeforeRecovery !== false;
  }

  /**
   * Perform automatic session recovery
   * @param {Object} options - Recovery options
   * @returns {Promise<Object>} Recovery result
   */
  async performRecovery(options = {}) {
    const startTime = Date.now();
    const {
      forceLevel = null,
      skipBackup = false,
      validateAfterRecovery = true,
    } = options;

    const result = {
      success: false,
      recoveryPerformed: false,
      recoveryLevel: null,
      backupCreated: false,
      backupPath: null,
      corruptionDetected: false,
      corruptionSeverity: null,
      duration: 0,
      error: null,
      validationResults: {
        before: null,
        after: null,
      },
      steps: [],
    };

    try {
      logDiagnostic("info", "Starting session recovery process", {
        sessionPath: this.sessionPath,
        forceLevel,
        skipBackup,
      });

      // Step 1: Validate current session state
      result.steps.push("session_validation");
      const validation = await this._validateSession();
      result.validationResults.before = validation;

      if (validation.isValid && !forceLevel) {
        logDiagnostic("info", "Session is valid, no recovery needed");
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Step 2: Assess corruption severity
      result.steps.push("corruption_assessment");
      const corruptionAssessment = await this._assessCorruption(validation);
      result.corruptionDetected = corruptionAssessment.detected;
      result.corruptionSeverity = corruptionAssessment.severity;

      if (!result.corruptionDetected && !forceLevel) {
        logDiagnostic("info", "No corruption detected, session may be new");
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Step 3: Create backup before recovery
      if (
        this.autoBackupBeforeRecovery &&
        !skipBackup &&
        fs.existsSync(this.sessionPath)
      ) {
        result.steps.push("backup_creation");
        const backup = await this._createRecoveryBackup(
          corruptionAssessment.severity
        );
        result.backupCreated = backup.success;
        result.backupPath = backup.backupPath;
      }

      // Step 4: Determine recovery strategy
      result.steps.push("strategy_determination");
      const recoveryLevel =
        forceLevel ||
        this._determineRecoveryLevel(corruptionAssessment.severity);
      result.recoveryLevel = recoveryLevel;

      logDiagnostic("info", "Executing recovery strategy", {
        recoveryLevel,
        corruptionSeverity: result.corruptionSeverity,
        backupCreated: result.backupCreated,
      });

      // Step 5: Execute recovery strategy
      result.steps.push("recovery_execution");
      const recoverySuccess = await this._executeRecoveryStrategy(
        recoveryLevel,
        corruptionAssessment
      );
      result.recoveryPerformed = recoverySuccess;

      // Step 6: Validate recovery if requested
      if (validateAfterRecovery) {
        result.steps.push("post_recovery_validation");
        const postValidation = await this._validateSession();
        result.validationResults.after = postValidation;
        result.success = postValidation.isValid || postValidation.canProceed;
      } else {
        result.success = recoverySuccess;
      }

      result.duration = Date.now() - startTime;

      if (result.success) {
        logDiagnostic("info", "Session recovery completed successfully", {
          recoveryLevel: result.recoveryLevel,
          duration: result.duration,
          backupCreated: result.backupCreated,
        });
      } else {
        logDiagnostic(
          "warn",
          "Session recovery completed but validation failed",
          {
            recoveryLevel: result.recoveryLevel,
            duration: result.duration,
          }
        );
      }
    } catch (error) {
      result.error = error.message;
      result.duration = Date.now() - startTime;

      logDiagnostic("error", "Session recovery failed", {
        sessionPath: this.sessionPath,
        error: error.message,
        duration: result.duration,
        steps: result.steps,
      });
    }

    return result;
  }

  /**
   * Assess corruption severity based on validation results
   * @param {Object} validation - Session validation results
   * @returns {Promise<Object>} Corruption assessment
   * @private
   */
  async _assessCorruption(validation) {
    const assessment = {
      detected: false,
      severity: null,
      indicators: [],
      patterns: [],
    };

    if (!validation.details.sessionExists) {
      // No session exists - not corruption, just new session
      return assessment;
    }

    if (validation.isValid) {
      // Session is valid - no corruption
      return assessment;
    }

    assessment.detected = true;

    // Analyze corruption patterns
    const issues = validation.issues || [];
    const warnings = validation.warnings || [];

    // Critical corruption indicators
    const criticalIndicators = [
      "Missing required directory",
      "Missing required file",
      "Missing critical authentication file",
    ];

    // Major corruption indicators
    const majorIndicators = [
      "Local Storage directory is empty",
      "IndexedDB directory is empty",
    ];

    // Minor corruption indicators
    const minorIndicators = [
      "Stale lock file detected",
      "Optional file missing",
      "Session directory size is unusually small",
    ];

    // Count indicators by severity
    let criticalCount = 0;
    let majorCount = 0;
    let minorCount = 0;

    for (const issue of issues) {
      if (criticalIndicators.some((indicator) => issue.includes(indicator))) {
        criticalCount++;
        assessment.indicators.push({ type: "critical", message: issue });
      } else if (
        majorIndicators.some((indicator) => issue.includes(indicator))
      ) {
        majorCount++;
        assessment.indicators.push({ type: "major", message: issue });
      } else {
        minorCount++;
        assessment.indicators.push({ type: "minor", message: issue });
      }
    }

    for (const warning of warnings) {
      if (minorIndicators.some((indicator) => warning.includes(indicator))) {
        minorCount++;
        assessment.indicators.push({ type: "minor", message: warning });
      }
    }

    // Determine severity based on indicator counts
    if (criticalCount > 0) {
      assessment.severity = CORRUPTION_SEVERITY.CRITICAL;
    } else if (majorCount > 1) {
      assessment.severity = CORRUPTION_SEVERITY.MAJOR;
    } else if (majorCount > 0 || minorCount > 3) {
      assessment.severity = CORRUPTION_SEVERITY.MODERATE;
    } else {
      assessment.severity = CORRUPTION_SEVERITY.MINOR;
    }

    // Detect specific corruption patterns
    assessment.patterns = this._detectCorruptionPatterns(validation);

    logDiagnostic("info", "Corruption assessment completed", {
      detected: assessment.detected,
      severity: assessment.severity,
      criticalCount,
      majorCount,
      minorCount,
      patterns: assessment.patterns,
    });

    return assessment;
  }

  /**
   * Detect specific corruption patterns
   * @param {Object} validation - Session validation results
   * @returns {Array} Array of detected patterns
   * @private
   */
  _detectCorruptionPatterns(validation) {
    const patterns = [];

    // Pattern: Network interruption during authentication
    if (
      validation.issues.some((issue) => issue.includes("Local Storage")) &&
      validation.issues.some((issue) => issue.includes("IndexedDB"))
    ) {
      patterns.push("network_interruption_auth");
    }

    // Pattern: Incomplete session initialization
    if (validation.details.sessionSize < 1024 * 100) {
      // Less than 100KB
      patterns.push("incomplete_initialization");
    }

    // Pattern: Browser crash during session save
    if (validation.issues.some((issue) => issue.includes("Stale lock file"))) {
      patterns.push("browser_crash_during_save");
    }

    // Pattern: Disk space issues
    if (
      validation.details.requiredDirectories.missing.length > 0 &&
      validation.details.requiredFiles.missing.length > 0
    ) {
      patterns.push("disk_space_issues");
    }

    return patterns;
  }

  /**
   * Determine appropriate recovery level based on corruption severity
   * @param {string} severity - Corruption severity
   * @returns {string} Recovery level
   * @private
   */
  _determineRecoveryLevel(severity) {
    switch (severity) {
      case CORRUPTION_SEVERITY.MINOR:
        return RECOVERY_LEVELS.LEVEL_1;
      case CORRUPTION_SEVERITY.MODERATE:
        return RECOVERY_LEVELS.LEVEL_2;
      case CORRUPTION_SEVERITY.MAJOR:
        return RECOVERY_LEVELS.LEVEL_3;
      case CORRUPTION_SEVERITY.CRITICAL:
        return RECOVERY_LEVELS.LEVEL_4;
      default:
        return RECOVERY_LEVELS.LEVEL_1;
    }
  }

  /**
   * Execute the specified recovery strategy
   * @param {string} recoveryLevel - Recovery level to execute
   * @param {Object} corruptionAssessment - Corruption assessment results
   * @returns {Promise<boolean>} True if recovery was successful
   * @private
   */
  async _executeRecoveryStrategy(recoveryLevel, corruptionAssessment) {
    logDiagnostic("info", "Executing recovery strategy", {
      recoveryLevel,
      sessionPath: this.sessionPath,
    });

    try {
      switch (recoveryLevel) {
        case RECOVERY_LEVELS.LEVEL_1:
          return await this._executeLevelOneRecovery();
        case RECOVERY_LEVELS.LEVEL_2:
          return await this._executeLevelTwoRecovery();
        case RECOVERY_LEVELS.LEVEL_3:
          return await this._executeLevelThreeRecovery();
        case RECOVERY_LEVELS.LEVEL_4:
          return await this._executeLevelFourRecovery();
        default:
          throw new Error(`Unknown recovery level: ${recoveryLevel}`);
      }
    } catch (error) {
      logDiagnostic("error", "Recovery strategy execution failed", {
        recoveryLevel,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Level 1 Recovery: Clear browser cache and temporary files
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async _executeLevelOneRecovery() {
    logDiagnostic(
      "info",
      "Executing Level 1 recovery: Clear cache and temporary files"
    );

    const pathsToClean = [
      "Default/Cache",
      "Default/Code Cache",
      "Default/GPUCache",
      "Default/Service Worker",
      "Default/blob_storage",
      "Default/File System",
      "Default/Local Storage/leveldb/LOG",
      "Default/Local Storage/leveldb/LOG.old",
    ];

    let cleanedPaths = 0;

    for (const relativePath of pathsToClean) {
      const fullPath = path.join(this.sessionPath, relativePath);

      try {
        if (fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);

          if (stats.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(fullPath);
          }

          cleanedPaths++;
          logDiagnostic("debug", "Cleaned cache path", { path: relativePath });
        }
      } catch (error) {
        logDiagnostic("warn", "Failed to clean cache path", {
          path: relativePath,
          error: error.message,
        });
      }
    }

    logDiagnostic("info", "Level 1 recovery completed", {
      pathsCleaned: cleanedPaths,
      totalPaths: pathsToClean.length,
    });

    return cleanedPaths > 0;
  }

  /**
   * Level 2 Recovery: Reset browser state but preserve authentication
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async _executeLevelTwoRecovery() {
    logDiagnostic(
      "info",
      "Executing Level 2 recovery: Reset browser state, preserve auth"
    );

    // First execute Level 1 recovery
    await this._executeLevelOneRecovery();

    // Preserve authentication data
    const authDataToPreserve = [
      "Default/Local Storage/leveldb",
      "Default/IndexedDB",
    ];

    const preservedData = {};

    // Backup authentication data
    for (const authPath of authDataToPreserve) {
      const fullPath = path.join(this.sessionPath, authPath);

      if (fs.existsSync(fullPath)) {
        const tempPath = `${fullPath}.recovery_backup`;

        try {
          if (fs.statSync(fullPath).isDirectory()) {
            await this._copyDirectory(fullPath, tempPath);
          } else {
            fs.copyFileSync(fullPath, tempPath);
          }

          preservedData[authPath] = tempPath;
          logDiagnostic("debug", "Preserved auth data", { path: authPath });
        } catch (error) {
          logDiagnostic("warn", "Failed to preserve auth data", {
            path: authPath,
            error: error.message,
          });
        }
      }
    }

    // Reset browser state files
    const stateFilesToReset = [
      "Default/Preferences",
      "Default/Local State",
      "Default/Session Storage",
      "Default/Web Data",
      "Default/Cookies",
      "Default/History",
    ];

    let resetFiles = 0;

    for (const stateFile of stateFilesToReset) {
      const fullPath = path.join(this.sessionPath, stateFile);

      try {
        if (fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);

          if (stats.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(fullPath);
          }

          resetFiles++;
          logDiagnostic("debug", "Reset state file", { path: stateFile });
        }
      } catch (error) {
        logDiagnostic("warn", "Failed to reset state file", {
          path: stateFile,
          error: error.message,
        });
      }
    }

    // Restore preserved authentication data
    for (const [authPath, tempPath] of Object.entries(preservedData)) {
      const fullPath = path.join(this.sessionPath, authPath);

      try {
        if (fs.statSync(tempPath).isDirectory()) {
          await this._copyDirectory(tempPath, fullPath);
        } else {
          fs.copyFileSync(tempPath, fullPath);
        }

        // Clean up temporary backup
        fs.rmSync(tempPath, { recursive: true, force: true });

        logDiagnostic("debug", "Restored auth data", { path: authPath });
      } catch (error) {
        logDiagnostic("warn", "Failed to restore auth data", {
          path: authPath,
          error: error.message,
        });
      }
    }

    logDiagnostic("info", "Level 2 recovery completed", {
      stateFilesReset: resetFiles,
      authDataPreserved: Object.keys(preservedData).length,
    });

    return resetFiles > 0;
  }

  /**
   * Level 3 Recovery: Full session reset with authentication backup
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async _executeLevelThreeRecovery() {
    logDiagnostic(
      "info",
      "Executing Level 3 recovery: Full reset with auth backup"
    );

    // Create backup of authentication tokens if they exist
    const authBackupPath = `${this.sessionPath}.auth_backup_${Date.now()}`;
    let authBackupCreated = false;

    const criticalAuthPaths = [
      "Default/Local Storage/leveldb",
      "Default/IndexedDB/https_web.whatsapp.com_0.indexeddb.leveldb",
    ];

    for (const authPath of criticalAuthPaths) {
      const fullPath = path.join(this.sessionPath, authPath);

      if (fs.existsSync(fullPath)) {
        try {
          if (!fs.existsSync(authBackupPath)) {
            fs.mkdirSync(authBackupPath, { recursive: true });
          }

          const backupPath = path.join(authBackupPath, authPath);
          fs.mkdirSync(path.dirname(backupPath), { recursive: true });

          if (fs.statSync(fullPath).isDirectory()) {
            await this._copyDirectory(fullPath, backupPath);
          } else {
            fs.copyFileSync(fullPath, backupPath);
          }

          authBackupCreated = true;
          logDiagnostic("debug", "Backed up critical auth data", {
            path: authPath,
          });
        } catch (error) {
          logDiagnostic("warn", "Failed to backup critical auth data", {
            path: authPath,
            error: error.message,
          });
        }
      }
    }

    // Remove entire session directory
    if (fs.existsSync(this.sessionPath)) {
      fs.rmSync(this.sessionPath, { recursive: true, force: true });
      logDiagnostic("info", "Removed corrupted session directory");
    }

    // Recreate session directory structure
    fs.mkdirSync(this.sessionPath, { recursive: true });
    fs.mkdirSync(path.join(this.sessionPath, "Default"), { recursive: true });

    // Restore critical authentication data if backup was created
    if (authBackupCreated) {
      try {
        await this._copyDirectory(authBackupPath, this.sessionPath);
        logDiagnostic("info", "Restored critical authentication data");

        // Clean up auth backup
        fs.rmSync(authBackupPath, { recursive: true, force: true });
      } catch (error) {
        logDiagnostic("warn", "Failed to restore authentication data", {
          error: error.message,
        });
      }
    }

    logDiagnostic("info", "Level 3 recovery completed", {
      authBackupCreated,
      sessionRecreated: true,
    });

    return true;
  }

  /**
   * Level 4 Recovery: Complete fresh start
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async _executeLevelFourRecovery() {
    logDiagnostic("info", "Executing Level 4 recovery: Complete fresh start");

    // Remove entire session directory
    if (fs.existsSync(this.sessionPath)) {
      fs.rmSync(this.sessionPath, { recursive: true, force: true });
      logDiagnostic("info", "Removed session directory for fresh start");
    }

    // Recreate basic session directory structure
    fs.mkdirSync(this.sessionPath, { recursive: true });
    fs.mkdirSync(path.join(this.sessionPath, "Default"), { recursive: true });

    logDiagnostic("info", "Level 4 recovery completed - fresh session created");

    return true;
  }

  /**
   * Create a backup before recovery
   * @param {string} severity - Corruption severity
   * @returns {Promise<Object>} Backup result
   * @private
   */
  async _createRecoveryBackup(severity) {
    const reason = `pre_recovery_${severity}`;

    logDiagnostic("info", "Creating backup before recovery", {
      sessionPath: this.sessionPath,
      reason,
    });

    return await this.backupManager.createBackup(this.sessionPath, {
      reason,
      includeMetadata: true,
    });
  }

  /**
   * Validate session with recovery-specific logic
   * @returns {Promise<Object>} Validation result with recovery context
   * @private
   */
  async _validateSession() {
    const validation = validateSessionData(this.sessionPath);

    // Add recovery-specific validation logic
    validation.canProceed =
      validation.isValid || !validation.details.sessionExists;

    return validation;
  }

  /**
   * Copy directory recursively
   * @param {string} source - Source directory
   * @param {string} target - Target directory
   * @private
   */
  async _copyDirectory(source, target) {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    const entries = fs.readdirSync(source);

    for (const entry of entries) {
      const sourcePath = path.join(source, entry);
      const targetPath = path.join(target, entry);
      const stats = fs.statSync(sourcePath);

      if (stats.isDirectory()) {
        await this._copyDirectory(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }
}

/**
 * Perform automatic session recovery with default settings
 * @param {string} sessionPath - Path to session directory
 * @param {Object} options - Recovery options
 * @returns {Promise<Object>} Recovery result
 */
export async function performAutomaticRecovery(sessionPath, options = {}) {
  const recoveryManager = new SessionRecoveryManager({
    sessionPath,
    ...options,
  });

  return await recoveryManager.performRecovery(options);
}

/**
 * Quick corruption check and recovery recommendation
 * @param {string} sessionPath - Path to session directory
 * @returns {Promise<Object>} Recovery recommendation
 */
export async function assessRecoveryNeeds(sessionPath) {
  const validation = validateSessionData(sessionPath);

  if (validation.isValid) {
    return {
      recoveryNeeded: false,
      recommendation: "none",
      severity: null,
    };
  }

  const recoveryManager = new SessionRecoveryManager({ sessionPath });
  const assessment = await recoveryManager._assessCorruption(validation);

  return {
    recoveryNeeded: assessment.detected,
    recommendation: assessment.detected
      ? recoveryManager._determineRecoveryLevel(assessment.severity)
      : "none",
    severity: assessment.severity,
    indicators: assessment.indicators,
    patterns: assessment.patterns,
  };
}
