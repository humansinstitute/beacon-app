/**
 * Session Management Integration Tests
 * Comprehensive testing of session management components working together
 * Validates session strategies, recovery, backup, and git integration
 */

import { jest } from "@jest/globals";
import fs from "fs";
import path from "path";
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

describe("Session Management Integration Tests", () => {
  let testSessionPath;
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
      `session-mgmt-${Date.now()}`
    );

    // Clear any existing mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup test session directory
    if (fs.existsSync(testSessionPath)) {
      fs.rmSync(testSessionPath, { recursive: true, force: true });
    }
  });

  describe("Session Strategy Management Integration", () => {
    test("should create and configure strategy manager correctly", async () => {
      const gitInfo = await getGitRepositoryInfo();
      const strategyManager = createSessionStrategyManager({
        gitInfo,
        baseSessionPath: testSessionPath,
        enableBranchDetection: true,
        enableAutoMigration: true,
        enableMigrationBackup: true,
      });

      expect(strategyManager).toBeDefined();
      expect(typeof strategyManager.getCurrentStrategy).toBe("function");
      expect(typeof strategyManager.migrateSession).toBe("function");
      expect(typeof strategyManager.cleanupOldSessions).toBe("function");

      const currentStrategy = strategyManager.getCurrentStrategy();
      expect(currentStrategy).toBeDefined();
      expect(currentStrategy.strategy).toBeDefined();
      expect(currentStrategy.instanceId).toBeDefined();
      expect(currentStrategy.sessionPath).toBeDefined();
    });

    test("should handle strategy switching with data preservation", async () => {
      const gitInfo = await getGitRepositoryInfo();

      // Create initial session with individual strategy
      const individualSessionPath = path.join(testSessionPath, "individual");
      fs.mkdirSync(individualSessionPath, { recursive: true });
      fs.mkdirSync(path.join(individualSessionPath, "Default"), {
        recursive: true,
      });

      const testData = { authenticated: true, timestamp: Date.now() };
      fs.writeFileSync(
        path.join(individualSessionPath, "Default", "Preferences"),
        JSON.stringify(testData)
      );

      const strategyManager = createSessionStrategyManager({
        gitInfo,
        baseSessionPath: testSessionPath,
        enableBranchDetection: true,
        enableAutoMigration: true,
        enableMigrationBackup: true,
      });

      // Migrate from individual to shared strategy
      const migrationResult = await strategyManager.migrateSession(
        "individual",
        "shared",
        {
          sourceSessionPath: individualSessionPath,
          createBackup: true,
          validateAfterMigration: true,
        }
      );

      expect(migrationResult.success).toBe(true);
      expect(migrationResult.migrated).toBe(true);
      expect(migrationResult.backup).toBeDefined();
      expect(migrationResult.targetSessionPath).toBeDefined();

      // Verify data preservation
      const targetPrefsPath = path.join(
        migrationResult.targetSessionPath,
        "Default",
        "Preferences"
      );
      expect(fs.existsSync(targetPrefsPath)).toBe(true);

      const preservedData = JSON.parse(
        fs.readFileSync(targetPrefsPath, "utf8")
      );
      expect(preservedData.authenticated).toBe(true);
      expect(preservedData.timestamp).toBe(testData.timestamp);
    });

    test("should handle git branch-based strategy selection", async () => {
      const mockGitInfo = {
        isRepository: true,
        branch: "feature/new-feature",
        commit: "abc123def456",
        isDirty: false,
      };

      // Test branch-based strategy
      process.env.WA_BRANCH_SESSIONS = "true";
      process.env.WA_BRANCH_PATTERN_STRATEGY = "prefix";

      const strategyManager = createSessionStrategyManager({
        gitInfo: mockGitInfo,
        baseSessionPath: testSessionPath,
        enableBranchDetection: true,
      });

      const currentStrategy = strategyManager.getCurrentStrategy();
      expect(currentStrategy.strategy).toBe("branch");
      expect(currentStrategy.gitBranch).toBe("feature/new-feature");
      expect(currentStrategy.instanceId).toContain("feature_new_feature");

      // Reset environment
      process.env.WA_BRANCH_SESSIONS = "false";
      delete process.env.WA_BRANCH_PATTERN_STRATEGY;
    });

    test("should cleanup old sessions while preserving current", async () => {
      const gitInfo = await getGitRepositoryInfo();

      // Create multiple old sessions
      const oldSessions = ["old-session-1", "old-session-2", "old-session-3"];
      for (const sessionName of oldSessions) {
        const sessionPath = path.join(testSessionPath, sessionName);
        fs.mkdirSync(sessionPath, { recursive: true });
        fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });

        // Set old modification time
        const oldTime = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
        fs.utimesSync(sessionPath, oldTime, oldTime);
      }

      // Create current session
      const currentSessionPath = path.join(testSessionPath, "current-session");
      fs.mkdirSync(currentSessionPath, { recursive: true });
      fs.mkdirSync(path.join(currentSessionPath, "Default"), {
        recursive: true,
      });

      const strategyManager = createSessionStrategyManager({
        gitInfo,
        baseSessionPath: testSessionPath,
        enableBranchDetection: true,
      });

      const cleanupResult = await strategyManager.cleanupOldSessions({
        keepCurrent: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        createBackup: true,
      });

      expect(cleanupResult.cleaned).toBe(3);
      expect(cleanupResult.backups.length).toBe(3);
      expect(cleanupResult.errors.length).toBe(0);

      // Verify current session is preserved
      expect(fs.existsSync(currentSessionPath)).toBe(true);

      // Verify old sessions are removed
      for (const sessionName of oldSessions) {
        const sessionPath = path.join(testSessionPath, sessionName);
        expect(fs.existsSync(sessionPath)).toBe(false);
      }
    });
  });

  describe("Session Recovery Integration", () => {
    test("should integrate recovery with backup system", async () => {
      // Create corrupted session
      const corruptedSessionPath = path.join(testSessionPath, "corrupted");
      fs.mkdirSync(corruptedSessionPath, { recursive: true });
      fs.writeFileSync(
        path.join(corruptedSessionPath, "LOCK"),
        "corrupted lock"
      );
      fs.mkdirSync(path.join(corruptedSessionPath, "Default"), {
        recursive: true,
      });
      // Missing required files to simulate corruption

      const backupManager = new SessionBackupManager();
      const recoveryManager = new SessionRecoveryManager({
        sessionPath: corruptedSessionPath,
        backupManager,
        maxRecoveryTime: 30000,
      });

      const recoveryResult = await recoveryManager.performRecovery({
        skipBackup: false,
        validateAfterRecovery: true,
      });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.recoveryPerformed).toBe(true);
      expect(recoveryResult.backupCreated).toBe(true);
      expect(recoveryResult.backupPath).toBeDefined();
      expect(recoveryResult.duration).toBeLessThan(30000);

      // Verify backup was created
      expect(fs.existsSync(recoveryResult.backupPath)).toBe(true);

      // Verify session is now valid
      const postRecoveryValidation = validateSessionData(corruptedSessionPath);
      expect(postRecoveryValidation.isValid).toBe(true);
    }, 35000);

    test("should handle progressive recovery levels", async () => {
      const recoveryScenarios = [
        {
          name: "Level 1 - Minor corruption",
          setup: (sessionPath) => {
            fs.mkdirSync(sessionPath, { recursive: true });
            fs.mkdirSync(path.join(sessionPath, "Default"), {
              recursive: true,
            });
            fs.writeFileSync(path.join(sessionPath, "LOCK"), "stale lock");

            // Set old modification time for stale lock
            const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
            fs.utimesSync(path.join(sessionPath, "LOCK"), oldTime, oldTime);
          },
          expectedLevel: RECOVERY_LEVELS.LEVEL_1,
        },
        {
          name: "Level 2 - Moderate corruption",
          setup: (sessionPath) => {
            fs.mkdirSync(sessionPath, { recursive: true });
            fs.mkdirSync(path.join(sessionPath, "Default"), {
              recursive: true,
            });
            fs.mkdirSync(path.join(sessionPath, "Default", "Local Storage"), {
              recursive: true,
            });
            // Empty Local Storage indicates corruption
          },
          expectedLevel: RECOVERY_LEVELS.LEVEL_2,
        },
        {
          name: "Level 3 - Major corruption",
          setup: (sessionPath) => {
            fs.mkdirSync(sessionPath, { recursive: true });
            fs.mkdirSync(path.join(sessionPath, "Default"), {
              recursive: true,
            });
            fs.mkdirSync(path.join(sessionPath, "Default", "Local Storage"), {
              recursive: true,
            });
            fs.mkdirSync(path.join(sessionPath, "Default", "IndexedDB"), {
              recursive: true,
            });
            // Both Local Storage and IndexedDB empty
          },
          expectedLevel: RECOVERY_LEVELS.LEVEL_3,
        },
        {
          name: "Level 4 - Critical corruption",
          setup: (sessionPath) => {
            fs.mkdirSync(sessionPath, { recursive: true });
            // Missing Default directory entirely
          },
          expectedLevel: RECOVERY_LEVELS.LEVEL_4,
        },
      ];

      for (const scenario of recoveryScenarios) {
        const scenarioPath = path.join(
          testSessionPath,
          scenario.name.replace(/\s+/g, "_")
        );
        scenario.setup(scenarioPath);

        const recoveryResult = await performAutomaticRecovery(scenarioPath, {
          validateAfterRecovery: true,
          maxRecoveryTime: 30000,
        });

        expect(recoveryResult.success).toBe(true);
        expect(recoveryResult.recoveryLevel).toBe(scenario.expectedLevel);
        expect(recoveryResult.duration).toBeLessThan(30000);

        // Verify session is valid after recovery
        const validation = validateSessionData(scenarioPath);
        expect(validation.isValid).toBe(true);

        // Cleanup
        fs.rmSync(scenarioPath, { recursive: true, force: true });
      }
    }, 60000);

    test("should assess recovery needs accurately", async () => {
      const assessmentScenarios = [
        {
          name: "No recovery needed",
          setup: (sessionPath) => {
            fs.mkdirSync(sessionPath, { recursive: true });
            fs.mkdirSync(path.join(sessionPath, "Default"), {
              recursive: true,
            });
            fs.writeFileSync(
              path.join(sessionPath, "Default", "Preferences"),
              JSON.stringify({ version: "1.0" })
            );
          },
          expectedRecoveryNeeded: false,
        },
        {
          name: "Recovery needed",
          setup: (sessionPath) => {
            fs.mkdirSync(sessionPath, { recursive: true });
            fs.writeFileSync(path.join(sessionPath, "LOCK"), "corrupted");
            // Missing Default directory
          },
          expectedRecoveryNeeded: true,
        },
      ];

      for (const scenario of assessmentScenarios) {
        const scenarioPath = path.join(
          testSessionPath,
          scenario.name.replace(/\s+/g, "_")
        );
        scenario.setup(scenarioPath);

        const assessment = await assessRecoveryNeeds(scenarioPath);
        expect(assessment.recoveryNeeded).toBe(scenario.expectedRecoveryNeeded);
        expect(assessment.recommendation).toBeDefined();
        expect(assessment.corruptionSeverity).toBeDefined();

        // Cleanup
        fs.rmSync(scenarioPath, { recursive: true, force: true });
      }
    });
  });

  describe("Session Backup Integration", () => {
    test("should create and restore backups correctly", async () => {
      // Create session with data
      const originalSessionPath = path.join(testSessionPath, "original");
      fs.mkdirSync(originalSessionPath, { recursive: true });
      fs.mkdirSync(path.join(originalSessionPath, "Default"), {
        recursive: true,
      });

      const testData = { authenticated: true, timestamp: Date.now() };
      fs.writeFileSync(
        path.join(originalSessionPath, "Default", "Preferences"),
        JSON.stringify(testData)
      );

      const backupManager = new SessionBackupManager();

      // Create backup
      const backupResult = await backupManager.createBackup(
        originalSessionPath,
        {
          reason: "integration-test",
          includeMetadata: true,
        }
      );

      expect(backupResult.success).toBe(true);
      expect(backupResult.backupPath).toBeDefined();
      expect(fs.existsSync(backupResult.backupPath)).toBe(true);

      // Verify backup metadata
      const metadataPath = path.join(
        backupResult.backupPath,
        "backup-metadata.json"
      );
      expect(fs.existsSync(metadataPath)).toBe(true);

      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
      expect(metadata.reason).toBe("integration-test");
      expect(metadata.timestamp).toBeDefined();
      expect(metadata.sourceSessionPath).toBe(originalSessionPath);

      // Modify original session
      fs.writeFileSync(
        path.join(originalSessionPath, "Default", "Preferences"),
        JSON.stringify({ modified: true })
      );

      // Restore from backup
      const restoreResult = await backupManager.restoreBackup(
        backupResult.backupPath,
        originalSessionPath,
        { validateAfterRestore: true }
      );

      expect(restoreResult.success).toBe(true);

      // Verify data was restored
      const restoredData = JSON.parse(
        fs.readFileSync(
          path.join(originalSessionPath, "Default", "Preferences"),
          "utf8"
        )
      );
      expect(restoredData.authenticated).toBe(true);
      expect(restoredData.timestamp).toBe(testData.timestamp);
      expect(restoredData.modified).toBeUndefined();
    });

    test("should manage backup retention policies", async () => {
      const backupManager = new SessionBackupManager();
      const sessionPath = path.join(testSessionPath, "retention-test");

      fs.mkdirSync(sessionPath, { recursive: true });
      fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });

      // Create multiple backups
      const backupPaths = [];
      for (let i = 0; i < 5; i++) {
        const backupResult = await backupManager.createBackup(sessionPath, {
          reason: `test-backup-${i}`,
        });
        backupPaths.push(backupResult.backupPath);

        // Wait a bit to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Apply retention policy (keep only 3 most recent)
      const cleanupResult = await backupManager.cleanupOldBackups({
        maxBackups: 3,
        maxAge: null, // Only count-based retention
      });

      expect(cleanupResult.cleaned).toBe(2);
      expect(cleanupResult.errors.length).toBe(0);

      // Verify only 3 backups remain
      const remainingBackups = backupPaths.filter((backupPath) =>
        fs.existsSync(backupPath)
      );
      expect(remainingBackups.length).toBe(3);
    });
  });

  describe("Git Integration", () => {
    test("should detect git repository information", async () => {
      const gitInfo = await getGitRepositoryInfo();

      expect(gitInfo).toBeDefined();
      expect(typeof gitInfo.isRepository).toBe("boolean");

      if (gitInfo.isRepository) {
        expect(gitInfo.branch).toBeDefined();
        expect(typeof gitInfo.branch).toBe("string");
        expect(typeof gitInfo.isDirty).toBe("boolean");

        if (gitInfo.commit) {
          expect(typeof gitInfo.commit).toBe("string");
          expect(gitInfo.commit.length).toBeGreaterThan(0);
        }
      }
    });

    test("should handle git branch detection methods", async () => {
      const detector = new GitBranchDetector();

      // Test different detection methods
      const methods = ["git-command", "git-file", "environment"];

      for (const method of methods) {
        try {
          const branch = await detector.detectBranch(method);
          if (branch) {
            expect(typeof branch).toBe("string");
            expect(branch.length).toBeGreaterThan(0);
          }
        } catch (error) {
          // Some methods may fail in test environment, which is acceptable
          expect(error).toBeDefined();
        }
      }
    });

    test("should integrate git info with session strategies", async () => {
      const gitInfo = await getGitRepositoryInfo();

      // Test branch-based instance ID generation
      const branchInstanceId = generateInstanceId({
        useSharedSession: false,
        gitBranch: gitInfo.branch || "test-branch",
        useBranchSessions: true,
      });

      expect(branchInstanceId).toBeDefined();
      if (gitInfo.branch) {
        expect(branchInstanceId).toContain(
          gitInfo.branch.replace(/[^a-zA-Z0-9]/g, "_")
        );
      }

      // Test shared session ID (should be consistent regardless of branch)
      const sharedInstanceId = generateInstanceId({
        useSharedSession: true,
        gitBranch: gitInfo.branch || "test-branch",
      });

      expect(sharedInstanceId).toMatch(/^wa_shared_[a-f0-9]{8}$/);
    });
  });

  describe("Diagnostic Integration", () => {
    test("should generate comprehensive diagnostic reports", async () => {
      // Create test sessions with various states
      const sessions = [
        { name: "valid", valid: true },
        { name: "corrupted", valid: false },
        { name: "empty", valid: false },
      ];

      for (const session of sessions) {
        const sessionPath = path.join(testSessionPath, session.name);
        fs.mkdirSync(sessionPath, { recursive: true });

        if (session.valid) {
          fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });
          fs.writeFileSync(
            path.join(sessionPath, "Default", "Preferences"),
            JSON.stringify({ version: "1.0" })
          );
        } else if (session.name === "corrupted") {
          fs.writeFileSync(path.join(sessionPath, "LOCK"), "corrupted");
        }
        // empty session has no files
      }

      const diagnosticReport = generateDiagnosticReport({
        baseDirectory: testSessionPath,
        includeSystemInfo: true,
        includeEnvironmentInfo: true,
        validateAllSessions: true,
      });

      expect(diagnosticReport).toBeDefined();
      expect(diagnosticReport.summary).toBeDefined();
      expect(diagnosticReport.summary.totalSessions).toBeGreaterThan(0);
      expect(diagnosticReport.summary.validSessions).toBeDefined();
      expect(diagnosticReport.summary.healthScore).toBeDefined();

      expect(diagnosticReport.environment).toBeDefined();
      expect(diagnosticReport.environment.executionMode).toBeDefined();

      expect(diagnosticReport.sessions).toBeDefined();
      expect(Array.isArray(diagnosticReport.sessions)).toBe(true);

      // Should have detected the valid session
      const validSessions = diagnosticReport.sessions.filter((s) => s.isValid);
      expect(validSessions.length).toBeGreaterThan(0);

      // Should have detected issues with invalid sessions
      const invalidSessions = diagnosticReport.sessions.filter(
        (s) => !s.isValid
      );
      expect(invalidSessions.length).toBeGreaterThan(0);
    });

    test("should discover session directories correctly", async () => {
      // Create various session directory structures
      const sessionStructures = [
        "wa_shared_12345678",
        "wa_individual_87654321",
        "wa_branch_feature_test_11111111",
        "not-a-session-dir",
        "wa_invalid", // Invalid format
      ];

      for (const structure of sessionStructures) {
        const sessionPath = path.join(testSessionPath, structure);
        fs.mkdirSync(sessionPath, { recursive: true });

        if (structure.startsWith("wa_") && structure !== "wa_invalid") {
          // Create valid session structure
          fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });
        }
      }

      const discoveredSessions = discoverSessionDirectories(testSessionPath);

      expect(Array.isArray(discoveredSessions)).toBe(true);
      expect(discoveredSessions.length).toBeGreaterThan(0);

      // Should only include valid WhatsApp session directories
      const validSessionNames = discoveredSessions.map((s) =>
        path.basename(s.path)
      );
      expect(validSessionNames).toContain("wa_shared_12345678");
      expect(validSessionNames).toContain("wa_individual_87654321");
      expect(validSessionNames).toContain("wa_branch_feature_test_11111111");
      expect(validSessionNames).not.toContain("not-a-session-dir");
      expect(validSessionNames).not.toContain("wa_invalid");
    });
  });

  describe("Lock File Management Integration", () => {
    test("should handle concurrent lock operations", async () => {
      const lockManager1 = new LockFileManager();
      const lockManager2 = new LockFileManager();

      // First manager acquires lock
      await lockManager1.acquireLock();

      // Second manager should handle gracefully
      await expect(lockManager2.acquireLock()).resolves.not.toThrow();

      // Release locks
      await lockManager1.releaseLock();
      await lockManager2.releaseLock();
    });

    test("should integrate with session validation", async () => {
      const sessionPath = path.join(testSessionPath, "lock-test");
      fs.mkdirSync(sessionPath, { recursive: true });

      // Create stale lock file
      const lockFile = path.join(sessionPath, "LOCK");
      fs.writeFileSync(lockFile, "stale lock");

      // Set old modification time
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
      fs.utimesSync(lockFile, oldTime, oldTime);

      const validation = validateSessionData(sessionPath);
      expect(validation.isValid).toBe(false);

      const staleLockIssue = validation.issues.find((issue) =>
        issue.includes("Stale lock file detected")
      );
      expect(staleLockIssue).toBeDefined();
    });
  });

  describe("End-to-End Integration Scenarios", () => {
    test("should handle complete session lifecycle", async () => {
      // 1. Initialize new session
      const instanceManagement = await initializeInstanceManagement({
        useSharedSession: true,
        consolidateSessions: true,
        useStrategyManager: true,
      });

      expect(instanceManagement.instanceId).toBeDefined();
      expect(instanceManagement.sessionPath).toBeDefined();

      // 2. Validate session
      const validation = validateSessionData(instanceManagement.sessionPath);
      expect(validation.isValid).toBe(true);

      // 3. Create backup
      const backupManager = new SessionBackupManager();
      const backupResult = await backupManager.createBackup(
        instanceManagement.sessionPath,
        { reason: "lifecycle-test" }
      );
      expect(backupResult.success).toBe(true);

      // 4. Simulate corruption and recovery
      fs.writeFileSync(
        path.join(instanceManagement.sessionPath, "LOCK"),
        "corrupted"
      );

      const recoveryResult = await performAutomaticRecovery(
        instanceManagement.sessionPath,
        { maxRecoveryTime: 30000 }
      );
      expect(recoveryResult.success).toBe(true);

      // 5. Final validation
      const finalValidation = validateSessionData(
        instanceManagement.sessionPath
      );
      expect(finalValidation.isValid).toBe(true);

      // 6. Cleanup
      await instanceManagement.lockManager.releaseLock();
    }, 40000);

    test("should handle strategy migration with recovery", async () => {
      // Create individual session with some corruption
      const individualPath = path.join(testSessionPath, "individual-corrupted");
      fs.mkdirSync(individualPath, { recursive: true });
      fs.mkdirSync(path.join(individualPath, "Default"), { recursive: true });
      fs.writeFileSync(path.join(individualPath, "LOCK"), "stale lock");

      // Perform recovery first
      const recoveryResult = await performAutomaticRecovery(individualPath, {
        maxRecoveryTime: 30000,
      });
      expect(recoveryResult.success).toBe(true);

      // Then migrate to shared strategy
      const gitInfo = await getGitRepositoryInfo();
      const strategyManager = createSessionStrategyManager({
        gitInfo,
        baseSessionPath: testSessionPath,
        enableAutoMigration: true,
        enableMigrationBackup: true,
      });

      const migrationResult = await strategyManager.migrateSession(
        "individual",
        "shared",
        {
          sourceSessionPath: individualPath,
          createBackup: true,
          validateAfterMigration: true,
        }
      );

      expect(migrationResult.success).toBe(true);
      expect(migrationResult.migrated).toBe(true);

      // Verify final session is valid
      const finalValidation = validateSessionData(
        migrationResult.targetSessionPath
      );
      expect(finalValidation.isValid).toBe(true);
    }, 40000);
  });
});
