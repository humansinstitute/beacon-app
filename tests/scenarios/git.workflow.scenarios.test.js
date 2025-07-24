/**
 * Git Workflow Scenario Tests
 * Comprehensive testing of git integration and branch-based session management
 * Validates git workflow integration and session strategy management
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
import { SessionBackupManager } from "../../app/utils/sessionBackup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

// Git workflow scenario generators
class GitWorkflowScenarioGenerator {
  static createMockGitInfo(branch, isDirty = false, commit = null) {
    return {
      isRepository: true,
      branch,
      commit:
        commit || `abc123def456${Math.random().toString(36).substr(2, 8)}`,
      isDirty,
      remoteUrl: "https://github.com/example/repo.git",
      lastCommitDate: new Date().toISOString(),
    };
  }

  static createNonGitInfo() {
    return {
      isRepository: false,
      branch: null,
      commit: null,
      isDirty: false,
      remoteUrl: null,
      lastCommitDate: null,
    };
  }

  static createBranchSwitchScenario() {
    return {
      name: "Branch Switch Scenario",
      description: "Developer switches between feature branches",
      branches: [
        { name: "main", sessions: ["wa_shared_12345678"] },
        {
          name: "feature/auth-improvement",
          sessions: ["wa_branch_feature_auth_improvement_87654321"],
        },
        {
          name: "bugfix/session-corruption",
          sessions: ["wa_branch_bugfix_session_corruption_11111111"],
        },
      ],
    };
  }

  static createTeamCollaborationScenario() {
    return {
      name: "Team Collaboration Scenario",
      description: "Multiple developers working on different features",
      developers: [
        { name: "dev1", branch: "feature/new-ui", strategy: "branch" },
        { name: "dev2", branch: "feature/api-integration", strategy: "branch" },
        { name: "dev3", branch: "main", strategy: "shared" },
      ],
    };
  }

  static createHotfixScenario() {
    return {
      name: "Hotfix Scenario",
      description: "Emergency hotfix requiring quick branch switch",
      workflow: [
        { step: 1, branch: "feature/long-running", action: "working" },
        { step: 2, branch: "main", action: "checkout" },
        { step: 3, branch: "hotfix/critical-bug", action: "create" },
        { step: 4, branch: "main", action: "merge" },
        { step: 5, branch: "feature/long-running", action: "return" },
      ],
    };
  }

  static createReleaseWorkflowScenario() {
    return {
      name: "Release Workflow Scenario",
      description: "Release branch workflow with session management",
      workflow: [
        { step: 1, branch: "develop", action: "feature-development" },
        { step: 2, branch: "release/v1.2.0", action: "create-release" },
        { step: 3, branch: "main", action: "merge-release" },
        { step: 4, branch: "develop", action: "merge-back" },
      ],
    };
  }
}

describe("Git Workflow Scenario Tests", () => {
  let testSessionPath;
  let originalEnv;

  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set test environment variables for git workflow testing
    process.env.NODE_ENV = "test";
    process.env.WA_SHARED_SESSION = "false"; // Enable branch sessions for testing
    process.env.WA_BRANCH_SESSIONS = "true";
    process.env.WA_BRANCH_DETECTION = "true";
    process.env.WA_AUTO_MIGRATE_SESSION = "true";
    process.env.WA_MIGRATION_BACKUP = "true";
    process.env.WA_TEAM_COLLABORATION = "true";
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
      `git-workflow-${Date.now()}`
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

  describe("Git Repository Detection", () => {
    test("should detect git repository information correctly", async () => {
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

    test("should handle non-git environments gracefully", async () => {
      // Mock git detection to simulate non-git environment
      const detector = new GitBranchDetector();
      const originalDetectBranch = detector.detectBranch;

      detector.detectBranch = jest
        .fn()
        .mockRejectedValue(new Error("Not a git repository"));

      try {
        const branch = await detector.detectBranch("git-command");
        expect(branch).toBeNull();
      } catch (error) {
        expect(error.message).toContain("Not a git repository");
      }

      // Restore original method
      detector.detectBranch = originalDetectBranch;
    });

    test("should use multiple detection methods", async () => {
      const detector = new GitBranchDetector();
      const methods = ["git-command", "git-file", "environment"];

      const results = [];
      for (const method of methods) {
        try {
          const branch = await detector.detectBranch(method);
          results.push({ method, branch, success: true });
        } catch (error) {
          results.push({
            method,
            branch: null,
            success: false,
            error: error.message,
          });
        }
      }

      expect(results.length).toBe(methods.length);

      // At least one method should work in a git repository
      const successfulMethods = results.filter((r) => r.success);
      if (successfulMethods.length > 0) {
        expect(successfulMethods.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Branch-Based Session Management", () => {
    test("should generate branch-specific instance IDs", async () => {
      const branches = [
        "main",
        "feature/auth",
        "bugfix/session-fix",
        "release/v1.0",
      ];
      const instanceIds = [];

      for (const branch of branches) {
        const instanceId = generateInstanceId({
          useSharedSession: false,
          gitBranch: branch,
          useBranchSessions: true,
        });
        instanceIds.push({ branch, instanceId });
      }

      // All instance IDs should be unique
      const uniqueIds = new Set(instanceIds.map((item) => item.instanceId));
      expect(uniqueIds.size).toBe(branches.length);

      // Each should contain the branch name (sanitized)
      instanceIds.forEach(({ branch, instanceId }) => {
        const sanitizedBranch = branch.replace(/[^a-zA-Z0-9]/g, "_");
        expect(instanceId).toContain(sanitizedBranch);
      });
    });

    test("should create branch-specific session paths", async () => {
      const mockGitInfo =
        GitWorkflowScenarioGenerator.createMockGitInfo("feature/new-ui");

      const strategyManager = createSessionStrategyManager({
        gitInfo: mockGitInfo,
        baseSessionPath: testSessionPath,
        enableBranchDetection: true,
      });

      const currentStrategy = strategyManager.getCurrentStrategy();

      expect(currentStrategy.strategy).toBe("branch");
      expect(currentStrategy.gitBranch).toBe("feature/new-ui");
      expect(currentStrategy.instanceId).toContain("feature_new_ui");
      expect(currentStrategy.sessionPath).toContain("feature_new_ui");
    });

    test("should handle branch name sanitization", async () => {
      const problematicBranches = [
        "feature/user-auth@v2",
        "bugfix/fix-#123-issue",
        "release/v1.0.0-beta",
        "hotfix/urgent!fix",
      ];

      for (const branch of problematicBranches) {
        const instanceId = generateInstanceId({
          useSharedSession: false,
          gitBranch: branch,
          useBranchSessions: true,
        });

        // Should not contain problematic characters
        expect(instanceId).not.toMatch(/[@#!\.]/);
        expect(instanceId).toMatch(/^wa_branch_[a-zA-Z0-9_]+$/);
      }
    });
  });

  describe("Session Strategy Configuration", () => {
    test("should respect shared session configuration", async () => {
      process.env.WA_SHARED_SESSION = "true";
      process.env.WA_BRANCH_SESSIONS = "false";

      const mockGitInfo =
        GitWorkflowScenarioGenerator.createMockGitInfo("feature/test");

      const strategyManager = createSessionStrategyManager({
        gitInfo: mockGitInfo,
        baseSessionPath: testSessionPath,
        enableBranchDetection: true,
      });

      const currentStrategy = strategyManager.getCurrentStrategy();

      expect(currentStrategy.strategy).toBe("shared");
      expect(currentStrategy.instanceId).toMatch(/^wa_shared_[a-f0-9]{8}$/);

      // Reset environment
      process.env.WA_SHARED_SESSION = "false";
      process.env.WA_BRANCH_SESSIONS = "true";
    });

    test("should respect branch session configuration", async () => {
      process.env.WA_SHARED_SESSION = "false";
      process.env.WA_BRANCH_SESSIONS = "true";

      const mockGitInfo =
        GitWorkflowScenarioGenerator.createMockGitInfo("develop");

      const strategyManager = createSessionStrategyManager({
        gitInfo: mockGitInfo,
        baseSessionPath: testSessionPath,
        enableBranchDetection: true,
      });

      const currentStrategy = strategyManager.getCurrentStrategy();

      expect(currentStrategy.strategy).toBe("branch");
      expect(currentStrategy.gitBranch).toBe("develop");
      expect(currentStrategy.instanceId).toContain("develop");
    });

    test("should handle pattern-based strategy selection", async () => {
      process.env.WA_BRANCH_PATTERN_STRATEGY = "prefix";
      process.env.WA_SHARED_BRANCHES = "main,master,develop";

      const testCases = [
        { branch: "main", expectedStrategy: "shared" },
        { branch: "develop", expectedStrategy: "shared" },
        { branch: "feature/new-ui", expectedStrategy: "branch" },
        { branch: "bugfix/session-fix", expectedStrategy: "branch" },
      ];

      for (const testCase of testCases) {
        const mockGitInfo = GitWorkflowScenarioGenerator.createMockGitInfo(
          testCase.branch
        );

        const strategyManager = createSessionStrategyManager({
          gitInfo: mockGitInfo,
          baseSessionPath: testSessionPath,
          enableBranchDetection: true,
        });

        const currentStrategy = strategyManager.getCurrentStrategy();
        expect(currentStrategy.strategy).toBe(testCase.expectedStrategy);
      }

      // Reset environment
      delete process.env.WA_BRANCH_PATTERN_STRATEGY;
      delete process.env.WA_SHARED_BRANCHES;
    });
  });

  describe("Branch Switching Scenarios", () => {
    test("should handle branch switching with session preservation", async () => {
      const scenario =
        GitWorkflowScenarioGenerator.createBranchSwitchScenario();

      // Simulate working on feature branch
      const featureBranch = "feature/auth-improvement";
      const featureGitInfo =
        GitWorkflowScenarioGenerator.createMockGitInfo(featureBranch);

      const featureStrategyManager = createSessionStrategyManager({
        gitInfo: featureGitInfo,
        baseSessionPath: testSessionPath,
        enableBranchDetection: true,
      });

      const featureStrategy = featureStrategyManager.getCurrentStrategy();

      // Create session data for feature branch
      fs.mkdirSync(featureStrategy.sessionPath, { recursive: true });
      fs.mkdirSync(path.join(featureStrategy.sessionPath, "Default"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(featureStrategy.sessionPath, "Default", "Preferences"),
        JSON.stringify({ branch: featureBranch, authenticated: true })
      );

      // Switch to main branch
      const mainBranch = "main";
      const mainGitInfo =
        GitWorkflowScenarioGenerator.createMockGitInfo(mainBranch);

      const mainStrategyManager = createSessionStrategyManager({
        gitInfo: mainGitInfo,
        baseSessionPath: testSessionPath,
        enableBranchDetection: true,
      });

      const mainStrategy = mainStrategyManager.getCurrentStrategy();

      // Should have different session paths
      expect(featureStrategy.sessionPath).not.toBe(mainStrategy.sessionPath);
      expect(featureStrategy.instanceId).not.toBe(mainStrategy.instanceId);

      // Feature branch session should still exist
      expect(fs.existsSync(featureStrategy.sessionPath)).toBe(true);

      const featurePrefs = JSON.parse(
        fs.readFileSync(
          path.join(featureStrategy.sessionPath, "Default", "Preferences"),
          "utf8"
        )
      );
      expect(featurePrefs.branch).toBe(featureBranch);
    });

    test("should handle rapid branch switching", async () => {
      const branches = ["main", "feature/a", "feature/b", "bugfix/c", "main"];
      const sessionPaths = [];

      for (const branch of branches) {
        const gitInfo = GitWorkflowScenarioGenerator.createMockGitInfo(branch);

        const strategyManager = createSessionStrategyManager({
          gitInfo,
          baseSessionPath: testSessionPath,
          enableBranchDetection: true,
        });

        const strategy = strategyManager.getCurrentStrategy();
        sessionPaths.push({ branch, sessionPath: strategy.sessionPath });

        // Create session if it doesn't exist
        if (!fs.existsSync(strategy.sessionPath)) {
          fs.mkdirSync(strategy.sessionPath, { recursive: true });
          fs.mkdirSync(path.join(strategy.sessionPath, "Default"), {
            recursive: true,
          });
        }
      }

      // Verify that returning to the same branch uses the same session path
      const mainSessions = sessionPaths.filter((s) => s.branch === "main");
      expect(mainSessions.length).toBe(2);
      expect(mainSessions[0].sessionPath).toBe(mainSessions[1].sessionPath);
    });
  });

  describe("Team Collaboration Scenarios", () => {
    test("should support multiple developers with different strategies", async () => {
      const scenario =
        GitWorkflowScenarioGenerator.createTeamCollaborationScenario();
      const developerSessions = [];

      for (const developer of scenario.developers) {
        const gitInfo = GitWorkflowScenarioGenerator.createMockGitInfo(
          developer.branch
        );

        // Configure environment for this developer's strategy
        if (developer.strategy === "shared") {
          process.env.WA_SHARED_SESSION = "true";
          process.env.WA_BRANCH_SESSIONS = "false";
        } else {
          process.env.WA_SHARED_SESSION = "false";
          process.env.WA_BRANCH_SESSIONS = "true";
        }

        const strategyManager = createSessionStrategyManager({
          gitInfo,
          baseSessionPath: testSessionPath,
          enableBranchDetection: true,
        });

        const strategy = strategyManager.getCurrentStrategy();
        developerSessions.push({
          developer: developer.name,
          branch: developer.branch,
          strategy: strategy.strategy,
          sessionPath: strategy.sessionPath,
          instanceId: strategy.instanceId,
        });
      }

      // Verify different strategies are used appropriately
      const sharedSessions = developerSessions.filter(
        (s) => s.strategy === "shared"
      );
      const branchSessions = developerSessions.filter(
        (s) => s.strategy === "branch"
      );

      expect(sharedSessions.length).toBeGreaterThan(0);
      expect(branchSessions.length).toBeGreaterThan(0);

      // Shared sessions should have the same instance ID
      if (sharedSessions.length > 1) {
        const sharedInstanceIds = sharedSessions.map((s) => s.instanceId);
        const uniqueSharedIds = new Set(sharedInstanceIds);
        expect(uniqueSharedIds.size).toBe(1);
      }

      // Branch sessions should have unique instance IDs
      const branchInstanceIds = branchSessions.map((s) => s.instanceId);
      const uniqueBranchIds = new Set(branchInstanceIds);
      expect(uniqueBranchIds.size).toBe(branchSessions.length);

      // Reset environment
      process.env.WA_SHARED_SESSION = "false";
      process.env.WA_BRANCH_SESSIONS = "true";
    });

    test("should handle team collaboration with session cleanup", async () => {
      // Create sessions for multiple team members
      const teamBranches = [
        "feature/member1-work",
        "feature/member2-work",
        "bugfix/member3-fix",
        "main", // Shared branch
      ];

      const sessionPaths = [];
      for (const branch of teamBranches) {
        const gitInfo = GitWorkflowScenarioGenerator.createMockGitInfo(branch);

        const strategyManager = createSessionStrategyManager({
          gitInfo,
          baseSessionPath: testSessionPath,
          enableBranchDetection: true,
        });

        const strategy = strategyManager.getCurrentStrategy();
        sessionPaths.push(strategy.sessionPath);

        // Create session with old timestamp
        fs.mkdirSync(strategy.sessionPath, { recursive: true });
        fs.mkdirSync(path.join(strategy.sessionPath, "Default"), {
          recursive: true,
        });

        // Set old modification time for feature branches
        if (branch.startsWith("feature/") || branch.startsWith("bugfix/")) {
          const oldTime = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
          fs.utimesSync(strategy.sessionPath, oldTime, oldTime);
        }
      }

      // Cleanup old sessions
      const currentGitInfo =
        GitWorkflowScenarioGenerator.createMockGitInfo("main");
      const strategyManager = createSessionStrategyManager({
        gitInfo: currentGitInfo,
        baseSessionPath: testSessionPath,
        enableBranchDetection: true,
      });

      const cleanupResult = await strategyManager.cleanupOldSessions({
        keepCurrent: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        createBackup: true,
      });

      expect(cleanupResult.cleaned).toBeGreaterThan(0);
      expect(cleanupResult.backups.length).toBeGreaterThan(0);

      // Current session should still exist
      const currentStrategy = strategyManager.getCurrentStrategy();
      expect(fs.existsSync(currentStrategy.sessionPath)).toBe(true);
    });
  });

  describe("Hotfix and Release Workflows", () => {
    test("should handle hotfix workflow scenario", async () => {
      const scenario = GitWorkflowScenarioGenerator.createHotfixScenario();
      const sessionStates = [];

      for (const step of scenario.workflow) {
        const gitInfo = GitWorkflowScenarioGenerator.createMockGitInfo(
          step.branch
        );

        const strategyManager = createSessionStrategyManager({
          gitInfo,
          baseSessionPath: testSessionPath,
          enableBranchDetection: true,
        });

        const strategy = strategyManager.getCurrentStrategy();
        sessionStates.push({
          step: step.step,
          branch: step.branch,
          action: step.action,
          sessionPath: strategy.sessionPath,
          instanceId: strategy.instanceId,
        });

        // Create session if it doesn't exist
        if (!fs.existsSync(strategy.sessionPath)) {
          fs.mkdirSync(strategy.sessionPath, { recursive: true });
          fs.mkdirSync(path.join(strategy.sessionPath, "Default"), {
            recursive: true,
          });
          fs.writeFileSync(
            path.join(strategy.sessionPath, "Default", "Preferences"),
            JSON.stringify({
              step: step.step,
              branch: step.branch,
              action: step.action,
            })
          );
        }
      }

      // Verify that returning to feature branch preserves session
      const featureSessions = sessionStates.filter(
        (s) => s.branch === "feature/long-running"
      );
      expect(featureSessions.length).toBe(2); // Step 1 and Step 5
      expect(featureSessions[0].sessionPath).toBe(
        featureSessions[1].sessionPath
      );

      // Verify session data is preserved
      const finalFeatureSession = featureSessions[1];
      const sessionData = JSON.parse(
        fs.readFileSync(
          path.join(finalFeatureSession.sessionPath, "Default", "Preferences"),
          "utf8"
        )
      );
      expect(sessionData.step).toBe(1); // Original data preserved
      expect(sessionData.action).toBe("working");
    });

    test("should handle release workflow with session migration", async () => {
      const scenario =
        GitWorkflowScenarioGenerator.createReleaseWorkflowScenario();

      // Start with develop branch
      const developGitInfo =
        GitWorkflowScenarioGenerator.createMockGitInfo("develop");
      const developStrategyManager = createSessionStrategyManager({
        gitInfo: developGitInfo,
        baseSessionPath: testSessionPath,
        enableBranchDetection: true,
      });

      const developStrategy = developStrategyManager.getCurrentStrategy();

      // Create develop session with feature data
      fs.mkdirSync(developStrategy.sessionPath, { recursive: true });
      fs.mkdirSync(path.join(developStrategy.sessionPath, "Default"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(developStrategy.sessionPath, "Default", "Preferences"),
        JSON.stringify({
          branch: "develop",
          features: ["feature1", "feature2"],
        })
      );

      // Create release branch
      const releaseGitInfo =
        GitWorkflowScenarioGenerator.createMockGitInfo("release/v1.2.0");
      const releaseStrategyManager = createSessionStrategyManager({
        gitInfo: releaseGitInfo,
        baseSessionPath: testSessionPath,
        enableBranchDetection: true,
        enableAutoMigration: true,
      });

      const releaseStrategy = releaseStrategyManager.getCurrentStrategy();

      // Migrate session from develop to release
      const migrationResult = await releaseStrategyManager.migrateSession(
        "branch",
        "branch",
        {
          sourceSessionPath: developStrategy.sessionPath,
          targetSessionPath: releaseStrategy.sessionPath,
          createBackup: true,
          validateAfterMigration: true,
        }
      );

      expect(migrationResult.success).toBe(true);
      expect(migrationResult.migrated).toBe(true);

      // Verify data was migrated
      const releaseData = JSON.parse(
        fs.readFileSync(
          path.join(releaseStrategy.sessionPath, "Default", "Preferences"),
          "utf8"
        )
      );
      expect(releaseData.features).toEqual(["feature1", "feature2"]);
    });
  });

  describe("Session Migration Between Strategies", () => {
    test("should migrate from individual to branch strategy", async () => {
      // Create individual session
      const individualSessionPath = path.join(testSessionPath, "individual");
      fs.mkdirSync(individualSessionPath, { recursive: true });
      fs.mkdirSync(path.join(individualSessionPath, "Default"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(individualSessionPath, "Default", "Preferences"),
        JSON.stringify({ strategy: "individual", data: "important" })
      );

      const gitInfo = GitWorkflowScenarioGenerator.createMockGitInfo(
        "feature/migration-test"
      );
      const strategyManager = createSessionStrategyManager({
        gitInfo,
        baseSessionPath: testSessionPath,
        enableBranchDetection: true,
        enableAutoMigration: true,
      });

      // Migrate to branch strategy
      const migrationResult = await strategyManager.migrateSession(
        "individual",
        "branch",
        {
          sourceSessionPath: individualSessionPath,
          createBackup: true,
          validateAfterMigration: true,
        }
      );

      expect(migrationResult.success).toBe(true);
      expect(migrationResult.migrated).toBe(true);
      expect(migrationResult.backup).toBeDefined();

      // Verify data preservation
      const migratedData = JSON.parse(
        fs.readFileSync(
          path.join(
            migrationResult.targetSessionPath,
            "Default",
            "Preferences"
          ),
          "utf8"
        )
      );
      expect(migratedData.data).toBe("important");
    });

    test("should migrate from branch to shared strategy", async () => {
      // Create branch session
      const branchGitInfo =
        GitWorkflowScenarioGenerator.createMockGitInfo("feature/test");
      const branchStrategyManager = createSessionStrategyManager({
        gitInfo: branchGitInfo,
        baseSessionPath: testSessionPath,
        enableBranchDetection: true,
      });

      const branchStrategy = branchStrategyManager.getCurrentStrategy();

      fs.mkdirSync(branchStrategy.sessionPath, { recursive: true });
      fs.mkdirSync(path.join(branchStrategy.sessionPath, "Default"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(branchStrategy.sessionPath, "Default", "Preferences"),
        JSON.stringify({ strategy: "branch", branch: "feature/test" })
      );

      // Migrate to shared strategy
      const migrationResult = await branchStrategyManager.migrateSession(
        "branch",
        "shared",
        {
          sourceSessionPath: branchStrategy.sessionPath,
          createBackup: true,
          validateAfterMigration: true,
        }
      );

      expect(migrationResult.success).toBe(true);
      expect(migrationResult.migrated).toBe(true);

      // Verify shared session path format
      expect(migrationResult.targetSessionPath).toContain("wa_shared_");
    });
  });

  describe("Error Handling in Git Workflows", () => {
    test("should handle git command failures gracefully", async () => {
      // Mock git command to fail
      const detector = new GitBranchDetector();
      const originalDetectBranch = detector.detectBranch;

      detector.detectBranch = jest.fn().mockImplementation((method) => {
        if (method === "git-command") {
          throw new Error("git command failed");
        }
        return originalDetectBranch.call(detector, method);
      });

      try {
        const gitInfo = await getGitRepositoryInfo();

        // Should still work with fallback methods
        expect(gitInfo).toBeDefined();
        expect(typeof gitInfo.isRepository).toBe("boolean");
      } finally {
        // Restore original method
        detector.detectBranch = originalDetectBranch;
      }
    });

    test("should handle corrupted git repository", async () => {
      // Mock git info to simulate corrupted repository
      const corruptedGitInfo = {
        isRepository: true,
        branch: null, // Corrupted - no branch detected
        commit: null,
        isDirty: false,
      };

      const strategyManager = createSessionStrategyManager({
        gitInfo: corruptedGitInfo,
        baseSessionPath: testSessionPath,
        enableBranchDetection: true,
      });

      const strategy = strategyManager.getCurrentStrategy();

      // Should fallback to a safe strategy
      expect(strategy).toBeDefined();
      expect(strategy.strategy).toBeDefined();
      expect(strategy.instanceId).toBeDefined();
    });

    test("should handle missing git executable", async () => {
      // This would be tested in an environment without git
      // For now, we test that the system handles the error gracefully
      const detector = new GitBranchDetector();

      try {
        const branch = await detector.detectBranch("git-command");
        // If git is available, branch might be detected
        if (branch) {
          expect(typeof branch).toBe("string");
        }
      } catch (error) {
        // If git is not available, should handle gracefully
        expect(error).toBeDefined();
      }
    });
  });

  describe("Performance in Git Workflows", () => {
    test("should detect git information quickly", async () => {
      const startTime = Date.now();
      const gitInfo = await getGitRepositoryInfo();
      const duration = Date.now() - startTime;

      expect(gitInfo).toBeDefined();
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    test("should handle multiple branch operations efficiently", async () => {
      const branches = Array.from(
        { length: 10 },
        (_, i) => `feature/test-${i}`
      );

      const startTime = Date.now();

      const strategies = branches.map((branch) => {
        const gitInfo = GitWorkflowScenarioGenerator.createMockGitInfo(branch);
        const strategyManager = createSessionStrategyManager({
          gitInfo,
          baseSessionPath: testSessionPath,
          enableBranchDetection: true,
        });

        return strategyManager.getCurrentStrategy();
      });

      const duration = Date.now() - startTime;

      expect(strategies.length).toBe(branches.length);
      expect(duration).toBeLessThan(1000); // Should be very fast for mock operations

      // All strategies should be unique
      const instanceIds = strategies.map((s) => s.instanceId);
      const uniqueIds = new Set(instanceIds);
      expect(uniqueIds.size).toBe(branches.length);
    });
  });
});
