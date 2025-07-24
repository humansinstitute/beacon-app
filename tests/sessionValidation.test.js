import {
  validateSessionData,
  validateMultipleSessions,
  discoverSessionDirectories,
  quickValidateSession,
} from "../app/utils/sessionValidation.js";
import fs from "fs";
import path from "path";
import { jest } from "@jest/globals";

// Mock fs module
jest.mock("fs");
jest.mock("path");

describe("Session Validation", () => {
  let mockSessionPath;
  let originalCwd;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Store original cwd
    originalCwd = process.cwd;

    // Mock session path
    mockSessionPath = "/test/path/.wwebjs_auth_test";

    // Mock path.join to return predictable paths
    path.join.mockImplementation((...args) => args.join("/"));

    // Mock process.cwd
    process.cwd = jest.fn().mockReturnValue("/test/path");
  });

  afterEach(() => {
    // Restore original cwd
    process.cwd = originalCwd;
  });

  describe("validateSessionData", () => {
    test("should return invalid result when session directory does not exist", () => {
      fs.existsSync.mockReturnValue(false);

      const result = validateSessionData(mockSessionPath);

      expect(result.isValid).toBe(false);
      expect(result.sessionPath).toBe(mockSessionPath);
      expect(result.details.sessionExists).toBe(false);
      expect(result.issues).toContain(
        `Session directory does not exist: ${mockSessionPath}`
      );
      expect(result.validationDuration).toBeGreaterThan(0);
    });

    test("should validate required directories and files for valid session", () => {
      // Mock session directory exists - return true for all paths to simulate valid session
      fs.existsSync.mockReturnValue(true);

      // Mock session stats
      const mockStats = {
        mtime: new Date("2024-01-01T00:00:00Z"),
        isDirectory: () => true,
      };
      fs.statSync.mockReturnValue(mockStats);

      // Mock directory reading for size calculation - return non-empty arrays
      fs.readdirSync.mockImplementation((dirPath) => {
        if (
          dirPath.includes("Local Storage") ||
          dirPath.includes("IndexedDB")
        ) {
          return ["data.db", "manifest.json"]; // Non-empty to avoid corruption detection
        }
        return ["file1.txt", "file2.txt"];
      });

      fs.statSync.mockImplementation((filePath) => {
        if (filePath === mockSessionPath) {
          return mockStats;
        }
        return {
          isDirectory: () => false,
          size: 1048576, // 1MB to avoid size warning
        };
      });

      const result = validateSessionData(mockSessionPath);

      expect(result.isValid).toBe(true);
      expect(result.details.sessionExists).toBe(true);
      expect(result.details.requiredDirectories.missing).toHaveLength(0);
      expect(result.details.requiredFiles.missing).toHaveLength(0);
      expect(result.details.authenticationFiles.missing).toHaveLength(0);
      expect(result.issues).toHaveLength(0);
    });

    test("should detect missing required directories", () => {
      // Mock session directory exists but missing subdirectories
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === mockSessionPath) return true;
        if (filePath.includes("Default/Local Storage")) return false; // Missing
        return true;
      });

      const mockStats = {
        mtime: new Date("2024-01-01T00:00:00Z"),
      };
      fs.statSync.mockReturnValue(mockStats);
      fs.readdirSync.mockReturnValue([]);

      const result = validateSessionData(mockSessionPath);

      expect(result.isValid).toBe(false);
      expect(result.details.requiredDirectories.missing).toContain(
        "Default/Local Storage"
      );
      expect(
        result.issues.some((issue) =>
          issue.includes("Missing required directory")
        )
      ).toBe(true);
    });

    test("should detect missing required files", () => {
      // Mock session directory exists but missing files
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === mockSessionPath) return true;
        if (filePath.includes("Default") && !filePath.includes("/"))
          return true; // Directory exists
        if (filePath.includes("Default/Preferences")) return false; // Missing file
        if (filePath.includes("Default/Local State")) return false; // Missing file
        return true;
      });

      const mockStats = {
        mtime: new Date("2024-01-01T00:00:00Z"),
      };
      fs.statSync.mockReturnValue(mockStats);
      fs.readdirSync.mockReturnValue([]);

      const result = validateSessionData(mockSessionPath);

      expect(result.isValid).toBe(false);
      expect(result.details.requiredFiles.missing).toContain(
        "Default/Preferences"
      );
      expect(result.details.requiredFiles.missing).toContain(
        "Default/Local State"
      );
      expect(
        result.issues.some((issue) => issue.includes("Missing required file"))
      ).toBe(true);
    });

    test("should detect missing critical authentication files", () => {
      // Mock session directory exists but missing auth files
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === mockSessionPath) return true;
        if (filePath.includes("Default") && !filePath.includes("leveldb"))
          return true;
        if (filePath.includes("leveldb")) return false; // Missing auth files
        return true;
      });

      const mockStats = {
        mtime: new Date("2024-01-01T00:00:00Z"),
      };
      fs.statSync.mockReturnValue(mockStats);
      fs.readdirSync.mockReturnValue([]);

      const result = validateSessionData(mockSessionPath);

      expect(result.isValid).toBe(false);
      expect(result.details.authenticationFiles.missing.length).toBeGreaterThan(
        0
      );
      expect(
        result.issues.some((issue) =>
          issue.includes("Missing critical authentication file")
        )
      ).toBe(true);
    });

    test("should warn about small session size", () => {
      // Mock valid session but small size
      fs.existsSync.mockReturnValue(true);

      const mockStats = {
        mtime: new Date("2024-01-01T00:00:00Z"),
      };
      fs.statSync.mockReturnValue(mockStats);

      // Mock small directory size (less than 1MB)
      fs.readdirSync.mockReturnValue(["small-file.txt"]);
      fs.statSync.mockImplementation((filePath) => {
        if (filePath === mockSessionPath) {
          return mockStats;
        }
        return {
          isDirectory: () => false,
          size: 100, // Very small file
        };
      });

      const result = validateSessionData(mockSessionPath);

      expect(
        result.warnings.some((warning) =>
          warning.includes("Session directory size is unusually small")
        )
      ).toBe(true);
    });

    test("should handle validation errors gracefully", () => {
      fs.existsSync.mockImplementation(() => {
        throw new Error("File system error");
      });

      const result = validateSessionData(mockSessionPath);

      expect(result.isValid).toBe(false);
      expect(
        result.issues.some((issue) => issue.includes("Validation error"))
      ).toBe(true);
    });

    test("should detect corruption indicators", () => {
      // Mock session with empty critical directories
      fs.existsSync.mockReturnValue(true);

      const mockStats = {
        mtime: new Date("2024-01-01T00:00:00Z"),
      };
      fs.statSync.mockReturnValue(mockStats);

      // Mock empty directories (corruption indicator)
      fs.readdirSync.mockImplementation((dirPath) => {
        if (
          dirPath.includes("Local Storage") ||
          dirPath.includes("IndexedDB")
        ) {
          return []; // Empty directory indicates corruption
        }
        return ["file.txt"];
      });

      const result = validateSessionData(mockSessionPath);

      expect(
        result.issues.some((issue) =>
          issue.includes("indicates potential corruption")
        )
      ).toBe(true);
    });
  });

  describe("validateMultipleSessions", () => {
    test("should validate multiple session directories", () => {
      const sessionPaths = [
        "/test/.wwebjs_auth_1",
        "/test/.wwebjs_auth_2",
        "/test/.wwebjs_auth_3",
      ];

      // Mock first session as valid, second as invalid, third as valid
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes("_1") || filePath.includes("_3")) {
          return true; // Valid sessions - return true for all paths
        }
        if (filePath.includes("_2")) {
          return false; // Invalid session - directory doesn't exist
        }
        return true;
      });

      const mockStats = {
        mtime: new Date("2024-01-01T00:00:00Z"),
      };
      fs.statSync.mockReturnValue(mockStats);

      // Mock directory reading for valid sessions
      fs.readdirSync.mockImplementation((dirPath) => {
        if (
          dirPath.includes("Local Storage") ||
          dirPath.includes("IndexedDB")
        ) {
          return ["data.db", "manifest.json"];
        }
        return ["file.txt"];
      });

      const result = validateMultipleSessions(sessionPaths);

      expect(result.totalSessions).toBe(3);
      expect(result.validSessions).toBe(2);
      expect(result.invalidSessions).toBe(1);
      expect(result.sessions).toHaveLength(3);
      expect(result.validationDuration).toBeGreaterThan(0);
    });

    test("should handle empty session paths array", () => {
      const result = validateMultipleSessions([]);

      expect(result.totalSessions).toBe(0);
      expect(result.validSessions).toBe(0);
      expect(result.invalidSessions).toBe(0);
      expect(result.sessions).toHaveLength(0);
    });
  });

  describe("discoverSessionDirectories", () => {
    test("should discover WhatsApp session directories", () => {
      const mockFiles = [
        ".wwebjs_auth_1",
        ".wwebjs_auth_standalone",
        ".wwebjs_auth_test",
        "other-directory",
        "file.txt",
      ];

      fs.readdirSync.mockReturnValue(mockFiles);
      fs.statSync.mockImplementation((filePath) => ({
        isDirectory: () => filePath.includes(".wwebjs_auth_"),
      }));

      const result = discoverSessionDirectories("/test/path");

      expect(result).toHaveLength(3);
      expect(result).toContain("/test/path/.wwebjs_auth_1");
      expect(result).toContain("/test/path/.wwebjs_auth_standalone");
      expect(result).toContain("/test/path/.wwebjs_auth_test");
      expect(result).not.toContain("/test/path/other-directory");
    });

    test("should return empty array when no session directories found", () => {
      fs.readdirSync.mockReturnValue(["other-file.txt", "another-dir"]);
      fs.statSync.mockReturnValue({ isDirectory: () => true });

      const result = discoverSessionDirectories("/test/path");

      expect(result).toHaveLength(0);
    });

    test("should handle directory read errors gracefully", () => {
      fs.readdirSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = discoverSessionDirectories("/test/path");

      expect(result).toHaveLength(0);
    });

    test("should sort discovered session directories", () => {
      const mockFiles = [".wwebjs_auth_z", ".wwebjs_auth_a", ".wwebjs_auth_m"];

      fs.readdirSync.mockReturnValue(mockFiles);
      fs.statSync.mockReturnValue({ isDirectory: () => true });

      const result = discoverSessionDirectories("/test/path");

      expect(result[0]).toContain(".wwebjs_auth_a");
      expect(result[1]).toContain(".wwebjs_auth_m");
      expect(result[2]).toContain(".wwebjs_auth_z");
    });
  });

  describe("quickValidateSession", () => {
    test("should return true for valid session structure", () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === mockSessionPath) return true;
        if (filePath.includes("Default")) return true;
        if (filePath.includes("Local Storage")) return true;
        return false;
      });

      const result = quickValidateSession(mockSessionPath);

      expect(result).toBe(true);
    });

    test("should return false when session directory does not exist", () => {
      fs.existsSync.mockReturnValue(false);

      const result = quickValidateSession(mockSessionPath);

      expect(result).toBe(false);
    });

    test("should return false when Default directory is missing", () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === mockSessionPath) return true;
        if (filePath.includes("Default")) return false;
        return true;
      });

      const result = quickValidateSession(mockSessionPath);

      expect(result).toBe(false);
    });

    test("should return false when Local Storage directory is missing", () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === mockSessionPath) return true;
        if (filePath.includes("Default") && !filePath.includes("Local Storage"))
          return true;
        if (filePath.includes("Local Storage")) return false;
        return true;
      });

      const result = quickValidateSession(mockSessionPath);

      expect(result).toBe(false);
    });

    test("should handle file system errors gracefully", () => {
      fs.existsSync.mockImplementation(() => {
        throw new Error("File system error");
      });

      const result = quickValidateSession(mockSessionPath);

      expect(result).toBe(false);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    test("should handle null or undefined session paths", () => {
      const resultNull = validateSessionData(null);
      const resultUndefined = validateSessionData(undefined);

      expect(resultNull.isValid).toBe(false);
      expect(resultUndefined.isValid).toBe(false);
    });

    test("should handle very long session paths", () => {
      const longPath = "/very/long/path/".repeat(100) + ".wwebjs_auth_test";
      fs.existsSync.mockReturnValue(false);

      const result = validateSessionData(longPath);

      expect(result.isValid).toBe(false);
      expect(result.sessionPath).toBe(longPath);
    });

    test("should handle special characters in session paths", () => {
      const specialPath =
        "/test/path with spaces/.wwebjs_auth_special-chars_123";
      fs.existsSync.mockReturnValue(false);

      const result = validateSessionData(specialPath);

      expect(result.sessionPath).toBe(specialPath);
    });
  });

  describe("Performance Tests", () => {
    test("should complete validation within reasonable time", () => {
      fs.existsSync.mockReturnValue(true);
      const mockStats = {
        mtime: new Date("2024-01-01T00:00:00Z"),
      };
      fs.statSync.mockReturnValue(mockStats);
      fs.readdirSync.mockReturnValue(["file.txt"]);

      const startTime = Date.now();
      const result = validateSessionData(mockSessionPath);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.validationDuration).toBeLessThan(1000);
    });

    test("should handle large directory structures efficiently", () => {
      fs.existsSync.mockReturnValue(true);
      const mockStats = {
        mtime: new Date("2024-01-01T00:00:00Z"),
      };
      fs.statSync.mockReturnValue(mockStats);

      // Mock large directory with many files
      const manyFiles = Array.from({ length: 1000 }, (_, i) => `file${i}.txt`);
      fs.readdirSync.mockReturnValue(manyFiles);

      const result = validateSessionData(mockSessionPath);

      expect(result.validationDuration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
