/**
 * Session Performance Tests
 * Validates timing requirements and performance benchmarks for session management
 * Tests PRD requirements: 5s validation, 30s recovery, 2s git detection
 */

import { jest } from "@jest/globals";
import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { fileURLToPath } from "url";

// Import session management components
import {
  validateSessionData,
  discoverSessionDirectories,
  quickValidateSession,
} from "../../app/utils/sessionValidation.js";
import {
  generateDiagnosticReport,
  logDiagnostic,
} from "../../app/utils/sessionDiagnostics.js";
import {
  generateInstanceId,
  LockFileManager,
  initializeInstanceManagement,
  getSessionPath,
  getInstanceInfo,
} from "../../app/utils/instanceManager.js";
import {
  createSessionStrategyManager,
  getConfiguredStrategy,
  SESSION_STRATEGIES,
} from "../../app/utils/sessionStrategy.js";
import {
  detectGitBranch,
  getGitRepositoryInfo,
  GitBranchDetector,
} from "../../app/utils/gitIntegration.js";
import {
  SessionRecoveryManager,
  performAutomaticRecovery,
  assessRecoveryNeeds,
  RECOVERY_LEVELS,
  CORRUPTION_SEVERITY,
} from "../../app/utils/sessionRecovery.js";
import { SessionBackupManager } from "../../app/utils/sessionBackup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

// Performance thresholds from PRD
const PERFORMANCE_THRESHOLDS = {
  SESSION_VALIDATION: 5000, // 5 seconds
  RECOVERY_COMPLETION: 30000, // 30 seconds
  GIT_BRANCH_DETECTION: 2000, // 2 seconds
  INSTANCE_INITIALIZATION: 5000, // 5 seconds
  BACKUP_CREATION: 10000, // 10 seconds
  STRATEGY_MIGRATION: 15000, // 15 seconds
  DIAGNOSTIC_GENERATION: 3000, // 3 seconds
};

// Performance metrics collection
class PerformanceMetrics {
  constructor() {
    this.metrics = [];
  }

  startTimer(name) {
    return {
      name,
      startTime: performance.now(),
      end: () => {
        const endTime = performance.now();
        const duration = endTime - this.startTime;
        this.metrics.push({
          name,
          duration,
          timestamp: new Date().toISOString(),
        });
        return duration;
      },
    };
  }

  getMetrics() {
    return this.metrics;
  }

  getAverageTime(name) {
    const nameMetrics = this.metrics.filter((m) => m.name === name);
    if (nameMetrics.length === 0) return 0;
    return (
      nameMetrics.reduce((sum, m) => sum + m.duration, 0) / nameMetrics.length
    );
  }

  getMaxTime(name) {
    const nameMetrics = this.metrics.filter((m) => m.name === name);
    if (nameMetrics.length === 0) return 0;
    return Math.max(...nameMetrics.map((m) => m.duration));
  }

  getMinTime(name) {
    const nameMetrics = this.metrics.filter((m) => m.name === name);
    if (nameMetrics.length === 0) return 0;
    return Math.min(...nameMetrics.map((m) => m.duration));
  }

  generateReport() {
    const report = {
      summary: {
        totalTests: this.metrics.length,
        testNames: [...new Set(this.metrics.map((m) => m.name))],
      },
      details: {},
    };

    for (const testName of report.summary.testNames) {
      report.details[testName] = {
        count: this.metrics.filter((m) => m.name === testName).length,
        average: this.getAverageTime(testName),
        min: this.getMinTime(testName),
        max: this.getMaxTime(testName),
        threshold:
          PERFORMANCE_THRESHOLDS[testName.toUpperCase().replace(/\s+/g, "_")] ||
          null,
      };
    }

    return report;
  }
}

