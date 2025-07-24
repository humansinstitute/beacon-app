/**
 * Dedicated unit tests for LockFileManager
 *
 * Comprehensive tests for lock file management including race conditions,
 * stale lock detection, and error handling scenarios.
 */

import { jest } from "@jest/globals";
import fs from "fs";
import path from "path";
import { LockFileManager } from "../app/utils/instanceManager.js";

// Mock dependencies
jest.mock("fs");
jest.mock("../app/utils/sessionDiagnostics.js", () => ({
  logDiagnostic: jest.fn(),
}));

describe("LockFileManager", () => {
  let lockManager;
  let originalPid;
  let originalKill;
  const testLockPath = "/test/path/.wwebjs.lock";

  beforeEach(() => {
    // Save original values
    originalPid = process.pid;
    originalKill = process.kill;

    // Set test PID
    Object.defineProperty(process, "pid", { value: 12345, configurable: true });

    // Initialize lock manager
    lockManager = new LockFileManager(testLockPath);

    // Reset mocks
    jest.clearAllMocks();

    // Mock fs methods
    fs.existsSync = jest.fn();
    fs.readFileSync = jest.fn();
    fs.writeFileSync = jest.fn();
    fs.unlinkSync = jest.fn();
    fs.statSync = jest.fn();
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(process, "pid", {
      value: originalPid,
      configurable: true,
    });
    process.kill = originalKill;
  });

  describe("Lock Acquisition Race Conditions", () => {
    test("should handle concurrent lock acquisition attempts", async () => {
      fs.existsSync.mockReturnValue(false);

      // Simulate race condition where file appears between check and write
      let writeCallCount = 0;
      fs.writeFileSync.mockImplementation(() => {
        writeCallCount++;
        if (writeCallCount === 1) {
          // First write succeeds
          return;
        }
        // Subsequent writes fail (file already exists)
        const error = new Error("File exists");
        error.code = "EEXIST";
        throw error;
      });

      const result = await lockManager.acquireLock();
      expect(result).toBe(true);
    });

    test("should handle file system errors during lock acquisition", async () => {
      fs.existsSync.mockImplementation(() => {
        throw new Error("File system error");
      });

      await expect(lockManager.acquireLock({ retries: 0 })).rejects.toThrow(
        "File system error"
      );
    });

    test("should handle corrupted lock file data", async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue("corrupted json data {");

      const result = await lockManager.acquireLock();

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe("Stale Lock Detection", () => {
    test("should detect and remove stale locks based on timestamp", async () => {
      const staleTimestamp = Date.now() - 60000; // 1 minute ago
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          pid: 99999,
          timestamp: staleTimestamp,
          instanceId: "stale-instance",
        })
      );

      // Mock process.kill to succeed first (process exists), then fail after removal
      let killCallCount = 0;
      process.kill = jest.fn().mockImplementation((pid, signal) => {
        killCallCount++;
        if (killCallCount === 1) {
          // First check: process appears to exist
          return;
        }
        // Second check: process doesn't exist after stale removal
        const error = new Error("No such process");
        error.code = "ESRCH";
        throw error;
      });

      const result = await lockManager.acquireLock({ timeout: 30000 });

      expect(result).toBe(true);
      expect(fs.unlinkSync).toHaveBeenCalledWith(testLockPath);
      expect(process.kill).toHaveBeenCalledTimes(2);
    });

    test("should not remove lock if process is still running even when stale", async () => {
      const staleTimestamp = Date.now() - 60000;
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          pid: 99999,
          timestamp: staleTimestamp,
        })
      );

      // Mock process.kill to always succeed (process always exists)
      process.kill = jest.fn();

      await expect(
        lockManager.acquireLock({ timeout: 30000, retries: 0 })
      ).rejects.toThrow("Another instance is running");

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    test("should handle permission errors when checking process existence", async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          pid: 99999,
          timestamp: Date.now() - 1000,
        })
      );

      // Mock process.kill to throw EPERM (permission denied)
      process.kill = jest.fn().mockImplementation(() => {
        const error = new Error("Operation not permitted");
        error.code = "EPERM";
        throw error;
      });

      await expect(lockManager.acquireLock({ retries: 0 })).rejects.toThrow(
        "Another instance is running"
      );
    });
  });

  describe("Legacy Lock File Support", () => {
    test("should handle legacy lock files with PID only", async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue("99999"); // Just PID, no JSON
      fs.statSync.mockReturnValue({
        mtime: new Date(Date.now() - 5000),
      });

      // Mock process not existing
      process.kill = jest.fn().mockImplementation(() => {
        const error = new Error("No such process");
        error.code = "ESRCH";
        throw error;
      });

      const result = await lockManager.acquireLock();

      expect(result).toBe(true);
      expect(fs.unlinkSync).toHaveBeenCalledWith(testLockPath);
    });

    test("should handle invalid legacy lock file content", async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue("not-a-number");
      fs.statSync.mockReturnValue({
        mtime: new Date(Date.now() - 5000),
      });

      const result = await lockManager.acquireLock();

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe("Lock Release Edge Cases", () => {
    test("should handle lock file disappearing during release", async () => {
      fs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          pid: 12345,
          timestamp: Date.now(),
        })
      );

      const result = await lockManager.releaseLock();

      expect(result).toBe(true);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    test("should handle file system errors during release", async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = await lockManager.releaseLock();

      expect(result).toBe(false);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    test("should handle unlock file deletion errors", async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          pid: 12345,
          timestamp: Date.now(),
        })
      );
      fs.unlinkSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = await lockManager.releaseLock();

      expect(result).toBe(false);
    });
  });

  describe("Lock Information Retrieval", () => {
    test("should return comprehensive lock information", async () => {
      const lockData = {
        pid: 99999,
        timestamp: Date.now() - 5000,
        instanceId: "test-instance",
        nodeVersion: "v18.0.0",
        platform: "linux",
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(lockData));

      // Mock process exists
      process.kill = jest.fn();

      const info = await lockManager.getLockInfo();

      expect(info).toMatchObject({
        pid: 99999,
        instanceId: "test-instance",
        nodeVersion: "v18.0.0",
        platform: "linux",
        isRunning: true,
        isStale: false,
      });
      expect(info.age).toBeGreaterThan(4000);
      expect(info.age).toBeLessThan(6000);
    });

    test("should handle lock info for dead process", async () => {
      const lockData = {
        pid: 99999,
        timestamp: Date.now() - 5000,
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(lockData));

      // Mock process doesn't exist
      process.kill = jest.fn().mockImplementation(() => {
        const error = new Error("No such process");
        error.code = "ESRCH";
        throw error;
      });

      const info = await lockManager.getLockInfo();

      expect(info.isRunning).toBe(false);
    });

    test("should handle corrupted lock file in getLockInfo", async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue("invalid json");

      const info = await lockManager.getLockInfo();

      expect(info).toBeNull();
    });
  });

  describe("Retry Mechanism", () => {
    test("should retry lock acquisition with exponential backoff", async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync
        .mockReturnValueOnce(
          JSON.stringify({ pid: 99999, timestamp: Date.now() })
        )
        .mockReturnValueOnce(
          JSON.stringify({ pid: 99999, timestamp: Date.now() })
        )
        .mockReturnValue("invalid");

      // Mock process exists for first two attempts, then doesn't exist
      let killCallCount = 0;
      process.kill = jest.fn().mockImplementation(() => {
        killCallCount++;
        if (killCallCount <= 2) {
          return; // Process exists
        }
        const error = new Error("No such process");
        error.code = "ESRCH";
        throw error;
      });

      const startTime = Date.now();
      const result = await lockManager.acquireLock({
        retries: 2,
        timeout: 1000,
      });
      const duration = Date.now() - startTime;

      expect(result).toBe(true);
      expect(duration).toBeGreaterThan(1900); // Should have waited ~2 seconds
      expect(process.kill).toHaveBeenCalledTimes(3);
    });

    test("should fail after maximum retries", async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          pid: 99999,
          timestamp: Date.now(),
        })
      );

      // Mock process always exists
      process.kill = jest.fn();

      await expect(
        lockManager.acquireLock({ retries: 2, timeout: 1000 })
      ).rejects.toThrow("Failed to acquire lock after 3 attempts");
    });
  });

  describe("Configuration Options", () => {
    test("should use custom timeout values", async () => {
      const customTimeout = 5000;
      const customRetries = 1;

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          pid: 99999,
          timestamp: Date.now() - (customTimeout + 1000), // Older than timeout
        })
      );

      // Mock process exists initially, then doesn't after stale removal
      let killCallCount = 0;
      process.kill = jest.fn().mockImplementation(() => {
        killCallCount++;
        if (killCallCount === 1) {
          return;
        }
        const error = new Error("No such process");
        error.code = "ESRCH";
        throw error;
      });

      const result = await lockManager.acquireLock({
        timeout: customTimeout,
        retries: customRetries,
      });

      expect(result).toBe(true);
      expect(fs.unlinkSync).toHaveBeenCalled(); // Stale lock removed
    });

    test("should use custom lock file path", () => {
      const customPath = "/custom/path/.lock";
      const customLockManager = new LockFileManager(customPath);

      expect(customLockManager.lockFilePath).toBe(customPath);
    });
  });

  describe("Error Handling", () => {
    test("should handle unexpected errors during lock acquisition", async () => {
      fs.existsSync.mockImplementation(() => {
        throw new Error("Unexpected file system error");
      });

      await expect(lockManager.acquireLock({ retries: 0 })).rejects.toThrow(
        "Unexpected file system error"
      );
    });

    test("should handle write errors during lock creation", async () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {
        throw new Error("Disk full");
      });

      await expect(lockManager.acquireLock({ retries: 0 })).rejects.toThrow(
        "Disk full"
      );
    });

    test("should handle process.kill throwing unexpected errors", async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          pid: 99999,
          timestamp: Date.now(),
        })
      );

      process.kill = jest.fn().mockImplementation(() => {
        throw new Error("Unexpected kill error");
      });

      await expect(lockManager.acquireLock({ retries: 0 })).rejects.toThrow(
        "Another instance is running"
      );
    });
  });
});
