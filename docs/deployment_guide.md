# The Beacon - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying The Beacon application with the complete API authorization system. The deployment includes environment validation, secure API access control, and proper PM2 process management.

## Prerequisites

### System Requirements

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher
- **MongoDB**: Version 5.0 or higher
- **PM2**: Latest version (`npm install -g pm2`)
- **Operating System**: Linux, macOS, or Windows with WSL

### Security Requirements

- Secure environment variable storage capability
- Network access for MongoDB connection
- Proper file system permissions for log directories

## Pre-Deployment Checklist

### 1. Environment Preparation

```bash
# Verify Node.js version
node --version  # Should be 18.0.0+

# Verify npm version
npm --version   # Should be 8.0.0+

# Install PM2 globally if not already installed
npm install -g pm2

# Verify PM2 installation
pm2 --version
```

### 2. Security Configuration

```bash
# Generate a secure BEACON_AUTH token (recommended)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use a custom secure string (minimum 16 characters)
# Example: beacon_auth_secret_key_2024_production
```

### 3. Database Setup

Ensure MongoDB is running and accessible:

```bash
# Test MongoDB connection
mongosh --eval "db.adminCommand('ping')"

# Or test with connection string
mongosh "mongodb://localhost:27017/beacon" --eval "db.adminCommand('ping')"
```

## Deployment Steps

### Step 1: Application Setup

```bash
# Clone the repository
git clone <repository-url>
cd thebeacon

# Install dependencies
npm install

# Verify installation
npm list --depth=0
```

### Step 2: Environment Configuration

#### Option A: Using .env file (Development/Testing)

```bash
# Create .env file
cat > .env << EOF
BEACON_AUTH=your-secure-secret-key-here
NODE_ENV=production
API_SERVER_PORT=3256
MONGODB_URI=mongodb://localhost:27017/beacon
EOF

# Secure the .env file
chmod 600 .env
```

#### Option B: System Environment Variables (Production)

```bash
# Set environment variables
export BEACON_AUTH=your-secure-secret-key-here
export NODE_ENV=production
export API_SERVER_PORT=3256
export MONGODB_URI=mongodb://localhost:27017/beacon

# Add to shell profile for persistence
echo 'export BEACON_AUTH=your-secure-secret-key-here' >> ~/.bashrc
echo 'export NODE_ENV=production' >> ~/.bashrc
echo 'export API_SERVER_PORT=3256' >> ~/.bashrc
echo 'export MONGODB_URI=mongodb://localhost:27017/beacon' >> ~/.bashrc

# Reload shell configuration
source ~/.bashrc
```

### Step 3: Validation Testing

```bash
# Test environment validation
npm test -- tests/envValidation.test.js

# Test authentication middleware
npm test -- tests/auth.middleware.test.js

# Test startup integration
npm test -- tests/startup.integration.test.js

# Run full authorization test suite
npm test -- --testPathPattern="auth|routes.middleware|startup"
```

### Step 4: PM2 Deployment

```bash
# Create log directories
mkdir -p logs/beacon-main-server
mkdir -p logs/beacon-worker-in
mkdir -p logs/beacon-worker-wa

# Start all processes
pm2 start ecosystem.config.cjs

# Verify all processes are running
pm2 status

# Check logs for any startup errors
pm2 logs --lines 20
```

### Step 5: Deployment Verification

```bash
# Test API server is responding
curl -X GET http://localhost:3256/api/user/test \
  -H "Authorization: Bearer $BEACON_AUTH"

# Expected response: User data or appropriate error message

# Test unauthorized access (should return 401)
curl -X GET http://localhost:3256/api/user/test

# Expected response: {"error": "Authorization header is required"}

# Test invalid token (should return 401)
curl -X GET http://localhost:3256/api/user/test \
  -H "Authorization: Bearer invalid-token"

# Expected response: {"error": "Invalid authorization token"}
```

## Post-Deployment Configuration

### 1. Process Management

```bash
# Save PM2 configuration for auto-restart
pm2 save

# Setup PM2 startup script
pm2 startup

# Follow the instructions provided by the startup command
```

### 2. Log Management

```bash
# Configure log rotation (if not using PM2's built-in rotation)
pm2 install pm2-logrotate

# View current log configuration
pm2 conf

# Monitor logs in real-time
pm2 logs --lines 50 --timestamp
```

### 3. Monitoring Setup

```bash
# Install PM2 monitoring (optional)
pm2 install pm2-server-monit

# View process monitoring
pm2 monit

# Check memory and CPU usage
pm2 show beacon-main-server
```

## Environment-Specific Configurations

### Development Environment

```bash
# Set development environment
export NODE_ENV=development
export BEACON_AUTH=dev-secret-key-123

# Start in development mode
pm2 start ecosystem.config.cjs --env development

# Enable file watching for development
pm2 start ecosystem.config.cjs --watch
```

### Staging Environment

```bash
# Set staging environment
export NODE_ENV=staging
export BEACON_AUTH=staging-secret-key-456

# Use staging-specific configuration
pm2 start ecosystem.config.cjs --env staging
```

### Production Environment

```bash
# Set production environment
export NODE_ENV=production
export BEACON_AUTH=production-secret-key-789

# Start with production configuration
pm2 start ecosystem.config.cjs --env production

# Disable development features
pm2 start ecosystem.config.cjs --no-daemon
```

## Security Hardening

### 1. Environment Variable Security

