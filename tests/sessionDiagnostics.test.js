import {
  generateDiagnosticReport,
  formatDiagnosticReport,
  logDiagnostic,
} from "../app/utils/sessionDiagnostics.js";
import * as sessionValidation from "../app/utils/sessionValidation.js";
import fs from "fs";
import os from "os";
import { jest } from "@jest/globals";

// Mock dependencies
jest.mock("fs");
jest.mock("os");
jest.mock("../app/utils/sessionValidation.js");

describe("Session Diagnostics", () => {
  let originalEnv;
  let originalCwd;
  let originalConsole;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Store original values
    originalEnv = { ...process.env };
    originalCwd = process.cwd;
    originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };

    // Mock console methods
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    // Mock process.cwd
    process.cwd = jest.fn().mockReturnValue("/test/path");

    // Set up default environment
    process.env = {
      NODE_ENV: "test",
      pm_id: "test-instance",
      name: "test-process",
      REDIS_URL: "redis://localhost:6379",
      BEACON_AUTH: "test-auth",
    };
  });

  afterEach(() => {
    // Restore original values
    process.env = originalEnv;
    process.cwd = originalCwd;
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe("generateDiagnosticReport", () => {
    test("should generate comprehensive diagnostic report with default options", () => {
      // Mock session discovery
      sessionValidation.discoverSessionDirectories.mockReturnValue([
        "/test/.wwebjs_auth_1",
        "/test/.wwebjs_auth_2",
      ]);

      // Mock session validation
      sessionValidation.validateSessionData.mockReturnValue({
        isValid: true,
        issues: [],
        warnings: [],
      });

      sessionValidation.quickValidateSession.mockReturnValue(true);

      // Mock system info
      os.hostname.mockReturnValue("test-host");
      os.type.mockReturnValue("Linux");
      os.release.mockReturnValue("5.4.0");
      os.totalmem.mockReturnValue(8589934592); // 8GB
      os.freemem.mockReturnValue(4294967296); // 4GB
      os.cpus.mockReturnValue([{}, {}, {}, {}]); // 4 CPUs
      os.loadavg.mockReturnValue([0.5, 0.7, 0.9]);
      os.uptime.mockReturnValue(86400); // 1 day
      os.userInfo.mockReturnValue({
        username: "testuser",
        homedir: "/home/testuser",
      });

      // Mock fs for session analysis
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({
        mtime: new Date("2024-01-01T00:00:00Z"),
        isDirectory: () => true,
      });
      fs.readdirSync.mockReturnValue(["file1.txt", "file2.txt"]);

      const result = generateDiagnosticReport();

      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("reportVersion", "1.0.0");
      expect(result).toHaveProperty("generationDuration");
      expect(result.summary.totalSessions).toBe(2);
      expect(result.summary.validSessions).toBe(2);
      expect(result.summary.healthScore).toBe(100);
      expect(result.environment).toBeDefined();
      expect(result.system).toBeDefined();
      expect(result.sessions).toHaveLength(2);
    });

    test("should handle no sessions found", () => {
      sessionValidation.discoverSessionDirectories.mockReturnValue([]);

      const result = generateDiagnosticReport();

      expect(result.summary.totalSessions).toBe(0);
      expect(result.warnings).toContain(
        "No WhatsApp Web.js session directories found"
      );
      expect(result.recommendations).toContain(
        "Initialize WhatsApp Web.js client to create session data"
      );
    });

    test("should detect PM2 execution mode", () => {
      process.env.pm_id = "5";
      process.env.name = "whatsapp-worker";

      sessionValidation.discoverSessionDirectories.mockReturnValue([]);

      const result = generateDiagnosticReport();

      expect(result.environment.executionMode).toBe("pm2");
      expect(result.environment.pm2.detected).toBe(true);
      expect(result.environment.pm2.instanceId).toBe("5");
      expect(result.environment.pm2.processName).toBe("whatsapp-worker");
    });

    test("should detect test execution mode", () => {
      process.env.JEST_WORKER_ID = "1";
      delete process.env.pm_id;

      sessionValidation.discoverSessionDirectories.mockReturnValue([]);

      const result = generateDiagnosticReport();

      expect(result.environment.executionMode).toBe("test");
    });

    test("should detect direct execution mode", () => {
      delete process.env.pm_id;
      delete process.env.JEST_WORKER_ID;
      process.env.NODE_ENV = "development";

      sessionValidation.discoverSessionDirectories.mockReturnValue([]);

      const result = generateDiagnosticReport();

      expect(result.environment.executionMode).toBe("direct");
    });

    test("should calculate health score correctly", () => {
      sessionValidation.discoverSessionDirectories.mockReturnValue([
        "/test/.wwebjs_auth_1",
        "/test/.wwebjs_auth_2",
        "/test/.wwebjs_auth_3",
        "/test/.wwebjs_auth_4",
      ]);

      // Mock 2 valid, 2 invalid sessions
      sessionValidation.validateSessionData
        .mockReturnValueOnce({ isValid: true, issues: [], warnings: [] })
        .mockReturnValueOnce({
          isValid: false,
          issues: ["error"],
          warnings: [],
        })
        .mockReturnValueOnce({ isValid: true, issues: [], warnings: [] })
        .mockReturnValueOnce({
          isValid: false,
          issues: ["error"],
          warnings: [],
        });

      sessionValidation.quickValidateSession
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      // Mock fs for session analysis
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({
        mtime: new Date("2024-01-01T00:00:00Z"),
      });
      fs.readdirSync.mockReturnValue(["file.txt"]);

      const result = generateDiagnosticReport();

      expect(result.summary.totalSessions).toBe(4);
      expect(result.summary.validSessions).toBe(2);
      expect(result.summary.invalidSessions).toBe(2);
      expect(result.summary.healthScore).toBe(50); // 2/4 = 50%
    });

    test("should generate recommendations based on findings", () => {
      sessionValidation.discoverSessionDirectories.mockReturnValue([
        "/test/.wwebjs_auth_1",
        "/test/.wwebjs_auth_2",
      ]);

      // Mock one corrupted session
      sessionValidation.validateSessionData
        .mockReturnValueOnce({
          isValid: false,
          issues: ["corruption detected"],
          warnings: [],
        })
        .mockReturnValueOnce({
          isValid: true,
          issues: [],
          warnings: [],
        });

      sessionValidation.quickValidateSession
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      // Mock old session (90+ days)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 95);

      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({
        mtime: oldDate,
      });
      fs.readdirSync.mockReturnValue(["file.txt"]);

      const result = generateDiagnosticReport();

      expect(result.summary.healthScore).toBe(50);
      expect(
        result.recommendations.some((r) =>
          r.includes("Some sessions may need attention")
        )
      ).toBe(true);
    });

    test("should detect common issues", () => {
      process.env.pm_id = "undefined";

      sessionValidation.discoverSessionDirectories.mockReturnValue([
        "/test/.wwebjs_auth_1",
      ]);

      sessionValidation.validateSessionData.mockReturnValue({
        isValid: false,
        issues: ["corruption detected"],
        warnings: [],
      });

      sessionValidation.quickValidateSession.mockReturnValue(false);

      // Mock corrupted session
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({
        mtime: new Date("2024-01-01T00:00:00Z"),
      });
      fs.readdirSync.mockReturnValue([]);

      const result = generateDiagnosticReport();

      expect(
        result.errors.some((e) => e.includes("PM2 instance ID is undefined"))
      ).toBe(true);
    });

    test("should handle generation errors gracefully", () => {
      sessionValidation.discoverSessionDirectories.mockImplementation(() => {
        throw new Error("Discovery failed");
      });

      const result = generateDiagnosticReport();

      expect(
        result.errors.some((e) => e.includes("Diagnostic generation error"))
      ).toBe(true);
    });

    test("should respect options for system and environment info", () => {
      sessionValidation.discoverSessionDirectories.mockReturnValue([]);

      const result = generateDiagnosticReport({
        includeSystemInfo: false,
        includeEnvironmentInfo: false,
      });

      expect(Object.keys(result.environment)).toHaveLength(0);
      expect(Object.keys(result.system)).toHaveLength(0);
    });

    test("should respect validateAllSessions option", () => {
      sessionValidation.discoverSessionDirectories.mockReturnValue([
        "/test/.wwebjs_auth_1",
      ]);

      sessionValidation.quickValidateSession.mockReturnValue(true);

      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({
        mtime: new Date("2024-01-01T00:00:00Z"),
      });
      fs.readdirSync.mockReturnValue(["file.txt"]);

      const result = generateDiagnosticReport({
        validateAllSessions: false,
      });

      expect(sessionValidation.validateSessionData).not.toHaveBeenCalled();
      expect(sessionValidation.quickValidateSession).toHaveBeenCalled();
    });
  });

  describe("formatDiagnosticReport", () => {
    test("should format diagnostic report for console output", () => {
      const mockReport = {
        timestamp: "2024-01-01T00:00:00.000Z",
        generationDuration: 150,
        summary: {
          totalSessions: 2,
          validSessions: 1,
          invalidSessions: 1,
          corruptedSessions: 1,
          healthScore: 50,
        },
        environment: {
          executionMode: "pm2",
          nodeVersion: "v18.0.0",
          platform: "linux",
          pm2: {
            detected: true,
            instanceId: "5",
          },
        },
        sessions: [
          {
            path: "/test/.wwebjs_auth_1",
            isValid: true,
            isCorrupted: false,
            size: 1048576, // 1MB
            ageInDays: 5,
          },
          {
            path: "/test/.wwebjs_auth_2",
            isValid: false,
            isCorrupted: true,
            size: 512000, // 500KB
            ageInDays: 30,
          },
        ],
        warnings: ["Session validation warning"],
        errors: ["Session validation error"],
        recommendations: ["Clean up corrupted sessions"],
      };

      const formatted = formatDiagnosticReport(mockReport);

      expect(formatted).toContain("WhatsApp Session Diagnostic Report");
      expect(formatted).toContain("Generated: 2024-01-01T00:00:00.000Z");
      expect(formatted).toContain("Duration: 150ms");
      expect(formatted).toContain("Total Sessions: 2");
      expect(formatted).toContain("Valid Sessions: 1");
      expect(formatted).toContain("Health Score: 50%");
      expect(formatted).toContain("Execution Mode: pm2");
      expect(formatted).toContain("PM2 Instance ID: 5");
      expect(formatted).toContain("/test/.wwebjs_auth_1");
      expect(formatted).toContain("Valid: Yes");
      expect(formatted).toContain("Size: 1 MB");
      expect(formatted).toContain("Age: 5 days");
      expect(formatted).toContain("Status: CORRUPTED");
      expect(formatted).toContain("⚠️  Session validation warning");
      expect(formatted).toContain("❌ Session validation error");
      expect(formatted).toContain("💡 Clean up corrupted sessions");
    });

    test("should handle empty report sections", () => {
      const mockReport = {
        timestamp: "2024-01-01T00:00:00.000Z",
        generationDuration: 50,
        summary: {
          totalSessions: 0,
          validSessions: 0,
          invalidSessions: 0,
          corruptedSessions: 0,
          healthScore: 0,
        },
        environment: {},
        sessions: [],
        warnings: [],
        errors: [],
        recommendations: [],
      };

      const formatted = formatDiagnosticReport(mockReport);

      expect(formatted).toContain("Total Sessions: 0");
      expect(formatted).not.toContain("SESSIONS:");
      expect(formatted).not.toContain("WARNINGS:");
      expect(formatted).not.toContain("ERRORS:");
      expect(formatted).not.toContain("RECOMMENDATIONS:");
    });
  });

  describe("logDiagnostic", () => {
    test("should log info level messages", () => {
      const testData = { key: "value" };

      logDiagnostic("info", "Test message", testData);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(
          "[INFO] [WhatsApp-Session-Diagnostics] Test message"
        ),
        testData
      );
    });

    test("should log warning level messages", () => {
      const testData = { warning: "data" };

      logDiagnostic("warn", "Warning message", testData);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "[WARN] [WhatsApp-Session-Diagnostics] Warning message"
        ),
        testData
      );
    });

    test("should log error level messages", () => {
      const testData = { error: "details" };

      logDiagnostic("error", "Error message", testData);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "[ERROR] [WhatsApp-Session-Diagnostics] Error message"
        ),
        testData
      );
    });

    test("should handle missing data parameter", () => {
      logDiagnostic("info", "Test message");

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(
          "[INFO] [WhatsApp-Session-Diagnostics] Test message"
        ),
        {}
      );
    });

    test("should format timestamp correctly", () => {
      logDiagnostic("info", "Test message");

      const logCall = console.log.mock.calls[0][0];
      expect(logCall).toMatch(
        /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/
      );
    });

    test("should handle case insensitive log levels", () => {
      logDiagnostic("INFO", "Test message");
      logDiagnostic("Warning", "Test message");
      logDiagnostic("ERROR", "Test message");

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[INFO]"),
        {}
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("[WARNING]"),
        {}
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR]"),
        {}
      );
    });

    test("should default to info level for unknown levels", () => {
      logDiagnostic("unknown", "Test message");

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[UNKNOWN]"),
        {}
      );
    });
  });

  describe("Environment Detection", () => {
    test("should detect PM2 legacy execution mode", () => {
      delete process.env.pm_id;
      process.argv[1] = "/path/to/ProcessContainer.js";

      sessionValidation.discoverSessionDirectories.mockReturnValue([]);

      const result = generateDiagnosticReport();

      expect(result.environment.executionMode).toBe("pm2-legacy");
    });

    test("should mask sensitive environment variables", () => {
      process.env.BEACON_AUTH = "secret-token";
      process.env.PASSWORD = "secret-password";
      process.env.SECRET_KEY = "secret-key";
      process.env.REDIS_URL = "redis://localhost:6379";

      sessionValidation.discoverSessionDirectories.mockReturnValue([]);

      const result = generateDiagnosticReport();

      expect(result.environment.environmentVariables.BEACON_AUTH).toBe(
        "***MASKED***"
      );
      expect(result.environment.environmentVariables.REDIS_URL).toBe(
        "redis://localhost:6379"
      );
    });
  });

  describe("Performance Tests", () => {
    test("should complete diagnostic generation within reasonable time", () => {
      sessionValidation.discoverSessionDirectories.mockReturnValue([
        "/test/.wwebjs_auth_1",
      ]);
      sessionValidation.quickValidateSession.mockReturnValue(true);

      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({
        mtime: new Date("2024-01-01T00:00:00Z"),
      });
      fs.readdirSync.mockReturnValue(["file.txt"]);

      const startTime = Date.now();
      const result = generateDiagnosticReport();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.generationDuration).toBeLessThan(2000);
    });
  });
});
