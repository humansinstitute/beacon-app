/**
 * Instance Management Utility
 *
 * Provides robust instance ID generation and lock file management
 * for WhatsApp session management that works consistently across
 * PM2 and direct Node.js execution environments.
 *
 * Enhanced with git branch integration and session strategy support.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logDiagnostic } from "./sessionDiagnostics.js";
import {
  detectGitBranch,
  generateBranchAwareInstanceId,
} from "./gitIntegration.js";
import {
  createSessionStrategyManager,
  getConfiguredStrategy,
} from "./sessionStrategy.js";

/**
 * Generate a unique instance ID that works reliably for both PM2 and direct execution
 * Enhanced with git branch integration and session strategy support
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.useSharedSession - Whether to use shared session strategy (default: true)
 * @param {string} options.fallbackId - Fallback ID if no other method works
 * @param {boolean} options.useGitIntegration - Whether to use git branch integration (default: true)
 * @param {string} options.strategy - Explicit strategy override
 * @returns {Promise<string>} Unique instance identifier
 */
export async function generateInstanceId(options = {}) {
  const {
    useSharedSession = true,
    fallbackId = "default",
    useGitIntegration = true,
    strategy = null,
  } = options;

  try {
    // If explicit strategy is provided, use it
    if (strategy) {
      return await generateStrategyBasedInstanceId(strategy, options);
    }

    // Check environment configuration for strategy
    const configuredStrategy = getConfiguredStrategy();

    // If configured strategy is not shared, use strategy-based generation
    if (configuredStrategy !== "shared") {
      return await generateStrategyBasedInstanceId(configuredStrategy, options);
    }

    // Legacy behavior: check useSharedSession parameter
    if (useSharedSession || process.env.WA_SHARED_SESSION === "true") {
      logDiagnostic("info", "Using shared session strategy", {
        strategy: "shared",
        instanceId: "shared",
      });
      return "shared";
    }

    // If git integration is enabled and we're not using shared strategy
    if (useGitIntegration && process.env.WA_BRANCH_DETECTION !== "false") {
      const gitInstanceId = await generateGitAwareInstanceId(options);
      if (gitInstanceId) {
        return gitInstanceId;
      }
    }

    // Fall back to legacy PM2/direct execution logic
    return generateLegacyInstanceId(options);
  } catch (error) {
    logDiagnostic("warn", "Instance ID generation failed, using fallback", {
      error: error.message,
      fallbackId,
    });
    return fallbackId;
  }
}

/**
 * Generate instance ID based on session strategy
 *
 * @param {string} strategy - Session strategy
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Strategy-based instance ID
 */
async function generateStrategyBasedInstanceId(strategy, options = {}) {
  const { fallbackId = "default" } = options;

  try {
    switch (strategy) {
      case "shared":
        return "shared";

      case "branch-specific":
        const gitInfo = await detectGitBranch();
        if (gitInfo.branch) {
          const branchInstanceId = generateBranchAwareInstanceId(
            gitInfo.branch,
            {
              strategy: "branch-specific",
              sanitize: true,
            }
          );

          logDiagnostic("info", "Generated branch-specific instance ID", {
            strategy: "branch-specific",
            branch: gitInfo.branch,
            instanceId: branchInstanceId,
          });

          return branchInstanceId;
        }
        // Fall back to shared if no branch detected
        return "shared";

      case "pattern-based":
        return await generatePatternBasedInstanceId(options);

      case "team":
        const teamId = process.env.WA_TEAM_SESSION_PREFIX || "team";
        logDiagnostic("info", "Generated team instance ID", {
          strategy: "team",
          instanceId: teamId,
        });
        return teamId;

      default:
        logDiagnostic("warn", "Unknown strategy, falling back to shared", {
          strategy,
        });
        return "shared";
    }
  } catch (error) {
    logDiagnostic("error", "Strategy-based instance ID generation failed", {
      strategy,
      error: error.message,
    });
    return fallbackId;
  }
}

/**
 * Generate pattern-based instance ID
 *
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Pattern-based instance ID
 */
