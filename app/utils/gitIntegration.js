/**
 * Git Integration Utility
 *
 * Provides git branch detection and utilities for WhatsApp session management
 * that supports branch-aware session strategies and team collaboration.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { logDiagnostic } from "./sessionDiagnostics.js";

/**
 * Git branch detection with multiple fallback methods
 *
 * @param {Object} options - Detection options
 * @param {string} options.workingDirectory - Directory to check for git repository
 * @param {boolean} options.useCache - Whether to cache branch detection results
 * @returns {Promise<Object>} Git branch information
 */
export async function detectGitBranch(options = {}) {
  const { workingDirectory = process.cwd(), useCache = true } = options;

  // Check cache first if enabled
  if (
    useCache &&
    _branchCache.branch &&
    _branchCache.timestamp > Date.now() - _branchCache.ttl
  ) {
    logDiagnostic("debug", "Using cached git branch information", {
      branch: _branchCache.branch,
      cacheAge: Date.now() - _branchCache.timestamp,
    });
    return _branchCache;
  }

  const result = {
    branch: null,
    isGitRepository: false,
    detectionMethod: null,
    error: null,
    timestamp: Date.now(),
  };

  try {
    // Check if we're in a git repository
    result.isGitRepository = await isGitRepository(workingDirectory);

    if (!result.isGitRepository) {
      logDiagnostic("info", "Not in a git repository", { workingDirectory });
      return result;
    }

    // Try multiple methods to detect branch
    const detectionMethods = [
      () => detectBranchFromGitCommand(workingDirectory),
      () => detectBranchFromGitHead(workingDirectory),
      () => detectBranchFromEnvironment(),
    ];

    for (const method of detectionMethods) {
      try {
        const branchInfo = await method();
        if (branchInfo.branch) {
          result.branch = branchInfo.branch;
          result.detectionMethod = branchInfo.method;
          break;
        }
      } catch (error) {
        logDiagnostic("debug", "Git branch detection method failed", {
          method: method.name,
          error: error.message,
        });
      }
    }

    if (result.branch) {
      logDiagnostic("info", "Git branch detected successfully", {
        branch: result.branch,
        method: result.detectionMethod,
        workingDirectory,
      });

      // Cache the result
      if (useCache) {
        _branchCache = { ...result, ttl: 30000 }; // 30 second cache
      }
    } else {
      result.error = "Unable to detect git branch using any method";
      logDiagnostic("warn", "Failed to detect git branch", {
        workingDirectory,
        isGitRepository: result.isGitRepository,
      });
    }
  } catch (error) {
    result.error = error.message;
    logDiagnostic("error", "Git branch detection failed", {
      error: error.message,
      workingDirectory,
    });
  }

  return result;
}

/**
 * Check if directory is a git repository
 *
 * @param {string} directory - Directory to check
 * @returns {Promise<boolean>} True if git repository
 */
export async function isGitRepository(directory = process.cwd()) {
  try {
    // Check for .git directory or file (for worktrees)
    const gitPath = path.join(directory, ".git");
    if (fs.existsSync(gitPath)) {
      return true;
    }

    // Check parent directories up to root
    const parentDir = path.dirname(directory);
    if (parentDir !== directory) {
      return await isGitRepository(parentDir);
    }

    return false;
  } catch (error) {
    logDiagnostic("debug", "Error checking git repository", {
      directory,
      error: error.message,
    });
    return false;
  }
}

/**
 * Detect branch using git command
 *
 * @param {string} workingDirectory - Working directory
 * @returns {Promise<Object>} Branch detection result
 */
