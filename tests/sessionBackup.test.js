/**
 * Session Backup Utility Tests
 * Comprehensive tests for session backup and restore functionality
 */

import { jest } from "@jest/globals";
import fs from "fs";
import path from "path";
import {
  SessionBackupManager,
  createQuickBackup,
  restoreLatestBackup,
} from "../app/utils/sessionBackup.js";

// Mock fs and path modules
jest.mock("fs");
jest.mock("path");

// Test directories
const testBaseDir = "/test/data/backup_tests";
const testSessionDir = "/test/data/backup_tests/test_session";
const testBackupDir = "/test/data/backup_tests/test_backups";

describe("SessionBackupManager", () => {
  let backupManager;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock path.join to return predictable paths
    path.join.mockImplementation((...args) => args.join("/"));
    path.dirname.mockImplementation((filePath) => {
      const parts = filePath.split("/");
      return parts.slice(0, -1).join("/");
    });
    path.basename.mockImplementation((filePath) => {
      const parts = filePath.split("/");
      return parts[parts.length - 1];
    });

    // Mock fs methods with default implementations
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockImplementation(() => {});
    fs.rmSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => {});
    fs.readFileSync.mockImplementation(() => "mock file content");
    fs.copyFileSync.mockImplementation(() => {});
    fs.readdirSync.mockReturnValue([]);
    fs.statSync.mockReturnValue({
      isDirectory: () => false,
      size: 1024,
      mtime: new Date(),
      birthtime: new Date(),
    });

    // Initialize backup manager with test directory
    backupManager = new SessionBackupManager({
      backupBaseDir: testBackupDir,
      maxBackups: 5,
    });
  });

  afterEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    test("should initialize with default options", () => {
      const manager = new SessionBackupManager();
      expect(manager.backupBaseDir).toBe(
        path.join(process.cwd(), ".wwebjs_backups")
      );
      expect(manager.maxBackups).toBe(10);
      expect(manager.compressionEnabled).toBe(false);
    });

    test("should initialize with custom options", () => {
      const options = {
        backupBaseDir: "/custom/backup/dir",
        maxBackups: 3,
        compressionEnabled: true,
      };
      const manager = new SessionBackupManager(options);
      expect(manager.backupBaseDir).toBe("/custom/backup/dir");
      expect(manager.maxBackups).toBe(3);
      expect(manager.compressionEnabled).toBe(true);
    });
  });

  describe("createBackup", () => {
    beforeEach(() => {
      // Create mock session structure
      createMockSessionStructure(testSessionDir);
    });

    test("should create backup successfully", async () => {
      const result = await backupManager.createBackup(testSessionDir, {
        reason: "test_backup",
        includeMetadata: true,
      });

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeTruthy();
      expect(result.metadata).toBeTruthy();
      expect(result.stats.filesBackedUp).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(fs.existsSync(result.backupPath)).toBe(true);

      // Check metadata file exists
      const metadataPath = path.join(result.backupPath, "backup_metadata.json");
      expect(fs.existsSync(metadataPath)).toBe(true);

      // Verify metadata content
      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
      expect(metadata.version).toBe("1.0");
      expect(metadata.reason).toBe("test_backup");
      expect(metadata.source.path).toBe(testSessionDir);
    });

    test("should fail when session directory does not exist", async () => {
      const nonExistentPath = path.join(testBaseDir, "non_existent");
      const result = await backupManager.createBackup(nonExistentPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Session directory does not exist");
    });

    test("should create backup without metadata when disabled", async () => {
      const result = await backupManager.createBackup(testSessionDir, {
        includeMetadata: false,
      });

      expect(result.success).toBe(true);
      expect(result.metadata).toBeNull();

      const metadataPath = path.join(result.backupPath, "backup_metadata.json");
      expect(fs.existsSync(metadataPath)).toBe(false);
    });

    test("should preserve directory structure by default", async () => {
      const result = await backupManager.createBackup(testSessionDir);

      expect(result.success).toBe(true);

      // Check that directory structure is preserved
      const defaultDir = path.join(result.backupPath, "Default");
      const localStorageDir = path.join(
        result.backupPath,
        "Default",
        "Local Storage"
      );

      expect(fs.existsSync(defaultDir)).toBe(true);
      expect(fs.existsSync(localStorageDir)).toBe(true);
    });

    test("should handle backup creation errors gracefully", async () => {
      // Create a session directory with restricted permissions
      const restrictedDir = path.join(testSessionDir, "restricted");
      fs.mkdirSync(restrictedDir);

      // Mock fs.copyFileSync to throw an error
      const originalCopyFileSync = fs.copyFileSync;
      fs.copyFileSync = jest.fn().mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = await backupManager.createBackup(testSessionDir);

      // Restore original function
      fs.copyFileSync = originalCopyFileSync;

      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
    });
  });

  describe("restoreFromBackup", () => {
    let backupPath;

    beforeEach(async () => {
      // Create mock session and backup
      createMockSessionStructure(testSessionDir);
      const backupResult = await backupManager.createBackup(testSessionDir, {
        reason: "test_restore",
      });
      backupPath = backupResult.backupPath;
    });

    test("should restore backup successfully", async () => {
      const targetPath = path.join(testBaseDir, "restored_session");

      const result = await backupManager.restoreFromBackup(
        backupPath,
        targetPath,
        {
          overwriteExisting: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.restoredPath).toBe(targetPath);
      expect(result.stats.filesRestored).toBeGreaterThan(0);
      expect(fs.existsSync(targetPath)).toBe(true);

      // Verify restored structure
      const defaultDir = path.join(targetPath, "Default");
      expect(fs.existsSync(defaultDir)).toBe(true);
    });

    test("should fail when backup does not exist", async () => {
      const nonExistentBackup = path.join(testBackupDir, "non_existent");
      const targetPath = path.join(testBaseDir, "restored_session");

      const result = await backupManager.restoreFromBackup(
        nonExistentBackup,
        targetPath
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Backup directory does not exist");
    });

    test("should fail when target exists and overwrite is disabled", async () => {
      const targetPath = path.join(testBaseDir, "existing_target");
      fs.mkdirSync(targetPath);

      const result = await backupManager.restoreFromBackup(
        backupPath,
        targetPath,
        {
          overwriteExisting: false,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Target session path already exists");
    });

    test("should create backup of existing target when enabled", async () => {
      const targetPath = path.join(testBaseDir, "existing_target");
      createMockSessionStructure(targetPath);

      const result = await backupManager.restoreFromBackup(
        backupPath,
        targetPath,
        {
          overwriteExisting: true,
          createTargetBackup: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.targetBackupPath).toBeTruthy();
      expect(fs.existsSync(result.targetBackupPath)).toBe(true);
    });

    test("should validate backup before restore when enabled", async () => {
      // Create invalid backup (remove essential files)
      const invalidBackupPath = path.join(testBackupDir, "invalid_backup");
      fs.mkdirSync(invalidBackupPath, { recursive: true });

      const targetPath = path.join(testBaseDir, "restored_session");

      const result = await backupManager.restoreFromBackup(
        invalidBackupPath,
        targetPath,
        {
          validateBeforeRestore: true,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Backup validation failed");
    });
  });

  describe("listBackups", () => {
    beforeEach(async () => {
      // Create multiple test backups
      createMockSessionStructure(testSessionDir);

      await backupManager.createBackup(testSessionDir, { reason: "backup1" });
      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay for different timestamps
      await backupManager.createBackup(testSessionDir, { reason: "backup2" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await backupManager.createBackup(testSessionDir, { reason: "backup3" });
    });

    test("should list all backups", async () => {
      const backups = await backupManager.listBackups();

      expect(backups).toHaveLength(3);
      expect(backups[0].reason).toBe("backup3"); // Most recent first
      expect(backups[1].reason).toBe("backup2");
      expect(backups[2].reason).toBe("backup1");
    });

    test("should include metadata when requested", async () => {
      const backups = await backupManager.listBackups({
        includeMetadata: true,
      });

      expect(backups).toHaveLength(3);
      expect(backups[0].metadata).toBeTruthy();
      expect(backups[0].metadata.reason).toBe("backup3");
    });

    test("should sort by size when requested", async () => {
      const backups = await backupManager.listBackups({ sortBy: "size" });

      expect(backups).toHaveLength(3);
      // All backups should have similar sizes, but verify sorting works
      for (let i = 0; i < backups.length - 1; i++) {
        expect(backups[i].size).toBeGreaterThanOrEqual(backups[i + 1].size);
      }
    });

    test("should return empty array when no backups exist", async () => {
      // Remove all backups
      if (fs.existsSync(testBackupDir)) {
        fs.rmSync(testBackupDir, { recursive: true, force: true });
      }

      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(0);
    });
  });

  describe("deleteBackup", () => {
    let backupPath;

    beforeEach(async () => {
      createMockSessionStructure(testSessionDir);
      const result = await backupManager.createBackup(testSessionDir);
      backupPath = result.backupPath;
    });

    test("should delete backup successfully", async () => {
      expect(fs.existsSync(backupPath)).toBe(true);

      const result = await backupManager.deleteBackup(backupPath);

      expect(result).toBe(true);
      expect(fs.existsSync(backupPath)).toBe(false);
    });

    test("should handle non-existent backup gracefully", async () => {
      const nonExistentPath = path.join(testBackupDir, "non_existent");

      const result = await backupManager.deleteBackup(nonExistentPath);
      expect(result).toBe(true);
    });
  });

  describe("cleanup old backups", () => {
    test("should cleanup old backups when limit exceeded", async () => {
      // Set low backup limit
      backupManager.maxBackups = 2;

      createMockSessionStructure(testSessionDir);

      // Create 4 backups
      await backupManager.createBackup(testSessionDir, { reason: "backup1" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await backupManager.createBackup(testSessionDir, { reason: "backup2" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await backupManager.createBackup(testSessionDir, { reason: "backup3" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await backupManager.createBackup(testSessionDir, { reason: "backup4" });

      const backups = await backupManager.listBackups();

      // Should only have 2 backups (most recent)
      expect(backups.length).toBeLessThanOrEqual(2);
      if (backups.length === 2) {
        expect(backups[0].reason).toBe("backup4");
        expect(backups[1].reason).toBe("backup3");
      }
    });
  });
});

describe("Utility Functions", () => {
  const testBaseDir = path.join(__dirname, "test_data", "utility_tests");
  const testSessionDir = path.join(testBaseDir, "test_session");

  beforeEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testBaseDir, { recursive: true });
    createMockSessionStructure(testSessionDir);
  });

  afterEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe("createQuickBackup", () => {
    test("should create quick backup successfully", async () => {
      const result = await createQuickBackup(testSessionDir, "quick_test");

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeTruthy();
      expect(fs.existsSync(result.backupPath)).toBe(true);
    });
  });

  describe("restoreLatestBackup", () => {
    test("should restore latest backup successfully", async () => {
      // Create a backup first
      await createQuickBackup(testSessionDir, "restore_test");

      const targetPath = path.join(testBaseDir, "restored");
      const sessionName = path.basename(testSessionDir);

      const result = await restoreLatestBackup(sessionName, targetPath);

      expect(result.success).toBe(true);
      expect(fs.existsSync(targetPath)).toBe(true);
    });

    test("should fail when no backups exist", async () => {
      const targetPath = path.join(testBaseDir, "restored");

      await expect(
        restoreLatestBackup("non_existent_session", targetPath)
      ).rejects.toThrow("No backups found for session");
    });
  });
});

/**
 * Helper function to create mock session structure
 */
function createMockSessionStructure(sessionPath) {
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

  // Create files
  const files = [
    "Default/Preferences",
    "Default/Local State",
    "Default/Cookies",
    "Default/Web Data",
    "Default/Local Storage/leveldb/CURRENT",
    "Default/Local Storage/leveldb/MANIFEST-000001",
    "Default/IndexedDB/https_web.whatsapp.com_0.indexeddb.leveldb/CURRENT",
  ];

  for (const file of files) {
    const filePath = path.join(sessionPath, file);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `Mock content for ${file}`);
  }
}
