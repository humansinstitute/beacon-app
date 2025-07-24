/**
 * Session Strategy Management System
 *
 * Provides configurable session strategies for WhatsApp session management
 * with support for shared, branch-specific, pattern-based, and team strategies.
 * Includes automatic migration between strategies with data preservation.
 */

import fs from "fs";
import path from "path";
import {
  detectGitBranch,
  determineBranchStrategy,
  generateBranchAwareInstanceId,
} from "./gitIntegration.js";
import { SessionBackupManager } from "./sessionBackup.js";
import { validateSessionData } from "./sessionValidation.js";
import { logDiagnostic } from "./sessionDiagnostics.js";

/**
 * Available session strategies
 */
export const SESSION_STRATEGIES = {
  SHARED: "shared",
  BRANCH_SPECIFIC: "branch-specific",
  PATTERN_BASED: "pattern-based",
  TEAM: "team",
};

/**
 * Session Strategy Manager
 *
 * Manages session strategies, configuration, and migration between strategies
 */
export class SessionStrategyManager {
  constructor(options = {}) {
    this.baseDirectory = options.baseDirectory || process.cwd();
    this.backupManager = new SessionBackupManager({
      backupDirectory: options.backupDirectory,
    });

    // Strategy configuration
    this.config = {
      // Default strategy settings
      defaultStrategy: SESSION_STRATEGIES.SHARED,
      autoMigrate: true,
      migrationBackup: true,

      // Git integration settings
      branchDetection: true,
      mainBranches: ["main", "master", "develop", "dev"],
      featureBranchPatterns: ["feature/*", "feat/*", "bugfix/*", "hotfix/*"],

      // Team collaboration settings
      teamCollaboration: false,
      teamSessionPrefix: "team",

      // Override with options
      ...options.config,
    };

    // Load configuration from environment variables
    this._loadEnvironmentConfig();

    // Current strategy state
    this.currentStrategy = null;
    this.currentInstanceId = null;
    this.gitBranchInfo = null;
  }

