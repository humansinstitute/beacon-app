/**
 * WhatsApp Web.js Session Diagnostic Utilities
 * Provides comprehensive diagnostic reporting for session health and environment analysis
 */

import fs from "fs";
import path from "path";
import os from "os";
import {
  validateSessionData,
  discoverSessionDirectories,
  quickValidateSession,
} from "./sessionValidation.js";

/**
 * Generates a comprehensive diagnostic report for WhatsApp session management
 * @param {Object} options - Configuration options for the diagnostic report
 * @param {string} options.baseDirectory - Base directory to scan for sessions
 * @param {boolean} options.includeSystemInfo - Include system information in report
 * @param {boolean} options.includeEnvironmentInfo - Include environment variables in report
 * @param {boolean} options.validateAllSessions - Perform full validation on all sessions
 * @returns {Object} Comprehensive diagnostic report
 */
export const generateDiagnosticReport = (options = {}) => {
  const {
    baseDirectory = process.cwd(),
    includeSystemInfo = true,
    includeEnvironmentInfo = true,
    validateAllSessions = true,
  } = options;

  const startTime = Date.now();
  const report = {
    timestamp: new Date().toISOString(),
    reportVersion: "1.0.0",
    generationDuration: 0,
    summary: {
      totalSessions: 0,
      validSessions: 0,
      invalidSessions: 0,
      corruptedSessions: 0,
      healthScore: 0,
    },
    environment: {},
    system: {},
    sessions: [],
    recommendations: [],
    warnings: [],
    errors: [],
  };

  try {
    // Collect environment information
    if (includeEnvironmentInfo) {
      report.environment = collectEnvironmentInfo();
    }

    // Collect system information
    if (includeSystemInfo) {
      report.system = collectSystemInfo();
    }

    // Discover and analyze sessions
    const sessionPaths = discoverSessionDirectories(baseDirectory);
    report.summary.totalSessions = sessionPaths.length;

    if (sessionPaths.length === 0) {
      report.warnings.push("No WhatsApp Web.js session directories found");
      report.recommendations.push(
        "Initialize WhatsApp Web.js client to create session data"
      );
    } else {
      // Analyze each session
      for (const sessionPath of sessionPaths) {
        const sessionAnalysis = analyzeSession(
          sessionPath,
          validateAllSessions
        );
        report.sessions.push(sessionAnalysis);

        // Update summary counts
        if (sessionAnalysis.isValid) {
          report.summary.validSessions++;
        } else {
          report.summary.invalidSessions++;
          if (sessionAnalysis.isCorrupted) {
            report.summary.corruptedSessions++;
          }
        }
      }
    }

    // Calculate health score (0-100)
    if (report.summary.totalSessions > 0) {
      report.summary.healthScore = Math.round(
        (report.summary.validSessions / report.summary.totalSessions) * 100
      );
    }

    // Generate recommendations based on findings
    report.recommendations.push(...generateRecommendations(report));

    // Detect common issues
    const issues = detectCommonIssues(report);
    report.warnings.push(...issues.warnings);
    report.errors.push(...issues.errors);
  } catch (error) {
    report.errors.push(`Diagnostic generation error: ${error.message}`);
  }

  report.generationDuration = Date.now() - startTime;
  return report;
};

/**
 * Analyzes a single session directory
 * @param {string} sessionPath - Path to the session directory
 * @param {boolean} fullValidation - Whether to perform full validation
 * @returns {Object} Session analysis results
 */
