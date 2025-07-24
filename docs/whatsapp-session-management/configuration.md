# Configuration Reference

Complete reference for all configuration options and environment variables in the WhatsApp Session Management System.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Session Strategy Configuration](#session-strategy-configuration)
- [Recovery and Backup Configuration](#recovery-and-backup-configuration)
- [Git Integration Configuration](#git-integration-configuration)
- [PM2 Configuration](#pm2-configuration)
- [Performance Tuning](#performance-tuning)
- [Security Configuration](#security-configuration)
- [Configuration Examples](#configuration-examples)

## Environment Variables

### Core Application Settings

| Variable      | Type   | Default                            | Description                                      |
| ------------- | ------ | ---------------------------------- | ------------------------------------------------ |
| `NODE_ENV`    | string | `development`                      | Application environment (development/production) |
| `PORT`        | number | `3000`                             | Application port                                 |
| `LOG_LEVEL`   | string | `info`                             | Logging level (debug/info/warn/error)            |
| `REDIS_URL`   | string | `redis://127.0.0.1:6379`           | Redis connection URL                             |
| `MONGO_URI`   | string | `mongodb://localhost:27017/beacon` | MongoDB connection URI                           |
| `BEACON_AUTH` | string | **Required**                       | Authentication token for the application         |

### WhatsApp Gateway Settings

| Variable               | Type   | Default | Description                     |
| ---------------------- | ------ | ------- | ------------------------------- |
| `WHATSAPP_WEBHOOK_URL` | string | -       | Webhook URL for WhatsApp events |
| `WHATSAPP_API_TOKEN`   | string | -       | WhatsApp API token              |

## Session Strategy Configuration

### Basic Session Settings

| Variable                  | Type    | Default | Description                        |
| ------------------------- | ------- | ------- | ---------------------------------- |
| `WA_SHARED_SESSION`       | boolean | `true`  | Enable shared session strategy     |
| `WA_BRANCH_SESSIONS`      | boolean | `false` | Enable branch-specific sessions    |
| `WA_BRANCH_DETECTION`     | boolean | `true`  | Enable git branch detection        |
| `WA_AUTO_MIGRATE_SESSION` | boolean | `true`  | Enable automatic session migration |
| `WA_MIGRATION_BACKUP`     | boolean | `true`  | Create backups during migration    |

### Advanced Session Strategies

| Variable                     | Type    | Default | Description                            |
| ---------------------------- | ------- | ------- | -------------------------------------- |
| `WA_BRANCH_PATTERN_STRATEGY` | boolean | `false` | Enable pattern-based session strategy  |
| `WA_TEAM_COLLABORATION`      | boolean | `false` | Enable team collaboration mode         |
| `WA_TEAM_SESSION_PREFIX`     | string  | `team`  | Prefix for team collaboration sessions |

### Session Strategy Details

#### Shared Strategy (`WA_SHARED_SESSION=true`)

- **Use Case**: Single session shared across all instances
- **Benefits**: Simple setup, consistent session state
- **Limitations**: No isolation between branches/environments
- **Recommended For**: Single-developer projects, production deployments

```bash
WA_SHARED_SESSION=true
WA_BRANCH_SESSIONS=false
WA_BRANCH_DETECTION=true  # Still useful for diagnostics
```

#### Branch-Specific Strategy (`WA_BRANCH_SESSIONS=true`)

- **Use Case**: Separate session per git branch
- **Benefits**: Complete isolation between branches
- **Limitations**: Requires re-authentication per branch
- **Recommended For**: Multi-branch development, feature testing

```bash
WA_SHARED_SESSION=false
WA_BRANCH_SESSIONS=true
WA_BRANCH_DETECTION=true
WA_AUTO_MIGRATE_SESSION=true
```

#### Pattern-Based Strategy (`WA_BRANCH_PATTERN_STRATEGY=true`)

- **Use Case**: Smart session sharing based on branch patterns
- **Benefits**: Shared sessions for main branches, isolated for features
- **Limitations**: Requires proper branch naming conventions
- **Recommended For**: Teams with structured git workflows

```bash
WA_BRANCH_PATTERN_STRATEGY=true
WA_BRANCH_DETECTION=true
WA_MAIN_BRANCHES=main,master,develop,staging
WA_FEATURE_PATTERNS=feature/*,feat/*,bugfix/*,hotfix/*
```

#### Team Collaboration Strategy (`WA_TEAM_COLLABORATION=true`)

- **Use Case**: Shared session for team development
- **Benefits**: Team members share the same WhatsApp session
- **Limitations**: Requires coordination between team members
- **Recommended For**: Small teams working on the same features

```bash
WA_TEAM_COLLABORATION=true
WA_TEAM_SESSION_PREFIX=team
WA_BRANCH_DETECTION=true
```

## Recovery and Backup Configuration

### Automatic Recovery Settings

| Variable                  | Type    | Default | Description                           |
| ------------------------- | ------- | ------- | ------------------------------------- |
| `WA_AUTO_RECOVERY`        | boolean | `true`  | Enable automatic session recovery     |
| `WA_MAX_RECOVERY_TIME`    | number  | `30000` | Maximum recovery time in milliseconds |
| `WA_RECOVERY_RETRY_COUNT` | number  | `3`     | Number of recovery attempts           |
| `WA_RECOVERY_RETRY_DELAY` | number  | `5000`  | Delay between recovery attempts (ms)  |

### Backup Configuration

| Variable                   | Type    | Default     | Description                            |
| -------------------------- | ------- | ----------- | -------------------------------------- |
| `WA_BACKUP_ENABLED`        | boolean | `true`      | Enable automatic backup creation       |
| `WA_BACKUP_RETENTION_DAYS` | number  | `30`        | Backup retention period in days        |
| `WA_BACKUP_COMPRESSION`    | boolean | `true`      | Enable backup compression              |
| `WA_BACKUP_DIRECTORY`      | string  | `./backups` | Backup storage directory               |
| `WA_BACKUP_ON_CORRUPTION`  | boolean | `true`      | Create backup when corruption detected |

### Cleanup Settings

| Variable                  | Type    | Default     | Description                                    |
| ------------------------- | ------- | ----------- | ---------------------------------------------- |
| `WA_CLEANUP_ON_EXIT`      | boolean | `true`      | Cleanup old sessions on application exit       |
| `WA_CLEANUP_MAX_AGE`      | number  | `604800000` | Maximum age for session cleanup (7 days in ms) |
| `WA_CLEANUP_KEEP_CURRENT` | boolean | `true`      | Keep current session during cleanup            |

## Git Integration Configuration

### Branch Detection Settings

| Variable                   | Type    | Default         | Description                      |
| -------------------------- | ------- | --------------- | -------------------------------- |
| `WA_BRANCH_DETECTION`      | boolean | `true`          | Enable git branch detection      |
| `WA_GIT_WORKING_DIRECTORY` | string  | `process.cwd()` | Git repository working directory |

### Branch Pattern Configuration

| Variable              | Type   | Default                              | Description                                     |
| --------------------- | ------ | ------------------------------------ | ----------------------------------------------- |
| `WA_MAIN_BRANCHES`    | string | `main,master,develop,dev`            | Comma-separated list of main branches           |
| `WA_FEATURE_PATTERNS` | string | `feature/*,feat/*,bugfix/*,hotfix/*` | Comma-separated list of feature branch patterns |

### Git Integration Examples

```bash
# Basic git integration
WA_BRANCH_DETECTION=true
WA_GIT_WORKING_DIRECTORY=/path/to/repo

# Custom branch patterns
WA_MAIN_BRANCHES=main,master,staging,production
WA_FEATURE_PATTERNS=feature/*,feat/*,bug/*,fix/*,dev/*

# Disable git integration
WA_BRANCH_DETECTION=false
```

## PM2 Configuration

### PM2 Environment Variables

The system automatically detects PM2 execution and configures accordingly:

| Variable          | Type   | Default       | Description             |
| ----------------- | ------ | ------------- | ----------------------- |
| `PM2_APP_NAME`    | string | Auto-detected | PM2 application name    |
| `PM2_INSTANCE_ID` | string | Auto-detected | PM2 instance identifier |

### PM2 Ecosystem Configuration

The `ecosystem.config.cjs` file contains PM2-specific settings:

```javascript
{
  name: "beacon-gate-wa",
  script: "app/workers/gateways/whatsapp.gateway.worker.js",
  instances: 1,
  autorestart: true,
  max_memory_restart: "1G",
  env: {
    NODE_ENV: "production",
    PM2_APP_NAME: "beacon-gate-wa",
    PM2_INSTANCE_ID: "0",
    WA_SHARED_SESSION: "true",
  }
}
```

### PM2 Logging Configuration

```javascript
{
  error_file: "logs/beacon-worker-wa/error.log",
  out_file: "logs/beacon-worker-wa/out.log",
  log_date_format: "YYYY-MM-DD HH:mm:ss",
  merge_logs: true,
  max_size: "1M",
  rotate_logs: true,
  max_logs: 5,
}
```

## Performance Tuning

### Memory Management

| Variable                   | Type   | Default | Description                         |
| -------------------------- | ------ | ------- | ----------------------------------- |
| `WA_MAX_MEMORY_USAGE`      | string | `1G`    | Maximum memory usage before restart |
| `WA_MEMORY_CHECK_INTERVAL` | number | `60000` | Memory check interval (ms)          |

### Session Validation Performance

| Variable                      | Type    | Default   | Description                         |
| ----------------------------- | ------- | --------- | ----------------------------------- |
| `WA_VALIDATION_TIMEOUT`       | number  | `10000`   | Session validation timeout (ms)     |
| `WA_QUICK_VALIDATION`         | boolean | `true`    | Enable quick validation for startup |
| `WA_DEEP_VALIDATION_INTERVAL` | number  | `3600000` | Deep validation interval (1 hour)   |

### Puppeteer Configuration

```bash
# Puppeteer performance settings
WA_PUPPETEER_HEADLESS=true
WA_PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage
WA_PUPPETEER_TIMEOUT=30000
```

## Security Configuration

### Authentication Settings

| Variable                | Type    | Default      | Description                     |
| ----------------------- | ------- | ------------ | ------------------------------- |
| `BEACON_AUTH`           | string  | **Required** | Primary authentication token    |
| `WA_SESSION_ENCRYPTION` | boolean | `false`      | Enable session data encryption  |
| `WA_SECURE_BACKUP`      | boolean | `false`      | Enable secure backup encryption |

### File System Security

| Variable                     | Type    | Default | Description                       |
| ---------------------------- | ------- | ------- | --------------------------------- |
| `WA_SESSION_PERMISSIONS`     | string  | `755`   | Session directory permissions     |
| `WA_BACKUP_PERMISSIONS`      | string  | `644`   | Backup file permissions           |
| `WA_RESTRICT_SESSION_ACCESS` | boolean | `true`  | Restrict session directory access |

## Configuration Examples

### Development Environment

```bash
# .env.development
NODE_ENV=development
LOG_LEVEL=debug

# Session Management
WA_SHARED_SESSION=false
WA_BRANCH_SESSIONS=true
WA_BRANCH_DETECTION=true
WA_AUTO_MIGRATE_SESSION=true
WA_MIGRATION_BACKUP=true

# Recovery and Backup
WA_AUTO_RECOVERY=true
WA_MAX_RECOVERY_TIME=30000
WA_BACKUP_ENABLED=true
WA_CLEANUP_ON_EXIT=false

# Git Integration
WA_MAIN_BRANCHES=main,develop
WA_FEATURE_PATTERNS=feature/*,bugfix/*
```

### Production Environment

```bash
# .env.production
NODE_ENV=production
LOG_LEVEL=info

# Session Management
WA_SHARED_SESSION=true
WA_BRANCH_SESSIONS=false
WA_BRANCH_DETECTION=true
WA_AUTO_MIGRATE_SESSION=true
WA_MIGRATION_BACKUP=true

# Recovery and Backup
WA_AUTO_RECOVERY=true
WA_MAX_RECOVERY_TIME=30000
WA_BACKUP_ENABLED=true
WA_BACKUP_RETENTION_DAYS=30
WA_CLEANUP_ON_EXIT=true

# Performance
WA_MAX_MEMORY_USAGE=2G
WA_QUICK_VALIDATION=true
```

### Team Collaboration Environment

```bash
# .env.team
NODE_ENV=production
LOG_LEVEL=info

# Team Session Strategy
WA_TEAM_COLLABORATION=true
WA_TEAM_SESSION_PREFIX=team-project
WA_BRANCH_DETECTION=true
WA_AUTO_MIGRATE_SESSION=true

# Backup and Recovery
WA_BACKUP_ENABLED=true
WA_BACKUP_RETENTION_DAYS=60
WA_AUTO_RECOVERY=true
WA_CLEANUP_ON_EXIT=false
```

### Pattern-Based Strategy Environment

```bash
# .env.pattern
NODE_ENV=production

# Pattern-Based Strategy
WA_BRANCH_PATTERN_STRATEGY=true
WA_BRANCH_DETECTION=true
WA_MAIN_BRANCHES=main,master,staging,production
WA_FEATURE_PATTERNS=feature/*,feat/*,bugfix/*,hotfix/*,dev/*

# Migration and Backup
WA_AUTO_MIGRATE_SESSION=true
WA_MIGRATION_BACKUP=true
WA_BACKUP_ENABLED=true
```

## Configuration Validation

### Environment Validation Script

```bash
# Validate configuration
node -e "
import { validateEnvironment } from './app/utils/envValidation.js';
import { validateStrategyConfig } from './app/utils/sessionStrategy.js';

const envResult = validateEnvironment();
console.log('Environment validation:', envResult);

const strategyConfig = {
  defaultStrategy: process.env.WA_SHARED_SESSION === 'true' ? 'shared' : 'branch-specific',
  autoMigrate: process.env.WA_AUTO_MIGRATE_SESSION === 'true',
  branchDetection: process.env.WA_BRANCH_DETECTION === 'true'
};

const strategyResult = validateStrategyConfig(strategyConfig);
console.log('Strategy validation:', strategyResult);
"
```

### Configuration Testing

```bash
# Test configuration with diagnostic report
node -e "
import { generateDiagnosticReport } from './app/utils/sessionDiagnostics.js';

const report = generateDiagnosticReport({
  baseDirectory: process.cwd(),
  includeSystemInfo: true,
  includeEnvironmentInfo: true,
  validateAllSessions: false
});

console.log('Configuration Status:');
console.log('- Environment:', report.environment.executionMode);
console.log('- Strategy:', report.environment.sessionStrategy);
console.log('- Git Integration:', report.environment.gitIntegration);
console.log('- Health Score:', report.summary.healthScore);
"
```

## Best Practices

### Configuration Management

1. **Use Environment-Specific Files**

   ```bash
   .env.development
   .env.staging
   .env.production
   ```

2. **Validate Configuration on Startup**

   ```bash
   # Add to package.json scripts
   "validate": "node scripts/validate-config.js"
   ```

3. **Document Custom Configurations**
   - Keep a configuration changelog
   - Document environment-specific settings
   - Include validation scripts

### Security Best Practices

1. **Never Commit Sensitive Values**

   ```bash
   # Add to .gitignore
   .env
   .env.local
   .env.*.local
   ```

2. **Use Strong Authentication Tokens**

   ```bash
   # Generate secure tokens
   BEACON_AUTH=$(openssl rand -hex 32)
   ```

3. **Restrict File Permissions**
   ```bash
   chmod 600 .env
   chmod 755 .wwebjs_auth_*
   ```

### Monitoring Configuration

1. **Log Configuration Changes**
2. **Monitor Configuration Drift**
3. **Validate Configuration Regularly**
4. **Alert on Configuration Errors**

---

**Next Steps**: Review the [Architecture Overview](architecture.md) to understand how these configurations affect system behavior, or check the [Troubleshooting Guide](troubleshooting.md) for configuration-related issues.
