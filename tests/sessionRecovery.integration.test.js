/**
 * Session Recovery Integration Tests
 * Tests for automatic session recovery functionality with simulated corruption scenarios
 */

import { jest } from "@jest/globals";
import fs from "fs";
import path from "path";
import {
  SessionRecoveryManager,
  performAutomaticRecovery,
  assessRecoveryNeeds,
  RECOVERY_LEVELS,
  CORRUPTION_SEVERITY,
} from "../app/utils/sessionRecovery.js";
import { SessionBackupManager } from "../app/utils/sessionBackup.js";

// Mock fs and path modules
jest.mock("fs");
jest.mock("path");

describe("Session Recovery Integration Tests", () => {
  let recoveryManager;
  let backupManager;
  const testSessionPath = "/test/session/path";

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock path operations
    path.join.mockImplementation((...args) => args.join("/"));
    path.dirname.mockImplementation((filePath) => {
      const parts = filePath.split("/");
      return parts.slice(0, -1).join("/");
    });
    path.basename.mockImplementation((filePath) => {
      const parts = filePath.split("/");
      return parts[parts.length - 1];
    });

    // Mock fs operations with defaults
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockImplementation(() => {});
    fs.rmSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => {});
    fs.readFileSync.mockImplementation(() =>
      JSON.stringify({ version: "1.0" })
    );
    fs.copyFileSync.mockImplementation(() => {});
    fs.readdirSync.mockReturnValue(["file1.txt", "file2.txt"]);
    fs.statSync.mockReturnValue({
      isDirectory: () => false,
      size: 1024,
      mtime: new Date(),
      birthtime: new Date(),
    });
    fs.unlinkSync.mockImplementation(() => {});

    // Initialize managers
    backupManager = new SessionBackupManager();
    recoveryManager = new SessionRecoveryManager({
      sessionPath: testSessionPath,
      backupManager,
      maxRecoveryTime: 5000,
    });
  });

  describe("Recovery Level Determination", () => {
    test("should determine Level 1 recovery for minor corruption", async () => {
      // Mock validation to return minor corruption
      const mockValidation = {
        isValid: false,
        details: { sessionExists: true, sessionSize: 500000 },
        issues: ["Stale lock file detected: LOCK (25.0 hours old)"],
        warnings: ["Session directory size is unusually small: 500 KB"],
      };

      // Mock validateSessionData
      const originalValidateSessionData = await import(
        "../app/utils/sessionValidation.js"
      );
      jest.doMock("../app/utils/sessionValidation.js", () => ({
        validateSessionData: jest.fn().mockReturnValue(mockValidation),
        quickValidateSession: jest.fn().mockReturnValue(true),
      }));

      const assessment = await recoveryManager._assessCorruption(
        mockValidation
      );
      const recoveryLevel = recoveryManager._determineRecoveryLevel(
        assessment.severity
      );

      expect(assessment.severity).toBe(CORRUPTION_SEVERITY.MINOR);
      expect(recoveryLevel).toBe(RECOVERY_LEVELS.LEVEL_1);
    });

    test("should determine Level 2 recovery for moderate corruption", async () => {
      const mockValidation = {
        isValid: false,
        details: { sessionExists: true },
        issues: [
          "Local Storage directory is empty - indicates potential corruption",
        ],
        warnings: [],
      };

      const assessment = await recoveryManager._assessCorruption(
        mockValidation
      );
      const recoveryLevel = recoveryManager._determineRecoveryLevel(
        assessment.severity
      );

      expect(assessment.severity).toBe(CORRUPTION_SEVERITY.MODERATE);
      expect(recoveryLevel).toBe(RECOVERY_LEVELS.LEVEL_2);
    });

    test("should determine Level 3 recovery for major corruption", async () => {
      const mockValidation = {
        isValid: false,
        details: { sessionExists: true },
        issues: [
          "Local Storage directory is empty - indicates potential corruption",
          "IndexedDB directory is empty - indicates potential corruption",
        ],
        warnings: [],
      };

      const assessment = await recoveryManager._assessCorruption(
        mockValidation
      );
      const recoveryLevel = recoveryManager._determineRecoveryLevel(
        assessment.severity
      );

      expect(assessment.severity).toBe(CORRUPTION_SEVERITY.MAJOR);
      expect(recoveryLevel).toBe(RECOVERY_LEVELS.LEVEL_3);
    });

    test("should determine Level 4 recovery for critical corruption", async () => {
      const mockValidation = {
        isValid: false,
        details: { sessionExists: true },
        issues: [
          "Missing required directory: Default",
          "Missing required file: Default/Preferences",
        ],
        warnings: [],
      };

      const assessment = await recoveryManager._assessCorruption(
        mockValidation
      );
      const recoveryLevel = recoveryManager._determineRecoveryLevel(
        assessment.severity
      );

      expect(assessment.severity).toBe(CORRUPTION_SEVERITY.CRITICAL);
      expect(recoveryLevel).toBe(RECOVERY_LEVELS.LEVEL_4);
    });
  });

  describe("Recovery Strategy Execution", () => {
    test("should execute Level 1 recovery (clear cache)", async () => {
      // Mock cache directories exist
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes("Cache") || filePath.includes("GPUCache");
      });

      const success = await recoveryManager._executeLevelOneRecovery();

      expect(success).toBe(true);
      expect(fs.rmSync).toHaveBeenCalled();
    });

    test("should execute Level 2 recovery (reset browser state)", async () => {
      // Mock authentication files exist
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes("leveldb") || filePath.includes("IndexedDB");
      });

      const success = await recoveryManager._executeLevelTwoRecovery();

      expect(success).toBe(true);
      expect(fs.copyFileSync).toHaveBeenCalled(); // For preserving auth data
    });

    test("should execute Level 3 recovery (partial reset)", async () => {
      const success = await recoveryManager._executeLevelThreeRecovery();

      expect(success).toBe(true);
      expect(fs.rmSync).toHaveBeenCalledWith(testSessionPath, {
        recursive: true,
        force: true,
      });
      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    test("should execute Level 4 recovery (complete reset)", async () => {
      const success = await recoveryManager._executeLevelFourRecovery();

      expect(success).toBe(true);
      expect(fs.rmSync).toHaveBeenCalledWith(testSessionPath, {
        recursive: true,
        force: true,
      });
      expect(fs.mkdirSync).toHaveBeenCalled();
    });
  });

  describe("Corruption Pattern Detection", () => {
    test("should detect network interruption pattern", () => {
      const mockValidation = {
        issues: [
          "Local Storage directory is empty - indicates potential corruption",
          "IndexedDB directory is empty - indicates potential corruption",
        ],
        details: { sessionSize: 50000 },
      };

      const patterns =
        recoveryManager._detectCorruptionPatterns(mockValidation);

      expect(patterns).toContain("network_interruption_auth");
      expect(patterns).toContain("incomplete_initialization");
    });

    test("should detect browser crash pattern", () => {
      const mockValidation = {
        issues: ["Stale lock file detected: LOCK (25.0 hours old)"],
        details: { sessionSize: 1000000 },
      };

      const patterns =
        recoveryManager._detectCorruptionPatterns(mockValidation);

      expect(patterns).toContain("browser_crash_during_save");
    });

    test("should detect disk space issues pattern", () => {
      const mockValidation = {
        issues: [
          "Missing required directory: Default",
          "Missing required file: Default/Preferences",
        ],
        details: { sessionSize: 1000000 },
      };

      const patterns =
        recoveryManager._detectCorruptionPatterns(mockValidation);

      expect(patterns).toContain("disk_space_issues");
    });
  });

  describe("Backup Integration", () => {
    test("should create backup before recovery", async () => {
      // Mock session exists and has corruption
      const mockValidation = {
        isValid: false,
        details: { sessionExists: true },
        issues: [
          "Local Storage directory is empty - indicates potential corruption",
        ],
        warnings: [],
      };

      // Mock validateSessionData to return corruption
      recoveryManager._validateSession = jest
        .fn()
        .mockResolvedValue(mockValidation);

      const result = await recoveryManager.performRecovery({
        skipBackup: false,
      });

      expect(result.backupCreated).toBe(true);
      expect(result.recoveryPerformed).toBe(true);
    });

    test("should skip backup when requested", async () => {
      const mockValidation = {
        isValid: false,
        details: { sessionExists: true },
        issues: [
          "Local Storage directory is empty - indicates potential corruption",
        ],
        warnings: [],
      };

      recoveryManager._validateSession = jest
        .fn()
        .mockResolvedValue(mockValidation);

      const result = await recoveryManager.performRecovery({
        skipBackup: true,
      });

      expect(result.backupCreated).toBe(false);
      expect(result.recoveryPerformed).toBe(true);
    });
  });

  describe("Performance Requirements", () => {
    test("should complete recovery within 30 seconds", async () => {
      const mockValidation = {
        isValid: false,
        details: { sessionExists: true },
        issues: [
          "Local Storage directory is empty - indicates potential corruption",
        ],
        warnings: [],
      };

      recoveryManager._validateSession = jest
        .fn()
        .mockResolvedValue(mockValidation);

      const startTime = Date.now();
      const result = await recoveryManager.performRecovery();
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(30000); // 30 seconds
      expect(result.duration).toBeLessThan(30000);
    });
  });

  describe("Error Handling", () => {
    test("should handle recovery errors gracefully", async () => {
      const mockValidation = {
        isValid: false,
        details: { sessionExists: true },
        issues: [
          "Local Storage directory is empty - indicates potential corruption",
        ],
        warnings: [],
      };

      recoveryManager._validateSession = jest
        .fn()
        .mockResolvedValue(mockValidation);
      recoveryManager._executeRecoveryStrategy = jest
        .fn()
        .mockRejectedValue(new Error("Recovery failed"));

      const result = await recoveryManager.performRecovery();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Recovery failed");
    });

    test("should continue gracefully when backup fails", async () => {
      const mockValidation = {
        isValid: false,
        details: { sessionExists: true },
        issues: [
          "Local Storage directory is empty - indicates potential corruption",
        ],
        warnings: [],
      };

      recoveryManager._validateSession = jest
        .fn()
        .mockResolvedValue(mockValidation);
      recoveryManager._createRecoveryBackup = jest.fn().mockResolvedValue({
        success: false,
        error: "Backup failed",
      });

      const result = await recoveryManager.performRecovery();

      expect(result.backupCreated).toBe(false);
      expect(result.recoveryPerformed).toBe(true); // Should still attempt recovery
    });
  });
});

describe("Utility Functions Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock path operations
    path.join.mockImplementation((...args) => args.join("/"));

    // Mock fs operations
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockImplementation(() => {});
    fs.rmSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => {});
    fs.readFileSync.mockImplementation(() =>
      JSON.stringify({ version: "1.0" })
    );
    fs.readdirSync.mockReturnValue(["file1.txt"]);
    fs.statSync.mockReturnValue({
      isDirectory: () => false,
      size: 1024,
      mtime: new Date(),
      birthtime: new Date(),
    });
  });

  describe("performAutomaticRecovery", () => {
    test("should perform automatic recovery successfully", async () => {
      const result = await performAutomaticRecovery("/test/session", {
        maxRecoveryTime: 5000,
      });

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.duration).toBeDefined();
    });
  });

  describe("assessRecoveryNeeds", () => {
    test("should assess recovery needs correctly", async () => {
      const assessment = await assessRecoveryNeeds("/test/session");

      expect(assessment).toBeDefined();
      expect(assessment.recoveryNeeded).toBeDefined();
      expect(assessment.recommendation).toBeDefined();
    });
  });
});