```bash
# Restrict access to environment files
chmod 600 .env
chown root:root .env

# Use system keyring for sensitive values (Linux)
secret-tool store --label="Beacon Auth" service beacon key auth

# Retrieve from keyring
export BEACON_AUTH=$(secret-tool lookup service beacon key auth)
```

### 2. File System Security

```bash
# Set proper ownership
chown -R beacon:beacon /path/to/thebeacon

# Set proper permissions
chmod -R 755 /path/to/thebeacon
chmod -R 644 /path/to/thebeacon/logs

# Secure configuration files
chmod 600 ecosystem.config.cjs
```

### 3. Network Security

```bash
# Configure firewall (example for ufw)
ufw allow 3256/tcp  # API server port
ufw allow 27017/tcp # MongoDB port (if external)

# Restrict MongoDB access
# Edit /etc/mongod.conf:
# net:
#   bindIp: 127.0.0.1
#   port: 27017
```

## Troubleshooting

### Common Deployment Issues

#### 1. Environment Validation Failures

```bash
# Check environment variables
env | grep BEACON

# Test validation manually
node -e "
import('./app/utils/envValidation.js').then(m => {
  const result = m.validateEnvironment();
  console.log(JSON.stringify(result, null, 2));
});
"

# Fix: Set proper BEACON_AUTH value
export BEACON_AUTH=your-secure-key
```

#### 2. PM2 Process Failures

```bash
# Check process status
pm2 status

# View error logs
pm2 logs beacon-main-server --err

# Restart failed processes
pm2 restart beacon-main-server

# Delete and recreate processes
pm2 delete all
pm2 start ecosystem.config.cjs
```

#### 3. Database Connection Issues

```bash
# Test MongoDB connection
mongosh --eval "db.adminCommand('ping')"

# Check MongoDB service status
systemctl status mongod

# Start MongoDB if stopped
systemctl start mongod

# Check connection string in environment
echo $MONGODB_URI
```

#### 4. Authentication Issues

```bash
# Verify BEACON_AUTH is set correctly
echo $BEACON_AUTH

# Test API with correct token
curl -H "Authorization: Bearer $BEACON_AUTH" http://localhost:3256/api/user/test

# Check authentication middleware logs
pm2 logs beacon-main-server | grep -i auth
```

### Debug Commands

```bash
# Test environment validation
npm test -- tests/envValidation.test.js --verbose

# Test authentication flow
npm test -- tests/auth.middleware.test.js --verbose

# Test startup process
npm test -- tests/startup.integration.test.js --verbose

# Check PM2 configuration
pm2 ecosystem ecosystem.config.cjs

# Monitor system resources
pm2 monit

# View detailed process information
pm2 show beacon-main-server
```

## Maintenance Procedures

### Regular Maintenance

#### Daily Tasks

```bash
# Check process status
pm2 status

# Review error logs
pm2 logs --err --lines 50

# Monitor system resources
pm2 monit
```

#### Weekly Tasks

```bash
# Rotate logs manually if needed
pm2 flush

# Update dependencies (in development first)
npm audit
npm update

# Run full test suite
npm test
```

#### Monthly Tasks

```bash
# Review and rotate BEACON_AUTH token
# 1. Generate new token
NEW_TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 2. Update environment
export BEACON_AUTH=$NEW_TOKEN

# 3. Restart processes
pm2 restart all

# 4. Verify functionality
curl -H "Authorization: Bearer $NEW_TOKEN" http://localhost:3256/api/user/test
```

### Backup Procedures

```bash
# Backup configuration
cp ecosystem.config.cjs ecosystem.config.cjs.backup.$(date +%Y%m%d)

# Backup environment configuration
env | grep -E "(BEACON|NODE_ENV|API_SERVER)" > env.backup.$(date +%Y%m%d)

# Backup PM2 configuration
pm2 save
cp ~/.pm2/dump.pm2 ~/.pm2/dump.pm2.backup.$(date +%Y%m%d)
```

## Rollback Procedures

### Emergency Rollback

```bash
# Stop all processes
pm2 stop all

# Restore previous configuration
cp ecosystem.config.cjs.backup.YYYYMMDD ecosystem.config.cjs

# Restore environment variables
source env.backup.YYYYMMDD

# Restart with previous configuration
pm2 start ecosystem.config.cjs

# Verify rollback
pm2 status
curl -H "Authorization: Bearer $BEACON_AUTH" http://localhost:3256/api/user/test
```

## Performance Optimization

### Production Tuning

```bash
# Optimize PM2 for production
pm2 start ecosystem.config.cjs --node-args="--max-old-space-size=2048"

# Enable cluster mode for API server (if needed)
# Edit ecosystem.config.cjs:
# instances: "max"  # Use all CPU cores

# Monitor performance
pm2 monit

# Analyze memory usage
pm2 show beacon-main-server
```

### Scaling Considerations

```bash
# Horizontal scaling with PM2 cluster mode
pm2 scale beacon-main-server +2  # Add 2 more instances

# Load balancing configuration
# Configure nginx or similar load balancer

# Database scaling
# Consider MongoDB replica sets for high availability
```

## Conclusion

This deployment guide provides comprehensive instructions for deploying The Beacon application with full API authorization. Follow the steps carefully, paying special attention to security configurations and environment validation.

For additional support:

- Review the troubleshooting section for common issues
- Check the test files for implementation examples
- Monitor logs regularly for operational insights
- Maintain regular backup and maintenance schedules

The authorization system is now production-ready with proper environment validation, secure API access control, and comprehensive monitoring capabilities.