function analyzeSession(sessionPath, fullValidation = true) {
  const analysis = {
    path: sessionPath,
    instanceId: extractInstanceId(sessionPath),
    exists: fs.existsSync(sessionPath),
    isValid: false,
    isCorrupted: false,
    size: 0,
    fileCount: 0,
    lastModified: null,
    ageInDays: 0,
    validation: null,
  };

  try {
    if (analysis.exists) {
      const stats = fs.statSync(sessionPath);
      analysis.lastModified = stats.mtime.toISOString();
      analysis.ageInDays = Math.floor(
        (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate directory size and file count
      const sizeInfo = calculateDirectorySizeAndCount(sessionPath);
      analysis.size = sizeInfo.size;
      analysis.fileCount = sizeInfo.fileCount;

      // Perform validation
      if (fullValidation) {
        analysis.validation = validateSessionData(sessionPath);
        analysis.isValid = analysis.validation.isValid;
        analysis.isCorrupted = analysis.validation.issues.some(
          (issue) =>
            issue.includes("corruption") ||
            issue.includes("empty") ||
            issue.includes("missing critical")
        );
      } else {
        analysis.isValid = quickValidateSession(sessionPath);
      }
    }
  } catch (error) {
    analysis.error = error.message;
  }

  return analysis;
}

/**
 * Collects environment information relevant to WhatsApp session management
 * @returns {Object} Environment information
 */
function collectEnvironmentInfo() {
  const env = {
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    processId: process.pid,
    parentProcessId: process.ppid,
    workingDirectory: process.cwd(),
    executionMode: detectExecutionMode(),
    pm2: {
      detected: !!process.env.pm_id,
      instanceId: process.env.pm_id || null,
      processName: process.env.name || null,
    },
    environment: process.env.NODE_ENV || "development",
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
  };

  // Check for relevant environment variables
  const relevantEnvVars = [
    "REDIS_URL",
    "BEACON_AUTH",
    "NODE_ENV",
    "pm_id",
    "name",
    "PM2_HOME",
  ];

  env.environmentVariables = {};
  for (const varName of relevantEnvVars) {
    if (process.env[varName]) {
      // Mask sensitive values
      if (
        varName.includes("AUTH") ||
        varName.includes("PASSWORD") ||
        varName.includes("SECRET")
      ) {
        env.environmentVariables[varName] = "***MASKED***";
      } else {
        env.environmentVariables[varName] = process.env[varName];
      }
    }
  }

  return env;
}

/**
 * Collects system information
 * @returns {Object} System information
 */
function collectSystemInfo() {
  return {
    hostname: os.hostname(),
    type: os.type(),
    release: os.release(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    cpuCount: os.cpus().length,
    loadAverage: os.loadavg(),
    uptime: os.uptime(),
    userInfo: {
      username: os.userInfo().username,
      homedir: os.userInfo().homedir,
    },
  };
}

/**
 * Detects the execution mode (PM2, direct Node.js, test, etc.)
 * @returns {string} Execution mode
 */
function detectExecutionMode() {
  if (process.env.JEST_WORKER_ID || process.env.NODE_ENV === "test") {
    return "test";
  }

  if (process.env.pm_id) {
    return "pm2";
  }

  if (process.argv[1] && process.argv[1].includes("ProcessContainer.js")) {
    return "pm2-legacy";
  }

  return "direct";
}

/**
 * Extracts instance ID from session path
 * @param {string} sessionPath - Path to session directory
 * @returns {string|null} Instance ID or null if not found
 */
function extractInstanceId(sessionPath) {
  const match = sessionPath.match(/\.wwebjs_auth_(.+)$/);
  return match ? match[1] : null;
}

/**
 * Calculates directory size and file count recursively
 * @param {string} dirPath - Directory path
 * @returns {Object} Size and file count information
 */
function calculateDirectorySizeAndCount(dirPath) {
  let totalSize = 0;
  let fileCount = 0;

  try {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        const subDirInfo = calculateDirectorySizeAndCount(filePath);
        totalSize += subDirInfo.size;
        fileCount += subDirInfo.fileCount;
      } else {
        totalSize += stats.size;
        fileCount++;
      }
    }
  } catch (error) {
    // Ignore errors for inaccessible files/directories
  }

  return { size: totalSize, fileCount };
}

/**
 * Generates recommendations based on diagnostic findings
 * @param {Object} report - Diagnostic report
 * @returns {string[]} Array of recommendations
 */
function generateRecommendations(report) {
  const recommendations = [];

  // Health score based recommendations
  if (report.summary.healthScore < 50) {
    recommendations.push(
      "Consider cleaning up corrupted sessions and reinitializing WhatsApp Web.js"
    );
  } else if (report.summary.healthScore < 80) {
    recommendations.push(
      "Some sessions may need attention - review validation details"
    );
  }

  // Session age recommendations
  const oldSessions = report.sessions.filter((s) => s.ageInDays > 30);
  if (oldSessions.length > 0) {
    recommendations.push(
      `${oldSessions.length} session(s) are older than 30 days - consider cleanup`
    );
  }

  // Multiple sessions recommendation
  if (report.summary.totalSessions > 3) {
    recommendations.push(
      "Multiple session directories detected - consider consolidating to reduce confusion"
    );
  }

  // PM2 specific recommendations
  if (
    report.environment.executionMode === "pm2" &&
    report.environment.pm2.instanceId
  ) {
    const expectedSessionPath = `.wwebjs_auth_${report.environment.pm2.instanceId}`;
    const hasMatchingSession = report.sessions.some((s) =>
      s.path.includes(expectedSessionPath)
    );
    if (!hasMatchingSession) {
      recommendations.push(
        `No session found for current PM2 instance ID (${report.environment.pm2.instanceId})`
      );
    }
  }

  // Memory usage recommendations
  if (report.environment.memoryUsage.heapUsed > 500 * 1024 * 1024) {
    // 500MB
    recommendations.push(
      "High memory usage detected - monitor for memory leaks"
    );
  }

  return recommendations;
}

/**
 * Detects common issues in the diagnostic report
 * @param {Object} report - Diagnostic report
 * @returns {Object} Object containing warnings and errors
 */
function detectCommonIssues(report) {
  const warnings = [];
  const errors = [];

  // Check for instance ID mismatches
  if (report.environment.executionMode === "pm2") {
    const pmInstanceId = report.environment.pm2.instanceId;
    if (pmInstanceId === "undefined" || pmInstanceId === "null") {
      errors.push(
        "PM2 instance ID is undefined - this will cause session management issues"
      );
    }
  }

  // Check for corrupted sessions
  const corruptedSessions = report.sessions.filter((s) => s.isCorrupted);
  if (corruptedSessions.length > 0) {
    warnings.push(`${corruptedSessions.length} corrupted session(s) detected`);
  }

  // Check for very old sessions
  const veryOldSessions = report.sessions.filter((s) => s.ageInDays > 90);
  if (veryOldSessions.length > 0) {
    warnings.push(
      `${veryOldSessions.length} session(s) are older than 90 days`
    );
  }

  // Check for empty sessions
  const emptySessions = report.sessions.filter((s) => s.size < 1024); // Less than 1KB
  if (emptySessions.length > 0) {
    warnings.push(
      `${emptySessions.length} session(s) appear to be empty or minimal`
    );
  }

  return { warnings, errors };
}

/**
 * Formats the diagnostic report for console output
 * @param {Object} report - Diagnostic report
 * @returns {string} Formatted report string
 */
export const formatDiagnosticReport = (report) => {
  const lines = [];

  lines.push("=".repeat(60));
  lines.push("WhatsApp Session Diagnostic Report");
  lines.push("=".repeat(60));
  lines.push(`Generated: ${report.timestamp}`);
  lines.push(`Duration: ${report.generationDuration}ms`);
  lines.push("");

  // Summary
  lines.push("SUMMARY:");
  lines.push(`  Total Sessions: ${report.summary.totalSessions}`);
  lines.push(`  Valid Sessions: ${report.summary.validSessions}`);
  lines.push(`  Invalid Sessions: ${report.summary.invalidSessions}`);
  lines.push(`  Corrupted Sessions: ${report.summary.corruptedSessions}`);
  lines.push(`  Health Score: ${report.summary.healthScore}%`);
  lines.push("");

  // Environment
  if (report.environment) {
    lines.push("ENVIRONMENT:");
    lines.push(`  Execution Mode: ${report.environment.executionMode}`);
    lines.push(`  Node Version: ${report.environment.nodeVersion}`);
    lines.push(`  Platform: ${report.environment.platform}`);
    if (report.environment.pm2.detected) {
      lines.push(`  PM2 Instance ID: ${report.environment.pm2.instanceId}`);
    }
    lines.push("");
  }

  // Sessions
  if (report.sessions.length > 0) {
    lines.push("SESSIONS:");
    for (const session of report.sessions) {
      lines.push(`  ${session.path}:`);
      lines.push(`    Valid: ${session.isValid ? "Yes" : "No"}`);
      lines.push(`    Size: ${formatBytes(session.size)}`);
      lines.push(`    Age: ${session.ageInDays} days`);
      if (session.isCorrupted) {
        lines.push(`    Status: CORRUPTED`);
      }
    }
    lines.push("");
  }

  // Warnings
  if (report.warnings.length > 0) {
    lines.push("WARNINGS:");
    for (const warning of report.warnings) {
      lines.push(`  ⚠️  ${warning}`);
    }
    lines.push("");
  }

  // Errors
  if (report.errors.length > 0) {
    lines.push("ERRORS:");
    for (const error of report.errors) {
      lines.push(`  ❌ ${error}`);
    }
    lines.push("");
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push("RECOMMENDATIONS:");
    for (const recommendation of report.recommendations) {
      lines.push(`  💡 ${recommendation}`);
    }
    lines.push("");
  }

  lines.push("=".repeat(60));

  return lines.join("\n");
};

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
 * Logs diagnostic information with structured formatting
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 */
export const logDiagnostic = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    component: "WhatsApp-Session-Diagnostics",
    message,
    ...data,
  };

  const logLine = `[${timestamp}] [${level.toUpperCase()}] [WhatsApp-Session-Diagnostics] ${message}`;

  switch (level.toLowerCase()) {
    case "error":
      console.error(logLine, data);
      break;
    case "warn":
      console.warn(logLine, data);
      break;
    case "info":
    default:
      console.log(logLine, data);
      break;
  }
};