async function generatePatternBasedInstanceId(options = {}) {
  try {
    const gitInfo = await detectGitBranch();

    if (!gitInfo.branch) {
      return "shared";
    }

    // Define main branches (shared strategy)
    const mainBranches = ["main", "master", "develop", "dev"];

    // Define feature branch patterns (branch-specific strategy)
    const featureBranchPatterns = [
      "feature/*",
      "feat/*",
      "bugfix/*",
      "hotfix/*",
    ];

    // Check if it's a main branch
    if (mainBranches.includes(gitInfo.branch)) {
      logDiagnostic("info", "Main branch detected, using shared strategy", {
        branch: gitInfo.branch,
        instanceId: "shared",
      });
      return "shared";
    }

    // Check if it matches feature branch patterns
    for (const pattern of featureBranchPatterns) {
      if (matchesGlobPattern(gitInfo.branch, pattern)) {
        const branchInstanceId = generateBranchAwareInstanceId(gitInfo.branch, {
          strategy: "branch-specific",
          sanitize: true,
        });

        logDiagnostic(
          "info",
          "Feature branch detected, using branch-specific strategy",
          {
            branch: gitInfo.branch,
            pattern,
            instanceId: branchInstanceId,
          }
        );

        return branchInstanceId;
      }
    }

    // Default to shared for unmatched patterns
    logDiagnostic("info", "Branch pattern not matched, using shared strategy", {
      branch: gitInfo.branch,
      instanceId: "shared",
    });
    return "shared";
  } catch (error) {
    logDiagnostic("error", "Pattern-based instance ID generation failed", {
      error: error.message,
    });
    return "shared";
  }
}

/**
 * Generate git-aware instance ID (legacy method)
 *
 * @param {Object} options - Generation options
 * @returns {Promise<string|null>} Git-aware instance ID or null
 */
async function generateGitAwareInstanceId(options = {}) {
  try {
    const gitInfo = await detectGitBranch();

    if (gitInfo.branch && gitInfo.branch !== "detached-head") {
      const branchInstanceId = generateBranchAwareInstanceId(gitInfo.branch, {
        strategy: "branch-specific",
        sanitize: true,
      });

      logDiagnostic("info", "Generated git-aware instance ID", {
        strategy: "git-aware",
        branch: gitInfo.branch,
        instanceId: branchInstanceId,
        detectionMethod: gitInfo.detectionMethod,
      });

      return branchInstanceId;
    }

    return null;
  } catch (error) {
    logDiagnostic("debug", "Git-aware instance ID generation failed", {
      error: error.message,
    });
    return null;
  }
}

/**
 * Generate legacy instance ID (PM2/direct execution)
 *
 * @param {Object} options - Generation options
 * @returns {string} Legacy instance ID
 */
function generateLegacyInstanceId(options = {}) {
  const { fallbackId = "default" } = options;

  // Try PM2 environment variables first
  const pm2InstanceId = getPM2InstanceId();
  if (pm2InstanceId) {
    logDiagnostic("info", "Generated instance ID from PM2 environment", {
      strategy: "pm2",
      instanceId: pm2InstanceId,
      pm2AppName: process.env.PM2_APP_NAME,
      pm2InstanceIndex: process.env.PM2_INSTANCE_ID,
    });
    return pm2InstanceId;
  }

  // For direct execution, generate process-based unique identifier
  const directInstanceId = getDirectExecutionInstanceId();
  logDiagnostic("info", "Generated instance ID for direct execution", {
    strategy: "direct",
    instanceId: directInstanceId,
    processId: process.pid,
    startTime: process.hrtime.bigint().toString(),
  });

  return directInstanceId || fallbackId;
}

/**
 * Check if string matches glob pattern
 *
 * @param {string} str - String to test
 * @param {string} pattern - Glob pattern
 * @returns {boolean} True if matches
 */
function matchesGlobPattern(str, pattern) {
  const regexPattern = pattern
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".")
    .replace(/\[([^\]]+)\]/g, "[$1]");

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(str);
}

/**
 * Get instance ID from PM2 environment variables
 *
 * @returns {string|null} PM2-based instance ID or null if not in PM2
 */