  /**
   * Load configuration from environment variables
   */
  _loadEnvironmentConfig() {
    const envMappings = {
      WA_SHARED_SESSION: (value) => {
        if (value === "true")
          this.config.defaultStrategy = SESSION_STRATEGIES.SHARED;
        if (value === "false")
          this.config.defaultStrategy = SESSION_STRATEGIES.BRANCH_SPECIFIC;
      },
      WA_BRANCH_SESSIONS: (value) => {
        if (value === "true")
          this.config.defaultStrategy = SESSION_STRATEGIES.BRANCH_SPECIFIC;
      },
      WA_AUTO_MIGRATE_SESSION: (value) => {
        this.config.autoMigrate = value === "true";
      },
      WA_BRANCH_PATTERN_STRATEGY: (value) => {
        if (value === "true")
          this.config.defaultStrategy = SESSION_STRATEGIES.PATTERN_BASED;
      },
      WA_BRANCH_DETECTION: (value) => {
        this.config.branchDetection = value === "true";
      },
      WA_MIGRATION_BACKUP: (value) => {
        this.config.migrationBackup = value === "true";
      },
      WA_TEAM_COLLABORATION: (value) => {
        this.config.teamCollaboration = value === "true";
        if (value === "true")
          this.config.defaultStrategy = SESSION_STRATEGIES.TEAM;
      },
    };

    for (const [envVar, handler] of Object.entries(envMappings)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        try {
          handler(value);
          logDiagnostic("debug", "Loaded environment configuration", {
            variable: envVar,
            value,
          });
        } catch (error) {
          logDiagnostic("warn", "Failed to process environment variable", {
            variable: envVar,
            value,
            error: error.message,
          });
        }
      }
    }
  }

  /**
   * Initialize session strategy based on current configuration and git state
   *
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    const result = {
      strategy: null,
      instanceId: null,
      sessionPath: null,
      migration: null,
      gitInfo: null,
      error: null,
    };

    try {
      // Detect git branch if enabled
      if (this.config.branchDetection) {
        this.gitBranchInfo = await detectGitBranch({
          workingDirectory: this.baseDirectory,
        });
        result.gitInfo = this.gitBranchInfo;
      }

      // Determine strategy
      result.strategy = await this._determineStrategy();
      this.currentStrategy = result.strategy;

      // Generate instance ID based on strategy
      result.instanceId = await this._generateStrategyInstanceId(
        result.strategy
      );
      this.currentInstanceId = result.instanceId;

      // Get session path
      result.sessionPath = this._getSessionPath(result.instanceId);

      // Check if migration is needed
      if (this.config.autoMigrate) {
        const migrationResult = await this._checkAndPerformMigration(
          result.strategy,
          result.instanceId
        );
        if (migrationResult.migrated) {
          result.migration = migrationResult;
        }
      }

      logDiagnostic("info", "Session strategy initialized", {
        strategy: result.strategy,
        instanceId: result.instanceId,
        sessionPath: result.sessionPath,
        gitBranch: this.gitBranchInfo?.branch,
        migrated: result.migration?.migrated || false,
      });
    } catch (error) {
      result.error = error.message;
      logDiagnostic("error", "Session strategy initialization failed", {
        error: error.message,
      });
    }

    return result;
  }

  /**
   * Determine the appropriate session strategy
   *
   * @returns {Promise<string>} Selected strategy
   */
  async _determineStrategy() {
    // If team collaboration is enabled, use team strategy
    if (this.config.teamCollaboration) {
      return SESSION_STRATEGIES.TEAM;
    }

    // If branch detection is disabled, use default strategy
    if (!this.config.branchDetection || !this.gitBranchInfo?.branch) {
      return this.config.defaultStrategy;
    }

    const branch = this.gitBranchInfo.branch;

    // Handle different strategy types
    switch (this.config.defaultStrategy) {
      case SESSION_STRATEGIES.SHARED:
        return SESSION_STRATEGIES.SHARED;

      case SESSION_STRATEGIES.BRANCH_SPECIFIC:
        return SESSION_STRATEGIES.BRANCH_SPECIFIC;

      case SESSION_STRATEGIES.PATTERN_BASED:
        const branchStrategy = determineBranchStrategy(branch, {
          mainBranches: this.config.mainBranches,
          featureBranchPatterns: this.config.featureBranchPatterns,
        });
        return branchStrategy === "shared"
          ? SESSION_STRATEGIES.SHARED
          : SESSION_STRATEGIES.BRANCH_SPECIFIC;

      default:
        return SESSION_STRATEGIES.SHARED;
    }
  }

  /**
   * Generate instance ID based on strategy
   *
   * @param {string} strategy - Session strategy
   * @returns {Promise<string>} Instance ID
   */
  async _generateStrategyInstanceId(strategy) {
    switch (strategy) {
      case SESSION_STRATEGIES.SHARED:
        return "shared";

      case SESSION_STRATEGIES.BRANCH_SPECIFIC:
        if (this.gitBranchInfo?.branch) {
          return generateBranchAwareInstanceId(this.gitBranchInfo.branch, {
            strategy: "branch-specific",
            sanitize: true,
          });
        }
        return "shared"; // Fallback

      case SESSION_STRATEGIES.TEAM:
        return this.config.teamSessionPrefix || "team";

      default:
        return "shared";
    }
  }

  /**
   * Get session path for instance ID
   *
   * @param {string} instanceId - Instance identifier
   * @returns {string} Session directory path
   */
  _getSessionPath(instanceId) {
    return path.join(this.baseDirectory, `.wwebjs_auth_${instanceId}`);
  }

  /**
   * Check if migration is needed and perform it
   *
   * @param {string} targetStrategy - Target strategy
   * @param {string} targetInstanceId - Target instance ID
   * @returns {Promise<Object>} Migration result
   */
  async _checkAndPerformMigration(targetStrategy, targetInstanceId) {
    const result = {
      migrated: false,
      sourceStrategy: null,
      sourceInstanceId: null,
      targetStrategy,
      targetInstanceId,
      backup: null,
      error: null,
    };

    try {
      // Find existing session directories
      const existingSessions = await this._findExistingSessions();

      if (existingSessions.length === 0) {
        logDiagnostic(
          "info",
          "No existing sessions found, no migration needed"
        );
        return result;
      }

      // Check if target session already exists
      const targetPath = this._getSessionPath(targetInstanceId);
      const targetExists = fs.existsSync(targetPath);

      if (targetExists) {
        logDiagnostic(
          "info",
          "Target session already exists, no migration needed",
          {
            targetPath,
          }
        );
        return result;
      }

      // Find best source session to migrate from
      const sourceSession = await this._selectBestSourceSession(
        existingSessions
      );

      if (!sourceSession) {
        logDiagnostic("info", "No suitable source session found for migration");
        return result;
      }

      result.sourceInstanceId = sourceSession.instanceId;
      result.sourceStrategy = this._inferStrategyFromInstanceId(
        sourceSession.instanceId
      );

      // Perform migration
      const migrationResult = await this._performMigration(
        sourceSession,
        targetInstanceId
      );

      if (migrationResult.success) {
        result.migrated = true;
        result.backup = migrationResult.backup;

        logDiagnostic("info", "Session migration completed successfully", {
          from: sourceSession.path,
          to: targetPath,
          sourceStrategy: result.sourceStrategy,
          targetStrategy: result.targetStrategy,
        });
      } else {
        result.error = migrationResult.error;
      }
    } catch (error) {
      result.error = error.message;
      logDiagnostic("error", "Session migration failed", {
        error: error.message,
        targetStrategy,
        targetInstanceId,
      });
    }

    return result;
  }

  /**
   * Find existing session directories
   *
   * @returns {Promise<Array>} Array of session information
   */
  async _findExistingSessions() {
    const sessions = [];

    try {
      const files = fs.readdirSync(this.baseDirectory);

      for (const file of files) {
        if (file.startsWith(".wwebjs_auth_")) {
          const fullPath = path.join(this.baseDirectory, file);
          const stats = fs.statSync(fullPath);

          if (stats.isDirectory()) {
            const instanceId = file.replace(".wwebjs_auth_", "");
            const sessionFiles = fs.readdirSync(fullPath);

            sessions.push({
              instanceId,
              path: fullPath,
              fileCount: sessionFiles.length,
              lastModified: stats.mtime,
              size: await this._getDirectorySize(fullPath),
            });
          }
        }
      }
    } catch (error) {
      logDiagnostic("warn", "Failed to scan for existing sessions", {
        error: error.message,
      });
    }

    return sessions.sort((a, b) => b.lastModified - a.lastModified);
  }

  /**
   * Select the best source session for migration
   *
   * @param {Array} sessions - Available sessions
   * @returns {Promise<Object|null>} Best source session
   */
  async _selectBestSourceSession(sessions) {
    if (sessions.length === 0) {
      return null;
    }

    // Prefer sessions with more files and recent activity
    let bestSession = null;
    let bestScore = 0;

    for (const session of sessions) {
      // Validate session data
      const isValid = await this._validateSessionDirectory(session.path);
      if (!isValid) {
        continue;
      }

      // Calculate score based on file count, size, and recency
      const ageScore = Math.max(
        0,
        1 - (Date.now() - session.lastModified) / (7 * 24 * 60 * 60 * 1000)
      ); // 7 days
      const fileScore = Math.min(1, session.fileCount / 10); // Normalize to 10 files
      const sizeScore = Math.min(1, session.size / (10 * 1024 * 1024)); // Normalize to 10MB

      const totalScore = ageScore * 0.4 + fileScore * 0.3 + sizeScore * 0.3;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestSession = session;
      }
    }

    return bestSession;
  }

  /**
   * Validate session directory
   *
   * @param {string} sessionPath - Path to session directory
   * @returns {Promise<boolean>} True if valid
   */
  async _validateSessionDirectory(sessionPath) {
    try {
      const sessionData = await validateSessionData(sessionPath);
      return sessionData.isValid && sessionData.hasAuthData;
    } catch (error) {
      logDiagnostic("debug", "Session validation failed", {
        sessionPath,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Perform session migration
   *
   * @param {Object} sourceSession - Source session info
   * @param {string} targetInstanceId - Target instance ID
   * @returns {Promise<Object>} Migration result
   */
  async _performMigration(sourceSession, targetInstanceId) {
    const result = {
      success: false,
      backup: null,
      error: null,
    };

    try {
      const targetPath = this._getSessionPath(targetInstanceId);

      // Create backup if enabled
      if (this.config.migrationBackup) {
        const backupResult = await this.backupManager.createBackup(
          sourceSession.path,
          {
            reason: "pre-migration",
            metadata: {
              sourceInstanceId: sourceSession.instanceId,
              targetInstanceId,
              migrationTimestamp: Date.now(),
            },
          }
        );

        if (backupResult.success) {
          result.backup = backupResult;
        } else {
          logDiagnostic("warn", "Failed to create migration backup", {
            error: backupResult.error,
          });
        }
      }

      // Copy session directory to new location
      await this._copyDirectory(sourceSession.path, targetPath);

      // Validate migrated session
      const isValid = await this._validateSessionDirectory(targetPath);
      if (!isValid) {
        throw new Error("Migrated session validation failed");
      }

      result.success = true;

      logDiagnostic("info", "Session migration completed", {
        from: sourceSession.path,
        to: targetPath,
        fileCount: sourceSession.fileCount,
        backup: result.backup?.backupPath,
      });
    } catch (error) {
      result.error = error.message;
      logDiagnostic("error", "Session migration failed", {
        error: error.message,
        sourceSession: sourceSession.path,
        targetInstanceId,
      });
    }

    return result;
  }

  /**
   * Copy directory recursively
   *
   * @param {string} source - Source directory
   * @param {string} target - Target directory
   */
  async _copyDirectory(source, target) {
    // Ensure target directory exists
    fs.mkdirSync(target, { recursive: true });

    const items = fs.readdirSync(source);

    for (const item of items) {
      const sourcePath = path.join(source, item);
      const targetPath = path.join(target, item);
      const stats = fs.statSync(sourcePath);

      if (stats.isDirectory()) {
        await this._copyDirectory(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }

  /**
   * Get directory size recursively
   *
   * @param {string} dirPath - Directory path
   * @param {Set} visited - Set of visited paths to prevent infinite recursion
   * @returns {Promise<number>} Size in bytes
   */
  async _getDirectorySize(dirPath, visited = new Set()) {
    let totalSize = 0;

    try {
      // Resolve the absolute path to handle symlinks and relative paths
      const absolutePath = path.resolve(dirPath);

      // Prevent infinite recursion by checking if we've already visited this path
      if (visited.has(absolutePath)) {
        return 0;
      }

      visited.add(absolutePath);

      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);

        try {
          const stats = fs.statSync(itemPath);

          if (stats.isDirectory()) {
            totalSize += await this._getDirectorySize(itemPath, visited);
          } else {
            totalSize += stats.size;
          }
        } catch (itemError) {
          // Skip items that can't be accessed (permissions, broken symlinks, etc.)
          logDiagnostic(
            "debug",
            "Failed to access item during size calculation",
            {
              itemPath,
              error: itemError.message,
            }
          );
        }
      }
    } catch (error) {
      logDiagnostic("debug", "Failed to calculate directory size", {
        dirPath,
        error: error.message,
      });
    }

    return totalSize;
  }

  /**
   * Infer strategy from instance ID
   *
   * @param {string} instanceId - Instance ID
   * @returns {string} Inferred strategy
   */
  _inferStrategyFromInstanceId(instanceId) {
    if (instanceId === "shared") {
      return SESSION_STRATEGIES.SHARED;
    }
    if (instanceId.startsWith("team")) {
      return SESSION_STRATEGIES.TEAM;
    }
    return SESSION_STRATEGIES.BRANCH_SPECIFIC;
  }

  /**
   * Get current strategy information
   *
   * @returns {Object} Current strategy info
   */
  getCurrentStrategy() {
    return {
      strategy: this.currentStrategy,
      instanceId: this.currentInstanceId,
      sessionPath: this.currentInstanceId
        ? this._getSessionPath(this.currentInstanceId)
        : null,
      gitBranch: this.gitBranchInfo?.branch,
      config: { ...this.config },
    };
  }

  /**
   * Switch to a different strategy
   *
   * @param {string} newStrategy - New strategy to switch to
   * @param {Object} options - Switch options
   * @returns {Promise<Object>} Switch result
   */
  async switchStrategy(newStrategy, options = {}) {
    const { migrate = true, backup = true } = options;

    const result = {
      success: false,
      oldStrategy: this.currentStrategy,
      newStrategy,
      migration: null,
      error: null,
    };

    try {
      // Update configuration
      this.config.defaultStrategy = newStrategy;

      // Re-initialize with new strategy
      const initResult = await this.initialize();

      if (initResult.error) {
        throw new Error(initResult.error);
      }

      result.success = true;
      result.migration = initResult.migration;

      logDiagnostic("info", "Strategy switched successfully", {
        from: result.oldStrategy,
        to: newStrategy,
        migrated: result.migration?.migrated || false,
      });
    } catch (error) {
      result.error = error.message;
      logDiagnostic("error", "Strategy switch failed", {
        error: error.message,
        oldStrategy: result.oldStrategy,
        newStrategy,
      });
    }

    return result;
  }

  /**
   * Clean up old session directories
   *
   * @param {Object} options - Cleanup options
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOldSessions(options = {}) {
    const {
      keepCurrent = true,
      maxAge = 7 * 24 * 60 * 60 * 1000, // 7 days
      createBackup = true,
    } = options;

    const result = {
      cleaned: 0,
      errors: [],
      backups: [],
    };

    try {
      const sessions = await this._findExistingSessions();
      const currentPath = this.currentInstanceId
        ? this._getSessionPath(this.currentInstanceId)
        : null;

      for (const session of sessions) {
        // Skip current session if keepCurrent is true
        if (keepCurrent && currentPath && session.path === currentPath) {
          continue;
        }

        // Skip recent sessions
        if (Date.now() - session.lastModified < maxAge) {
          continue;
        }

        try {
          // Create backup if requested
          if (createBackup) {
            const backupResult = await this.backupManager.createBackup(
              session.path,
              {
                reason: "cleanup",
                metadata: {
                  instanceId: session.instanceId,
                  cleanupTimestamp: Date.now(),
                },
              }
            );

            if (backupResult.success) {
              result.backups.push(backupResult);
            }
          }

          // Remove session directory
          fs.rmSync(session.path, { recursive: true, force: true });
          result.cleaned++;

          logDiagnostic("info", "Cleaned up old session", {
            sessionPath: session.path,
            instanceId: session.instanceId,
            age: Date.now() - session.lastModified,
          });
        } catch (error) {
          result.errors.push({
            sessionPath: session.path,
            error: error.message,
          });
        }
      }
    } catch (error) {
      result.errors.push({
        operation: "cleanup",
        error: error.message,
      });
    }

    return result;
  }
}

/**
 * Create and initialize session strategy manager
 *
 * @param {Object} options - Configuration options
 * @returns {Promise<SessionStrategyManager>} Initialized manager
 */
export async function createSessionStrategyManager(options = {}) {
  const manager = new SessionStrategyManager(options);
  await manager.initialize();
  return manager;
}

/**
 * Get session strategy from environment configuration
 *
 * @returns {string} Configured strategy
 */
export function getConfiguredStrategy() {
  // Check environment variables in order of precedence
  if (process.env.WA_TEAM_COLLABORATION === "true") {
    return SESSION_STRATEGIES.TEAM;
  }

  if (process.env.WA_BRANCH_PATTERN_STRATEGY === "true") {
    return SESSION_STRATEGIES.PATTERN_BASED;
  }

  if (process.env.WA_BRANCH_SESSIONS === "true") {
    return SESSION_STRATEGIES.BRANCH_SPECIFIC;
  }

  if (process.env.WA_SHARED_SESSION === "false") {
    return SESSION_STRATEGIES.BRANCH_SPECIFIC;
  }

  // Default to shared strategy
  return SESSION_STRATEGIES.SHARED;
}

/**
 * Validate session strategy configuration
 *
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validation result
 */
export function validateStrategyConfig(config) {
  const result = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  // Check strategy value
  if (
    config.defaultStrategy &&
    !Object.values(SESSION_STRATEGIES).includes(config.defaultStrategy)
  ) {
    result.errors.push(`Invalid strategy: ${config.defaultStrategy}`);
    result.isValid = false;
  }

  // Check boolean values
  const booleanFields = [
    "autoMigrate",
    "migrationBackup",
    "branchDetection",
    "teamCollaboration",
  ];
  for (const field of booleanFields) {
    if (config[field] !== undefined && typeof config[field] !== "boolean") {
      result.errors.push(`${field} must be a boolean`);
      result.isValid = false;
    }
  }

  // Check array fields
  const arrayFields = ["mainBranches", "featureBranchPatterns"];
  for (const field of arrayFields) {
    if (config[field] && !Array.isArray(config[field])) {
      result.errors.push(`${field} must be an array`);
      result.isValid = false;
    }
  }

  return result;
}
