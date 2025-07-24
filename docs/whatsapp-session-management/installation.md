# Installation Guide

Complete installation and setup guide for the WhatsApp Session Management System.

## Table of Contents

- [Prerequisites](#prerequisites)
- [System Requirements](#system-requirements)
- [Installation Steps](#installation-steps)
- [Environment Configuration](#environment-configuration)
- [Initial Setup](#initial-setup)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before installing the WhatsApp Session Management System, ensure you have the following prerequisites:

### Required Software

1. **Node.js** (18.x or higher)

   ```bash
   # Check Node.js version
   node --version

   # Install Node.js (if needed)
   # Visit https://nodejs.org/ or use a package manager
   ```

2. **npm** (comes with Node.js)

   ```bash
   # Check npm version
   npm --version
   ```

3. **PM2** (Process Manager)

   ```bash
   # Install PM2 globally
   npm install -g pm2

   # Verify installation
   pm2 --version
   ```

4. **Redis** (6.x or higher)

   ```bash
   # Install Redis (Ubuntu/Debian)
   sudo apt update
   sudo apt install redis-server

   # Install Redis (macOS with Homebrew)
   brew install redis

   # Start Redis service
   sudo systemctl start redis-server  # Linux
   brew services start redis          # macOS

   # Verify Redis is running
   redis-cli ping  # Should return "PONG"
   ```

5. **Git** (2.x or higher) - Optional but recommended for git integration features

   ```bash
   # Check Git version
   git --version

   # Install Git (if needed)
   sudo apt install git  # Ubuntu/Debian
   brew install git      # macOS
   ```

### Optional Dependencies

1. **MongoDB** (if using MongoDB features)

   ```bash
   # Install MongoDB (Ubuntu/Debian)
   sudo apt install mongodb

   # Install MongoDB (macOS with Homebrew)
   brew tap mongodb/brew
   brew install mongodb-community
   ```

## System Requirements

### Minimum Requirements

- **CPU**: 1 core
- **RAM**: 512 MB
- **Storage**: 1 GB free space
- **Network**: Internet connection for WhatsApp Web

### Recommended Requirements

- **CPU**: 2+ cores
- **RAM**: 2 GB
- **Storage**: 5 GB free space
- **Network**: Stable internet connection

### Operating System Support

- **Linux**: Ubuntu 18.04+, Debian 10+, CentOS 7+
- **macOS**: 10.15+
- **Windows**: 10+ (with WSL2 recommended)

## Installation Steps

### 1. Clone the Repository

```bash
# Clone the repository
git clone <repository-url>
cd thebeacon

# Or if you're adding to an existing project
# Copy the session management files to your project
```

### 2. Install Dependencies

```bash
# Install all dependencies
npm install

# Verify critical dependencies
npm list whatsapp-web.js
npm list bullmq
npm list ioredis
```

### 3. Verify Project Structure

Ensure the following session management files are present:

```
app/
├── utils/
│   ├── sessionStrategy.js
│   ├── instanceManager.js
│   ├── sessionValidation.js
│   ├── sessionDiagnostics.js
│   ├── sessionRecovery.js
│   ├── sessionBackup.js
│   └── gitIntegration.js
├── workers/
│   └── gateways/
│       └── whatsapp.gateway.worker.js
tests/
├── sessionStrategy.test.js
├── instanceManager.test.js
├── sessionValidation.test.js
├── sessionDiagnostics.test.js
├── sessionRecovery.test.js
├── sessionBackup.test.js
└── gitIntegration.test.js
```

## Environment Configuration

### 1. Create Environment File

```bash
# Copy the example environment file
cp .env.example .env

# Edit the environment file
nano .env  # or your preferred editor
```

### 2. Basic Configuration

Configure the essential environment variables in `.env`:

```bash
# Database Configuration
MONGO_URI=mongodb://localhost:27017/beacon
REDIS_URL=redis://127.0.0.1:6379

# Authentication
BEACON_AUTH=your-secure-auth-token-here

# Application Settings
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# WhatsApp Session Management (Basic)
WA_SHARED_SESSION=true
WA_BRANCH_DETECTION=true
WA_AUTO_MIGRATE_SESSION=true
WA_MIGRATION_BACKUP=true
WA_AUTO_RECOVERY=true
WA_MAX_RECOVERY_TIME=30000
```

### 3. Advanced Session Configuration

For advanced session management features:

```bash
# Session Strategy Options
WA_BRANCH_SESSIONS=false            # Enable branch-specific sessions
WA_BRANCH_PATTERN_STRATEGY=false    # Enable pattern-based strategy
WA_TEAM_COLLABORATION=false         # Enable team collaboration

# Recovery and Cleanup
WA_CLEANUP_ON_EXIT=true             # Cleanup old sessions on exit
WA_BACKUP_RETENTION_DAYS=30         # Backup retention period

# Git Integration
WA_BRANCH_DETECTION=true            # Enable git branch detection
WA_MAIN_BRANCHES=main,master,develop # Main branch patterns
WA_FEATURE_PATTERNS=feature/*,feat/*,bugfix/* # Feature branch patterns
```

### 4. PM2 Configuration

The system includes a pre-configured PM2 ecosystem file (`ecosystem.config.cjs`). Verify the WhatsApp gateway configuration:

```javascript
{
  name: "beacon-gate-wa",
  script: "app/workers/gateways/whatsapp.gateway.worker.js",
  instances: 1,
  autorestart: true,
  env: {
    NODE_ENV: "production",
    PM2_APP_NAME: "beacon-gate-wa",
    PM2_INSTANCE_ID: "0",
    WA_SHARED_SESSION: "true",
  }
}
```

## Initial Setup

### 1. Validate Environment

```bash
# Run environment validation
node -e "
import { validateEnvironment } from './app/utils/envValidation.js';
const result = validateEnvironment();
console.log('Environment validation:', result);
"
```

### 2. Test Session Management

```bash
# Run session management tests
npm test -- --testPathPattern=session

# Run specific session tests
npm test sessionStrategy.test.js
npm test instanceManager.test.js
npm test sessionValidation.test.js
```

### 3. Initialize Session Directory

```bash
# Create session directory (if needed)
mkdir -p .wwebjs_auth_shared

# Set proper permissions
chmod 755 .wwebjs_auth_shared
```

### 4. Start Services

```bash
# Start Redis (if not already running)
sudo systemctl start redis-server  # Linux
brew services start redis          # macOS

# Start the application with PM2
pm2 start ecosystem.config.cjs

# Check process status
pm2 status

# View logs
pm2 logs beacon-gate-wa
```

## Verification

### 1. Verify PM2 Processes

```bash
# Check all processes are running
pm2 status

# Expected output should show:
# - beacon-main-server: online
# - beacon-worker: online
# - beacon-gate-wa: online
```

### 2. Verify WhatsApp Gateway

```bash
# Check WhatsApp gateway logs
pm2 logs beacon-gate-wa --lines 50

# Look for successful initialization messages:
# - "WhatsApp Gateway Worker starting..."
# - "Instance management initialized with strategy support"
# - "Session validation results"
# - "WhatsApp client is ready!" (after QR code scan)
```

### 3. Verify Session Management

```bash
# Check session directory was created
ls -la .wwebjs_auth_*

# Run diagnostic report
node -e "
import { generateDiagnosticReport } from './app/utils/sessionDiagnostics.js';
const report = generateDiagnosticReport({
  baseDirectory: process.cwd(),
  includeSystemInfo: true,
  includeEnvironmentInfo: true
});
console.log('Diagnostic Report:', JSON.stringify(report, null, 2));
"
```

### 4. Test QR Code Generation

When starting for the first time, the system will generate a QR code for WhatsApp authentication:

1. Check the terminal output for the QR code
2. Look for the QR code image file: `app/workers/gateways/whatsapp_qr.png`
3. Scan the QR code with WhatsApp mobile app
4. Verify successful authentication in the logs

### 5. Verify Session Persistence

```bash
# Restart the WhatsApp gateway
pm2 restart beacon-gate-wa

# Check logs to verify session was loaded successfully
pm2 logs beacon-gate-wa --lines 20

# Look for: "Session validation passed - using existing session"
```

## Troubleshooting

### Common Installation Issues

#### 1. Node.js Version Issues

```bash
# If you have an older Node.js version
# Install Node Version Manager (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install and use Node.js 18
nvm install 18
nvm use 18
nvm alias default 18
```

#### 2. PM2 Installation Issues

```bash
# If PM2 installation fails
npm uninstall -g pm2
npm install -g pm2@latest

# If permission issues on Linux/macOS
sudo npm install -g pm2
```

#### 3. Redis Connection Issues

```bash
# Check Redis status
sudo systemctl status redis-server  # Linux
brew services list | grep redis     # macOS

# Test Redis connection
redis-cli ping

# If Redis is not running
sudo systemctl start redis-server   # Linux
brew services start redis           # macOS
```

#### 4. Permission Issues

```bash
# Fix session directory permissions
sudo chown -R $USER:$USER .wwebjs_auth_*
chmod -R 755 .wwebjs_auth_*

# Fix log directory permissions
mkdir -p logs
sudo chown -R $USER:$USER logs
chmod -R 755 logs
```

#### 5. WhatsApp Web.js Issues

```bash
# Clear existing session data (if corrupted)
rm -rf .wwebjs_auth_*

# Reinstall WhatsApp Web.js
npm uninstall whatsapp-web.js
npm install whatsapp-web.js@latest

# Check for Puppeteer dependencies (Linux)
sudo apt install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

### Getting Help

If you encounter issues not covered here:

1. Check the [Troubleshooting Guide](troubleshooting.md) for detailed solutions
2. Review the [Configuration Reference](configuration.md) for configuration options
3. Run the diagnostic report to identify issues
4. Check the PM2 logs for error messages

### Next Steps

After successful installation:

1. Review the [Configuration Reference](configuration.md) for advanced configuration
2. Read the [Architecture Overview](architecture.md) to understand the system
3. Check the [Operations Guide](operations.md) for monitoring and maintenance
4. Consider the [Migration Guide](migration.md) if migrating from an existing setup

---

**Installation Complete!** Your WhatsApp Session Management System is now ready for use.
