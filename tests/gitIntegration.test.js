/**
 * Git Integration Unit Tests
 *
 * Tests for git branch detection, repository information,
 * and branch-aware instance ID generation.
 */

import { jest } from "@jest/globals";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import {
  detectGitBranch,
  isGitRepository,
  determineBranchStrategy,
  generateBranchAwareInstanceId,
  getGitRepositoryInfo,
  clearGitBranchCache,
  validateGitIntegrationConfig,
} from "../app/utils/gitIntegration.js";

// Mock child_process
jest.mock("child_process");
const mockExecSync = execSync;

// Mock fs
jest.mock("fs");
const mockFs = fs;

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

describe("Git Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearGitBranchCache();

    // Reset environment variables
    delete process.env.GIT_BRANCH;
    delete process.env.BRANCH_NAME;
    delete process.env.CI_COMMIT_REF_NAME;
    delete process.env.GITHUB_REF_NAME;
  });

  describe("isGitRepository", () => {
    it("should return true when .git directory exists", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });

      const result = await isGitRepository("/test/repo");
      expect(result).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith("/test/repo/.git");
    });

    it("should return true when .git file exists (worktree)", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        isDirectory: () => false,
      });

      const result = await isGitRepository("/test/repo");
      expect(result).toBe(true);
    });

    it("should return false when .git does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await isGitRepository("/test/repo");
      expect(result).toBe(false);
    });

    it("should check parent directories recursively", async () => {
      mockFs.existsSync
        .mockReturnValueOnce(false) // /test/repo/subdir/.git
        .mockReturnValueOnce(true); // /test/repo/.git
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });

      const result = await isGitRepository("/test/repo/subdir");
      expect(result).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith("/test/repo/subdir/.git");
      expect(mockFs.existsSync).toHaveBeenCalledWith("/test/repo/.git");
    });
  });

  describe("detectGitBranch", () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });
    });

    it("should detect branch using git command", async () => {
      mockExecSync.mockReturnValue("feature/test-branch\n");

      const result = await detectGitBranch();

      expect(result.branch).toBe("feature/test-branch");
      expect(result.detectionMethod).toBe("git-command");
      expect(result.isGitRepository).toBe(true);
    });

    it("should handle git command failure and try HEAD file", async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Git command failed");
      });

      mockFs.readFileSync.mockReturnValue("ref: refs/heads/main\n");

      const result = await detectGitBranch();

      expect(result.branch).toBe("main");
      expect(result.detectionMethod).toBe("git-head-file");
    });

    it("should detect branch from environment variables", async () => {
      process.env.GIT_BRANCH = "develop";
      mockExecSync.mockImplementation(() => {
        throw new Error("Git command failed");
      });
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("HEAD file not found");
      });

      const result = await detectGitBranch();

      expect(result.branch).toBe("develop");
      expect(result.detectionMethod).toBe("env-GIT_BRANCH");
    });

    it("should handle detached HEAD state", async () => {
      mockExecSync.mockReturnValue("HEAD\n");
      mockFs.readFileSync.mockReturnValue(
        "1234567890abcdef1234567890abcdef12345678\n"
      );

      const result = await detectGitBranch();

      expect(result.branch).toBe("detached-head");
      expect(result.detectionMethod).toBe("git-head-file");
    });

    it("should return null branch when not in git repository", async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await detectGitBranch();

      expect(result.branch).toBeNull();
      expect(result.isGitRepository).toBe(false);
    });

    it("should use cache on subsequent calls", async () => {
      mockExecSync.mockReturnValue("cached-branch\n");

      // First call
      const result1 = await detectGitBranch();
      expect(result1.branch).toBe("cached-branch");

      // Clear mock to ensure cache is used
      mockExecSync.mockClear();

      // Second call should use cache
      const result2 = await detectGitBranch();
      expect(result2.branch).toBe("cached-branch");
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it("should bypass cache when useCache is false", async () => {
      mockExecSync.mockReturnValue("fresh-branch\n");

      const result = await detectGitBranch({ useCache: false });
      expect(result.branch).toBe("fresh-branch");
    });
  });

  describe("determineBranchStrategy", () => {
    it("should return shared for main branches", () => {
      expect(determineBranchStrategy("main")).toBe("shared");
      expect(determineBranchStrategy("master")).toBe("shared");
      expect(determineBranchStrategy("develop")).toBe("shared");
      expect(determineBranchStrategy("dev")).toBe("shared");
    });

    it("should return branch-specific for feature branches", () => {
      expect(determineBranchStrategy("feature/new-feature")).toBe(
        "branch-specific"
      );
      expect(determineBranchStrategy("feat/improvement")).toBe(
        "branch-specific"
      );
      expect(determineBranchStrategy("bugfix/issue-123")).toBe(
        "branch-specific"
      );
      expect(determineBranchStrategy("hotfix/critical-fix")).toBe(
        "branch-specific"
      );
    });

    it("should return default strategy for unknown patterns", () => {
      expect(determineBranchStrategy("unknown-branch")).toBe("shared");
      expect(determineBranchStrategy("custom/branch")).toBe("shared");
    });

    it("should handle null or undefined branch", () => {
      expect(determineBranchStrategy(null)).toBe("shared");
      expect(determineBranchStrategy(undefined)).toBe("shared");
      expect(determineBranchStrategy("detached-head")).toBe("shared");
    });

    it("should use custom main branches", () => {
      const options = {
        mainBranches: ["production", "staging"],
      };

      expect(determineBranchStrategy("production", options)).toBe("shared");
      expect(determineBranchStrategy("staging", options)).toBe("shared");
      expect(determineBranchStrategy("main", options)).toBe("shared"); // default fallback
    });

    it("should use custom feature branch patterns", () => {
      const options = {
        featureBranchPatterns: ["task/*", "story/*"],
      };

      expect(determineBranchStrategy("task/123", options)).toBe(
        "branch-specific"
      );
      expect(determineBranchStrategy("story/user-login", options)).toBe(
        "branch-specific"
      );
      expect(determineBranchStrategy("feature/test", options)).toBe("shared"); // not in custom patterns
    });
  });

  describe("generateBranchAwareInstanceId", () => {
    it("should return shared for shared strategy", () => {
      const result = generateBranchAwareInstanceId("feature/test", {
        strategy: "shared",
      });

      expect(result).toBe("shared");
    });

    it("should sanitize branch names for filesystem compatibility", () => {
      const result = generateBranchAwareInstanceId("feature/test-branch@123", {
        strategy: "branch-specific",
        sanitize: true,
      });

      expect(result).toBe("feature_test-branch_123");
    });

    it("should truncate long branch names", () => {
      const longBranch =
        "feature/very-long-branch-name-that-exceeds-maximum-length-limit";
      const result = generateBranchAwareInstanceId(longBranch, {
        strategy: "branch-specific",
        maxLength: 20,
      });

      expect(result.length).toBeLessThanOrEqual(20);
      expect(result).toMatch(/^feature_very-long_[a-z0-9]+$/);
    });

    it("should handle empty or invalid branch names", () => {
      expect(
        generateBranchAwareInstanceId("", { strategy: "branch-specific" })
      ).toBe("default");
      expect(
        generateBranchAwareInstanceId(null, { strategy: "branch-specific" })
      ).toBe("default");
    });

    it("should use custom fallback ID", () => {
      const result = generateBranchAwareInstanceId("", {
        strategy: "branch-specific",
        fallbackId: "custom-fallback",
      });

      expect(result).toBe("custom-fallback");
    });
  });

  describe("getGitRepositoryInfo", () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });
    });

    it("should return comprehensive repository information", async () => {
      mockExecSync
        .mockReturnValueOnce("main\n") // branch
        .mockReturnValueOnce("1234567890abcdef1234567890abcdef12345678\n") // commit
        .mockReturnValueOnce("https://github.com/user/repo.git\n") // remote
        .mockReturnValueOnce(""); // status (clean)

      const result = await getGitRepositoryInfo();

      expect(result.isRepository).toBe(true);
      expect(result.branch).toBe("main");
      expect(result.commit).toBe("1234567890abcdef1234567890abcdef12345678");
      expect(result.remote).toBe("https://github.com/user/repo.git");
      expect(result.isDirty).toBe(false);
    });

    it("should detect dirty working directory", async () => {
      mockExecSync
        .mockReturnValueOnce("main\n") // branch
        .mockReturnValueOnce("1234567890abcdef1234567890abcdef12345678\n") // commit
        .mockReturnValueOnce("https://github.com/user/repo.git\n") // remote
        .mockReturnValueOnce(" M file.txt\n"); // status (dirty)

      const result = await getGitRepositoryInfo();

      expect(result.isDirty).toBe(true);
    });

    it("should handle git command failures gracefully", async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Git command failed");
      });
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("HEAD file not found");
      });

      const result = await getGitRepositoryInfo();

      expect(result.isRepository).toBe(true); // .git exists
      expect(result.branch).toBeNull();
      expect(result.commit).toBeNull();
      expect(result.remote).toBeNull();
      expect(result.isDirty).toBe(false);
    });

    it("should return false for non-git directory", async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await getGitRepositoryInfo();

      expect(result.isRepository).toBe(false);
      expect(result.branch).toBeNull();
    });
  });

  describe("validateGitIntegrationConfig", () => {
    it("should validate correct configuration", () => {
      const config = {
        branchDetection: true,
        mainBranches: ["main", "develop"],
        featureBranchPatterns: ["feature/*", "bugfix/*"],
      };

      const result = validateGitIntegrationConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect invalid branchDetection type", () => {
      const config = {
        branchDetection: "true", // should be boolean
      };

      const result = validateGitIntegrationConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("branchDetection must be a boolean");
    });

    it("should detect invalid mainBranches type", () => {
      const config = {
        mainBranches: "main,develop", // should be array
      };

      const result = validateGitIntegrationConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("mainBranches must be an array");
    });

    it("should detect invalid featureBranchPatterns type", () => {
      const config = {
        featureBranchPatterns: "feature/*", // should be array
      };

      const result = validateGitIntegrationConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("featureBranchPatterns must be an array");
    });

    it("should detect invalid pattern types in array", () => {
      const config = {
        featureBranchPatterns: ["feature/*", 123, "bugfix/*"], // 123 is not string
      };

      const result = validateGitIntegrationConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid pattern type: number");
    });

    it("should handle empty configuration", () => {
      const result = validateGitIntegrationConfig({});

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("clearGitBranchCache", () => {
    it("should clear the branch cache", async () => {
      mockExecSync.mockReturnValue("cached-branch\n");

      // First call to populate cache
      await detectGitBranch();

      // Clear cache
      clearGitBranchCache();

      // Mock different response
      mockExecSync.mockClear();
      mockExecSync.mockReturnValue("new-branch\n");

      // Should detect new branch, not use cache
      const result = await detectGitBranch({ useCache: false });
      expect(result.branch).toBe("new-branch");
    });
  });

  describe("Error Handling", () => {
    it("should handle file system errors gracefully", async () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error("File system error");
      });

      const result = await detectGitBranch();

      expect(result.error).toBeTruthy();
      expect(result.branch).toBeNull();
    });

    it("should handle git command timeout", async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Command timed out");
      });
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("File read error");
      });
      // Ensure environment variables don't interfere
      delete process.env.GIT_BRANCH;
      delete process.env.BRANCH_NAME;

      const result = await detectGitBranch();

      expect(result.branch).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it("should handle corrupted git HEAD file", async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Git command failed");
      });
      mockFs.readFileSync.mockReturnValue("invalid-head-content");

      const result = await detectGitBranch();

      expect(result.branch).toBeNull();
    });
  });

  describe("Environment Variable Detection", () => {
    it("should detect branch from CI_COMMIT_REF_NAME", async () => {
      // Clear other env vars first
      delete process.env.GIT_BRANCH;
      delete process.env.BRANCH_NAME;
      process.env.CI_COMMIT_REF_NAME = "ci-branch";

      mockExecSync.mockImplementation(() => {
        throw new Error("Git command failed");
      });
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("HEAD file not found");
      });

      const result = await detectGitBranch();

      expect(result.branch).toBe("ci-branch");
      expect(result.detectionMethod).toBe("env-CI_COMMIT_REF_NAME");
    });

    it("should detect branch from GITHUB_REF_NAME", async () => {
      // Clear other env vars first
      delete process.env.GIT_BRANCH;
      delete process.env.BRANCH_NAME;
      delete process.env.CI_COMMIT_REF_NAME;
      process.env.GITHUB_REF_NAME = "github-branch";

      mockExecSync.mockImplementation(() => {
        throw new Error("Git command failed");
      });
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("HEAD file not found");
      });

      const result = await detectGitBranch();

      expect(result.branch).toBe("github-branch");
      expect(result.detectionMethod).toBe("env-GITHUB_REF_NAME");
    });

    it("should clean refs/heads/ prefix from environment variables", async () => {
      // Clear other env vars first
      delete process.env.BRANCH_NAME;
      delete process.env.CI_COMMIT_REF_NAME;
      delete process.env.GITHUB_REF_NAME;
      process.env.GIT_BRANCH = "refs/heads/feature/test";

      mockExecSync.mockImplementation(() => {
        throw new Error("Git command failed");
      });
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("HEAD file not found");
      });

      const result = await detectGitBranch();

      expect(result.branch).toBe("feature/test");
    });
  });

  describe("Performance", () => {
    it("should complete branch detection within reasonable time", async () => {
      mockExecSync.mockReturnValue("performance-test-branch\n");

      const startTime = Date.now();
      await detectGitBranch();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });

    it("should handle multiple concurrent calls efficiently", async () => {
      mockExecSync.mockReturnValue("concurrent-branch\n");
      clearGitBranchCache(); // Ensure clean cache

      const promises = Array(10)
        .fill()
        .map(() => detectGitBranch({ useCache: false }));
      const results = await Promise.all(promises);

      // All results should be the same
      results.forEach((result) => {
        expect(result.branch).toBe("concurrent-branch");
      });
    });
  });
});
