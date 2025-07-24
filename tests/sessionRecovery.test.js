/**
 * Session Recovery Manager Tests
 * Comprehensive tests for automatic session recovery functionality
 */

import { jest } from "@jest/globals";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  SessionRecoveryManager,
  performAutomaticRecovery,
  assessRecoveryNeeds,
  RECOVERY_LEVELS,
  CORRUPTION_SEVERITY,
} from "../app/utils/sessionRecovery.js";
import { SessionBackupManager } from "../app/utils/sessionBackup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test directories
const testBaseDir = path.join(__dirname, "test_data", "recovery_tests");
const testSessionDir = path.join(testBaseDir, "test_session");
const testBackupDir = path.join(testBaseDir, "test_backups");

describe("SessionRecoveryManager", () => {
  let recoveryManager;
  let backupManager;

  beforeEach(() => {
    // Clean up test directories
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }

    // Create test directories
    fs.mkdirSync(testBaseDir, { recursive: true });
    fs.mkdirSync(testSessionDir, { recursive: true });

    // Initialize managers
    backupManager = new SessionBackupManager({
      backupBaseDir: testBackupDir,
      maxBackups: 5,
    });

    recoveryManager = new SessionRecoveryManager({
      sessionPath: testSessionDir,
      backupManager,
      maxRecoveryTime: 5000, // 5 seconds for tests
    });
  });

  afterEach(() => {
    // Clean up test directories
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe("constructor", () => {
    test("should initialize with default options", () => {
      const manager = new SessionRecoveryManager({
        sessionPath: "/test/path",
      });

      expect(manager.sessionPath).toBe("/test/path");
      expect(manager.maxRecoveryTime).toBe(30000);
      expect(manager.enableProgressiveRecovery).toBe(true);
      expect(manager.autoBackupBeforeRecovery).toBe(true);
    });

    test("should initialize with custom options", () => {
      const customBackupManager = new SessionBackupManager();
      const manager = new SessionRecoveryManager({
        sessionPath: "/custom/path",
        backupManager: customBackupManager,
        maxRecoveryTime: 10000,
        enableProgressiveRecovery: false,
        autoBackupBeforeRecovery: false,
      });

      expect(manager.sessionPath).toBe("/custom/path");
      expect(manager.backupManager).toBe(customBackupManager);
      expect(manager.maxRecoveryTime).toBe(10000);
      expect(manager.enableProgressiveRecovery).toBe(false);
      expect(manager.autoBackupBeforeRecovery).toBe(false);
    });
  });

  describe("performRecovery", () => {
    test("should skip recovery for valid session", async () => {
      // Create valid session structure
      createValidSessionStructure(testSessionDir);

      const result = await recoveryManager.performRecovery();

      expect(result.success).toBe(true);
      expect(result.recoveryPerformed).toBe(false);
      expect(result.corruptionDetected).toBe(false);
      expect(result.validationResults.before.isValid).toBe(true);
    });

    test("should skip recovery for non-existent session", async () => {
      // Don't create any session structure
      const result = await recoveryManager.performRecovery();

      expect(result.success).toBe(true);
      expect(result.recoveryPerformed).toBe(false);
      expect(result.corruptionDetected).toBe(false);
    });

    test("should perform Level 1 recovery for minor corruption", async () => {
      // Create session with minor corruption (cache files)
      createCorruptedSession(testSessionDir, "minor");

      const result = await recoveryManager.performRecovery();

      expect(result.success).toBe(true);
      expect(result.recoveryPerformed).toBe(true);
      expect(result.recoveryLevel).toBe(RECOVERY_LEVELS.LEVEL_1);
      expect(result.corruptionSeverity).toBe(CORRUPTION_SEVERITY.MINOR);
      expect(result.duration).toBeGreaterThan(0);
    });

    test("should perform Level 2 recovery for moderate corruption", async () => {
      // Create session with moderate corruption
      createCorruptedSession(testSessionDir, "moderate");

      const result = await recoveryManager.performRecovery();

      expect(result.success).toBe(true);
      expect(result.recoveryPerformed).toBe(true);
      expect(result.recoveryLevel).toBe(RECOVERY_LEVELS.LEVEL_2);
      expect(result.corruptionSeverity).toBe(CORRUPTION_SEVERITY.MODERATE);
    });

    test("should perform Level 3 recovery for major corruption", async () => {
      // Create session with major corruption
      createCorruptedSession(testSessionDir, "major");

      const result = await recoveryManager.performRecovery();

      expect(result.success).toBe(true);
      expect(result.recoveryPerformed).toBe(true);
      expect(result.recoveryLevel).toBe(RECOVERY_LEVELS.LEVEL_3);
      expect(result.corruptionSeverity).toBe(CORRUPTION_SEVERITY.MAJOR);
    });

    test("should perform Level 4 recovery for critical corruption", async () => {
      // Create session with critical corruption
      createCorruptedSession(testSessionDir, "critical");

      const result = await recoveryManager.performRecovery();

      expect(result.success).toBe(true);
      expect(result.recoveryPerformed).toBe(true);
      expect(result.recoveryLevel).toBe(RECOVERY_LEVELS.LEVEL_4);
      expect(result.corruptionSeverity).toBe(CORRUPTION_SEVERITY.CRITICAL);
    });

    test("should create backup before recovery when enabled", async () => {
      createCorruptedSession(testSessionDir, "moderate");

      const result = await recoveryManager.performRecovery({
        skipBackup: false,
      });

      expect(result.backupCreated).toBe(true);
      expect(result.backupPath).toBeTruthy();
      expect(fs.existsSync(result.backupPath)).toBe(true);
    });

    test("should skip backup when disabled", async () => {
      createCorruptedSession(testSessionDir, "moderate");

      const result = await recoveryManager.performRecovery({
        skipBackup: true,
      });

      expect(result.backupCreated).toBe(false);
      expect(result.backupPath).toBeNull();
    });

    test("should force specific recovery level when requested", async () => {
      createCorruptedSession(testSessionDir, "minor");

      const result = await recoveryManager.performRecovery({
        forceLevel: RECOVERY_LEVELS.LEVEL_3,
      });

      expect(result.success).toBe(true);
      expect(result.recoveryPerformed).toBe(true);
      expect(result.recoveryLevel).toBe(RECOVERY_LEVELS.LEVEL_3);
    });

    test("should validate after recovery when enabled", async () => {
      createCorruptedSession(testSessionDir, "moderate");

      const result = await recoveryManager.performRecovery({
        validateAfterRecovery: true,
      });

      expect(result.validationResults.after).toBeTruthy();
      expect(result.steps).toContain("post_recovery_validation");
    });

    test("should handle recovery errors gracefully", async () => {
      createCorruptedSession(testSessionDir, "moderate");

      // Mock a recovery method to throw an error
      const originalExecuteRecovery = recoveryManager._executeRecoveryStrategy;
      recoveryManager._executeRecoveryStrategy = jest
        .fn()
        .mockRejectedValue(new Error("Recovery failed"));

      const result = await recoveryManager.performRecovery();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Recovery failed");

      // Restore original method
      recoveryManager._executeRecoveryStrategy = originalExecuteRecovery;
    });
  });

  describe("corruption assessment", () => {
    test("should detect minor corruption correctly", async () => {
      createCorruptedSession(testSessionDir, "minor");

      const validation = {
        isValid: false,
        details: { sessionExists: true },
        issues: ["Stale lock file detected: LOCK (25.0 hours old)"],
        warnings: ["Session directory size is unusually small: 500 KB"],
      };

      const assessment = await recoveryManager._assessCorruption(validation);

      expect(assessment.detected).toBe(true);
      expect(assessment.severity).toBe(CORRUPTION_SEVERITY.MINOR);
      expect(assessment.indicators.length).toBeGreaterThan(0);
    });

    test("should detect moderate corruption correctly", async () => {
      const validation = {
        isValid: false,
        details: { sessionExists: true },
        issues: [
          "Local Storage directory is empty - indicates potential corruption",
        ],
        warnings: [],
      };

      const assessment = await recoveryManager._assessCorruption(validation);

      expect(assessment.detected).toBe(true);
      expect(assessment.severity).toBe(CORRUPTION_SEVERITY.MODERATE);
    });

    test("should detect major corruption correctly", async () => {
      const validation = {
        isValid: false,
        details: { sessionExists: true },
        issues: [
          "Local Storage directory is empty - indicates potential corruption",
          "IndexedDB directory is empty - indicates potential corruption",
        ],
        warnings: [],
      };

      const assessment = await recoveryManager._assessCorruption(validation);

      expect(assessment.detected).toBe(true);
      expect(assessment.severity).toBe(CORRUPTION_SEVERITY.MAJOR);
    });

    test("should detect critical corruption correctly", async () => {
      const validation = {
        isValid: false,
        details: { sessionExists: true },
        issues: [
          "Missing required directory: Default",
          "Missing required file: Default/Preferences",
        ],
        warnings: [],
      };

      const assessment = await recoveryManager._assessCorruption(validation);

      expect(assessment.detected).toBe(true);
      expect(assessment.severity).toBe(CORRUPTION_SEVERITY.CRITICAL);
    });

    test("should detect corruption patterns", async () => {
      const validation = {
        isValid: false,
        details: { sessionExists: true, sessionSize: 50000 }, // Small size
        issues: [
          "Local Storage directory is empty - indicates potential corruption",
          "IndexedDB directory is empty - indicates potential corruption",
        ],
        warnings: [],
      };

      const patterns = recoveryManager._detectCorruptionPatterns(validation);

      expect(patterns).toContain("network_interruption_auth");
      expect(patterns).toContain("incomplete_initialization");
    });
  });

  describe("recovery strategies", () => {
    test("should execute Level 1 recovery correctly", async () => {
      // Create session with cache files
      createValidSessionStructure(testSessionDir);
      createCacheFiles(testSessionDir);

      const success = await recoveryManager._executeLevelOneRecovery();

      expect(success).toBe(true);

      // Verify cache files are removed
      const cachePath = path.join(testSessionDir, "Default/Cache");
      expect(fs.existsSync(cachePath)).toBe(false);
    });

    test("should execute Level 2 recovery correctly", async () => {
      createValidSessionStructure(testSessionDir);
      createAuthenticationFiles(testSessionDir);

      const success = await recoveryManager._executeLevelTwoRecovery();

      expect(success).toBe(true);

      // Verify auth files are preserved
      const authPath = path.join(
        testSessionDir,
        "Default/Local Storage/leveldb"
      );
      expect(fs.existsSync(authPath)).toBe(true);
    });

    test("should execute Level 3 recovery correctly", async () => {
      createValidSessionStructure(testSessionDir);
      createAuthenticationFiles(testSessionDir);

      const success = await recoveryManager._executeLevelThreeRecovery();

      expect(success).toBe(true);

      // Verify session directory is recreated
      expect(fs.existsSync(testSessionDir)).toBe(true);
      expect(fs.existsSync(path.join(testSessionDir, "Default"))).toBe(true);
    });

    test("should execute Level 4 recovery correctly", async () => {
      createValidSessionStructure(testSessionDir);

      const success = await recoveryManager._executeLevelFourRecovery();

      expect(success).toBe(true);

      // Verify fresh session structure
      expect(fs.existsSync(testSessionDir)).toBe(true);
      expect(fs.existsSync(path.join(testSessionDir, "Default"))).toBe(true);

      // Verify old files are gone
      const preferencesPath = path.join(testSessionDir, "Default/Preferences");
      expect(fs.existsSync(preferencesPath)).toBe(false);
    });
  });

  describe("recovery level determination", () => {
    test("should determine correct recovery levels", () => {
      expect(
        recoveryManager._determineRecoveryLevel(CORRUPTION_SEVERITY.MINOR)
      ).toBe(RECOVERY_LEVELS.LEVEL_1);
      expect(
        recoveryManager._determineRecoveryLevel(CORRUPTION_SEVERITY.MODERATE)
      ).toBe(RECOVERY_LEVELS.LEVEL_2);
      expect(
        recoveryManager._determineRecoveryLevel(CORRUPTION_SEVERITY.MAJOR)
      ).toBe(RECOVERY_LEVELS.LEVEL_3);
      expect(
        recoveryManager._determineRecoveryLevel(CORRUPTION_SEVERITY.CRITICAL)
      ).toBe(RECOVERY_LEVELS.LEVEL_4);
    });
  });
});

describe("Utility Functions", () => {
  const testBaseDir = path.join(
    __dirname,
    "test_data",
    "recovery_utility_tests"
  );
  const testSessionDir = path.join(testBaseDir, "test_session");

  beforeEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testBaseDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe("performAutomaticRecovery", () => {
    test("should perform automatic recovery successfully", async () => {
      createCorruptedSession(testSessionDir, "moderate");

      const result = await performAutomaticRecovery(testSessionDir, {
        maxRecoveryTime: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.recoveryPerformed).toBe(true);
      expect(result.recoveryLevel).toBe(RECOVERY_LEVELS.LEVEL_2);
    });

    test("should handle non-existent session path", async () => {
      const result = await performAutomaticRecovery("/non/existent/path");

      expect(result.success).toBe(true);
      expect(result.recoveryPerformed).toBe(false);
    });
  });

  describe("assessRecoveryNeeds", () => {
    test("should assess no recovery needed for valid session", async () => {
      createValidSessionStructure(testSessionDir);

      const assessment = await assessRecoveryNeeds(testSessionDir);

      expect(assessment.recoveryNeeded).toBe(false);
      expect(assessment.recommendation).toBe("none");
      expect(assessment.severity).toBeNull();
    });

    test("should assess recovery needs for corrupted session", async () => {
      createCorruptedSession(testSessionDir, "moderate");

      const assessment = await assessRecoveryNeeds(testSessionDir);

      expect(assessment.recoveryNeeded).toBe(true);
      expect(assessment.recommendation).toBe(RECOVERY_LEVELS.LEVEL_2);
      expect(assessment.severity).toBe(CORRUPTION_SEVERITY.MODERATE);
      expect(assessment.indicators).toBeTruthy();
      expect(assessment.patterns).toBeTruthy();
    });
  });
});

describe("Recovery Constants", () => {
  test("should have correct recovery levels", () => {
    expect(RECOVERY_LEVELS.LEVEL_1).toBe("clear_cache");
    expect(RECOVERY_LEVELS.LEVEL_2).toBe("reset_browser_state");
    expect(RECOVERY_LEVELS.LEVEL_3).toBe("partial_reset");
    expect(RECOVERY_LEVELS.LEVEL_4).toBe("complete_reset");
  });

  test("should have correct corruption severity levels", () => {
    expect(CORRUPTION_SEVERITY.MINOR).toBe("minor");
    expect(CORRUPTION_SEVERITY.MODERATE).toBe("moderate");
    expect(CORRUPTION_SEVERITY.MAJOR).toBe("major");
    expect(CORRUPTION_SEVERITY.CRITICAL).toBe("critical");
  });
});

/**
 * Helper functions for creating test session structures
 */

function createValidSessionStructure(sessionPath) {
  // Create directory structure
  const directories = [
    "Default",
    "Default/Local Storage",
    "Default/Local Storage/leveldb",
    "Default/Session Storage",
    "Default/IndexedDB",
    "Default/IndexedDB/https_web.whatsapp.com_0.indexeddb.leveldb",
  ];

  for (const dir of directories) {
    fs.mkdirSync(path.join(sessionPath, dir), { recursive: true });
  }

  // Create required files
  const files = [
    "Default/Preferences",
    "Default/Local State",
    "Default/Local Storage/leveldb/CURRENT",
    "Default/Local Storage/leveldb/MANIFEST-000001",
    "Default/IndexedDB/https_web.whatsapp.com_0.indexeddb.leveldb/CURRENT",
  ];

  for (const file of files) {
    const filePath = path.join(sessionPath, file);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `Valid content for ${file}`);
  }
}

function createCorruptedSession(sessionPath, corruptionType) {
  // Start with basic structure
  fs.mkdirSync(path.join(sessionPath, "Default"), { recursive: true });

  switch (corruptionType) {
    case "minor":
      // Create session with stale lock files and small size
      createValidSessionStructure(sessionPath);
      const lockPath = path.join(
        sessionPath,
        "Default/Local Storage/leveldb/LOCK"
      );
      fs.writeFileSync(lockPath, "stale lock");
      // Set old timestamp
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      fs.utimesSync(lockPath, oldTime, oldTime);
      break;

    case "moderate":
      // Create session with empty critical directories
      createValidSessionStructure(sessionPath);
      fs.rmSync(path.join(sessionPath, "Default/Local Storage/leveldb"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(sessionPath, "Default/Local Storage/leveldb"));
      break;

    case "major":
      // Create session with multiple empty critical directories
      createValidSessionStructure(sessionPath);
      fs.rmSync(path.join(sessionPath, "Default/Local Storage/leveldb"), {
        recursive: true,
      });
      fs.rmSync(path.join(sessionPath, "Default/IndexedDB"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(sessionPath, "Default/Local Storage/leveldb"));
      fs.mkdirSync(path.join(sessionPath, "Default/IndexedDB"));
      break;

    case "critical":
      // Create session with missing required directories and files
      // Only create Default directory, missing everything else
      break;
  }
}

function createCacheFiles(sessionPath) {
  const cacheDirs = ["Default/Cache", "Default/Code Cache", "Default/GPUCache"];

  for (const dir of cacheDirs) {
    const dirPath = path.join(sessionPath, dir);
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(path.join(dirPath, "cache_file.tmp"), "cache data");
  }
}

function createAuthenticationFiles(sessionPath) {
  const authPaths = [
    "Default/Local Storage/leveldb",
    "Default/IndexedDB/https_web.whatsapp.com_0.indexeddb.leveldb",
  ];

  for (const authPath of authPaths) {
    const fullPath = path.join(sessionPath, authPath);
    fs.mkdirSync(fullPath, { recursive: true });
    fs.writeFileSync(path.join(fullPath, "auth_data"), "authentication data");
  }
}
