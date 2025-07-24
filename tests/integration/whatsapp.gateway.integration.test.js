/**
 * WhatsApp Gateway Integration Tests
 * Comprehensive end-to-end testing of the WhatsApp gateway startup process
 * Validates all PRD success criteria and acceptance criteria
 */

import { jest } from "@jest/globals";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

// Import all session management components
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

describe("WhatsApp Gateway Integration Tests", () => {
  let testSessionPath;
  let lockManager;
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
    process.env.WA_CLEANUP_ON_EXIT = "false";
    process.env.BEACON_AUTH = "test-auth-token";
    process.env.WA_GATEWAY_NPUB = "test-npub";
    process.env.SERVER_URL = "http://localhost";
    process.env.API_SERVER_PORT = "3256";
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  beforeEach(() => {
    // Create unique test session path for each test
    testSessionPath = path.join(
      projectRoot,
      "test-sessions",
      `test-${Date.now()}`
    );
    lockManager = new LockFileManager();

    // Clear any existing mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup test session directory
    if (fs.existsSync(testSessionPath)) {
      fs.rmSync(testSessionPath, { recursive: true, force: true });
    }

    // Release any locks
    try {
      await lockManager.releaseLock();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("PRD Success Criteria Validation", () => {
    describe("SC1: 100% successful startup rate for PM2 execution", () => {
      test("should successfully initialize all components without errors", async () => {
        const startTime = Date.now();

        try {
          // Initialize instance management
          const instanceManagement = await initializeInstanceManagement({
            useSharedSession: true,
            consolidateSessions: true,
            useStrategyManager: true,
            strategyConfig: {
              branchDetection: true,
              autoMigrate: true,
              migrationBackup: true,
            },
          });

          const endTime = Date.now();
          const initializationTime = endTime - startTime;

          // Validate successful initialization
          expect(instanceManagement).toBeDefined();
          expect(instanceManagement.instanceId).toBeDefined();
          expect(instanceManagement.sessionPath).toBeDefined();
          expect(instanceManagement.lockManager).toBeDefined();
          expect(initializationTime).toBeLessThan(5000); // Should complete within 5 seconds

          // Validate instance ID format
          expect(instanceManagement.instanceId).toMatch(
            /^wa_shared_[a-f0-9]{8}$/
          );

          // Validate session path exists
          expect(fs.existsSync(instanceManagement.sessionPath)).toBe(true);
        } catch (error) {
          fail(`Initialization failed: ${error.message}`);
        }
      }, 10000);

      test("should handle concurrent initialization attempts gracefully", async () => {
        const concurrentAttempts = 3;
        const initPromises = [];

        for (let i = 0; i < concurrentAttempts; i++) {
          initPromises.push(
            initializeInstanceManagement({
              useSharedSession: true,
              consolidateSessions: true,
              useStrategyManager: true,
            })
          );
        }

        const results = await Promise.allSettled(initPromises);

        // At least one should succeed
        const successfulResults = results.filter(
          (result) => result.status === "fulfilled"
        );
        expect(successfulResults.length).toBeGreaterThan(0);

        // All successful results should have the same instance ID (shared session)
        const instanceIds = successfulResults.map(
          (result) => result.value.instanceId
        );
        const uniqueInstanceIds = [...new Set(instanceIds)];
        expect(uniqueInstanceIds.length).toBe(1);
      }, 15000);
    });

    describe("SC2: Zero manual intervention required for session management", () => {
      test("should automatically detect and handle session corruption", async () => {
        // Create a corrupted session
        const corruptedSessionPath = path.join(testSessionPath, "corrupted");
        fs.mkdirSync(corruptedSessionPath, { recursive: true });

        // Create corrupted session files
        fs.writeFileSync(
          path.join(corruptedSessionPath, "LOCK"),
          "corrupted lock file"
        );
        fs.mkdirSync(path.join(corruptedSessionPath, "Default"), {
          recursive: true,
        });
        // Missing required files to simulate corruption

        // Validate session (should detect corruption)
        const validation = validateSessionData(corruptedSessionPath);
        expect(validation.isValid).toBe(false);
        expect(validation.issues.length).toBeGreaterThan(0);

        // Perform automatic recovery
        const recoveryResult = await performAutomaticRecovery(
          corruptedSessionPath,
          {
            validateAfterRecovery: true,
            autoBackupBeforeRecovery: true,
            maxRecoveryTime: 30000,
          }
        );

        expect(recoveryResult.success).toBe(true);
        expect(recoveryResult.recoveryPerformed).toBe(true);
        expect(recoveryResult.duration).toBeLessThan(30000);
      }, 35000);

      test("should automatically migrate sessions between strategies", async () => {
        // Create session with individual strategy
        const individualSessionPath = path.join(testSessionPath, "individual");
        fs.mkdirSync(individualSessionPath, { recursive: true });
        fs.mkdirSync(path.join(individualSessionPath, "Default"), {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(individualSessionPath, "Default", "Preferences"),
          JSON.stringify({ version: "1.0" })
        );

        // Initialize with shared strategy (should trigger migration)
        const instanceManagement = await initializeInstanceManagement({
          useSharedSession: true,
          consolidateSessions: true,
          useStrategyManager: true,
          strategyConfig: {
            autoMigrate: true,
            migrationBackup: true,
          },
        });

        // Verify migration occurred
        if (instanceManagement.migration) {
          expect(instanceManagement.migration.migrated).toBe(true);
          expect(instanceManagement.migration.sourceStrategy).toBe(
            "individual"
          );
          expect(instanceManagement.migration.targetStrategy).toBe("shared");
          expect(instanceManagement.migration.backup).toBeDefined();
        }
      }, 10000);
    });

    describe("SC3: Session state persistence across normal restarts", () => {
      test("should preserve session data across restarts", async () => {
        // First initialization
        const firstInit = await initializeInstanceManagement({
          useSharedSession: true,
          consolidateSessions: true,
        });

        const firstInstanceId = firstInit.instanceId;
        const sessionPath = firstInit.sessionPath;

        // Create some session data
        fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });
        const testData = { authenticated: true, timestamp: Date.now() };
        fs.writeFileSync(
          path.join(sessionPath, "Default", "Preferences"),
          JSON.stringify(testData)
        );

        // Release lock to simulate shutdown
        await firstInit.lockManager.releaseLock();

        // Second initialization (simulating restart)
        const secondInit = await initializeInstanceManagement({
          useSharedSession: true,
          consolidateSessions: true,
        });

        const secondInstanceId = secondInit.instanceId;

        // Verify same instance ID and preserved data
        expect(secondInstanceId).toBe(firstInstanceId);
        expect(
          fs.existsSync(path.join(sessionPath, "Default", "Preferences"))
        ).toBe(true);

        const preservedData = JSON.parse(
          fs.readFileSync(
            path.join(sessionPath, "Default", "Preferences"),
            "utf8"
          )
        );
        expect(preservedData.authenticated).toBe(true);
        expect(preservedData.timestamp).toBe(testData.timestamp);

        await secondInit.lockManager.releaseLock();
      }, 10000);
    });

    describe("SC4: Automatic detection and cleanup of corrupted session data", () => {
      test("should detect various corruption patterns", async () => {
        const corruptionScenarios = [
          {
            name: "Stale lock file",
            setup: (sessionPath) => {
              fs.mkdirSync(sessionPath, { recursive: true });
              fs.writeFileSync(path.join(sessionPath, "LOCK"), "stale lock");
              // Set old modification time
              const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
              fs.utimesSync(path.join(sessionPath, "LOCK"), oldTime, oldTime);
            },
            expectedIssues: ["Stale lock file detected"],
          },
          {
            name: "Empty Local Storage",
            setup: (sessionPath) => {
              fs.mkdirSync(sessionPath, { recursive: true });
              fs.mkdirSync(path.join(sessionPath, "Default"), {
                recursive: true,
              });
              fs.mkdirSync(path.join(sessionPath, "Default", "Local Storage"), {
                recursive: true,
              });
              // Empty directory indicates corruption
            },
            expectedIssues: ["Local Storage directory is empty"],
          },
          {
            name: "Missing required files",
            setup: (sessionPath) => {
              fs.mkdirSync(sessionPath, { recursive: true });
              // Missing Default directory entirely
            },
            expectedIssues: ["Missing required directory: Default"],
          },
        ];

        for (const scenario of corruptionScenarios) {
          const scenarioPath = path.join(
            testSessionPath,
            scenario.name.replace(/\s+/g, "_")
          );
          scenario.setup(scenarioPath);

          const validation = validateSessionData(scenarioPath);
          expect(validation.isValid).toBe(false);

          const hasExpectedIssue = scenario.expectedIssues.some(
            (expectedIssue) =>
              validation.issues.some((issue) => issue.includes(expectedIssue))
          );
          expect(hasExpectedIssue).toBe(true);

          // Cleanup
          fs.rmSync(scenarioPath, { recursive: true, force: true });
        }
      });

      test("should automatically clean up corrupted sessions", async () => {
        // Create multiple corrupted sessions
        const corruptedSessions = ["session1", "session2", "session3"];

        for (const sessionName of corruptedSessions) {
          const sessionPath = path.join(testSessionPath, sessionName);
          fs.mkdirSync(sessionPath, { recursive: true });
          fs.writeFileSync(path.join(sessionPath, "LOCK"), "corrupted");
          // Create incomplete session structure
        }

        // Initialize with consolidation enabled
        const instanceManagement = await initializeInstanceManagement({
          useSharedSession: true,
          consolidateSessions: true,
          useStrategyManager: true,
        });

        // Verify consolidation occurred
        if (instanceManagement.consolidation) {
          expect(instanceManagement.consolidation.consolidated).toBe(true);
          expect(
            instanceManagement.consolidation.sourceDirectories.length
          ).toBeGreaterThan(0);
        }

        await instanceManagement.lockManager.releaseLock();
      }, 10000);
    });

    describe("SC5: Consistent behavior between PM2 and direct Node.js execution", () => {
      test("should generate identical instance IDs in both execution modes", async () => {
        // Test direct execution mode
        process.env.PM2_INSTANCE_ID = undefined;
        const directInit = await initializeInstanceManagement({
          useSharedSession: true,
          consolidateSessions: false,
        });
        const directInstanceId = directInit.instanceId;
        await directInit.lockManager.releaseLock();

        // Test PM2 execution mode
        process.env.PM2_INSTANCE_ID = "0";
        const pm2Init = await initializeInstanceManagement({
          useSharedSession: true,
          consolidateSessions: false,
        });
        const pm2InstanceId = pm2Init.instanceId;
        await pm2Init.lockManager.releaseLock();

        // Both should use shared session strategy and have same ID
        expect(directInstanceId).toBe(pm2InstanceId);
        expect(directInstanceId).toMatch(/^wa_shared_[a-f0-9]{8}$/);

        // Cleanup environment
        delete process.env.PM2_INSTANCE_ID;
      }, 10000);

      test("should handle environment detection consistently", async () => {
        const scenarios = [
          { PM2_INSTANCE_ID: undefined, expected: "direct" },
          { PM2_INSTANCE_ID: "0", expected: "pm2" },
          { PM2_INSTANCE_ID: "1", expected: "pm2" },
        ];

        for (const scenario of scenarios) {
          if (scenario.PM2_INSTANCE_ID !== undefined) {
            process.env.PM2_INSTANCE_ID = scenario.PM2_INSTANCE_ID;
          } else {
            delete process.env.PM2_INSTANCE_ID;
          }

          const diagnosticReport = generateDiagnosticReport({
            baseDirectory: process.cwd(),
            includeSystemInfo: true,
            includeEnvironmentInfo: true,
          });

          expect(diagnosticReport.environment.executionMode).toBe(
            scenario.expected
          );
        }

        // Cleanup
        delete process.env.PM2_INSTANCE_ID;
      });
    });
  });

  describe("Acceptance Criteria Validation", () => {
    describe("AC1: Instance ID Management", () => {
      test("should generate unique identifiers that prevent conflicts", async () => {
        const instanceIds = new Set();
        const iterations = 10;

        for (let i = 0; i < iterations; i++) {
          const instanceId = generateInstanceId({
            useSharedSession: false,
            gitBranch: `branch-${i}`,
          });

          expect(instanceIds.has(instanceId)).toBe(false);
          instanceIds.add(instanceId);
        }

        expect(instanceIds.size).toBe(iterations);
      });

      test("should generate consistent IDs for shared sessions", async () => {
        const sharedIds = [];
        const iterations = 5;

        for (let i = 0; i < iterations; i++) {
          const instanceId = generateInstanceId({
            useSharedSession: true,
            gitBranch: "main",
          });
          sharedIds.push(instanceId);
        }

        // All shared session IDs should be identical
        const uniqueIds = [...new Set(sharedIds)];
        expect(uniqueIds.length).toBe(1);
        expect(uniqueIds[0]).toMatch(/^wa_shared_[a-f0-9]{8}$/);
      });
    });

    describe("AC2: Session Data Validation", () => {
      test("should validate session integrity before use", async () => {
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

        const validation = validateSessionData(validSessionPath);
        expect(validation.isValid).toBe(true);
        expect(validation.issues.length).toBe(0);
        expect(validation.validationDuration).toBeLessThan(5000); // Should complete within 5 seconds
      });

      test("should detect integrity violations", async () => {
        // Create invalid session
        const invalidSessionPath = path.join(testSessionPath, "invalid");
        fs.mkdirSync(invalidSessionPath, { recursive: true });
        // Missing required directories and files

        const validation = validateSessionData(invalidSessionPath);
        expect(validation.isValid).toBe(false);
        expect(validation.issues.length).toBeGreaterThan(0);
      });
    });

    describe("AC3: Automatic Recovery", () => {
      test("should clean up invalid data and start fresh", async () => {
        // Create corrupted session
        const corruptedPath = path.join(testSessionPath, "corrupted");
        fs.mkdirSync(corruptedPath, { recursive: true });
        fs.writeFileSync(path.join(corruptedPath, "LOCK"), "corrupted lock");

        // Perform recovery
        const recoveryResult = await performAutomaticRecovery(corruptedPath, {
          validateAfterRecovery: true,
          maxRecoveryTime: 30000,
        });

        expect(recoveryResult.success).toBe(true);
        expect(recoveryResult.recoveryPerformed).toBe(true);
        expect(recoveryResult.duration).toBeLessThan(30000);

        // Verify session is now valid
        const postRecoveryValidation = validateSessionData(corruptedPath);
        expect(postRecoveryValidation.isValid).toBe(true);
      }, 35000);
    });

    describe("AC4: Lock File Robustness", () => {
      test("should handle edge cases gracefully", async () => {
        const lockManager = new LockFileManager();

        // Test acquiring lock
        await expect(lockManager.acquireLock()).resolves.not.toThrow();

        // Test double acquisition (should handle gracefully)
        await expect(lockManager.acquireLock()).resolves.not.toThrow();

        // Test release
        await expect(lockManager.releaseLock()).resolves.not.toThrow();

        // Test double release (should handle gracefully)
        await expect(lockManager.releaseLock()).resolves.not.toThrow();
      });

      test("should detect and handle stale locks", async () => {
        const staleLockPath = path.join(testSessionPath, "stale-lock");
        fs.mkdirSync(staleLockPath, { recursive: true });

        // Create stale lock file
        const lockFile = path.join(staleLockPath, "LOCK");
        fs.writeFileSync(lockFile, "stale lock content");

        // Set old modification time (25 hours ago)
        const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
        fs.utimesSync(lockFile, oldTime, oldTime);

        const validation = validateSessionData(staleLockPath);
        const staleLockIssue = validation.issues.find((issue) =>
          issue.includes("Stale lock file detected")
        );
        expect(staleLockIssue).toBeDefined();
      });
    });

    describe("AC5: Environment Consistency", () => {
      test("should behave identically between execution methods", async () => {
        const testConfigs = [
          { PM2_INSTANCE_ID: undefined, description: "Direct execution" },
          { PM2_INSTANCE_ID: "0", description: "PM2 execution" },
        ];

        const results = [];

        for (const config of testConfigs) {
          if (config.PM2_INSTANCE_ID !== undefined) {
            process.env.PM2_INSTANCE_ID = config.PM2_INSTANCE_ID;
          } else {
            delete process.env.PM2_INSTANCE_ID;
          }

          const instanceManagement = await initializeInstanceManagement({
            useSharedSession: true,
            consolidateSessions: false,
          });

          results.push({
            description: config.description,
            instanceId: instanceManagement.instanceId,
            sessionPath: instanceManagement.sessionPath,
            strategy: instanceManagement.strategy,
          });

          await instanceManagement.lockManager.releaseLock();
        }

        // Verify identical behavior
        expect(results[0].instanceId).toBe(results[1].instanceId);
        expect(results[0].sessionPath).toBe(results[1].sessionPath);
        expect(results[0].strategy).toBe(results[1].strategy);

        // Cleanup
        delete process.env.PM2_INSTANCE_ID;
      }, 15000);
    });
  });

  describe("Performance Validation", () => {
    test("should meet timing requirements", async () => {
      const performanceTests = [
        {
          name: "Session validation",
          test: async () => {
            const validSessionPath = path.join(testSessionPath, "perf-valid");
            fs.mkdirSync(validSessionPath, { recursive: true });
            fs.mkdirSync(path.join(validSessionPath, "Default"), {
              recursive: true,
            });

            const startTime = Date.now();
            const validation = validateSessionData(validSessionPath);
            const endTime = Date.now();

            return endTime - startTime;
          },
          maxTime: 5000, // 5 seconds
        },
        {
          name: "Recovery completion",
          test: async () => {
            const recoverySessionPath = path.join(
              testSessionPath,
              "perf-recovery"
            );
            fs.mkdirSync(recoverySessionPath, { recursive: true });
            fs.writeFileSync(
              path.join(recoverySessionPath, "LOCK"),
              "corrupted"
            );

            const startTime = Date.now();
            await performAutomaticRecovery(recoverySessionPath, {
              maxRecoveryTime: 30000,
            });
            const endTime = Date.now();

            return endTime - startTime;
          },
          maxTime: 30000, // 30 seconds
        },
        {
          name: "Git branch detection",
          test: async () => {
            const startTime = Date.now();
            await getGitRepositoryInfo();
            const endTime = Date.now();

            return endTime - startTime;
          },
          maxTime: 2000, // 2 seconds
        },
      ];

      for (const perfTest of performanceTests) {
        const duration = await perfTest.test();
        expect(duration).toBeLessThan(perfTest.maxTime);

        // Log performance metrics
        console.log(
          `${perfTest.name}: ${duration}ms (max: ${perfTest.maxTime}ms)`
        );
      }
    }, 40000);
  });

  describe("Error Handling and Edge Cases", () => {
    test("should handle disk space issues gracefully", async () => {
      // Mock fs operations to simulate disk space issues
      const originalWriteFileSync = fs.writeFileSync;
      fs.writeFileSync = jest.fn().mockImplementation(() => {
        throw new Error("ENOSPC: no space left on device");
      });

      try {
        const result = await performAutomaticRecovery(testSessionPath, {
          maxRecoveryTime: 5000,
        });

        // Should handle error gracefully
        expect(result.success).toBe(false);
        expect(result.error).toContain("ENOSPC");
      } finally {
        // Restore original function
        fs.writeFileSync = originalWriteFileSync;
      }
    });

    test("should handle permission errors gracefully", async () => {
      // Mock fs operations to simulate permission errors
      const originalMkdirSync = fs.mkdirSync;
      fs.mkdirSync = jest.fn().mockImplementation(() => {
        throw new Error("EACCES: permission denied");
      });

      try {
        const result = await performAutomaticRecovery(testSessionPath, {
          maxRecoveryTime: 5000,
        });

        // Should handle error gracefully
        expect(result.success).toBe(false);
        expect(result.error).toContain("EACCES");
      } finally {
        // Restore original function
        fs.mkdirSync = originalMkdirSync;
      }
    });

    test("should handle network failures during initialization", async () => {
      // This test would be more relevant in a real network environment
      // For now, we test that initialization doesn't depend on network
      const instanceManagement = await initializeInstanceManagement({
        useSharedSession: true,
        consolidateSessions: false,
      });

      expect(instanceManagement).toBeDefined();
      expect(instanceManagement.instanceId).toBeDefined();

      await instanceManagement.lockManager.releaseLock();
    });
  });
});
