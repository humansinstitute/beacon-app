// tests/env.setup.js
// Set up test environment variables before any tests run

// Core test environment configuration
process.env.NODE_ENV = "test";

// Disable configuration auto-initialization in tests
process.env.CONFIG_DISABLE_AUTO_INIT = "true";

// Authentication configuration
process.env.BEACON_AUTH = "test-beacon-auth-token-12345";

// Database configuration
process.env.MONGO_URI = "mongodb://localhost:27017/beacon_test";
process.env.REDIS_URL = "redis://127.0.0.1:6379";

// Server configuration
process.env.PORT = "3001";
process.env.API_SERVER_PORT = "3257";
process.env.SERVER_URL = "http://localhost";

// WhatsApp Gateway configuration
process.env.WA_GATEWAY_NPUB = "test-npub-12345";

// Logging configuration
process.env.DEBUG = "false";
process.env.LOG_LEVEL = "error";

// WhatsApp session management configuration
process.env.WA_SHARED_SESSION = "true";
process.env.WA_BRANCH_SESSIONS = "false";
process.env.WA_BRANCH_DETECTION = "true";
process.env.WA_AUTO_MIGRATE_SESSION = "true";
process.env.WA_MIGRATION_BACKUP = "true";
process.env.WA_CLEANUP_ON_EXIT = "false";

// Cashu configuration for testing
process.env.NCTOOLS_API_URL = "http://localhost:3000";
process.env.NCTOOLS_TIMEOUT = "30000";
process.env.CASHU_DEFAULT_MINT = "https://mint.minibits.cash/Bitcoin";
process.env.CASHU_MIN_AMOUNT = "1";
process.env.CASHU_MAX_AMOUNT = "1000000";

// Test-specific configuration
process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || "1";

// Disable PM2 detection in tests
delete process.env.pm_id;
delete process.env.PM2_APP_NAME;
delete process.env.PM2_INSTANCE_ID;

// Disable git integration in tests unless explicitly enabled
if (!process.env.ENABLE_GIT_TESTS) {
  delete process.env.GIT_BRANCH;
  delete process.env.BRANCH_NAME;
  delete process.env.CI_COMMIT_REF_NAME;
  delete process.env.GITHUB_REF_NAME;
}

// Configuration validation settings for tests
process.env.CONFIG_VALIDATION_STRICT = "false";
process.env.CONFIG_LOG_WARNINGS = "false";
process.env.CONFIG_THROW_ON_ERROR = "false";

// Ensure test isolation
process.env.TEST_ISOLATION = "true";