function getPM2InstanceId() {
  // Check for PM2 environment indicators
  const pm2AppName = process.env.PM2_APP_NAME || process.env.name;
  const pm2InstanceIndex =
    process.env.PM2_INSTANCE_ID || process.env.NODE_APP_INSTANCE;
  const pm2Id = process.env.pm_id;

  // If we have PM2 app name, use it as base
  if (pm2AppName) {
    if (pm2InstanceIndex !== undefined) {
      return `${pm2AppName}_${pm2InstanceIndex}`;
    }
    return pm2AppName;
  }

  // Fall back to pm_id if available
  if (pm2Id) {
    return `pm2_${pm2Id}`;
  }

  // Check if we're likely running under PM2 by examining process.argv
  if (
    process.argv.some(
      (arg) => arg.includes("PM2") || arg.includes("ProcessContainer")
    )
  ) {
    return `pm2_${process.pid}`;
  }

  return null;
}

/**
 * Get instance ID for direct Node.js execution
 *
 * @returns {string} Process-based instance ID
 */
function getDirectExecutionInstanceId() {
  // Use process ID and start time for uniqueness
  const pid = process.pid;
  const startTime = process.hrtime.bigint().toString().slice(-6); // Last 6 digits for brevity

  return `direct_${pid}_${startTime}`;
}

/**
 * Enhanced lock file management with proper error handling and race condition prevention
 */
export class LockFileManager {
  constructor(lockFilePath = null) {
    this.lockFilePath =
      lockFilePath || path.join(process.cwd(), ".wwebjs.lock");
    this.lockTimeout = 30000; // 30 seconds timeout for stale locks
    this.retryDelay = 1000; // 1 second delay between retries
    this.maxRetries = 5;
  }

  /**
   * Acquire lock with retry mechanism and stale lock detection
   *
   * @param {Object} options - Lock acquisition options
   * @param {number} options.timeout - Timeout for lock acquisition
   * @param {number} options.retries - Maximum number of retries
   * @returns {Promise<boolean>} True if lock acquired successfully
   */
  async acquireLock(options = {}) {
    const { timeout = this.lockTimeout, retries = this.maxRetries } = options;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (await this._tryAcquireLock(timeout)) {
          logDiagnostic("info", "Lock acquired successfully", {
            lockFile: this.lockFilePath,
            processId: process.pid,
            attempt: attempt + 1,
          });
          return true;
        }
      } catch (error) {
        logDiagnostic("warn", "Lock acquisition attempt failed", {
          lockFile: this.lockFilePath,
          attempt: attempt + 1,
          error: error.message,
        });

        if (attempt === retries) {
          throw new Error(
            `Failed to acquire lock after ${retries + 1} attempts: ${
              error.message
            }`
          );
        }
      }

