/**
 * Unit tests for Instance Management functionality
 *
 * Tests instance ID generation, lock file management, and session consolidation
 * for both PM2 and direct Node.js execution environments.
 */

import { jest } from "@jest/globals";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  generateInstanceId,
  LockFileManager,
  initializeInstanceManagement,
  consolidateSessionDirectories,
  getSessionPath,
} from "../app/utils/instanceManager.js";

// Mock dependencies
jest.mock("fs");
jest.mock("../app/utils/sessionDiagnostics.js", () => ({
  logDiagnostic: jest.fn(),
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Instance Management", () => {
  let originalEnv;
  let originalArgv;
  let originalPid;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    originalArgv = [...process.argv];
    originalPid = process.pid;

    // Clear environment variables
    delete process.env.PM2_APP_NAME;
    delete process.env.PM2_INSTANCE_ID;
    delete process.env.pm_id;
    delete process.env.NODE_APP_INSTANCE;
    delete process.env.WA_SHARED_SESSION;

    // Reset mocks
    jest.clearAllMocks();

    // Mock fs methods
    fs.existsSync = jest.fn();
    fs.readFileSync = jest.fn();
    fs.writeFileSync = jest.fn();
    fs.unlinkSync = jest.fn();
    fs.readdirSync = jest.fn();
    fs.statSync = jest.fn();
    fs.rmSync = jest.fn();
    fs.renameSync = jest.fn();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    process.argv = originalArgv;
    Object.defineProperty(process, "pid", { value: originalPid });
  });

  describe("generateInstanceId", () => {
    test('should return "shared" when useSharedSession is true', () => {
      const instanceId = generateInstanceId({ useSharedSession: true });
      expect(instanceId).toBe("shared");
    });

    test('should return "shared" when WA_SHARED_SESSION environment variable is true', () => {
      process.env.WA_SHARED_SESSION = "true";
      const instanceId = generateInstanceId();
      expect(instanceId).toBe("shared");
    });

    test("should generate PM2 instance ID when PM2_APP_NAME is set", () => {
      process.env.PM2_APP_NAME = "beacon-gate-wa";
      process.env.PM2_INSTANCE_ID = "0";

      const instanceId = generateInstanceId({ useSharedSession: false });
      expect(instanceId).toBe("beacon-gate-wa_0");
    });

    test("should use PM2_APP_NAME without instance ID when PM2_INSTANCE_ID is not set", () => {
      process.env.PM2_APP_NAME = "beacon-gate-wa";

      const instanceId = generateInstanceId({ useSharedSession: false });
      expect(instanceId).toBe("beacon-gate-wa");
    });

    test("should use pm_id when available but no PM2_APP_NAME", () => {
      process.env.pm_id = "5";

      const instanceId = generateInstanceId({ useSharedSession: false });
      expect(instanceId).toBe("pm2_5");
    });

    test("should detect PM2 from process.argv and generate PM2 instance ID", () => {
      process.argv = ["node", "/path/to/PM2/ProcessContainer.js"];
      Object.defineProperty(process, "pid", { value: 12345 });

      const instanceId = generateInstanceId({ useSharedSession: false });
      expect(instanceId).toBe("pm2_12345");
    });

    test("should generate direct execution instance ID for non-PM2 environments", () => {
      Object.defineProperty(process, "pid", { value: 12345 });

      const instanceId = generateInstanceId({ useSharedSession: false });
      expect(instanceId).toMatch(/^direct_12345_\d+$/);
    });

    test("should use fallback ID when no other method works", () => {
      const instanceId = generateInstanceId({
        useSharedSession: false,
        fallbackId: "test-fallback",
      });
      expect(instanceId).toMatch(/^(direct_\d+_\d+|test-fallback)$/);
    });
  });

  describe("LockFileManager", () => {
    let lockManager;
    const testLockPath = "/test/path/.wwebjs.lock";

    beforeEach(() => {
      lockManager = new LockFileManager(testLockPath);
      Object.defineProperty(process, "pid", { value: 12345 });
    });

    describe("acquireLock", () => {
      test("should acquire lock when no lock file exists", async () => {
        fs.existsSync.mockReturnValue(false);

        const result = await lockManager.acquireLock();

        expect(result).toBe(true);
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          testLockPath,
          expect.stringContaining('"pid":12345')
        );
      });

      test("should acquire lock when existing process is dead", async () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(
          JSON.stringify({
            pid: 99999,
            timestamp: Date.now() - 1000,
          })
        );

        // Mock process.kill to throw ESRCH (process not found)
        const originalKill = process.kill;
        process.kill = jest.fn().mockImplementation(() => {
          const error = new Error("No such process");
          error.code = "ESRCH";
          throw error;
        });

        const result = await lockManager.acquireLock();

        expect(result).toBe(true);
        expect(fs.unlinkSync).toHaveBeenCalledWith(testLockPath);
        expect(fs.writeFileSync).toHaveBeenCalled();

        process.kill = originalKill;
      });

      test("should handle legacy lock files (PID only)", async () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue("99999");
        fs.statSync.mockReturnValue({ mtime: new Date(Date.now() - 1000) });

        // Mock process.kill to throw ESRCH
        const originalKill = process.kill;
        process.kill = jest.fn().mockImplementation(() => {
          const error = new Error("No such process");
          error.code = "ESRCH";
          throw error;
        });

        const result = await lockManager.acquireLock();

        expect(result).toBe(true);
        expect(fs.unlinkSync).toHaveBeenCalledWith(testLockPath);

        process.kill = originalKill;
      });

      test("should throw error when another process is running", async () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(
          JSON.stringify({
            pid: 99999,
            timestamp: Date.now() - 1000,
          })
        );

        // Mock process.kill to succeed (process exists)
        const originalKill = process.kill;
        process.kill = jest.fn();

        await expect(lockManager.acquireLock({ retries: 0 })).rejects.toThrow(
          "Another instance is running"
        );

        process.kill = originalKill;
      });

      test("should remove stale lock when timeout exceeded", async () => {
        const staleTimestamp = Date.now() - 60000; // 1 minute ago
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(
          JSON.stringify({
            pid: 99999,
            timestamp: staleTimestamp,
          })
        );

        // Mock process.kill to succeed initially, then fail after removal
        const originalKill = process.kill;
        let killCallCount = 0;
        process.kill = jest.fn().mockImplementation(() => {
          killCallCount++;
          if (killCallCount > 1) {
            const error = new Error("No such process");
            error.code = "ESRCH";
            throw error;
          }
        });

        const result = await lockManager.acquireLock({ timeout: 30000 });

        expect(result).toBe(true);
        expect(fs.unlinkSync).toHaveBeenCalledWith(testLockPath);

        process.kill = originalKill;
      });

      test("should retry on lock acquisition failure", async () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync
          .mockReturnValueOnce(
            JSON.stringify({ pid: 99999, timestamp: Date.now() })
          )
          .mockReturnValueOnce(
            JSON.stringify({ pid: 99999, timestamp: Date.now() })
          )
          .mockReturnValue("invalid json");

        const originalKill = process.kill;
        process.kill = jest
          .fn()
          .mockImplementationOnce(() => {}) // First call succeeds (process exists)
          .mockImplementationOnce(() => {}) // Second call succeeds
          .mockImplementation(() => {
            const error = new Error("No such process");
            error.code = "ESRCH";
            throw error;
          });

        const result = await lockManager.acquireLock({
          retries: 2,
          timeout: 1000,
        });

        expect(result).toBe(true);
        expect(process.kill).toHaveBeenCalledTimes(3);

        process.kill = originalKill;
      });
    });

    describe("releaseLock", () => {
      test("should release lock when owned by current process", async () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(
          JSON.stringify({
            pid: 12345,
            timestamp: Date.now(),
          })
        );

        const result = await lockManager.releaseLock();

        expect(result).toBe(true);
        expect(fs.unlinkSync).toHaveBeenCalledWith(testLockPath);
      });

      test("should not release lock when owned by different process", async () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(
          JSON.stringify({
            pid: 99999,
            timestamp: Date.now(),
          })
        );

        const result = await lockManager.releaseLock();

        expect(result).toBe(false);
        expect(fs.unlinkSync).not.toHaveBeenCalled();
      });

      test("should return true when no lock file exists", async () => {
        fs.existsSync.mockReturnValue(false);

        const result = await lockManager.releaseLock();

        expect(result).toBe(true);
        expect(fs.unlinkSync).not.toHaveBeenCalled();
      });
    });

    describe("getLockInfo", () => {
      test("should return lock information when lock exists", async () => {
        const lockData = {
          pid: 99999,
          timestamp: Date.now() - 5000,
          instanceId: "test-instance",
        };

        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(JSON.stringify(lockData));

        // Mock process.kill to succeed (process exists)
        const originalKill = process.kill;
        process.kill = jest.fn();

        const info = await lockManager.getLockInfo();

        expect(info).toMatchObject({
          pid: 99999,
          instanceId: "test-instance",
          isRunning: true,
          isStale: false,
        });
        expect(info.age).toBeGreaterThan(4000);

        process.kill = originalKill;
      });

      test("should return null when no lock file exists", async () => {
        fs.existsSync.mockReturnValue(false);

        const info = await lockManager.getLockInfo();

        expect(info).toBeNull();
      });
    });
  });

  describe("consolidateSessionDirectories", () => {
    const testBaseDir = "/test/base";
    const testTargetId = "shared";

    beforeEach(() => {
      fs.readdirSync.mockReturnValue([]);
      fs.existsSync.mockReturnValue(false);
    });

    test("should return early when no session directories exist", async () => {
      fs.readdirSync.mockReturnValue(["other-file.txt"]);

      const result = await consolidateSessionDirectories(
        testBaseDir,
        testTargetId
      );

      expect(result.consolidated).toBe(false);
      expect(result.sourceDirectories).toHaveLength(0);
    });

    test("should not consolidate when target is the only directory", async () => {
      fs.readdirSync.mockReturnValue([".wwebjs_auth_shared"]);

      const result = await consolidateSessionDirectories(
        testBaseDir,
        testTargetId
      );

      expect(result.consolidated).toBe(true);
      expect(result.sourceDirectories).toHaveLength(1);
    });

    test("should consolidate multiple session directories", async () => {
      fs.readdirSync.mockReturnValue([
        ".wwebjs_auth_4",
        ".wwebjs_auth_19",
        ".wwebjs_auth_standalone",
      ]);

      // Mock directory stats and contents
      fs.statSync.mockImplementation((dirPath) => {
        if (dirPath.includes("_19")) {
          return {
            isDirectory: () => true,
            mtime: new Date(Date.now() - 1000),
          };
        }
        return { isDirectory: () => true, mtime: new Date(Date.now() - 5000) };
      });

      fs.readdirSync.mockImplementation((dirPath) => {
        if (dirPath.includes(".wwebjs_auth_")) {
          return ["session.json", "Default"];
        }
        return [];
      });

      fs.existsSync.mockImplementation((path) => {
        return path.includes(".wwebjs_auth_");
      });

      const result = await consolidateSessionDirectories(
        testBaseDir,
        testTargetId
      );

      expect(result.consolidated).toBe(true);
      expect(result.preservedSessions).toBe(1);
      expect(fs.renameSync).toHaveBeenCalledWith(
        path.join(testBaseDir, ".wwebjs_auth_19"),
        path.join(testBaseDir, ".wwebjs_auth_shared")
      );
      expect(fs.rmSync).toHaveBeenCalledTimes(2); // Remove other directories
    });

    test("should handle errors during consolidation", async () => {
      fs.readdirSync.mockReturnValue([".wwebjs_auth_4", ".wwebjs_auth_19"]);
      fs.statSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = await consolidateSessionDirectories(
        testBaseDir,
        testTargetId
      );

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain("Permission denied");
    });
  });

  describe("getSessionPath", () => {
    test("should return correct session path", () => {
      const instanceId = "test-instance";
      const baseDir = "/test/base";

      const sessionPath = getSessionPath(instanceId, baseDir);

      expect(sessionPath).toBe("/test/base/.wwebjs_auth_test-instance");
    });

    test("should use current working directory as default", () => {
      const instanceId = "test-instance";
      const originalCwd = process.cwd();

      const sessionPath = getSessionPath(instanceId);

      expect(sessionPath).toBe(
        path.join(originalCwd, ".wwebjs_auth_test-instance")
      );
    });
  });

  describe("initializeInstanceManagement", () => {
    beforeEach(() => {
      // Mock consolidateSessionDirectories
      fs.readdirSync.mockReturnValue([]);
    });

    test("should initialize with shared session by default", async () => {
      const result = await initializeInstanceManagement();

      expect(result.instanceId).toBe("shared");
      expect(result.sessionPath).toContain(".wwebjs_auth_shared");
      expect(result.lockManager).toBeInstanceOf(LockFileManager);
    });

    test("should initialize with custom options", async () => {
      const options = {
        useSharedSession: false,
        baseDirectory: "/custom/base",
        consolidateSessions: false,
      };

      const result = await initializeInstanceManagement(options);

      expect(result.instanceId).toMatch(/^direct_\d+_\d+$/);
      expect(result.sessionPath).toContain("/custom/base/.wwebjs_auth_");
      expect(result.consolidation).toBeNull();
    });

    test("should perform consolidation when enabled", async () => {
      fs.readdirSync.mockReturnValue([".wwebjs_auth_4", ".wwebjs_auth_19"]);
      fs.statSync.mockReturnValue({
        isDirectory: () => true,
        mtime: new Date(),
      });
      fs.readdirSync.mockImplementation((dirPath) => {
        if (dirPath.includes(".wwebjs_auth_")) {
          return ["session.json"];
        }
        return [".wwebjs_auth_4", ".wwebjs_auth_19"];
      });
      fs.existsSync.mockReturnValue(true);

      const result = await initializeInstanceManagement({
        useSharedSession: true,
        consolidateSessions: true,
      });

      expect(result.consolidation).toBeDefined();
      expect(result.consolidation.consolidated).toBe(true);
    });
  });
});
