/**
 * Session Strategy Management Unit Tests
 *
 * Tests for session strategy management, configuration,
 * migration between strategies, and integration with git.
 */

import { jest } from "@jest/globals";
import fs from "fs";
import path from "path";
import {
  SessionStrategyManager,
  createSessionStrategyManager,
  getConfiguredStrategy,
  validateStrategyConfig,
  SESSION_STRATEGIES,
} from "../app/utils/sessionStrategy.js";

// Mock dependencies
jest.mock("fs");
jest.mock("../app/utils/gitIntegration.js");
jest.mock("../app/utils/sessionBackup.js");
jest.mock("../app/utils/sessionValidation.js");

const mockFs = fs;

// Import mocked modules
import * as gitIntegration from "../app/utils/gitIntegration.js";
import * as sessionBackup from "../app/utils/sessionBackup.js";
import * as sessionValidation from "../app/utils/sessionValidation.js";

// Setup mocks
const mockGitIntegration = gitIntegration;
mockGitIntegration.detectGitBranch = jest.fn();
mockGitIntegration.determineBranchStrategy = jest.fn();
mockGitIntegration.generateBranchAwareInstanceId = jest.fn();

const mockSessionBackup = sessionBackup;
mockSessionBackup.SessionBackupManager = jest.fn().mockImplementation(() => ({
  createBackup: jest
    .fn()
    .mockResolvedValue({ success: true, backupPath: "/backup/path" }),
}));

const mockSessionValidation = sessionValidation;
mockSessionValidation.validateSessionData = jest.fn();

// Mock console methods to avoid test output pollution
const originalConsole = console;
beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