async function detectBranchFromGitCommand(workingDirectory) {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: workingDirectory,
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (branch && branch !== "HEAD") {
      return { branch, method: "git-command" };
    }

    // If we get HEAD, try to get branch from symbolic ref
    const symbolicRef = execSync("git symbolic-ref HEAD", {
      cwd: workingDirectory,
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (symbolicRef.startsWith("refs/heads/")) {
      return {
        branch: symbolicRef.replace("refs/heads/", ""),
        method: "git-symbolic-ref",
      };
    }

    return { branch: null, method: "git-command" };
  } catch (error) {
    throw new Error(`Git command failed: ${error.message}`);
  }
}

/**
 * Detect branch from .git/HEAD file
 *
 * @param {string} workingDirectory - Working directory
 * @returns {Promise<Object>} Branch detection result
 */
async function detectBranchFromGitHead(workingDirectory) {
  try {
    const gitDir = await findGitDirectory(workingDirectory);
    if (!gitDir) {
      throw new Error("Git directory not found");
    }

    const headPath = path.join(gitDir, "HEAD");
    if (!fs.existsSync(headPath)) {
      throw new Error("HEAD file not found");
    }

    const headContent = fs.readFileSync(headPath, "utf8").trim();

    if (headContent.startsWith("ref: refs/heads/")) {
      return {
        branch: headContent.replace("ref: refs/heads/", ""),
        method: "git-head-file",
      };
    }

    // Detached HEAD state
    if (/^[0-9a-f]{40}$/.test(headContent)) {
      return { branch: "detached-head", method: "git-head-file" };
    }

    return { branch: null, method: "git-head-file" };
  } catch (error) {
    throw new Error(`Git HEAD file reading failed: ${error.message}`);
  }
}

/**
 * Detect branch from environment variables
 *
 * @returns {Promise<Object>} Branch detection result
 */
async function detectBranchFromEnvironment() {
  // Common CI/CD environment variables
  const envVars = [
    "GIT_BRANCH",
    "BRANCH_NAME",
    "CI_COMMIT_REF_NAME",
    "GITHUB_REF_NAME",
    "GITLAB_CI_COMMIT_REF_NAME",
    "BUILDKITE_BRANCH",
  ];

  for (const envVar of envVars) {
    const branch = process.env[envVar];
    if (branch) {
      // Clean up branch name (remove refs/heads/ prefix if present)
      const cleanBranch = branch.replace(/^refs\/heads\//, "");
      return { branch: cleanBranch, method: `env-${envVar}` };
    }
  }

  return { branch: null, method: "environment" };
}

/**
 * Find git directory (.git folder or file)
 *
 * @param {string} startDirectory - Starting directory
 * @returns {Promise<string|null>} Path to git directory
 */
async function findGitDirectory(startDirectory) {
  let currentDir = startDirectory;

  while (currentDir !== path.dirname(currentDir)) {
    const gitPath = path.join(currentDir, ".git");

    if (fs.existsSync(gitPath)) {
      const stats = fs.statSync(gitPath);

      if (stats.isDirectory()) {
        return gitPath;
      } else if (stats.isFile()) {
        // Git worktree - read the file to get actual git directory
        const gitFileContent = fs.readFileSync(gitPath, "utf8").trim();
        if (gitFileContent.startsWith("gitdir: ")) {
          const gitDir = gitFileContent.replace("gitdir: ", "");
          return path.isAbsolute(gitDir)
            ? gitDir
            : path.resolve(currentDir, gitDir);
        }
      }
    }

    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Determine session strategy based on branch patterns
 *
 * @param {string} branch - Git branch name
 * @param {Object} options - Strategy options
 * @returns {string} Session strategy ('shared', 'branch-specific', 'pattern-based')
 */
export function determineBranchStrategy(branch, options = {}) {
  const {
    mainBranches = ["main", "master", "develop", "dev"],
    featureBranchPatterns = ["feature/*", "feat/*", "bugfix/*", "hotfix/*"],
    defaultStrategy = "shared",
  } = options;

  if (!branch || branch === "detached-head") {
    return defaultStrategy;
  }

  // Check if it's a main branch
  if (mainBranches.includes(branch)) {
    return "shared";
  }

  // Check if it matches feature branch patterns
  for (const pattern of featureBranchPatterns) {
    if (matchesPattern(branch, pattern)) {
      return "branch-specific";
    }
  }

  return defaultStrategy;
}

/**
 * Check if branch name matches a pattern
 *
 * @param {string} branchName - Branch name to check
 * @param {string} pattern - Pattern to match (supports * wildcard)
 * @returns {boolean} True if matches
 */
function matchesPattern(branchName, pattern) {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".")
    .replace(/\[([^\]]+)\]/g, "[$1]");

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(branchName);
}

/**
 * Generate branch-aware instance ID
 *
 * @param {string} branch - Git branch name
 * @param {Object} options - Generation options
 * @returns {string} Branch-aware instance ID
 */
export function generateBranchAwareInstanceId(branch, options = {}) {
  const {
    strategy = "shared",
    sanitize = true,
    maxLength = 50,
    fallbackId = "default",
  } = options;

  if (strategy === "shared" || !branch) {
    return "shared";
  }

  let instanceId = branch;

  if (sanitize) {
    // Sanitize branch name for filesystem compatibility
    instanceId = instanceId
      .replace(/[^a-zA-Z0-9\-_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }

  if (instanceId.length > maxLength) {
    // Truncate but keep meaningful part
    const hash = createSimpleHash(instanceId);
    instanceId = instanceId.substring(0, maxLength - 8) + "_" + hash;
  }

  return instanceId || fallbackId;
}

/**
 * Create simple hash for branch names
 *
 * @param {string} input - Input string
 * @returns {string} Simple hash
 */
function createSimpleHash(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 7);
}

/**
 * Get git repository information
 *
 * @param {string} workingDirectory - Working directory
 * @returns {Promise<Object>} Repository information
 */
export async function getGitRepositoryInfo(workingDirectory = process.cwd()) {
  const info = {
    isRepository: false,
    branch: null,
    commit: null,
    remote: null,
    isDirty: false,
    error: null,
  };

  try {
    info.isRepository = await isGitRepository(workingDirectory);

    if (!info.isRepository) {
      return info;
    }

    const branchInfo = await detectGitBranch({
      workingDirectory,
      useCache: false,
    });
    info.branch = branchInfo.branch;

    // Get current commit hash
    try {
      info.commit = execSync("git rev-parse HEAD", {
        cwd: workingDirectory,
        encoding: "utf8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch (error) {
      logDiagnostic("debug", "Failed to get commit hash", {
        error: error.message,
      });
    }

    // Get remote URL
    try {
      info.remote = execSync("git config --get remote.origin.url", {
        cwd: workingDirectory,
        encoding: "utf8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch (error) {
      logDiagnostic("debug", "Failed to get remote URL", {
        error: error.message,
      });
    }

    // Check if working directory is dirty
    try {
      const status = execSync("git status --porcelain", {
        cwd: workingDirectory,
        encoding: "utf8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      info.isDirty = status.length > 0;
    } catch (error) {
      logDiagnostic("debug", "Failed to check git status", {
        error: error.message,
      });
    }
  } catch (error) {
    info.error = error.message;
    logDiagnostic("error", "Failed to get git repository info", {
      error: error.message,
      workingDirectory,
    });
  }

  return info;
}

/**
 * Clear git branch cache
 */
export function clearGitBranchCache() {
  _branchCache = {
    branch: null,
    timestamp: 0,
    ttl: 30000,
  };
  logDiagnostic("debug", "Git branch cache cleared");
}

// Private cache for branch detection
let _branchCache = {
  branch: null,
  timestamp: 0,
  ttl: 30000, // 30 seconds
};

/**
 * Validate git integration configuration
 *
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validation result
 */
export function validateGitIntegrationConfig(config = {}) {
  const result = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  // Check branch detection settings
  if (
    config.branchDetection !== undefined &&
    typeof config.branchDetection !== "boolean"
  ) {
    result.errors.push("branchDetection must be a boolean");
    result.isValid = false;
  }

  // Check main branches configuration
  if (config.mainBranches && !Array.isArray(config.mainBranches)) {
    result.errors.push("mainBranches must be an array");
    result.isValid = false;
  }

  // Check feature branch patterns
  if (
    config.featureBranchPatterns &&
    !Array.isArray(config.featureBranchPatterns)
  ) {
    result.errors.push("featureBranchPatterns must be an array");
    result.isValid = false;
  }

  // Validate pattern syntax
  if (config.featureBranchPatterns) {
    for (const pattern of config.featureBranchPatterns) {
      if (typeof pattern !== "string") {
        result.errors.push(`Invalid pattern type: ${typeof pattern}`);
        result.isValid = false;
      }
    }
  }

  return result;
}
