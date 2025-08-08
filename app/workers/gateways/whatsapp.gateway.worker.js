// Library for interacting with WhatsApp Web and managing sessions.
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
// Import qrcode for image generation
import qr from "qrcode";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import path from "path";
import fs from "fs";

// Load environment variables from project root
import dotenv from "dotenv";
dotenv.config();

// WhatsApp Gateway Worker starting
const workerStartTime = Date.now();
logDiagnostic("info", "WhatsApp Gateway Worker starting...", {
  processId: process.pid,
  nodeVersion: process.version,
  platform: process.platform,
});

// Import environment validation and worker functions
import { validateBeaconAuth } from "../../utils/envValidation.js";
import {
  transformAndQueueMessage,
  processOutboundMessage,
} from "./whatsapp.gateway.functions.js";

// Import session validation and diagnostics
import {
  validateSessionData,
  discoverSessionDirectories,
  quickValidateSession,
} from "../../utils/sessionValidation.js";
import {
  generateDiagnosticReport,
  logDiagnostic,
} from "../../utils/sessionDiagnostics.js";

// Import instance management utilities
import {
  generateInstanceId,
  LockFileManager,
  initializeInstanceManagement,
  getSessionPath,
  getInstanceInfo,
} from "../../utils/instanceManager.js";

// Import session strategy management
import {
  createSessionStrategyManager,
  getConfiguredStrategy,
  SESSION_STRATEGIES,
} from "../../utils/sessionStrategy.js";

// Import git integration
import {
  detectGitBranch,
  getGitRepositoryInfo,
} from "../../utils/gitIntegration.js";

// Import session recovery utilities
import {
  SessionRecoveryManager,
  performAutomaticRecovery,
  assessRecoveryNeeds,
  RECOVERY_LEVELS,
  CORRUPTION_SEVERITY,
} from "../../utils/sessionRecovery.js";
import { SessionBackupManager } from "../../utils/sessionBackup.js";

// Re-export for backward compatibility
export { transformAndQueueMessage, processOutboundMessage };

const OUTBOUND_QUEUE_NAME = "bm_out";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

// Initialize lock manager
const lockManager = new LockFileManager();

// Only run worker initialization if this is the main module
// PM2 changes process.argv[1] to ProcessContainer.js, so we need a different approach
let isMainModule = false;

// Check if we're in a test environment first
if (process.env.JEST_WORKER_ID || process.env.NODE_ENV === "test") {
  isMainModule = false;
} else {
  // For PM2 and direct execution, always initialize unless explicitly in test mode
  isMainModule = true;
}

// Global variables for instance management
let instanceManagement = null;
let strategyManager = null;
let gitInfo = null;

