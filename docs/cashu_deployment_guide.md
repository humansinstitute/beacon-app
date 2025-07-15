# Cashu Feature Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Cashu Interaction feature in production environments. The Cashu feature enables Bitcoin/Lightning operations through WhatsApp messaging using Cashu eCash tokens.

## Prerequisites

### System Requirements

- **Node.js**: Version 18.x or higher
- **MongoDB**: Version 5.0 or higher
- **Redis**: Version 6.0 or higher
- **PM2**: Process manager for Node.js applications
- **NC Tools Service**: Running and accessible

### Network Requirements

- **Outbound HTTPS**: Access to NC Tools API (default: localhost:3000)
- **Outbound HTTPS**: Access to Cashu mint (default: https://mint.minibits.cash/Bitcoin)
- **Outbound HTTPS**: Access to Everest AI service
- **Inbound HTTP/HTTPS**: WhatsApp webhook endpoints

### Dependencies

```bash
# Core dependencies (already included in package.json)
npm install axios bullmq ioredis uuid dotenv
```

## NC Tools Service Setup

### Installation

The Cashu feature requires the NC Tools service to be running. This service provides the Cashu wallet functionality.

```bash
# Clone NC Tools repository
git clone https://github.com/nostr-connect/nc-tools.git
cd nc-tools

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Start the service
npm start
```

### NC Tools Configuration

Create or update the NC Tools `.env` file:

```bash
# NC Tools Configuration
PORT=3000
NODE_ENV=production

# Database (if required by NC Tools)
DATABASE_URL=your_database_url

# Lightning Configuration
LIGHTNING_BACKEND=lnd
LND_GRPC_HOST=localhost:10009
LND_TLS_CERT_PATH=/path/to/tls.cert
LND_MACAROON_PATH=/path/to/admin.macaroon

# Cashu Mint Configuration
DEFAULT_MINT_URL=https://mint.minibits.cash/Bitcoin
```

### Verify NC Tools Installation

```bash
# Test NC Tools health endpoint
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2025-01-15T06:19:00.000Z"}
```

## Environment Configuration

### Required Environment Variables

Create or update your Beacon application `.env` file:

```bash
# Database Configuration
MONGO_URI=mongodb://localhost:27017/beacon

# Redis Configuration
REDIS_URL=redis://127.0.0.1:6379

# Authentication
BEACON_AUTH=your-secure-beacon-auth-token

# WhatsApp Gateway Configuration
WHATSAPP_WEBHOOK_URL=https://your-domain.com/webhook/whatsapp
WHATSAPP_API_TOKEN=your-whatsapp-api-token

# Everest AI Service Configuration
EVEREST_API_URL=https://api.everest.ai
EVEREST_API_KEY=your-everest-api-key

# NC Tools Integration (REQUIRED FOR CASHU)
NCTOOLS_API_URL=http://localhost:3000
NCTOOLS_TIMEOUT=30000

# Cashu Configuration (REQUIRED FOR CASHU)
CASHU_DEFAULT_MINT=https://mint.minibits.cash/Bitcoin
CASHU_MIN_AMOUNT=1
CASHU_MAX_AMOUNT=1000000

# Application Settings
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

### Environment Variable Descriptions

| Variable             | Description                        | Default                              | Required |
| -------------------- | ---------------------------------- | ------------------------------------ | -------- |
| `NCTOOLS_API_URL`    | NC Tools service base URL          | `http://localhost:3000`              | Yes      |
| `NCTOOLS_TIMEOUT`    | Request timeout in milliseconds    | `30000`                              | No       |
| `CASHU_DEFAULT_MINT` | Default Cashu mint URL             | `https://mint.minibits.cash/Bitcoin` | No       |
| `CASHU_MIN_AMOUNT`   | Minimum transaction amount in sats | `1`                                  | No       |
| `CASHU_MAX_AMOUNT`   | Maximum transaction amount in sats | `1000000`                            | No       |

## Deployment Steps

### Step 1: Prepare the Environment

```bash
# Navigate to Beacon project directory
cd /path/to/thebeacon

# Install dependencies
npm install

# Verify environment configuration
npm run test:env
```

### Step 2: Database Setup

```bash
# Ensure MongoDB is running
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify MongoDB connection
mongosh $MONGO_URI --eval "db.adminCommand('ping')"
```

### Step 3: Redis Setup

```bash
# Ensure Redis is running
sudo systemctl start redis
sudo systemctl enable redis

# Verify Redis connection
redis-cli -u $REDIS_URL ping
```

### Step 4: Start NC Tools Service

```bash
# Start NC Tools in production mode
cd /path/to/nc-tools
NODE_ENV=production npm start

# Or use PM2 for process management
pm2 start npm --name "nc-tools" -- start
pm2 save
```

### Step 5: Deploy Beacon Application

```bash
# Navigate back to Beacon directory
cd /path/to/thebeacon

# Start all services using PM2
pm2 restart ecosystem.config.cjs

# Verify all processes are running
pm2 status
```

### Step 6: Verify Deployment

```bash
# Check NC Tools health
curl http://localhost:3000/health

# Check Beacon main server
curl http://localhost:3000/health

# Check PM2 processes
pm2 logs --lines 50
```

## Production Deployment Checklist

### Pre-Deployment Checklist

- [ ] **NC Tools Service**: Installed and configured
- [ ] **Environment Variables**: All required variables set
- [ ] **Database**: MongoDB running and accessible
- [ ] **Redis**: Redis running and accessible
- [ ] **Network**: Outbound access to required services
- [ ] **SSL Certificates**: Valid certificates for HTTPS endpoints
- [ ] **Monitoring**: Logging and monitoring systems configured

### Deployment Validation

- [ ] **NC Tools Health**: Service responds to health checks
- [ ] **Beacon Services**: All PM2 processes running
- [ ] **Database Connection**: Successful MongoDB connection
- [ ] **Redis Connection**: Successful Redis connection
- [ ] **WhatsApp Integration**: Webhook endpoints accessible
- [ ] **Cashu Operations**: Test basic operations work

### Post-Deployment Testing

```bash
# Test Cashu integration
npm run test:cashu

# Test worker integration
npm run test:worker

# Test end-to-end pipeline
npm run test:integration
```

## PM2 Configuration

### Ecosystem Configuration

The project uses PM2 for process management. Verify the `ecosystem.config.cjs` includes Cashu-related environment variables:

```javascript
module.exports = {
  apps: [
    {
      name: "beacon-main-server",
      script: "index.js",
      env: {
        NODE_ENV: "production",
        NCTOOLS_API_URL: "http://localhost:3000",
        CASHU_DEFAULT_MINT: "https://mint.minibits.cash/Bitcoin",
      },
    },
    {
      name: "beacon-worker-in",
      script: "app/workers/beaconMessage.worker.js",
      env: {
        NODE_ENV: "production",
        NCTOOLS_API_URL: "http://localhost:3000",
        CASHU_DEFAULT_MINT: "https://mint.minibits.cash/Bitcoin",
      },
    },
    {
      name: "beacon-worker-wa",
      script: "app/workers/gateways/whatsapp.gateway.worker.js",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
```

### PM2 Commands

```bash
# Start all services
pm2 start ecosystem.config.cjs

# Restart all services
pm2 restart ecosystem.config.cjs

# Stop all services
pm2 stop ecosystem.config.cjs

# View logs
pm2 logs

# Monitor processes
pm2 monit

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

## Monitoring and Maintenance

### Health Checks

Create health check scripts to monitor service availability:

```bash
#!/bin/bash
# health-check.sh

# Check NC Tools
echo "Checking NC Tools..."
curl -f http://localhost:3000/health || exit 1

# Check Beacon main server
echo "Checking Beacon main server..."
curl -f http://localhost:3000/health || exit 1

# Check PM2 processes
echo "Checking PM2 processes..."
pm2 jlist | jq -r '.[] | select(.pm2_env.status != "online") | .name' | while read app; do
  if [ ! -z "$app" ]; then
    echo "Process $app is not online"
    exit 1
  fi
done

echo "All health checks passed"
```

### Log Monitoring

Monitor logs for Cashu-related operations:

```bash
# Monitor NC Tools service logs
pm2 logs nc-tools --lines 100

# Monitor Beacon worker logs for Cashu operations
pm2 logs beacon-worker-in | grep -i cashu

# Monitor error logs
pm2 logs --err --lines 50
```

### Performance Monitoring

Key metrics to monitor:

1. **NC Tools Response Time**: Monitor API response times
2. **Cashu Operation Success Rate**: Track successful vs. failed operations
3. **Queue Depth**: Monitor Redis queue sizes
4. **Memory Usage**: Monitor process memory consumption
5. **Error Rates**: Track error frequencies by operation type

### Backup and Recovery

```bash
# Backup MongoDB data
mongodump --uri="$MONGO_URI" --out=/backup/mongodb/$(date +%Y%m%d)

# Backup Redis data
redis-cli -u "$REDIS_URL" --rdb /backup/redis/dump-$(date +%Y%m%d).rdb

# Backup environment configuration
cp .env /backup/config/.env-$(date +%Y%m%d)
```

## Troubleshooting

### Common Issues

#### 1. NC Tools Service Not Available

**Symptoms**:

- Error: "NC Tools API is not available"
- Connection refused errors

**Solutions**:

```bash
# Check if NC Tools is running
curl http://localhost:3000/health

# Restart NC Tools
pm2 restart nc-tools

# Check NC Tools logs
pm2 logs nc-tools
```

#### 2. Cashu Operations Timing Out

**Symptoms**:

- "Request timeout" errors
- Slow response times

**Solutions**:

```bash
# Increase timeout in environment
export NCTOOLS_TIMEOUT=60000

# Check network connectivity
ping mint.minibits.cash

# Monitor NC Tools performance
pm2 monit
```

#### 3. Invalid Mint Configuration

**Symptoms**:

- Mint-related errors
- Wallet creation failures

**Solutions**:

```bash
# Verify mint URL accessibility
curl https://mint.minibits.cash/Bitcoin/info

# Update mint configuration
export CASHU_DEFAULT_MINT=https://alternative-mint.com/Bitcoin

# Restart services
pm2 restart ecosystem.config.cjs
```

#### 4. Database Connection Issues

**Symptoms**:

- MongoDB connection errors
- User lookup failures

**Solutions**:

```bash
# Check MongoDB status
sudo systemctl status mongod

# Test connection
mongosh $MONGO_URI --eval "db.adminCommand('ping')"

# Check disk space
df -h
```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Set debug environment
export LOG_LEVEL=debug
export NODE_ENV=development

# Restart with debug logging
pm2 restart ecosystem.config.cjs

# Monitor debug logs
pm2 logs --lines 100
```

## Security Considerations

### Network Security

1. **Firewall Configuration**:

   ```bash
   # Allow only necessary ports
   sudo ufw allow 3000/tcp  # Beacon main server
   sudo ufw allow 27017/tcp # MongoDB (internal only)
   sudo ufw allow 6379/tcp  # Redis (internal only)
   ```

2. **NC Tools Security**:
   - Run NC Tools on internal network only
   - Use authentication if available
   - Monitor access logs

### Data Security

1. **Environment Variables**:

   - Store sensitive variables in secure configuration management
   - Use file permissions to protect `.env` files
   - Rotate API keys regularly

2. **Database Security**:
   - Enable MongoDB authentication
   - Use encrypted connections
   - Regular security updates

### Monitoring Security

1. **Log Security**:

   - Monitor for suspicious activity
   - Set up alerts for failed operations
   - Regular log rotation

2. **Access Control**:
   - Limit server access
   - Use SSH keys instead of passwords
   - Regular security audits

## Scaling Considerations

### Horizontal Scaling

1. **Multiple Workers**:

   ```javascript
   // In ecosystem.config.cjs
   {
     name: 'beacon-worker-in',
     script: 'app/workers/beaconMessage.worker.js',
     instances: 4, // Scale based on load
     exec_mode: 'cluster'
   }
   ```

2. **Load Balancing**:
   - Use nginx for load balancing
   - Distribute NC Tools instances
   - Redis clustering for high availability

### Vertical Scaling

1. **Resource Allocation**:

   ```javascript
   // In ecosystem.config.cjs
   {
     name: 'beacon-worker-in',
     script: 'app/workers/beaconMessage.worker.js',
     max_memory_restart: '1G',
     node_args: '--max-old-space-size=1024'
   }
   ```

2. **Performance Tuning**:
   - Optimize database queries
   - Implement caching strategies
   - Monitor resource usage

## Conclusion

This deployment guide provides the foundation for successfully deploying the Cashu Interaction feature in production environments. Regular monitoring, maintenance, and security updates are essential for optimal performance and reliability.

For additional support or questions, refer to the implementation documentation and API reference guides.
