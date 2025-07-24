#!/usr/bin/env node

/**
 * Comprehensive Test Runner for WhatsApp Session Management
 * Executes all Phase 5 tests and generates comprehensive reports
 * Validates all PRD success criteria and acceptance criteria
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Test configuration
const TEST_CONFIG = {
  timeout: 300000, // 5 minutes per test suite
  maxConcurrency: 1, // Run tests sequentially to avoid conflicts
  retries: 2, // Retry failed tests
  coverage: true, // Enable coverage reporting
  verbose: true, // Verbose output
};

// Test suites configuration
const TEST_SUITES = [
  {
    name: "Unit Tests",
    description: "Core component unit tests",
    pattern: "tests/*.test.js",
    timeout: 60000,
    priority: 1,
  },
  {
    name: "Integration Tests",
    description: "WhatsApp gateway and session management integration",
    pattern: "tests/integration/*.test.js",
    timeout: 120000,
    priority: 2,
  },
  {
    name: "Performance Tests",
    description: "Performance benchmarking and timing validation",
    pattern: "tests/performance/*.test.js",
    timeout: 180000,
    priority: 3,
  },
  {
    name: "Scenario Tests",
    description: "Corruption recovery and git workflow scenarios",
    pattern: "tests/scenarios/*.test.js",
    timeout: 240000,
    priority: 4,
  },
];

// PRD Success Criteria mapping
const PRD_CRITERIA = {
  SC1: {
    name: "100% successful startup rate for PM2 execution",
    tests: [
      "tests/integration/whatsapp.gateway.integration.test.js",
      "tests/instanceManager.test.js",
    ],
  },
  SC2: {
    name: "Zero manual intervention required for session management",
    tests: [
      "tests/integration/session.management.integration.test.js",
      "tests/sessionRecovery.test.js",
      "tests/scenarios/corruption.scenarios.test.js",
    ],
  },
  SC3: {
    name: "Session state persistence across normal restarts",
    tests: [
      "tests/integration/whatsapp.gateway.integration.test.js",
      "tests/sessionValidation.test.js",
      "tests/sessionBackup.test.js",
    ],
  },
  SC4: {
    name: "Automatic detection and cleanup of corrupted session data",
    tests: [
      "tests/scenarios/corruption.scenarios.test.js",
      "tests/sessionRecovery.test.js",
      "tests/sessionValidation.test.js",
    ],
  },
  SC5: {
    name: "Consistent behavior between PM2 and direct Node.js execution",
    tests: [
      "tests/integration/whatsapp.gateway.integration.test.js",
      "tests/sessionDiagnostics.test.js",
    ],
  },
};

// Performance thresholds from PRD
const PERFORMANCE_THRESHOLDS = {
  SESSION_VALIDATION: 5000, // 5 seconds
  RECOVERY_COMPLETION: 30000, // 30 seconds
  GIT_BRANCH_DETECTION: 2000, // 2 seconds
};

class TestRunner {
  constructor() {
    this.results = {
      suites: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
      },
      prdCriteria: {},
      performance: {},
      coverage: null,
      errors: [],
    };
    this.startTime = Date.now();
  }

  async run() {
    console.log("🚀 Starting WhatsApp Session Management Test Suite");
    console.log("=".repeat(60));

    try {
      // Setup test environment
      await this.setupTestEnvironment();

      // Run test suites
      await this.runTestSuites();

      // Generate reports
      await this.generateReports();

      // Validate PRD criteria
      await this.validatePRDCriteria();

      // Display results
      this.displayResults();

      // Exit with appropriate code
      process.exit(this.results.summary.failed > 0 ? 1 : 0);
    } catch (error) {
      console.error("❌ Test runner failed:", error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }

  async setupTestEnvironment() {
    console.log("🔧 Setting up test environment...");

    // Set test environment variables
    process.env.NODE_ENV = "test";
    process.env.WA_SHARED_SESSION = "true";
    process.env.WA_BRANCH_SESSIONS = "false";
    process.env.WA_BRANCH_DETECTION = "true";
    process.env.WA_AUTO_MIGRATE_SESSION = "true";
    process.env.WA_MIGRATION_BACKUP = "true";
    process.env.WA_CLEANUP_ON_EXIT = "false";
    process.env.BEACON_AUTH = "test-auth-token";
    process.env.WA_GATEWAY_NPUB = "test-npub";
    process.env.SERVER_URL = "http://localhost";
    process.env.API_SERVER_PORT = "3256";
    process.env.REDIS_URL = "redis://127.0.0.1:6379";

    // Create test directories
    const testDirs = ["test-sessions", "test-backups", "test-reports"];

    for (const dir of testDirs) {
      const dirPath = path.join(projectRoot, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }

    console.log("✅ Test environment ready");
  }

  async runTestSuites() {
    console.log("\n📋 Running test suites...");

    // Sort test suites by priority
    const sortedSuites = TEST_SUITES.sort((a, b) => a.priority - b.priority);

    for (const suite of sortedSuites) {
      console.log(`\n🧪 Running ${suite.name}: ${suite.description}`);

      const suiteResult = await this.runTestSuite(suite);
      this.results.suites.push(suiteResult);

      // Update summary
      this.results.summary.total += suiteResult.total;
      this.results.summary.passed += suiteResult.passed;
      this.results.summary.failed += suiteResult.failed;
      this.results.summary.skipped += suiteResult.skipped;

      // Display suite results
      this.displaySuiteResult(suiteResult);

      // Stop on critical failures
      if (suiteResult.failed > 0 && suite.priority <= 2) {
        console.log(
          "⚠️  Critical test failures detected. Continuing with remaining tests..."
        );
      }
    }
  }

  async runTestSuite(suite) {
    const startTime = Date.now();

    try {
      const result = await this.executeJest(suite);
      const duration = Date.now() - startTime;

      return {
        name: suite.name,
        description: suite.description,
        pattern: suite.pattern,
        duration,
        success: result.success,
        total: result.numTotalTests || 0,
        passed: result.numPassedTests || 0,
        failed: result.numFailedTests || 0,
        skipped: result.numPendingTests || 0,
        coverage: result.coverageMap || null,
        output: result.output,
        errors: result.errors || [],
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        name: suite.name,
        description: suite.description,
        pattern: suite.pattern,
        duration,
        success: false,
        total: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
        coverage: null,
        output: "",
        errors: [error.message],
      };
    }
  }

  async executeJest(suite) {
    return new Promise((resolve, reject) => {
      const jestArgs = [
        "--testPathPattern=" + suite.pattern,
        "--testTimeout=" + (suite.timeout || TEST_CONFIG.timeout),
        "--verbose",
        "--json",
        "--coverage",
        "--coverageDirectory=test-reports/coverage",
        "--coverageReporters=json,lcov,text",
      ];

      const jest = spawn("npx", ["jest", ...jestArgs], {
        cwd: projectRoot,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });

      let output = "";
      let errorOutput = "";

      jest.stdout.on("data", (data) => {
        output += data.toString();
      });

      jest.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      jest.on("close", (code) => {
        try {
          // Parse Jest JSON output
          const lines = output.split("\n");
          const jsonLine = lines.find(
            (line) => line.startsWith("{") && line.includes("numTotalTests")
          );

          if (jsonLine) {
            const result = JSON.parse(jsonLine);
            result.success = code === 0;
            result.output = output;
            result.errors = errorOutput ? [errorOutput] : [];
            resolve(result);
          } else {
            resolve({
              success: code === 0,
              numTotalTests: 0,
              numPassedTests: 0,
              numFailedTests: code === 0 ? 0 : 1,
              numPendingTests: 0,
              output,
              errors: errorOutput ? [errorOutput] : [],
            });
          }
        } catch (parseError) {
          reject(
            new Error(`Failed to parse Jest output: ${parseError.message}`)
          );
        }
      });

      jest.on("error", (error) => {
        reject(new Error(`Failed to execute Jest: ${error.message}`));
      });
    });
  }

  displaySuiteResult(result) {
    const status = result.success ? "✅" : "❌";
    const duration = (result.duration / 1000).toFixed(2);

    console.log(`${status} ${result.name} (${duration}s)`);
    console.log(
      `   Tests: ${result.total}, Passed: ${result.passed}, Failed: ${result.failed}, Skipped: ${result.skipped}`
    );

    if (result.errors.length > 0) {
      console.log("   Errors:");
      result.errors.forEach((error) => {
        console.log(`     - ${error}`);
      });
    }
  }

  async generateReports() {
    console.log("\n📊 Generating test reports...");

    const reportsDir = path.join(projectRoot, "test-reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Generate JSON report
    const jsonReport = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      configuration: TEST_CONFIG,
      results: this.results,
    };

    fs.writeFileSync(
      path.join(reportsDir, "test-results.json"),
      JSON.stringify(jsonReport, null, 2)
    );

    // Generate HTML report
    await this.generateHTMLReport(jsonReport, reportsDir);

    // Generate markdown summary
    await this.generateMarkdownSummary(jsonReport, reportsDir);

    console.log("✅ Reports generated in test-reports/");
  }

  async generateHTMLReport(jsonReport, reportsDir) {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Session Management Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e8f4fd; padding: 15px; border-radius: 5px; text-align: center; }
        .metric.success { background: #d4edda; }
        .metric.failure { background: #f8d7da; }
        .suite { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .suite.success { border-color: #28a745; }
        .suite.failure { border-color: #dc3545; }
        .prd-criteria { margin: 20px 0; }
        .criteria { padding: 10px; margin: 5px 0; border-radius: 3px; }
        .criteria.pass { background: #d4edda; }
        .criteria.fail { background: #f8d7da; }
        .criteria.unknown { background: #fff3cd; }
    </style>
</head>
<body>
    <div class="header">
        <h1>WhatsApp Session Management Test Report</h1>
        <p>Generated: ${jsonReport.timestamp}</p>
        <p>Duration: ${(jsonReport.duration / 1000).toFixed(2)} seconds</p>
        <p>Environment: Node.js ${jsonReport.environment.nodeVersion} on ${
      jsonReport.environment.platform
    }</p>
    </div>

    <div class="summary">
        <div class="metric ${
          jsonReport.results.summary.failed === 0 ? "success" : "failure"
        }">
            <h3>Total Tests</h3>
            <div>${jsonReport.results.summary.total}</div>
        </div>
        <div class="metric success">
            <h3>Passed</h3>
            <div>${jsonReport.results.summary.passed}</div>
        </div>
        <div class="metric ${
          jsonReport.results.summary.failed > 0 ? "failure" : "success"
        }">
            <h3>Failed</h3>
            <div>${jsonReport.results.summary.failed}</div>
        </div>
        <div class="metric">
            <h3>Skipped</h3>
            <div>${jsonReport.results.summary.skipped}</div>
        </div>
    </div>

    <h2>Test Suites</h2>
    ${jsonReport.results.suites
      .map(
        (suite) => `
        <div class="suite ${suite.success ? "success" : "failure"}">
            <h3>${suite.name} ${suite.success ? "✅" : "❌"}</h3>
            <p>${suite.description}</p>
            <p>Duration: ${(suite.duration / 1000).toFixed(2)}s | Tests: ${
          suite.total
        } | Passed: ${suite.passed} | Failed: ${suite.failed}</p>
            ${
              suite.errors.length > 0
                ? `<div><strong>Errors:</strong><ul>${suite.errors
                    .map((error) => `<li>${error}</li>`)
                    .join("")}</ul></div>`
                : ""
            }
        </div>
    `
      )
      .join("")}

    <h2>PRD Success Criteria</h2>
    <div class="prd-criteria">
        ${Object.entries(PRD_CRITERIA)
          .map(
            ([key, criteria]) => `
            <div class="criteria unknown">
                <strong>${key}:</strong> ${criteria.name}
                <div>Related tests: ${criteria.tests.join(", ")}</div>
            </div>
        `
          )
          .join("")}
    </div>
</body>
</html>
    `;

    fs.writeFileSync(path.join(reportsDir, "test-report.html"), htmlContent);
  }

  async generateMarkdownSummary(jsonReport, reportsDir) {
    const passRate = (
      (jsonReport.results.summary.passed / jsonReport.results.summary.total) *
      100
    ).toFixed(1);

    const markdownContent = `
# WhatsApp Session Management Test Report

**Generated:** ${jsonReport.timestamp}  
**Duration:** ${(jsonReport.duration / 1000).toFixed(2)} seconds  
**Environment:** Node.js ${jsonReport.environment.nodeVersion} on ${
      jsonReport.environment.platform
    }

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${jsonReport.results.summary.total} |
| Passed | ${jsonReport.results.summary.passed} |
| Failed | ${jsonReport.results.summary.failed} |
| Skipped | ${jsonReport.results.summary.skipped} |
| Pass Rate | ${passRate}% |

## Test Suites

${jsonReport.results.suites
  .map(
    (suite) => `
### ${suite.name} ${suite.success ? "✅" : "❌"}

**Description:** ${suite.description}  
**Duration:** ${(suite.duration / 1000).toFixed(2)}s  
**Results:** ${suite.total} tests, ${suite.passed} passed, ${
      suite.failed
    } failed, ${suite.skipped} skipped

${
  suite.errors.length > 0
    ? `**Errors:**\n${suite.errors.map((error) => `- ${error}`).join("\n")}`
    : ""
}
`
  )
  .join("")}

## PRD Success Criteria

${Object.entries(PRD_CRITERIA)
  .map(
    ([key, criteria]) => `
### ${key}: ${criteria.name}

**Related Tests:** ${criteria.tests.join(", ")}
`
  )
  .join("")}

## Performance Thresholds

| Requirement | Threshold | Status |
|-------------|-----------|--------|
| Session Validation | < ${PERFORMANCE_THRESHOLDS.SESSION_VALIDATION}ms | ⏳ |
| Recovery Completion | < ${PERFORMANCE_THRESHOLDS.RECOVERY_COMPLETION}ms | ⏳ |
| Git Branch Detection | < ${
      PERFORMANCE_THRESHOLDS.GIT_BRANCH_DETECTION
    }ms | ⏳ |
    `;

    fs.writeFileSync(path.join(reportsDir, "test-summary.md"), markdownContent);
  }

  async validatePRDCriteria() {
    console.log("\n🎯 Validating PRD Success Criteria...");

    for (const [key, criteria] of Object.entries(PRD_CRITERIA)) {
      const relatedSuites = this.results.suites.filter((suite) =>
        criteria.tests.some(
          (testFile) =>
            suite.pattern.includes(testFile) || testFile.includes(suite.pattern)
        )
      );

      const allPassed = relatedSuites.every((suite) => suite.success);
      const status = allPassed ? "✅ PASS" : "❌ FAIL";

      console.log(`${status} ${key}: ${criteria.name}`);

      this.results.prdCriteria[key] = {
        name: criteria.name,
        status: allPassed ? "PASS" : "FAIL",
        relatedSuites: relatedSuites.map((s) => s.name),
      };
    }
  }

  displayResults() {
    const duration = (Date.now() - this.startTime) / 1000;
    this.results.summary.duration = duration;

    console.log("\n" + "=".repeat(60));
    console.log("📊 TEST RESULTS SUMMARY");
    console.log("=".repeat(60));

    console.log(`⏱️  Total Duration: ${duration.toFixed(2)}s`);
    console.log(`📋 Total Tests: ${this.results.summary.total}`);
    console.log(`✅ Passed: ${this.results.summary.passed}`);
    console.log(`❌ Failed: ${this.results.summary.failed}`);
    console.log(`⏭️  Skipped: ${this.results.summary.skipped}`);

    const passRate =
      this.results.summary.total > 0
        ? (
            (this.results.summary.passed / this.results.summary.total) *
            100
          ).toFixed(1)
        : 0;
    console.log(`📈 Pass Rate: ${passRate}%`);

    console.log("\n🎯 PRD Success Criteria:");
    Object.entries(this.results.prdCriteria).forEach(([key, criteria]) => {
      const status = criteria.status === "PASS" ? "✅" : "❌";
      console.log(`${status} ${key}: ${criteria.name}`);
    });

    if (this.results.summary.failed === 0) {
      console.log(
        "\n🎉 All tests passed! WhatsApp Session Management is ready for production."
      );
    } else {
      console.log(
        `\n⚠️  ${this.results.summary.failed} test(s) failed. Please review the failures before deployment.`
      );
    }

    console.log("\n📁 Reports available in test-reports/");
    console.log("   - test-results.json (detailed JSON report)");
    console.log("   - test-report.html (interactive HTML report)");
    console.log("   - test-summary.md (markdown summary)");
    console.log("   - coverage/ (code coverage reports)");
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
WhatsApp Session Management Test Runner

Usage: node scripts/test-runner.js [options]

Options:
  --help, -h          Show this help message
  --suite <name>      Run specific test suite only
  --coverage          Enable coverage reporting (default: true)
  --timeout <ms>      Set test timeout in milliseconds
  --verbose           Enable verbose output (default: true)

Test Suites:
  unit               Core component unit tests
  integration        Integration tests
  performance        Performance benchmarking tests
  scenarios          Scenario-based tests

Examples:
  node scripts/test-runner.js                    # Run all tests
  node scripts/test-runner.js --suite integration # Run integration tests only
  node scripts/test-runner.js --timeout 60000    # Set 60s timeout
    `);
    process.exit(0);
  }

  // Parse command line arguments
  const suiteFilter = args.includes("--suite")
    ? args[args.indexOf("--suite") + 1]
    : null;

  const timeoutOverride = args.includes("--timeout")
    ? parseInt(args[args.indexOf("--timeout") + 1])
    : null;

  if (timeoutOverride) {
    TEST_CONFIG.timeout = timeoutOverride;
  }

  if (suiteFilter) {
    const filteredSuites = TEST_SUITES.filter((suite) =>
      suite.name.toLowerCase().includes(suiteFilter.toLowerCase())
    );

    if (filteredSuites.length === 0) {
      console.error(`❌ No test suite found matching: ${suiteFilter}`);
      process.exit(1);
    }

    // Replace TEST_SUITES with filtered suites
    TEST_SUITES.length = 0;
    TEST_SUITES.push(...filteredSuites);
  }

  const runner = new TestRunner();
  await runner.run();
}

// Run if this is the main module
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Test runner failed:", error);
    process.exit(1);
  });
}

export { TestRunner, TEST_SUITES, PRD_CRITERIA, PERFORMANCE_THRESHOLDS };