async function initializeWorker() {
  if (!isMainModule) return;

  // Initialize git information first
  try {
    gitInfo = await getGitRepositoryInfo();
    logDiagnostic("info", "Git repository information", {
      isRepository: gitInfo.isRepository,
      branch: gitInfo.branch,
      commit: gitInfo.commit?.substring(0, 8),
      isDirty: gitInfo.isDirty,
    });
  } catch (error) {
    logDiagnostic("warn", "Failed to get git information", {
      error: error.message,
    });
    gitInfo = { isRepository: false, branch: null };
  }

  // Initialize session strategy management
  try {
    const configuredStrategy = getConfiguredStrategy();
    logDiagnostic("info", "Session strategy configuration", {
      strategy: configuredStrategy,
      gitBranch: gitInfo.branch,
      environment: {
        sharedSession: process.env.WA_SHARED_SESSION,
        branchSessions: process.env.WA_BRANCH_SESSIONS,
        branchDetection: process.env.WA_BRANCH_DETECTION,
        patternStrategy: process.env.WA_BRANCH_PATTERN_STRATEGY,
        teamCollaboration: process.env.WA_TEAM_COLLABORATION,
      },
    });

    // Use enhanced instance management with strategy support
    instanceManagement = await initializeInstanceManagement({
      useSharedSession: process.env.WA_SHARED_SESSION !== "false", // Default to true
      consolidateSessions: true,
      useStrategyManager: true, // Enable strategy manager
      strategyConfig: {
        branchDetection: process.env.WA_BRANCH_DETECTION !== "false",
        autoMigrate: process.env.WA_AUTO_MIGRATE_SESSION !== "false",
        migrationBackup: process.env.WA_MIGRATION_BACKUP !== "false",
      },
    });

    // Store strategy manager reference if available
    if (instanceManagement.strategyManager) {
      strategyManager = instanceManagement.strategyManager;
    }

    logDiagnostic(
      "info",
      "Instance management initialized with strategy support",
      {
        instanceId: instanceManagement.instanceId,
        sessionPath: instanceManagement.sessionPath,
        strategy: instanceManagement.strategy,
        gitBranch: instanceManagement.gitInfo,
        consolidationPerformed:
          instanceManagement.consolidation?.consolidated || false,
        migrationPerformed: instanceManagement.migration?.migrated || false,
        strategyManagerEnabled: !!strategyManager,
      }
    );

    // Log migration details if performed
    if (instanceManagement.migration?.migrated) {
      logDiagnostic(
        "info",
        "Session migration performed during initialization",
        {
          sourceStrategy: instanceManagement.migration.sourceStrategy,
          targetStrategy: instanceManagement.migration.targetStrategy,
          sourceInstanceId: instanceManagement.migration.sourceInstanceId,
          targetInstanceId: instanceManagement.migration.targetInstanceId,
          backupCreated: !!instanceManagement.migration.backup,
        }
      );
    }

    // Acquire lock with enhanced mechanism
    await instanceManagement.lockManager.acquireLock();

    // Start the main worker logic
    await startWhatsAppWorker();
  } catch (error) {
    logDiagnostic("error", "Failed to initialize instance management", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

async function startWhatsAppWorker() {
  const outboundRedisConnection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  // Generate diagnostic report before initialization
  logDiagnostic("info", "Generating session diagnostic report...");
  const diagnosticReport = generateDiagnosticReport({
    baseDirectory: process.cwd(),
    includeSystemInfo: true,
    includeEnvironmentInfo: true,
    validateAllSessions: false, // Quick validation for startup performance
  });

  logDiagnostic("info", "Session diagnostic summary", {
    totalSessions: diagnosticReport.summary.totalSessions,
    validSessions: diagnosticReport.summary.validSessions,
    healthScore: diagnosticReport.summary.healthScore,
    executionMode: diagnosticReport.environment.executionMode,
    pm2InstanceId: diagnosticReport.environment.pm2?.instanceId,
  });

  // Log warnings and errors from diagnostic report
  if (diagnosticReport.warnings.length > 0) {
    logDiagnostic("warn", "Session diagnostic warnings detected", {
      warnings: diagnosticReport.warnings,
    });
  }

  if (diagnosticReport.errors.length > 0) {
    logDiagnostic("error", "Session diagnostic errors detected", {
      errors: diagnosticReport.errors,
    });
  }

  // Get instance ID and session path from instance management
  const instanceId = instanceManagement.instanceId;
  const sessionPath = instanceManagement.sessionPath;

  // Log enhanced initialization information
  logDiagnostic(
    "info",
    "Initializing WhatsApp client with enhanced strategy support",
    {
      instanceId,
      sessionPath,
      strategy: instanceManagement.strategy,
      gitRepository: gitInfo.isRepository,
      gitBranch: gitInfo.branch,
      gitCommit: gitInfo.commit?.substring(0, 8),
      executionMode: diagnosticReport.environment.executionMode,
      strategyManagerEnabled: !!strategyManager,
      configuredStrategy: getConfiguredStrategy(),
    }
  );

  // Log consolidation results if performed
  if (instanceManagement.consolidation) {
    const consolidation = instanceManagement.consolidation;
    logDiagnostic("info", "Session consolidation results", {
      consolidated: consolidation.consolidated,
      sourceDirectories: consolidation.sourceDirectories.length,
      preservedSessions: consolidation.preservedSessions,
      errors: consolidation.errors.length,
    });

    if (consolidation.errors.length > 0) {
      logDiagnostic("warn", "Session consolidation had errors", {
        errors: consolidation.errors,
      });
    }
  }

  // Validate session before client initialization
  const sessionValidation = validateSessionData(sessionPath);

  logDiagnostic("info", "Session validation results", {
    sessionPath,
    isValid: sessionValidation.isValid,
    sessionExists: sessionValidation.details.sessionExists,
    issueCount: sessionValidation.issues.length,
    warningCount: sessionValidation.warnings.length,
    validationDuration: sessionValidation.validationDuration,
  });

  // Automatic session recovery if corruption is detected
  let recoveryResult = null;
  if (!sessionValidation.isValid && sessionValidation.details.sessionExists) {
    logDiagnostic(
      "warn",
      "Session validation failed - initiating automatic recovery",
      {
        issues: sessionValidation.issues,
        warnings: sessionValidation.warnings,
      }
    );

    try {
      // Perform automatic recovery
      recoveryResult = await performAutomaticRecovery(sessionPath, {
        validateAfterRecovery: true,
        autoBackupBeforeRecovery: true,
        maxRecoveryTime: 30000, // 30 seconds as per PRD
      });

      logDiagnostic("info", "Automatic recovery completed", {
        success: recoveryResult.success,
        recoveryPerformed: recoveryResult.recoveryPerformed,
        recoveryLevel: recoveryResult.recoveryLevel,
        backupCreated: recoveryResult.backupCreated,
        duration: recoveryResult.duration,
        corruptionSeverity: recoveryResult.corruptionSeverity,
      });

      if (recoveryResult.success) {
        logDiagnostic(
          "info",
          "Session recovery successful - proceeding with client initialization"
        );
      } else {
        logDiagnostic(
          "warn",
          "Session recovery completed but validation still failed",
          {
            error: recoveryResult.error,
            validationAfter: recoveryResult.validationResults.after,
          }
        );
      }

      // Log backup information if created
      if (recoveryResult.backupCreated && recoveryResult.backupPath) {
        logDiagnostic("info", "Session backup created before recovery", {
          backupPath: recoveryResult.backupPath,
          corruptionSeverity: recoveryResult.corruptionSeverity,
        });
      }
    } catch (error) {
      logDiagnostic("error", "Automatic recovery failed", {
        sessionPath,
        error: error.message,
        stack: error.stack,
      });

      // Continue with client initialization even if recovery fails
      // The client will handle authentication as needed
      logDiagnostic(
        "info",
        "Continuing with client initialization despite recovery failure"
      );
    }
  } else if (!sessionValidation.details.sessionExists) {
    logDiagnostic(
      "info",
      "No existing session found - new session will be created"
    );
  } else {
    logDiagnostic("info", "Session validation passed - using existing session");
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: sessionPath,
    }),
    puppeteer: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    },
  });

  // Display QR code in terminal when WhatsApp Web requests authentication.
  client.on("qr", (qrCode) => {
    logDiagnostic("info", "QR code generated for authentication", {
      instanceId,
      sessionPath,
      timestamp: new Date().toISOString(),
    });

    qrcode.generate(qrCode, { small: true });

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const qrFilename = path.join(__dirname, `whatsapp_qr.png`);

    if (fs.existsSync(qrFilename)) {
      fs.unlinkSync(qrFilename);
      logDiagnostic("info", "Deleted existing QR code image", { qrFilename });
    }

    qr.toFile(qrFilename, qrCode, (err) => {
      if (err) {
        logDiagnostic("error", "Failed to save QR code image", {
          error: err.message,
          qrFilename,
        });
      } else {
        logDiagnostic("info", "QR code image saved successfully", {
          qrFilename,
        });
      }
    });
  });

  client.on("auth_failure", (msg) => {
    logDiagnostic("error", "WhatsApp authentication failure", {
      instanceId,
      sessionPath,
      failureMessage: msg,
      timestamp: new Date().toISOString(),
    });
  });

  client.on("message_create", async (message) => {
    if (message.fromMe) {
      logDiagnostic("debug", "Ignoring message from self", {
        messageBody:
          message.body?.substring(0, 100) +
          (message.body?.length > 100 ? "..." : ""),
      });
      return;
    }

    logDiagnostic("info", "Received WhatsApp message", {
      messageId: message.id._serialized,
      from: message.from,
      messageType: message.type,
      hasMedia: message.hasMedia,
      bodyLength: message.body?.length || 0,
    });

    try {
      await transformAndQueueMessage(message);
      logDiagnostic("info", "Message successfully queued for processing", {
        messageId: message.id._serialized,
      });
    } catch (error) {
      logDiagnostic("error", "Failed to queue message for processing", {
        messageId: message.id._serialized,
        error: error.message,
      });
    }
  });

  client.on("disconnected", (reason) => {
    logDiagnostic("error", "WhatsApp client disconnected", {
      instanceId,
      sessionPath,
      reason,
      timestamp: new Date().toISOString(),
    });
    cleanup();
  });

  let outboundWorker;

  client.once("ready", async () => {
    const startupDuration = Date.now() - workerStartTime;
    logDiagnostic("info", "WhatsApp client is ready!", {
      instanceId,
      sessionPath,
      strategy: instanceManagement.strategy,
      gitBranch: gitInfo.branch,
      startupDuration,
      timestamp: new Date().toISOString(),
    });

    // Re-validate session after successful connection
    const postConnectionValidation = quickValidateSession(sessionPath);
    logDiagnostic("info", "Post-connection session validation", {
      sessionPath,
      isValid: postConnectionValidation,
      connectionEstablished: true,
      recoveryPerformed: recoveryResult?.recoveryPerformed || false,
      recoveryLevel: recoveryResult?.recoveryLevel || null,
      strategy: instanceManagement.strategy,
      migrationPerformed: instanceManagement.migration?.migrated || false,
    });

    // Log strategy information
    if (strategyManager) {
      const currentStrategy = strategyManager.getCurrentStrategy();
      logDiagnostic("info", "Session strategy status", {
        strategy: currentStrategy.strategy,
        instanceId: currentStrategy.instanceId,
        gitBranch: currentStrategy.gitBranch,
        configuredStrategy: getConfiguredStrategy(),
        sessionPath: currentStrategy.sessionPath,
      });
    }

    // Log final recovery summary if recovery was performed
    if (recoveryResult?.recoveryPerformed) {
      logDiagnostic("info", "Session recovery summary", {
        initialValidation: {
          isValid: sessionValidation.isValid,
          issueCount: sessionValidation.issues.length,
        },
        recovery: {
          level: recoveryResult.recoveryLevel,
          duration: recoveryResult.duration,
          backupCreated: recoveryResult.backupCreated,
          corruptionSeverity: recoveryResult.corruptionSeverity,
        },
        finalValidation: {
          isValid: postConnectionValidation,
          connectionSuccessful: true,
        },
        strategy: instanceManagement.strategy,
      });
    }

    // Log migration summary if migration was performed
    if (instanceManagement.migration?.migrated) {
      logDiagnostic("info", "Session migration summary", {
        migration: {
          sourceStrategy: instanceManagement.migration.sourceStrategy,
          targetStrategy: instanceManagement.migration.targetStrategy,
          sourceInstanceId: instanceManagement.migration.sourceInstanceId,
          targetInstanceId: instanceManagement.migration.targetInstanceId,
          backupCreated: !!instanceManagement.migration.backup,
        },
        finalValidation: {
          isValid: postConnectionValidation,
          connectionSuccessful: true,
        },
      });
    }

    // Wait for client to be fully ready for sending messages
    const CLIENT_STABILIZATION_DELAY = 3000; // 3 seconds
    logDiagnostic("info", "Waiting for client stabilization before starting outbound worker", {
      delay: CLIENT_STABILIZATION_DELAY,
      timestamp: new Date().toISOString(),
    });

    await new Promise(resolve => setTimeout(resolve, CLIENT_STABILIZATION_DELAY));

    // Verify client is ready for sending messages before creating worker
    try {
      const clientState = await client.getState();
      logDiagnostic("info", "Client state verification before outbound worker creation", {
        state: clientState,
        isConnected: clientState === 'CONNECTED',
        timestamp: new Date().toISOString(),
      });

      if (clientState !== 'CONNECTED') {
        logDiagnostic("warn", "Client not in CONNECTED state, waiting additional time", {
          currentState: clientState,
          additionalDelay: 2000,
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      logDiagnostic("warn", "Could not verify client state, proceeding with worker creation", {
        error: error.message,
      });
    }

    // Add outbound worker after client is ready and stabilized
    logDiagnostic("info", "Creating outbound worker for message processing", {
      queueName: OUTBOUND_QUEUE_NAME,
      concurrency: 5,
      timestamp: new Date().toISOString(),
    });

    outboundWorker = new Worker(
      OUTBOUND_QUEUE_NAME,
      async (job) => {
        console.log(
          `[WhatsApp Gateway] Processing outbound job ${job.id}:`,
          job.data
        );

        try {
          return await processOutboundMessage(job.data, client);
        } catch (error) {
          console.error(
            `[WhatsApp Gateway] Error processing outbound job ${job.id}:`,
            error
          );
          throw error;
        }
      },
      {
        connection: outboundRedisConnection,
        concurrency: 5,
        settings: {
          stalledInterval: 30000, // 30 seconds
          maxStalledCount: 1,
        },
      }
    );

    outboundWorker.on("completed", (job, result) => {
      console.log(
        `[WhatsApp Gateway] Outbound job ${job.id} completed:`,
        result
      );
    });

    outboundWorker.on("failed", (job, err) => {
      console.error(`[WhatsApp Gateway] Outbound job ${job.id} failed:`, err);
    });

    outboundWorker.on("stalled", (jobId) => {
      console.warn(`[WhatsApp Gateway] Outbound job ${jobId} stalled`);
    });

    logDiagnostic("info", "Outbound worker created and ready for processing", {
      workerName: outboundWorker.name,
      queueName: OUTBOUND_QUEUE_NAME,
      timestamp: new Date().toISOString(),
    });
  });

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  async function cleanup() {
    logDiagnostic("info", "Starting cleanup process", {
      instanceId,
      sessionPath,
      strategy: instanceManagement.strategy,
      gitBranch: gitInfo.branch,
    });

    try {
      await client.destroy();
      logDiagnostic("info", "WhatsApp client destroyed");

      if (outboundWorker) {
        await outboundWorker.close();
        logDiagnostic("info", "Outbound worker closed");
      }

      await outboundRedisConnection.quit();
      logDiagnostic("info", "Redis connection closed");

      // Cleanup old sessions if strategy manager is available
      if (strategyManager && process.env.WA_CLEANUP_ON_EXIT === "true") {
        try {
          const cleanupResult = await strategyManager.cleanupOldSessions({
            keepCurrent: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            createBackup: true,
          });

          if (cleanupResult.cleaned > 0) {
            logDiagnostic("info", "Cleaned up old sessions during shutdown", {
              cleaned: cleanupResult.cleaned,
              backups: cleanupResult.backups.length,
              errors: cleanupResult.errors.length,
            });
          }
        } catch (error) {
          logDiagnostic(
            "warn",
            "Failed to cleanup old sessions during shutdown",
            {
              error: error.message,
            }
          );
        }
      }
    } catch (e) {
      logDiagnostic("error", "Cleanup error", { error: e.message });
    } finally {
      // Release lock using enhanced lock manager
      if (instanceManagement?.lockManager) {
        await instanceManagement.lockManager.releaseLock();
      }
      process.exit(0);
    }
  }

  // Initialize the WhatsApp client with enhanced logging
  logDiagnostic("info", "Starting WhatsApp client initialization", {
    instanceId,
    sessionPath,
    strategy: instanceManagement.strategy,
    gitBranch: gitInfo.branch,
    validationPassed: sessionValidation.isValid,
    recoveryPerformed: recoveryResult?.recoveryPerformed || false,
    migrationPerformed: instanceManagement.migration?.migrated || false,
  });

  client.initialize();
}

// Initialize the worker if this is the main module
if (isMainModule) {
  initializeWorker().catch((error) => {
    logDiagnostic("error", "Worker initialization failed", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });
}