describe("Session Strategy Management", () => {
  let testBaseDirectory;

  beforeEach(() => {
    jest.clearAllMocks();
    testBaseDirectory = "/test/base";

    // Reset environment variables
    delete process.env.WA_SHARED_SESSION;
    delete process.env.WA_BRANCH_SESSIONS;
    delete process.env.WA_AUTO_MIGRATE_SESSION;
    delete process.env.WA_BRANCH_PATTERN_STRATEGY;
    delete process.env.WA_BRANCH_DETECTION;
    delete process.env.WA_MIGRATION_BACKUP;
    delete process.env.WA_TEAM_COLLABORATION;

    // Default mocks
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockReturnValue([]);
    mockFs.statSync.mockReturnValue({
      isDirectory: () => true,
      mtime: new Date(),
    });
    mockFs.mkdirSync.mockImplementation(() => {});
    mockFs.copyFileSync.mockImplementation(() => {});
    mockFs.rmSync.mockImplementation(() => {});
    mockFs.renameSync.mockImplementation(() => {});

    mockGitIntegration.detectGitBranch.mockResolvedValue({
      branch: "main",
      isGitRepository: true,
      detectionMethod: "git-command",
    });

    mockSessionValidation.validateSessionData.mockResolvedValue({
      isValid: true,
      hasAuthData: true,
    });
  });

  describe("SessionStrategyManager", () => {
    describe("constructor", () => {
      it("should initialize with default configuration", () => {
        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
        });

        expect(manager.baseDirectory).toBe(testBaseDirectory);
        expect(manager.config.defaultStrategy).toBe(SESSION_STRATEGIES.SHARED);
        expect(manager.config.autoMigrate).toBe(true);
        expect(manager.config.branchDetection).toBe(true);
      });

      it("should load configuration from environment variables", () => {
        process.env.WA_SHARED_SESSION = "false";
        process.env.WA_BRANCH_SESSIONS = "true";
        process.env.WA_AUTO_MIGRATE_SESSION = "false";

        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
        });

        expect(manager.config.defaultStrategy).toBe(
          SESSION_STRATEGIES.BRANCH_SPECIFIC
        );
        expect(manager.config.autoMigrate).toBe(false);
      });

      it("should prioritize team collaboration setting", () => {
        process.env.WA_TEAM_COLLABORATION = "true";
        process.env.WA_SHARED_SESSION = "true";

        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
        });

        expect(manager.config.defaultStrategy).toBe(SESSION_STRATEGIES.TEAM);
        expect(manager.config.teamCollaboration).toBe(true);
      });

      it("should handle pattern-based strategy configuration", () => {
        process.env.WA_BRANCH_PATTERN_STRATEGY = "true";

        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
        });

        expect(manager.config.defaultStrategy).toBe(
          SESSION_STRATEGIES.PATTERN_BASED
        );
      });
    });

    describe("initialize", () => {
      it("should initialize with shared strategy", async () => {
        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
        });

        const result = await manager.initialize();

        expect(result.strategy).toBe(SESSION_STRATEGIES.SHARED);
        expect(result.instanceId).toBe("shared");
        expect(result.sessionPath).toBe(
          path.join(testBaseDirectory, ".wwebjs_auth_shared")
        );
        expect(result.gitInfo).toBeTruthy();
      });

      it("should initialize with branch-specific strategy", async () => {
        mockGitIntegration.detectGitBranch.mockResolvedValue({
          branch: "feature/test",
          isGitRepository: true,
          detectionMethod: "git-command",
        });
        mockGitIntegration.generateBranchAwareInstanceId.mockReturnValue(
          "feature_test"
        );

        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
          config: {
            defaultStrategy: SESSION_STRATEGIES.BRANCH_SPECIFIC,
          },
        });

        const result = await manager.initialize();

        expect(result.strategy).toBe(SESSION_STRATEGIES.BRANCH_SPECIFIC);
        expect(result.instanceId).toBe("feature_test");
        expect(
          mockGitIntegration.generateBranchAwareInstanceId
        ).toHaveBeenCalledWith("feature/test", {
          strategy: "branch-specific",
          sanitize: true,
        });
      });

      it("should initialize with pattern-based strategy", async () => {
        mockGitIntegration.detectGitBranch.mockResolvedValue({
          branch: "feature/new-feature",
          isGitRepository: true,
          detectionMethod: "git-command",
        });
        mockGitIntegration.determineBranchStrategy.mockReturnValue(
          "branch-specific"
        );
        mockGitIntegration.generateBranchAwareInstanceId.mockReturnValue(
          "feature_new-feature"
        );

        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
          config: {
            defaultStrategy: SESSION_STRATEGIES.PATTERN_BASED,
          },
        });

        const result = await manager.initialize();

        expect(result.strategy).toBe(SESSION_STRATEGIES.BRANCH_SPECIFIC);
        expect(result.instanceId).toBe("feature_new-feature");
        expect(mockGitIntegration.determineBranchStrategy).toHaveBeenCalled();
      });

      it("should initialize with team strategy", async () => {
        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
          config: {
            teamCollaboration: true,
          },
        });

        const result = await manager.initialize();

        expect(result.strategy).toBe(SESSION_STRATEGIES.TEAM);
        expect(result.instanceId).toBe("team");
      });

      it("should handle git detection failure gracefully", async () => {
        mockGitIntegration.detectGitBranch.mockResolvedValue({
          branch: null,
          isGitRepository: false,
          error: "Not a git repository",
        });

        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
          config: {
            defaultStrategy: SESSION_STRATEGIES.BRANCH_SPECIFIC,
          },
        });

        const result = await manager.initialize();

        expect(result.strategy).toBe(SESSION_STRATEGIES.BRANCH_SPECIFIC);
        expect(result.instanceId).toBe("shared"); // Fallback
      });
    });

    describe("migration", () => {
      it("should perform migration when existing sessions found", async () => {
        // Mock existing session directories
        mockFs.readdirSync.mockReturnValue([
          ".wwebjs_auth_old_instance",
          ".wwebjs_auth_another_old",
          "other_file",
        ]);
        mockFs.existsSync.mockImplementation((path) => {
          return path.includes(".wwebjs_auth_");
        });
        mockFs.statSync.mockReturnValue({
          isDirectory: () => true,
          mtime: new Date(Date.now() - 1000),
        });

        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
          config: {
            autoMigrate: true,
          },
        });

        const result = await manager.initialize();

        expect(result.migration).toBeTruthy();
        expect(result.migration.migrated).toBe(true);
      });

      it("should skip migration when target session already exists", async () => {
        mockFs.readdirSync.mockReturnValue([".wwebjs_auth_shared"]);
        mockFs.existsSync.mockImplementation((path) => {
          return path.endsWith(".wwebjs_auth_shared");
        });

        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
          config: {
            autoMigrate: true,
          },
        });

        const result = await manager.initialize();

        expect(result.migration).toBeNull();
      });

      it("should create backup during migration when enabled", async () => {
        mockFs.readdirSync.mockReturnValue([".wwebjs_auth_old"]);
        mockFs.existsSync.mockImplementation((path) => {
          return path.includes(".wwebjs_auth_old") && !path.includes("shared");
        });

        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
          config: {
            autoMigrate: true,
            migrationBackup: true,
          },
        });

        const result = await manager.initialize();

        expect(result.migration?.backup).toBeTruthy();
      });

      it("should select best source session for migration", async () => {
        const now = Date.now();
        mockFs.readdirSync.mockReturnValue([
          ".wwebjs_auth_old1",
          ".wwebjs_auth_old2",
          ".wwebjs_auth_old3",
        ]);
        mockFs.existsSync.mockImplementation((path) => {
          return path.includes(".wwebjs_auth_") && !path.includes("shared");
        });
        mockFs.statSync.mockImplementation((path) => ({
          isDirectory: () => true,
          mtime: new Date(path.includes("old2") ? now : now - 10000), // old2 is most recent
        }));

        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
        });

        await manager.initialize();

        // Should have selected the most recent session (old2)
        expect(mockFs.renameSync).toHaveBeenCalledWith(
          expect.stringContaining("old2"),
          expect.stringContaining("shared")
        );
      });
    });

    describe("switchStrategy", () => {
      it("should switch from shared to branch-specific strategy", async () => {
        mockGitIntegration.detectGitBranch.mockResolvedValue({
          branch: "feature/switch-test",
          isGitRepository: true,
          detectionMethod: "git-command",
        });
        mockGitIntegration.generateBranchAwareInstanceId.mockReturnValue(
          "feature_switch-test"
        );

        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
        });

        await manager.initialize();
        expect(manager.getCurrentStrategy().strategy).toBe(
          SESSION_STRATEGIES.SHARED
        );

        const result = await manager.switchStrategy(
          SESSION_STRATEGIES.BRANCH_SPECIFIC
        );

        expect(result.success).toBe(true);
        expect(result.oldStrategy).toBe(SESSION_STRATEGIES.SHARED);
        expect(result.newStrategy).toBe(SESSION_STRATEGIES.BRANCH_SPECIFIC);
        expect(manager.getCurrentStrategy().strategy).toBe(
          SESSION_STRATEGIES.BRANCH_SPECIFIC
        );
      });

      it("should handle switch failure gracefully", async () => {
        mockGitIntegration.detectGitBranch.mockRejectedValue(
          new Error("Git error")
        );

        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
        });

        await manager.initialize();

        const result = await manager.switchStrategy(
          SESSION_STRATEGIES.BRANCH_SPECIFIC
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
      });
    });

    describe("cleanupOldSessions", () => {
      it("should clean up old sessions", async () => {
        const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
        mockFs.readdirSync.mockReturnValue([
          ".wwebjs_auth_old1",
          ".wwebjs_auth_old2",
          ".wwebjs_auth_shared",
        ]);
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockImplementation((path) => ({
          isDirectory: () => true,
          mtime: path.includes("shared") ? new Date() : oldDate,
        }));

        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
        });

        await manager.initialize();

        const result = await manager.cleanupOldSessions({
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        expect(result.cleaned).toBe(2); // old1 and old2
        expect(mockFs.rmSync).toHaveBeenCalledTimes(2);
      });

      it("should preserve current session during cleanup", async () => {
        const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        mockFs.readdirSync.mockReturnValue([
          ".wwebjs_auth_old",
          ".wwebjs_auth_shared",
        ]);
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({
          isDirectory: () => true,
          mtime: oldDate,
        });

        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
        });

        await manager.initialize();

        const result = await manager.cleanupOldSessions({
          keepCurrent: true,
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        expect(result.cleaned).toBe(1); // Only old, not shared (current)
      });

      it("should create backups during cleanup when enabled", async () => {
        const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        mockFs.readdirSync.mockReturnValue([".wwebjs_auth_old"]);
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({
          isDirectory: () => true,
          mtime: oldDate,
        });

        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
        });

        await manager.initialize();

        const result = await manager.cleanupOldSessions({
          createBackup: true,
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        expect(result.backups).toHaveLength(1);
      });
    });

    describe("getCurrentStrategy", () => {
      it("should return current strategy information", async () => {
        const manager = new SessionStrategyManager({
          baseDirectory: testBaseDirectory,
        });

        await manager.initialize();

        const info = manager.getCurrentStrategy();

        expect(info.strategy).toBe(SESSION_STRATEGIES.SHARED);
        expect(info.instanceId).toBe("shared");
        expect(info.sessionPath).toBe(
          path.join(testBaseDirectory, ".wwebjs_auth_shared")
        );
        expect(info.gitBranch).toBe("main");
        expect(info.config).toBeTruthy();
      });
    });
  });

  describe("createSessionStrategyManager", () => {
    it("should create and initialize strategy manager", async () => {
      const manager = await createSessionStrategyManager({
        baseDirectory: testBaseDirectory,
      });

      expect(manager).toBeInstanceOf(SessionStrategyManager);
      expect(manager.getCurrentStrategy().strategy).toBe(
        SESSION_STRATEGIES.SHARED
      );
    });
  });

  describe("getConfiguredStrategy", () => {
    it("should return team strategy when team collaboration is enabled", () => {
      process.env.WA_TEAM_COLLABORATION = "true";

      const strategy = getConfiguredStrategy();

      expect(strategy).toBe(SESSION_STRATEGIES.TEAM);
    });

    it("should return pattern-based strategy when configured", () => {
      process.env.WA_BRANCH_PATTERN_STRATEGY = "true";

      const strategy = getConfiguredStrategy();

      expect(strategy).toBe(SESSION_STRATEGIES.PATTERN_BASED);
    });

    it("should return branch-specific strategy when branch sessions enabled", () => {
      process.env.WA_BRANCH_SESSIONS = "true";

      const strategy = getConfiguredStrategy();

      expect(strategy).toBe(SESSION_STRATEGIES.BRANCH_SPECIFIC);
    });

    it("should return branch-specific when shared session disabled", () => {
      process.env.WA_SHARED_SESSION = "false";

      const strategy = getConfiguredStrategy();

      expect(strategy).toBe(SESSION_STRATEGIES.BRANCH_SPECIFIC);
    });

    it("should return shared strategy by default", () => {
      const strategy = getConfiguredStrategy();

      expect(strategy).toBe(SESSION_STRATEGIES.SHARED);
    });

    it("should prioritize team collaboration over other settings", () => {
      process.env.WA_TEAM_COLLABORATION = "true";
      process.env.WA_BRANCH_SESSIONS = "true";
      process.env.WA_SHARED_SESSION = "false";

      const strategy = getConfiguredStrategy();

      expect(strategy).toBe(SESSION_STRATEGIES.TEAM);
    });
  });

  describe("validateStrategyConfig", () => {
    it("should validate correct configuration", () => {
      const config = {
        defaultStrategy: SESSION_STRATEGIES.SHARED,
        autoMigrate: true,
        migrationBackup: true,
        branchDetection: true,
        teamCollaboration: false,
        mainBranches: ["main", "develop"],
        featureBranchPatterns: ["feature/*", "bugfix/*"],
      };

      const result = validateStrategyConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect invalid strategy", () => {
      const config = {
        defaultStrategy: "invalid-strategy",
      };

      const result = validateStrategyConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid strategy: invalid-strategy");
    });

    it("should detect invalid boolean fields", () => {
      const config = {
        autoMigrate: "true", // should be boolean
        migrationBackup: 1, // should be boolean
      };

      const result = validateStrategyConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("autoMigrate must be a boolean");
      expect(result.errors).toContain("migrationBackup must be a boolean");
    });

    it("should detect invalid array fields", () => {
      const config = {
        mainBranches: "main,develop", // should be array
        featureBranchPatterns: "feature/*", // should be array
      };

      const result = validateStrategyConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("mainBranches must be an array");
      expect(result.errors).toContain("featureBranchPatterns must be an array");
    });

    it("should handle empty configuration", () => {
      const result = validateStrategyConfig({});

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle file system errors during initialization", async () => {
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error("File system error");
      });

      const manager = new SessionStrategyManager({
        baseDirectory: testBaseDirectory,
      });

      const result = await manager.initialize();

      expect(result.error).toBeTruthy();
    });

    it("should handle git integration errors gracefully", async () => {
      mockGitIntegration.detectGitBranch.mockRejectedValue(
        new Error("Git error")
      );

      const manager = new SessionStrategyManager({
        baseDirectory: testBaseDirectory,
        config: {
          branchDetection: true,
        },
      });

      const result = await manager.initialize();

      // Should still initialize with fallback strategy
      expect(result.strategy).toBe(SESSION_STRATEGIES.SHARED);
    });

    it("should handle session validation errors during migration", async () => {
      mockSessionValidation.validateSessionData.mockRejectedValue(
        new Error("Validation error")
      );
      mockFs.readdirSync.mockReturnValue([".wwebjs_auth_old"]);
      mockFs.existsSync.mockImplementation((path) => {
        return path.includes(".wwebjs_auth_old");
      });

      const manager = new SessionStrategyManager({
        baseDirectory: testBaseDirectory,
        config: {
          autoMigrate: true,
        },
      });

      const result = await manager.initialize();

      // Should handle validation error gracefully
      expect(result.migration?.migrated).toBeFalsy();
    });

    it("should handle backup creation failure during migration", async () => {
      const mockBackupManager = {
        createBackup: jest
          .fn()
          .mockResolvedValue({ success: false, error: "Backup failed" }),
      };
      mockSessionBackup.SessionBackupManager.mockImplementation(
        () => mockBackupManager
      );

      mockFs.readdirSync.mockReturnValue([".wwebjs_auth_old"]);
      mockFs.existsSync.mockImplementation((path) => {
        return path.includes(".wwebjs_auth_old") && !path.includes("shared");
      });

      const manager = new SessionStrategyManager({
        baseDirectory: testBaseDirectory,
        config: {
          autoMigrate: true,
          migrationBackup: true,
        },
      });

      const result = await manager.initialize();

      // Should continue migration even if backup fails
      expect(result.migration?.migrated).toBe(true);
    });
  });

  describe("Integration with Git", () => {
    it("should adapt strategy based on git branch changes", async () => {
      // Start with main branch (shared strategy)
      mockGitIntegration.detectGitBranch.mockResolvedValue({
        branch: "main",
        isGitRepository: true,
        detectionMethod: "git-command",
      });
      mockGitIntegration.determineBranchStrategy.mockReturnValue("shared");

      const manager = new SessionStrategyManager({
        baseDirectory: testBaseDirectory,
        config: {
          defaultStrategy: SESSION_STRATEGIES.PATTERN_BASED,
        },
      });

      await manager.initialize();
      expect(manager.getCurrentStrategy().strategy).toBe(
        SESSION_STRATEGIES.SHARED
      );

      // Switch to feature branch (branch-specific strategy)
      mockGitIntegration.detectGitBranch.mockResolvedValue({
        branch: "feature/new-feature",
        isGitRepository: true,
        detectionMethod: "git-command",
      });
      mockGitIntegration.determineBranchStrategy.mockReturnValue(
        "branch-specific"
      );
      mockGitIntegration.generateBranchAwareInstanceId.mockReturnValue(
        "feature_new-feature"
      );

      await manager.initialize();
      expect(manager.getCurrentStrategy().strategy).toBe(
        SESSION_STRATEGIES.BRANCH_SPECIFIC
      );
    });

    it("should handle non-git repositories gracefully", async () => {
      mockGitIntegration.detectGitBranch.mockResolvedValue({
        branch: null,
        isGitRepository: false,
        error: "Not a git repository",
      });

      const manager = new SessionStrategyManager({
        baseDirectory: testBaseDirectory,
        config: {
          branchDetection: true,
        },
      });

      const result = await manager.initialize();

      expect(result.strategy).toBe(SESSION_STRATEGIES.SHARED);
      expect(result.gitInfo.isGitRepository).toBe(false);
    });
  });

  describe("Performance", () => {
    it("should initialize within reasonable time", async () => {
      const manager = new SessionStrategyManager({
        baseDirectory: testBaseDirectory,
      });

      const startTime = Date.now();
      await manager.initialize();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000); // Should complete in under 2 seconds
    });

    it("should handle large numbers of session directories efficiently", async () => {
      // Mock 100 old session directories
      const sessionDirs = Array(100)
        .fill()
        .map((_, i) => `.wwebjs_auth_old_${i}`);
      mockFs.readdirSync.mockReturnValue(sessionDirs);
      mockFs.existsSync.mockReturnValue(true);

      const manager = new SessionStrategyManager({
        baseDirectory: testBaseDirectory,
        config: {
          autoMigrate: true,
        },
      });

      const startTime = Date.now();
      await manager.initialize();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should handle 100 directories in under 5 seconds
    });
  });
});