      // Wait before retry
      if (attempt < retries) {
        await this._sleep(this.retryDelay);
      }
    }

    return false;
  }

  /**
   * Try to acquire lock once
   *
   * @param {number} timeout - Timeout for stale lock detection
   * @returns {Promise<boolean>} True if lock acquired
   */
  async _tryAcquireLock(timeout) {
    if (fs.existsSync(this.lockFilePath)) {
      const lockData = await this._readLockFile();

      if (lockData) {
        // Check if the process is still running
        if (await this._isProcessRunning(lockData.pid)) {
          // Check if lock is stale
          if (this._isLockStale(lockData.timestamp, timeout)) {
            logDiagnostic("warn", "Stale lock detected, attempting to remove", {
              lockFile: this.lockFilePath,
              stalePid: lockData.pid,
              lockAge: Date.now() - lockData.timestamp,
            });

            await this._removeStaleLock(lockData.pid);
          } else {
            throw new Error(
              `Another instance is running (PID: ${lockData.pid})`
            );
          }
        } else {
          // Process not running, remove stale lock
          logDiagnostic("info", "Removing lock from dead process", {
            lockFile: this.lockFilePath,
            deadPid: lockData.pid,
          });
          fs.unlinkSync(this.lockFilePath);
        }
      }
    }

    // Create lock file
    const lockData = {
      pid: process.pid,
      timestamp: Date.now(),
      instanceId: generateInstanceId(),
      nodeVersion: process.version,
      platform: process.platform,
    };

    fs.writeFileSync(this.lockFilePath, JSON.stringify(lockData, null, 2));
    return true;
  }

  /**
   * Read and parse lock file data
   *
   * @returns {Object|null} Lock file data or null if invalid
   */
  async _readLockFile() {
    try {
      const content = fs.readFileSync(this.lockFilePath, "utf8");

      // Handle legacy lock files (just PID)
      if (!content.startsWith("{")) {
        const pid = parseInt(content.trim(), 10);
        if (!isNaN(pid)) {
          return {
            pid,
            timestamp: fs.statSync(this.lockFilePath).mtime.getTime(),
            legacy: true,
          };
        }
        return null;
      }

      return JSON.parse(content);
    } catch (error) {
      logDiagnostic("warn", "Failed to read lock file", {
        lockFile: this.lockFilePath,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Check if a process is still running
   *
   * @param {number} pid - Process ID to check
   * @returns {Promise<boolean>} True if process is running
   */
  async _isProcessRunning(pid) {
    try {
      // Use kill with signal 0 to check if process exists
      process.kill(pid, 0);
      return true;
    } catch (error) {
      // ESRCH means process doesn't exist
      if (error.code === "ESRCH") {
        return false;
      }
      // EPERM means process exists but we don't have permission to signal it
      if (error.code === "EPERM") {
        return true;
      }
      // Other errors, assume process doesn't exist
      return false;
    }
  }

  /**
   * Check if lock is stale based on timestamp
   *
   * @param {number} lockTimestamp - Lock creation timestamp
   * @param {number} timeout - Timeout in milliseconds
   * @returns {boolean} True if lock is stale
   */
  _isLockStale(lockTimestamp, timeout) {
    return Date.now() - lockTimestamp > timeout;
  }

  /**
   * Remove stale lock with additional verification
   *
   * @param {number} stalePid - PID of the stale process
   */
  async _removeStaleLock(stalePid) {
    // Double-check that process is not running
    if (!(await this._isProcessRunning(stalePid))) {
      fs.unlinkSync(this.lockFilePath);
      logDiagnostic("info", "Stale lock removed successfully", {
        lockFile: this.lockFilePath,
        stalePid,
      });
    } else {
      throw new Error(
        `Cannot remove lock: process ${stalePid} is still running`
      );
    }
  }

  /**
   * Release the lock if it belongs to this process
   *
   * @returns {Promise<boolean>} True if lock was released
   */
  async releaseLock() {
    try {
      if (!fs.existsSync(this.lockFilePath)) {
        logDiagnostic("info", "No lock file to release", {
          lockFile: this.lockFilePath,
        });
        return true;
      }

      const lockData = await this._readLockFile();

      if (lockData && lockData.pid === process.pid) {
        fs.unlinkSync(this.lockFilePath);
        logDiagnostic("info", "Lock released successfully", {
          lockFile: this.lockFilePath,
          processId: process.pid,
        });
        return true;
      } else {
        logDiagnostic(
          "warn",
          "Cannot release lock: not owned by this process",
          {
            lockFile: this.lockFilePath,
            currentPid: process.pid,
            lockPid: lockData?.pid,
          }
        );
        return false;
      }
    } catch (error) {
      logDiagnostic("error", "Error releasing lock", {
        lockFile: this.lockFilePath,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get information about the current lock
   *
   * @returns {Object|null} Lock information or null if no lock
   */
  async getLockInfo() {
    if (!fs.existsSync(this.lockFilePath)) {
      return null;
    }

    const lockData = await this._readLockFile();
    if (!lockData) {
      return null;
    }

    return {
      ...lockData,
      isRunning: await this._isProcessRunning(lockData.pid),
      isStale: this._isLockStale(lockData.timestamp, this.lockTimeout),
      age: Date.now() - lockData.timestamp,
    };
  }

  /**
   * Sleep utility for retry delays
   *
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Consolidate session directories for shared session strategy
 *
 * @param {string} baseDirectory - Base directory for session storage
 * @param {string} targetInstanceId - Target instance ID for consolidation
 * @returns {Promise<Object>} Consolidation results
 */
export async function consolidateSessionDirectories(
  baseDirectory,
  targetInstanceId = "shared"
) {
  const results = {
    consolidated: false,
    sourceDirectories: [],
    targetDirectory: null,
    preservedSessions: 0,
    errors: [],
  };

  try {
    // Find all existing session directories
    const sessionDirs = fs
      .readdirSync(baseDirectory)
      .filter((dir) => dir.startsWith(".wwebjs_auth_"))
      .map((dir) => path.join(baseDirectory, dir));

    if (sessionDirs.length === 0) {
      logDiagnostic("info", "No existing session directories found");
      return results;
    }

    results.sourceDirectories = sessionDirs;
    results.targetDirectory = path.join(
      baseDirectory,
      `.wwebjs_auth_${targetInstanceId}`
    );

    // If target already exists and is the only directory, no consolidation needed
    if (
      sessionDirs.length === 1 &&
      sessionDirs[0] === results.targetDirectory
    ) {
      logDiagnostic("info", "Session already consolidated", {
        targetDirectory: results.targetDirectory,
      });
      results.consolidated = true;
      return results;
    }

    // Find the most recent/complete session to preserve
    let sourceSession = null;
    let latestMtime = 0;

    for (const sessionDir of sessionDirs) {
      try {
        const stats = fs.statSync(sessionDir);
        if (stats.isDirectory() && stats.mtime.getTime() > latestMtime) {
          // Check if this session has actual data
          const sessionFiles = fs.readdirSync(sessionDir);
          if (sessionFiles.length > 0) {
            sourceSession = sessionDir;
            latestMtime = stats.mtime.getTime();
          }
        }
      } catch (error) {
        results.errors.push(
          `Failed to check session directory ${sessionDir}: ${error.message}`
        );
      }
    }

    if (sourceSession) {
      // If source is not the target, move/copy it
      if (sourceSession !== results.targetDirectory) {
        if (fs.existsSync(results.targetDirectory)) {
          // Remove existing target if it exists
          fs.rmSync(results.targetDirectory, { recursive: true, force: true });
        }

        // Move source to target
        fs.renameSync(sourceSession, results.targetDirectory);
        logDiagnostic("info", "Session directory moved for consolidation", {
          from: sourceSession,
          to: results.targetDirectory,
        });
      }

      results.preservedSessions = 1;
    }

    // Remove other session directories
    for (const sessionDir of sessionDirs) {
      if (
        sessionDir !== sourceSession &&
        sessionDir !== results.targetDirectory
      ) {
        try {
          if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
            logDiagnostic("info", "Removed redundant session directory", {
              directory: sessionDir,
            });
          }
        } catch (error) {
          results.errors.push(
            `Failed to remove session directory ${sessionDir}: ${error.message}`
          );
        }
      }
    }

    results.consolidated = true;

    logDiagnostic("info", "Session consolidation completed", {
      sourceDirectories: results.sourceDirectories.length,
      targetDirectory: results.targetDirectory,
      preservedSessions: results.preservedSessions,
      errors: results.errors.length,
    });
  } catch (error) {
    results.errors.push(`Session consolidation failed: ${error.message}`);
    logDiagnostic("error", "Session consolidation failed", {
      error: error.message,
    });
  }

  return results;
}

/**
 * Get session path for the given instance ID
 *
 * @param {string} instanceId - Instance identifier
 * @param {string} baseDirectory - Base directory for sessions
 * @returns {string} Full path to session directory
 */
export function getSessionPath(instanceId, baseDirectory = process.cwd()) {
  return path.join(baseDirectory, `.wwebjs_auth_${instanceId}`);
}

/**
 * Initialize instance management with enhanced strategy support
 *
 * @param {Object} options - Initialization options
 * @returns {Promise<Object>} Initialization results
 */
export async function initializeInstanceManagement(options = {}) {
  const {
    useSharedSession = true,
    baseDirectory = process.cwd(),
    consolidateSessions = true,
    useStrategyManager = true,
    strategyConfig = {},
  } = options;

  const results = {
    instanceId: null,
    sessionPath: null,
    consolidation: null,
    lockManager: new LockFileManager(),
    strategyManager: null,
    strategy: null,
    gitInfo: null,
    migration: null,
  };

  try {
    // Use strategy manager if enabled
    if (
      useStrategyManager &&
      process.env.WA_DISABLE_STRATEGY_MANAGER !== "true"
    ) {
      const strategyManager = await createSessionStrategyManager({
        baseDirectory,
        config: strategyConfig,
      });

      const strategyInfo = strategyManager.getCurrentStrategy();

      results.strategyManager = strategyManager;
      results.strategy = strategyInfo.strategy;
      results.instanceId = strategyInfo.instanceId;
      results.sessionPath = strategyInfo.sessionPath;
      results.gitInfo = strategyInfo.gitBranch;

      logDiagnostic("info", "Initialized with strategy manager", {
        strategy: results.strategy,
        instanceId: results.instanceId,
        gitBranch: results.gitInfo,
      });
    } else {
      // Legacy initialization
      results.instanceId = await generateInstanceId({ useSharedSession });
      results.sessionPath = getSessionPath(results.instanceId, baseDirectory);
      results.strategy = useSharedSession ? "shared" : "legacy";

      logDiagnostic("info", "Initialized with legacy method", {
        strategy: results.strategy,
        instanceId: results.instanceId,
        useSharedSession,
      });
    }

    // Consolidate sessions if using shared strategy and consolidation is enabled
    if (
      consolidateSessions &&
      (results.strategy === "shared" || useSharedSession)
    ) {
      results.consolidation = await consolidateSessionDirectories(
        baseDirectory,
        results.instanceId
      );
    }
  } catch (error) {
    logDiagnostic("error", "Instance management initialization failed", {
      error: error.message,
    });

    // Fallback to basic initialization
    results.instanceId = "shared";
    results.sessionPath = getSessionPath(results.instanceId, baseDirectory);
    results.strategy = "fallback";
  }

  return results;
}

/**
 * Get enhanced instance information including git and strategy details
 *
 * @param {Object} options - Information options
 * @returns {Promise<Object>} Enhanced instance information
 */
export async function getInstanceInfo(options = {}) {
  const { includeGitInfo = true, includeStrategy = true } = options;

  const info = {
    instanceId: null,
    strategy: null,
    sessionPath: null,
    gitInfo: null,
    environment: {
      pm2: !!process.env.PM2_APP_NAME,
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
    },
    configuration: {},
  };

  try {
    // Get configured strategy
    if (includeStrategy) {
      info.strategy = getConfiguredStrategy();
      info.configuration = {
        sharedSession: process.env.WA_SHARED_SESSION,
        branchSessions: process.env.WA_BRANCH_SESSIONS,
        branchDetection: process.env.WA_BRANCH_DETECTION,
        patternStrategy: process.env.WA_BRANCH_PATTERN_STRATEGY,
        teamCollaboration: process.env.WA_TEAM_COLLABORATION,
      };
    }

    // Generate instance ID
    info.instanceId = await generateInstanceId();
    info.sessionPath = getSessionPath(info.instanceId);

    // Get git information
    if (includeGitInfo) {
      info.gitInfo = await detectGitBranch();
    }
  } catch (error) {
    logDiagnostic("error", "Failed to get instance info", {
      error: error.message,
    });
  }

  return info;
}

/**
 * Migrate to new session strategy
 *
 * @param {string} newStrategy - Target strategy
 * @param {Object} options - Migration options
 * @returns {Promise<Object>} Migration result
 */
export async function migrateToStrategy(newStrategy, options = {}) {
  const { baseDirectory = process.cwd(), backup = true } = options;

  const result = {
    success: false,
    oldStrategy: null,
    newStrategy,
    migration: null,
    error: null,
  };

  try {
    // Create strategy manager
    const strategyManager = await createSessionStrategyManager({
      baseDirectory,
    });

    result.oldStrategy = strategyManager.getCurrentStrategy().strategy;

    // Switch to new strategy
    const switchResult = await strategyManager.switchStrategy(newStrategy, {
      migrate: true,
      backup,
    });

    if (switchResult.success) {
      result.success = true;
      result.migration = switchResult.migration;

      logDiagnostic("info", "Strategy migration completed", {
        from: result.oldStrategy,
        to: newStrategy,
        migrated: result.migration?.migrated || false,
      });
    } else {
      result.error = switchResult.error;
    }
  } catch (error) {
    result.error = error.message;
    logDiagnostic("error", "Strategy migration failed", {
      error: error.message,
      newStrategy,
    });
  }

  return result;
}
