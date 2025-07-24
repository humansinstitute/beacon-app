/**
 * Corruption and Recovery Scenario Tests
 * Comprehensive testing of session corruption scenarios and recovery mechanisms
 * Simulates real-world corruption patterns and validates recovery effectiveness
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

// Corruption scenario generators
class CorruptionScenarioGenerator {
  static createStaleLockFile(sessionPath) {
    fs.mkdirSync(sessionPath, { recursive: true });
    fs.writeFileSync(path.join(sessionPath, "LOCK"), "stale lock content");

    // Set old modification time (25 hours ago)
    const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
    fs.utimesSync(path.join(sessionPath, "LOCK"), oldTime, oldTime);

    return {
      name: "Stale Lock File",
      severity: CORRUPTION_SEVERITY.MINOR,
      expectedLevel: RECOVERY_LEVELS.LEVEL_1,
      description:
        "Browser crashed during session save, leaving stale lock file",
    };
  }

  static createEmptyLocalStorage(sessionPath) {
    fs.mkdirSync(sessionPath, { recursive: true });
    fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });
    fs.mkdirSync(path.join(sessionPath, "Default", "Local Storage"), {
      recursive: true,
    });
    // Empty Local Storage directory indicates corruption

    return {
      name: "Empty Local Storage",
      severity: CORRUPTION_SEVERITY.MODERATE,
      expectedLevel: RECOVERY_LEVELS.LEVEL_2,
      description: "Network interruption during authentication data save",
    };
  }

  static createEmptyIndexedDB(sessionPath) {
    fs.mkdirSync(sessionPath, { recursive: true });
    fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });
    fs.mkdirSync(path.join(sessionPath, "Default", "IndexedDB"), {
      recursive: true,
    });
    // Empty IndexedDB directory indicates corruption

    return {
      name: "Empty IndexedDB",
      severity: CORRUPTION_SEVERITY.MODERATE,
      expectedLevel: RECOVERY_LEVELS.LEVEL_2,
      description: "Database corruption during message storage",
    };
  }

  static createBothStorageEmpty(sessionPath) {
    fs.mkdirSync(sessionPath, { recursive: true });
    fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });
    fs.mkdirSync(path.join(sessionPath, "Default", "Local Storage"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(sessionPath, "Default", "IndexedDB"), {
      recursive: true,
    });
    // Both storage directories empty

    return {
      name: "Both Storage Systems Empty",
      severity: CORRUPTION_SEVERITY.MAJOR,
      expectedLevel: RECOVERY_LEVELS.LEVEL_3,
      description: "Complete authentication data loss due to disk issues",
    };
  }

  static createMissingDefaultDirectory(sessionPath) {
    fs.mkdirSync(sessionPath, { recursive: true });
    // Missing Default directory entirely

    return {
      name: "Missing Default Directory",
      severity: CORRUPTION_SEVERITY.CRITICAL,
      expectedLevel: RECOVERY_LEVELS.LEVEL_4,
      description: "Complete session directory corruption",
    };
  }

  static createMissingPreferences(sessionPath) {
    fs.mkdirSync(sessionPath, { recursive: true });
    fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });
    // Missing Preferences file

    return {
      name: "Missing Preferences File",
      severity: CORRUPTION_SEVERITY.CRITICAL,
      expectedLevel: RECOVERY_LEVELS.LEVEL_4,
      description: "Critical configuration file missing",
    };
  }

  static createCorruptedPreferences(sessionPath) {
    fs.mkdirSync(sessionPath, { recursive: true });
    fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });
    fs.writeFileSync(
      path.join(sessionPath, "Default", "Preferences"),
      "corrupted json content {"
    );

    return {
      name: "Corrupted Preferences File",
      severity: CORRUPTION_SEVERITY.MAJOR,
      expectedLevel: RECOVERY_LEVELS.LEVEL_3,
      description: "Configuration file corrupted during write",
    };
  }

  static createPartialSessionData(sessionPath) {
    fs.mkdirSync(sessionPath, { recursive: true });
    fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });
    fs.mkdirSync(path.join(sessionPath, "Default", "Local Storage"), {
      recursive: true,
    });

    // Create some files but leave others missing
    fs.writeFileSync(
      path.join(sessionPath, "Default", "Preferences"),
      JSON.stringify({ version: "1.0" })
    );
    // Missing IndexedDB directory

    return {
      name: "Partial Session Data",
      severity: CORRUPTION_SEVERITY.MODERATE,
      expectedLevel: RECOVERY_LEVELS.LEVEL_2,
      description: "Incomplete session initialization",
    };
  }

  static createNetworkInterruptionPattern(sessionPath) {
    fs.mkdirSync(sessionPath, { recursive: true });
    fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });
    fs.mkdirSync(path.join(sessionPath, "Default", "Local Storage"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(sessionPath, "Default", "IndexedDB"), {
      recursive: true,
    });

    // Create temporary files that indicate interrupted operations
    fs.writeFileSync(
      path.join(sessionPath, "Default", ".tmp_auth"),
      "temp auth data"
    );
    fs.writeFileSync(path.join(sessionPath, "LOCK"), "active lock");

    return {
      name: "Network Interruption Pattern",
      severity: CORRUPTION_SEVERITY.MODERATE,
      expectedLevel: RECOVERY_LEVELS.LEVEL_2,
      description: "Network failure during authentication process",
    };
  }

  static createDiskSpacePattern(sessionPath) {
    fs.mkdirSync(sessionPath, { recursive: true });
    fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });

    // Create zero-byte files indicating disk space issues
    fs.writeFileSync(path.join(sessionPath, "Default", "Preferences"), "");
    fs.writeFileSync(path.join(sessionPath, "Default", "Local State"), "");

    return {
      name: "Disk Space Issues Pattern",
      severity: CORRUPTION_SEVERITY.MAJOR,
      expectedLevel: RECOVERY_LEVELS.LEVEL_3,
      description: "Insufficient disk space during session save",
    };
  }

  static createPermissionIssuesPattern(sessionPath) {
    fs.mkdirSync(sessionPath, { recursive: true });
    fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });

    // Create files with unusual permissions (simulated)
    fs.writeFileSync(
      path.join(sessionPath, "Default", "Preferences"),
      JSON.stringify({ version: "1.0" })
    );

    // Create a directory where a file should be
    fs.mkdirSync(path.join(sessionPath, "Default", "Local State"), {
      recursive: true,
    });

    return {
      name: "Permission Issues Pattern",
      severity: CORRUPTION_SEVERITY.MAJOR,
      expectedLevel: RECOVERY_LEVELS.LEVEL_3,
      description: "File system permission errors during operation",
    };
  }

  static getAllScenarios() {
    return [
      this.createStaleLockFile,
      this.createEmptyLocalStorage,
      this.createEmptyIndexedDB,
      this.createBothStorageEmpty,
      this.createMissingDefaultDirectory,
      this.createMissingPreferences,
      this.createCorruptedPreferences,
      this.createPartialSessionData,
      this.createNetworkInterruptionPattern,
      this.createDiskSpacePattern,
      this.createPermissionIssuesPattern,
    ];
  }
}

describe("Corruption and Recovery Scenario Tests", () => {
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
      `corruption-${Date.now()}`
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

  describe("Individual Corruption Scenarios", () => {
    test("should handle stale lock file corruption", async () => {
      const scenarioPath = path.join(testSessionPath, "stale-lock");
      const scenario =
        CorruptionScenarioGenerator.createStaleLockFile(scenarioPath);

      // Validate corruption detection
      const validation = validateSessionData(scenarioPath);
      expect(validation.isValid).toBe(false);

      const staleLockIssue = validation.issues.find((issue) =>
        issue.includes("Stale lock file detected")
      );
      expect(staleLockIssue).toBeDefined();

      // Perform recovery
      const recoveryResult = await performAutomaticRecovery(scenarioPath, {
        validateAfterRecovery: true,
        maxRecoveryTime: 30000,
      });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.recoveryLevel).toBe(scenario.expectedLevel);
      expect(recoveryResult.corruptionSeverity).toBe(scenario.severity);

      // Verify session is valid after recovery
      const postRecoveryValidation = validateSessionData(scenarioPath);
      expect(postRecoveryValidation.isValid).toBe(true);
    }, 35000);

    test("should handle empty Local Storage corruption", async () => {
      const scenarioPath = path.join(testSessionPath, "empty-localstorage");
      const scenario =
        CorruptionScenarioGenerator.createEmptyLocalStorage(scenarioPath);

      const validation = validateSessionData(scenarioPath);
      expect(validation.isValid).toBe(false);

      const emptyStorageIssue = validation.issues.find((issue) =>
        issue.includes("Local Storage directory is empty")
      );
      expect(emptyStorageIssue).toBeDefined();

      const recoveryResult = await performAutomaticRecovery(scenarioPath, {
        validateAfterRecovery: true,
        maxRecoveryTime: 30000,
      });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.recoveryLevel).toBe(scenario.expectedLevel);
      expect(recoveryResult.corruptionSeverity).toBe(scenario.severity);

      const postRecoveryValidation = validateSessionData(scenarioPath);
      expect(postRecoveryValidation.isValid).toBe(true);
    }, 35000);

    test("should handle missing Default directory corruption", async () => {
      const scenarioPath = path.join(testSessionPath, "missing-default");
      const scenario =
        CorruptionScenarioGenerator.createMissingDefaultDirectory(scenarioPath);

      const validation = validateSessionData(scenarioPath);
      expect(validation.isValid).toBe(false);

      const missingDirIssue = validation.issues.find((issue) =>
        issue.includes("Missing required directory: Default")
      );
      expect(missingDirIssue).toBeDefined();

      const recoveryResult = await performAutomaticRecovery(scenarioPath, {
        validateAfterRecovery: true,
        maxRecoveryTime: 30000,
      });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.recoveryLevel).toBe(scenario.expectedLevel);
      expect(recoveryResult.corruptionSeverity).toBe(scenario.severity);

      const postRecoveryValidation = validateSessionData(scenarioPath);
      expect(postRecoveryValidation.isValid).toBe(true);
    }, 35000);

    test("should handle corrupted Preferences file", async () => {
      const scenarioPath = path.join(testSessionPath, "corrupted-prefs");
      const scenario =
        CorruptionScenarioGenerator.createCorruptedPreferences(scenarioPath);

      const validation = validateSessionData(scenarioPath);
      expect(validation.isValid).toBe(false);

      const recoveryResult = await performAutomaticRecovery(scenarioPath, {
        validateAfterRecovery: true,
        maxRecoveryTime: 30000,
      });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.recoveryLevel).toBe(scenario.expectedLevel);

      const postRecoveryValidation = validateSessionData(scenarioPath);
      expect(postRecoveryValidation.isValid).toBe(true);
    }, 35000);
  });

  describe("Complex Corruption Patterns", () => {
    test("should handle network interruption pattern", async () => {
      const scenarioPath = path.join(testSessionPath, "network-interruption");
      const scenario =
        CorruptionScenarioGenerator.createNetworkInterruptionPattern(
          scenarioPath
        );

      const validation = validateSessionData(scenarioPath);
      expect(validation.isValid).toBe(false);

      // Should detect network interruption pattern
      const recoveryManager = new SessionRecoveryManager({
        sessionPath: scenarioPath,
        backupManager: new SessionBackupManager(),
      });

      const patterns = recoveryManager._detectCorruptionPatterns(validation);
      expect(patterns).toContain("network_interruption_auth");

      const recoveryResult = await performAutomaticRecovery(scenarioPath, {
        validateAfterRecovery: true,
        maxRecoveryTime: 30000,
      });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.recoveryLevel).toBe(scenario.expectedLevel);
    }, 35000);

    test("should handle disk space issues pattern", async () => {
      const scenarioPath = path.join(testSessionPath, "disk-space");
      const scenario =
        CorruptionScenarioGenerator.createDiskSpacePattern(scenarioPath);

      const validation = validateSessionData(scenarioPath);
      expect(validation.isValid).toBe(false);

      const recoveryManager = new SessionRecoveryManager({
        sessionPath: scenarioPath,
        backupManager: new SessionBackupManager(),
      });

      const patterns = recoveryManager._detectCorruptionPatterns(validation);
      expect(patterns).toContain("disk_space_issues");

      const recoveryResult = await performAutomaticRecovery(scenarioPath, {
        validateAfterRecovery: true,
        maxRecoveryTime: 30000,
      });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.recoveryLevel).toBe(scenario.expectedLevel);
    }, 35000);

    test("should handle permission issues pattern", async () => {
      const scenarioPath = path.join(testSessionPath, "permission-issues");
      const scenario =
        CorruptionScenarioGenerator.createPermissionIssuesPattern(scenarioPath);

      const validation = validateSessionData(scenarioPath);
      expect(validation.isValid).toBe(false);

      const recoveryResult = await performAutomaticRecovery(scenarioPath, {
        validateAfterRecovery: true,
        maxRecoveryTime: 30000,
      });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.recoveryLevel).toBe(scenario.expectedLevel);
    }, 35000);
  });

  describe("Progressive Recovery Testing", () => {
    test("should escalate recovery levels appropriately", async () => {
      const scenarios = [
        {
          generator: CorruptionScenarioGenerator.createStaleLockFile,
          expectedLevel: RECOVERY_LEVELS.LEVEL_1,
        },
        {
          generator: CorruptionScenarioGenerator.createEmptyLocalStorage,
          expectedLevel: RECOVERY_LEVELS.LEVEL_2,
        },
        {
          generator: CorruptionScenarioGenerator.createBothStorageEmpty,
          expectedLevel: RECOVERY_LEVELS.LEVEL_3,
        },
        {
          generator: CorruptionScenarioGenerator.createMissingDefaultDirectory,
          expectedLevel: RECOVERY_LEVELS.LEVEL_4,
        },
      ];

      for (let i = 0; i < scenarios.length; i++) {
        const scenarioPath = path.join(testSessionPath, `escalation-${i}`);
        const scenario = scenarios[i].generator(scenarioPath);

        const recoveryResult = await performAutomaticRecovery(scenarioPath, {
          validateAfterRecovery: true,
          maxRecoveryTime: 30000,
        });

        expect(recoveryResult.success).toBe(true);
        expect(recoveryResult.recoveryLevel).toBe(scenarios[i].expectedLevel);

        // Cleanup for next iteration
        fs.rmSync(scenarioPath, { recursive: true, force: true });
      }
    }, 60000);

    test("should handle recovery failure gracefully", async () => {
      const scenarioPath = path.join(testSessionPath, "recovery-failure");
      CorruptionScenarioGenerator.createMissingDefaultDirectory(scenarioPath);

      // Mock recovery to fail
      const recoveryManager = new SessionRecoveryManager({
        sessionPath: scenarioPath,
        backupManager: new SessionBackupManager(),
      });

      const originalExecute = recoveryManager._executeRecoveryStrategy;
      recoveryManager._executeRecoveryStrategy = jest
        .fn()
        .mockRejectedValue(new Error("Simulated recovery failure"));

      const recoveryResult = await recoveryManager.performRecovery({
        skipBackup: true,
      });

      expect(recoveryResult.success).toBe(false);
      expect(recoveryResult.error).toContain("Simulated recovery failure");

      // Restore original method
      recoveryManager._executeRecoveryStrategy = originalExecute;
    });
  });

  describe("Recovery with Backup Integration", () => {
    test("should create backup before recovery", async () => {
      const scenarioPath = path.join(testSessionPath, "backup-before-recovery");
      CorruptionScenarioGenerator.createCorruptedPreferences(scenarioPath);

      const recoveryResult = await performAutomaticRecovery(scenarioPath, {
        validateAfterRecovery: true,
        autoBackupBeforeRecovery: true,
        maxRecoveryTime: 30000,
      });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.backupCreated).toBe(true);
      expect(recoveryResult.backupPath).toBeDefined();
      expect(fs.existsSync(recoveryResult.backupPath)).toBe(true);

      // Verify backup contains the corrupted data
      const backupMetadataPath = path.join(
        recoveryResult.backupPath,
        "backup-metadata.json"
      );
      expect(fs.existsSync(backupMetadataPath)).toBe(true);

      const metadata = JSON.parse(fs.readFileSync(backupMetadataPath, "utf8"));
      expect(metadata.reason).toContain("recovery");
    }, 35000);

    test("should continue recovery even if backup fails", async () => {
      const scenarioPath = path.join(testSessionPath, "backup-failure");
      CorruptionScenarioGenerator.createEmptyLocalStorage(scenarioPath);

      // Mock backup to fail
      const backupManager = new SessionBackupManager();
      const originalCreateBackup = backupManager.createBackup;
      backupManager.createBackup = jest.fn().mockResolvedValue({
        success: false,
        error: "Simulated backup failure",
      });

      const recoveryManager = new SessionRecoveryManager({
        sessionPath: scenarioPath,
        backupManager,
      });

      const recoveryResult = await recoveryManager.performRecovery({
        skipBackup: false,
      });

      expect(recoveryResult.backupCreated).toBe(false);
      expect(recoveryResult.recoveryPerformed).toBe(true);
      expect(recoveryResult.success).toBe(true);

      // Restore original method
      backupManager.createBackup = originalCreateBackup;
    }, 35000);
  });

  describe("Comprehensive Scenario Testing", () => {
    test("should handle all corruption scenarios", async () => {
      const scenarios = CorruptionScenarioGenerator.getAllScenarios();
      const results = [];

      for (let i = 0; i < scenarios.length; i++) {
        const scenarioPath = path.join(testSessionPath, `comprehensive-${i}`);
        const scenario = scenarios[i](scenarioPath);

        const startTime = Date.now();
        const recoveryResult = await performAutomaticRecovery(scenarioPath, {
          validateAfterRecovery: true,
          maxRecoveryTime: 30000,
        });
        const duration = Date.now() - startTime;

        results.push({
          scenario: scenario.name,
          success: recoveryResult.success,
          recoveryLevel: recoveryResult.recoveryLevel,
          duration,
          expectedLevel: scenario.expectedLevel,
        });

        expect(recoveryResult.success).toBe(true);
        expect(duration).toBeLessThan(30000);

        // Verify session is valid after recovery
        const validation = validateSessionData(scenarioPath);
        expect(validation.isValid).toBe(true);

        // Cleanup for next iteration
        fs.rmSync(scenarioPath, { recursive: true, force: true });
      }

      // Log comprehensive results
      console.log("\n=== COMPREHENSIVE CORRUPTION SCENARIO RESULTS ===");
      results.forEach((result) => {
        console.log(
          `${result.scenario}: ${result.success ? "✓" : "✗"} (${
            result.duration
          }ms, Level ${result.recoveryLevel})`
        );
      });

      // All scenarios should succeed
      expect(results.every((r) => r.success)).toBe(true);
    }, 120000); // Allow more time for comprehensive testing
  });

  describe("Recovery Assessment", () => {
    test("should accurately assess recovery needs", async () => {
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
          name: "Minor recovery needed",
          setup: (sessionPath) => {
            CorruptionScenarioGenerator.createStaleLockFile(sessionPath);
          },
          expectedRecoveryNeeded: true,
          expectedSeverity: CORRUPTION_SEVERITY.MINOR,
        },
        {
          name: "Major recovery needed",
          setup: (sessionPath) => {
            CorruptionScenarioGenerator.createBothStorageEmpty(sessionPath);
          },
          expectedRecoveryNeeded: true,
          expectedSeverity: CORRUPTION_SEVERITY.MAJOR,
        },
        {
          name: "Critical recovery needed",
          setup: (sessionPath) => {
            CorruptionScenarioGenerator.createMissingDefaultDirectory(
              sessionPath
            );
          },
          expectedRecoveryNeeded: true,
          expectedSeverity: CORRUPTION_SEVERITY.CRITICAL,
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

        if (scenario.expectedSeverity) {
          expect(assessment.corruptionSeverity).toBe(scenario.expectedSeverity);
        }

        // Cleanup
        fs.rmSync(scenarioPath, { recursive: true, force: true });
      }
    });
  });

  describe("Error Handling in Recovery", () => {
    test("should handle file system errors during recovery", async () => {
      const scenarioPath = path.join(testSessionPath, "fs-error");
      CorruptionScenarioGenerator.createEmptyLocalStorage(scenarioPath);

      // Mock fs operations to simulate errors
      const originalRmSync = fs.rmSync;
      fs.rmSync = jest.fn().mockImplementation(() => {
        throw new Error("EACCES: permission denied");
      });

      try {
        const recoveryResult = await performAutomaticRecovery(scenarioPath, {
          maxRecoveryTime: 30000,
        });

        // Should handle error gracefully
        expect(recoveryResult.success).toBe(false);
        expect(recoveryResult.error).toContain("EACCES");
      } finally {
        // Restore original function
        fs.rmSync = originalRmSync;
      }
    });

    test("should handle timeout during recovery", async () => {
      const scenarioPath = path.join(testSessionPath, "timeout");
      CorruptionScenarioGenerator.createMissingDefaultDirectory(scenarioPath);

      // Set very short timeout
      const recoveryResult = await performAutomaticRecovery(scenarioPath, {
        maxRecoveryTime: 1, // 1ms timeout
      });

      expect(recoveryResult.success).toBe(false);
      expect(recoveryResult.error).toContain("timeout");
    });
  });
});