describe("Session Performance Tests", () => {
  let testSessionPath;
  let performanceMetrics;
  let originalEnv;

  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set test environment variables
    process.env.NODE_ENV = "test";
    process.env.WA_SHARED_SESSION = "true";
    process.env.WA_BRANCH_SESSIONS = "false";
    process.env.WA_BRANCH_DETECTION = "true";
    process.env.WA_AUTO_MIGRATE_SESSION = "true";
    process.env.WA_MIGRATION_BACKUP = "true";
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;

    // Generate final performance report
    if (performanceMetrics) {
      const report = performanceMetrics.generateReport();
      console.log("\n=== PERFORMANCE REPORT ===");
      console.log(JSON.stringify(report, null, 2));
    }
  });

  beforeEach(() => {
    // Create unique test session path for each test
    testSessionPath = path.join(
      projectRoot,
      "test-sessions",
      `perf-${Date.now()}`
    );
    performanceMetrics = new PerformanceMetrics();

    // Clear any existing mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup test session directory
    if (fs.existsSync(testSessionPath)) {
      fs.rmSync(testSessionPath, { recursive: true, force: true });
    }
  });

  describe("PRD Timing Requirements", () => {
    describe("Session Validation Performance (< 5 seconds)", () => {
      test("should validate valid session within 5 seconds", async () => {
        // Create valid session
        const validSessionPath = path.join(testSessionPath, "valid");
        fs.mkdirSync(validSessionPath, { recursive: true });
        fs.mkdirSync(path.join(validSessionPath, "Default"), {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(validSessionPath, "Default", "Preferences"),
          JSON.stringify({ version: "1.0" })
        );

        const timer = performanceMetrics.startTimer("session_validation");
        const validation = validateSessionData(validSessionPath);
        const duration = timer.end();

        expect(validation.isValid).toBe(true);
        expect(duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.SESSION_VALIDATION
        );
        expect(validation.validationDuration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.SESSION_VALIDATION
        );
      });

      test("should validate corrupted session within 5 seconds", async () => {
        // Create corrupted session
        const corruptedSessionPath = path.join(testSessionPath, "corrupted");
        fs.mkdirSync(corruptedSessionPath, { recursive: true });
        fs.writeFileSync(path.join(corruptedSessionPath, "LOCK"), "corrupted");
        // Missing required directories

        const timer = performanceMetrics.startTimer("session_validation");
        const validation = validateSessionData(corruptedSessionPath);
        const duration = timer.end();

        expect(validation.isValid).toBe(false);
        expect(duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.SESSION_VALIDATION
        );
        expect(validation.validationDuration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.SESSION_VALIDATION
        );
      });

      test("should perform quick validation within 1 second", async () => {
        // Create valid session
        const quickSessionPath = path.join(testSessionPath, "quick");
        fs.mkdirSync(quickSessionPath, { recursive: true });
        fs.mkdirSync(path.join(quickSessionPath, "Default"), {
          recursive: true,
        });

        const timer = performanceMetrics.startTimer("quick_validation");
        const isValid = quickValidateSession(quickSessionPath);
        const duration = timer.end();

        expect(typeof isValid).toBe("boolean");
        expect(duration).toBeLessThan(1000); // Quick validation should be under 1 second
      });

      test("should validate multiple sessions efficiently", async () => {
        // Create multiple sessions
        const sessionCount = 10;
        const sessionPaths = [];

        for (let i = 0; i < sessionCount; i++) {
          const sessionPath = path.join(testSessionPath, `session-${i}`);
          fs.mkdirSync(sessionPath, { recursive: true });
          fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });
          sessionPaths.push(sessionPath);
        }

        const timer = performanceMetrics.startTimer("multiple_validation");

        const validations = sessionPaths.map((sessionPath) =>
          validateSessionData(sessionPath)
        );

        const duration = timer.end();

        expect(validations.length).toBe(sessionCount);
        expect(validations.every((v) => v.isValid)).toBe(true);
        expect(duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.SESSION_VALIDATION * 2
        ); // Allow 2x for multiple
      });
    });

    describe("Recovery Completion Performance (< 30 seconds)", () => {
      test("should complete Level 1 recovery within 30 seconds", async () => {
        // Create session with minor corruption (stale lock)
        const sessionPath = path.join(testSessionPath, "level1");
        fs.mkdirSync(sessionPath, { recursive: true });
        fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });
        fs.writeFileSync(path.join(sessionPath, "LOCK"), "stale lock");

        // Set old modification time
        const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
        fs.utimesSync(path.join(sessionPath, "LOCK"), oldTime, oldTime);

        const timer = performanceMetrics.startTimer("recovery_level1");
        const recoveryResult = await performAutomaticRecovery(sessionPath, {
          validateAfterRecovery: true,
          maxRecoveryTime: PERFORMANCE_THRESHOLDS.RECOVERY_COMPLETION,
        });
        const duration = timer.end();

        expect(recoveryResult.success).toBe(true);
        expect(recoveryResult.recoveryLevel).toBe(RECOVERY_LEVELS.LEVEL_1);
        expect(duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.RECOVERY_COMPLETION
        );
        expect(recoveryResult.duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.RECOVERY_COMPLETION
        );
      }, 35000);

      test("should complete Level 2 recovery within 30 seconds", async () => {
        // Create session with moderate corruption
        const sessionPath = path.join(testSessionPath, "level2");
        fs.mkdirSync(sessionPath, { recursive: true });
        fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });
        fs.mkdirSync(path.join(sessionPath, "Default", "Local Storage"), {
          recursive: true,
        });
        // Empty Local Storage indicates corruption

        const timer = performanceMetrics.startTimer("recovery_level2");
        const recoveryResult = await performAutomaticRecovery(sessionPath, {
          validateAfterRecovery: true,
          maxRecoveryTime: PERFORMANCE_THRESHOLDS.RECOVERY_COMPLETION,
        });
        const duration = timer.end();

        expect(recoveryResult.success).toBe(true);
        expect(recoveryResult.recoveryLevel).toBe(RECOVERY_LEVELS.LEVEL_2);
        expect(duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.RECOVERY_COMPLETION
        );
        expect(recoveryResult.duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.RECOVERY_COMPLETION
        );
      }, 35000);

      test("should complete Level 3 recovery within 30 seconds", async () => {
        // Create session with major corruption
        const sessionPath = path.join(testSessionPath, "level3");
        fs.mkdirSync(sessionPath, { recursive: true });
        fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });
        fs.mkdirSync(path.join(sessionPath, "Default", "Local Storage"), {
          recursive: true,
        });
        fs.mkdirSync(path.join(sessionPath, "Default", "IndexedDB"), {
          recursive: true,
        });
        // Both directories empty

        const timer = performanceMetrics.startTimer("recovery_level3");
        const recoveryResult = await performAutomaticRecovery(sessionPath, {
          validateAfterRecovery: true,
          maxRecoveryTime: PERFORMANCE_THRESHOLDS.RECOVERY_COMPLETION,
        });
        const duration = timer.end();

        expect(recoveryResult.success).toBe(true);
        expect(recoveryResult.recoveryLevel).toBe(RECOVERY_LEVELS.LEVEL_3);
        expect(duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.RECOVERY_COMPLETION
        );
        expect(recoveryResult.duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.RECOVERY_COMPLETION
        );
      }, 35000);

      test("should complete Level 4 recovery within 30 seconds", async () => {
        // Create session with critical corruption
        const sessionPath = path.join(testSessionPath, "level4");
        fs.mkdirSync(sessionPath, { recursive: true });
        // Missing Default directory entirely

        const timer = performanceMetrics.startTimer("recovery_level4");
        const recoveryResult = await performAutomaticRecovery(sessionPath, {
          validateAfterRecovery: true,
          maxRecoveryTime: PERFORMANCE_THRESHOLDS.RECOVERY_COMPLETION,
        });
        const duration = timer.end();

        expect(recoveryResult.success).toBe(true);
        expect(recoveryResult.recoveryLevel).toBe(RECOVERY_LEVELS.LEVEL_4);
        expect(duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.RECOVERY_COMPLETION
        );
        expect(recoveryResult.duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.RECOVERY_COMPLETION
        );
      }, 35000);
    });

    describe("Git Branch Detection Performance (< 2 seconds)", () => {
      test("should detect git branch within 2 seconds", async () => {
        const timer = performanceMetrics.startTimer("git_detection");
        const gitInfo = await getGitRepositoryInfo();
        const duration = timer.end();

        expect(gitInfo).toBeDefined();
        expect(typeof gitInfo.isRepository).toBe("boolean");
        expect(duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.GIT_BRANCH_DETECTION
        );
      });

      test("should detect branch using different methods within 2 seconds", async () => {
        const detector = new GitBranchDetector();
        const methods = ["git-command", "git-file", "environment"];

        for (const method of methods) {
          const timer = performanceMetrics.startTimer(
            `git_detection_${method}`
          );

          try {
            const branch = await detector.detectBranch(method);
            const duration = timer.end();

            expect(duration).toBeLessThan(
              PERFORMANCE_THRESHOLDS.GIT_BRANCH_DETECTION
            );

            if (branch) {
              expect(typeof branch).toBe("string");
            }
          } catch (error) {
            const duration = timer.end();
            // Even failures should be fast
            expect(duration).toBeLessThan(
              PERFORMANCE_THRESHOLDS.GIT_BRANCH_DETECTION
            );
          }
        }
      });

      test("should handle multiple git operations efficiently", async () => {
        const operations = 5;
        const timer = performanceMetrics.startTimer("multiple_git_operations");

        const promises = [];
        for (let i = 0; i < operations; i++) {
          promises.push(getGitRepositoryInfo());
        }

        const results = await Promise.all(promises);
        const duration = timer.end();

        expect(results.length).toBe(operations);
        expect(duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.GIT_BRANCH_DETECTION * 2
        ); // Allow 2x for multiple
      });
    });
  });

  describe("Component Performance Benchmarks", () => {
    describe("Instance Initialization Performance", () => {
      test("should initialize instance management within 5 seconds", async () => {
        const timer = performanceMetrics.startTimer("instance_initialization");

        const instanceManagement = await initializeInstanceManagement({
          useSharedSession: true,
          consolidateSessions: false, // Skip consolidation for pure init timing
          useStrategyManager: true,
        });

        const duration = timer.end();

        expect(instanceManagement).toBeDefined();
        expect(instanceManagement.instanceId).toBeDefined();
        expect(duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.INSTANCE_INITIALIZATION
        );

        await instanceManagement.lockManager.releaseLock();
      });

      test("should generate instance IDs efficiently", async () => {
        const iterations = 1000;
        const timer = performanceMetrics.startTimer("instance_id_generation");

        const instanceIds = [];
        for (let i = 0; i < iterations; i++) {
          const instanceId = generateInstanceId({
            useSharedSession: false,
            gitBranch: `branch-${i}`,
          });
          instanceIds.push(instanceId);
        }

        const duration = timer.end();

        expect(instanceIds.length).toBe(iterations);
        expect(duration).toBeLessThan(1000); // Should be very fast

        // Verify uniqueness
        const uniqueIds = new Set(instanceIds);
        expect(uniqueIds.size).toBe(iterations);
      });
    });

    describe("Backup Performance", () => {
      test("should create backup within 10 seconds", async () => {
        // Create session with substantial data
        const sessionPath = path.join(testSessionPath, "backup-test");
        fs.mkdirSync(sessionPath, { recursive: true });
        fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });

        // Create multiple files to simulate real session
        for (let i = 0; i < 10; i++) {
          fs.writeFileSync(
            path.join(sessionPath, "Default", `file-${i}.json`),
            JSON.stringify({ data: `test-data-${i}`, size: "x".repeat(1000) })
          );
        }

        const backupManager = new SessionBackupManager();
        const timer = performanceMetrics.startTimer("backup_creation");

        const backupResult = await backupManager.createBackup(sessionPath, {
          reason: "performance-test",
          includeMetadata: true,
        });

        const duration = timer.end();

        expect(backupResult.success).toBe(true);
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BACKUP_CREATION);
      });

      test("should restore backup efficiently", async () => {
        // Create and backup session
        const sessionPath = path.join(testSessionPath, "restore-test");
        fs.mkdirSync(sessionPath, { recursive: true });
        fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });
        fs.writeFileSync(
          path.join(sessionPath, "Default", "Preferences"),
          JSON.stringify({ test: "data" })
        );

        const backupManager = new SessionBackupManager();
        const backupResult = await backupManager.createBackup(sessionPath, {
          reason: "restore-test",
        });

        // Modify session
        fs.writeFileSync(
          path.join(sessionPath, "Default", "Preferences"),
          JSON.stringify({ modified: true })
        );

        const timer = performanceMetrics.startTimer("backup_restore");

        const restoreResult = await backupManager.restoreBackup(
          backupResult.backupPath,
          sessionPath,
          { validateAfterRestore: true }
        );

        const duration = timer.end();

        expect(restoreResult.success).toBe(true);
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BACKUP_CREATION);
      });
    });

    describe("Strategy Migration Performance", () => {
      test("should migrate session strategy within 15 seconds", async () => {
        // Create source session
        const sourceSessionPath = path.join(
          testSessionPath,
          "migration-source"
        );
        fs.mkdirSync(sourceSessionPath, { recursive: true });
        fs.mkdirSync(path.join(sourceSessionPath, "Default"), {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(sourceSessionPath, "Default", "Preferences"),
          JSON.stringify({ authenticated: true })
        );

        const gitInfo = await getGitRepositoryInfo();
        const strategyManager = createSessionStrategyManager({
          gitInfo,
          baseSessionPath: testSessionPath,
          enableAutoMigration: true,
          enableMigrationBackup: true,
        });

        const timer = performanceMetrics.startTimer("strategy_migration");

        const migrationResult = await strategyManager.migrateSession(
          "individual",
          "shared",
          {
            sourceSessionPath,
            createBackup: true,
            validateAfterMigration: true,
          }
        );

        const duration = timer.end();

        expect(migrationResult.success).toBe(true);
        expect(duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.STRATEGY_MIGRATION
        );
      });
    });

    describe("Diagnostic Generation Performance", () => {
      test("should generate diagnostic report within 3 seconds", async () => {
        // Create multiple test sessions
        for (let i = 0; i < 5; i++) {
          const sessionPath = path.join(testSessionPath, `diag-session-${i}`);
          fs.mkdirSync(sessionPath, { recursive: true });
          fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });
        }

        const timer = performanceMetrics.startTimer("diagnostic_generation");

        const diagnosticReport = generateDiagnosticReport({
          baseDirectory: testSessionPath,
          includeSystemInfo: true,
          includeEnvironmentInfo: true,
          validateAllSessions: true,
        });

        const duration = timer.end();

        expect(diagnosticReport).toBeDefined();
        expect(diagnosticReport.summary).toBeDefined();
        expect(duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.DIAGNOSTIC_GENERATION
        );
      });

      test("should discover sessions efficiently", async () => {
        // Create many session directories
        const sessionCount = 50;
        for (let i = 0; i < sessionCount; i++) {
          const sessionPath = path.join(
            testSessionPath,
            `wa_test_${i.toString().padStart(8, "0")}`
          );
          fs.mkdirSync(sessionPath, { recursive: true });
        }

        const timer = performanceMetrics.startTimer("session_discovery");
        const discoveredSessions = discoverSessionDirectories(testSessionPath);
        const duration = timer.end();

        expect(discoveredSessions.length).toBe(sessionCount);
        expect(duration).toBeLessThan(2000); // Should be very fast
      });
    });
  });

  describe("Memory and Resource Performance", () => {
    test("should not leak memory during repeated operations", async () => {
      const iterations = 100;
      const initialMemory = process.memoryUsage();

      for (let i = 0; i < iterations; i++) {
        // Perform various operations
        const instanceId = generateInstanceId({
          useSharedSession: false,
          gitBranch: `test-${i}`,
        });

        const sessionPath = path.join(testSessionPath, `memory-test-${i}`);
        fs.mkdirSync(sessionPath, { recursive: true });

        const validation = quickValidateSession(sessionPath);

        // Cleanup immediately
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test("should handle concurrent operations efficiently", async () => {
      const concurrentOperations = 10;
      const timer = performanceMetrics.startTimer("concurrent_operations");

      const promises = [];
      for (let i = 0; i < concurrentOperations; i++) {
        promises.push(
          (async () => {
            const sessionPath = path.join(testSessionPath, `concurrent-${i}`);
            fs.mkdirSync(sessionPath, { recursive: true });
            fs.mkdirSync(path.join(sessionPath, "Default"), {
              recursive: true,
            });

            const validation = validateSessionData(sessionPath);
            return validation;
          })()
        );
      }

      const results = await Promise.all(promises);
      const duration = timer.end();

      expect(results.length).toBe(concurrentOperations);
      expect(results.every((r) => r.isValid)).toBe(true);
      expect(duration).toBeLessThan(
        PERFORMANCE_THRESHOLDS.SESSION_VALIDATION * 2
      );
    });
  });

  describe("Stress Testing", () => {
    test("should handle large session directories", async () => {
      // Create session with many files
      const largeSessionPath = path.join(testSessionPath, "large-session");
      fs.mkdirSync(largeSessionPath, { recursive: true });
      fs.mkdirSync(path.join(largeSessionPath, "Default"), { recursive: true });

      // Create many files
      for (let i = 0; i < 100; i++) {
        fs.writeFileSync(
          path.join(largeSessionPath, "Default", `file-${i}.txt`),
          `content-${i}`
        );
      }

      const timer = performanceMetrics.startTimer("large_session_validation");
      const validation = validateSessionData(largeSessionPath);
      const duration = timer.end();

      expect(validation.isValid).toBe(true);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SESSION_VALIDATION);
    });

    test("should handle rapid successive operations", async () => {
      const rapidOperations = 50;
      const timer = performanceMetrics.startTimer("rapid_operations");

      for (let i = 0; i < rapidOperations; i++) {
        const sessionPath = path.join(testSessionPath, `rapid-${i}`);
        fs.mkdirSync(sessionPath, { recursive: true });

        const validation = quickValidateSession(sessionPath);
        expect(typeof validation).toBe("boolean");

        fs.rmSync(sessionPath, { recursive: true, force: true });
      }

      const duration = timer.end();
      expect(duration).toBeLessThan(5000); // Should complete rapidly
    });
  });
});
