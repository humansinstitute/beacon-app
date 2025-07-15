# API Authorization System - Complete Implementation

## Overview

This document provides comprehensive documentation for the complete API authorization system implementation in The Beacon project. The system provides secure API access control using bearer token authentication with environment-based configuration.

## Architecture

The authorization system consists of four main components:

1. **Environment Validation** (`app/utils/envValidation.js`)
2. **Authentication Middleware** (`app/api/middlewares/auth.middleware.js`)
3. **User Utilities** (`app/utils/userUtils.js`)
4. **Startup Integration** (`index.js`)

## Implementation Stages

### Stage 1: Environment Validation ✅

- Created `validateBeaconAuth()` function to validate BEACON_AUTH environment variable
- Created `validateEnvironment()` function for comprehensive environment validation
- Implemented robust validation with clear error messages
- Added comprehensive unit tests

### Stage 2: Authentication Middleware ✅

- Implemented bearer token authentication middleware
- Added proper error handling and status codes
- Integrated with environment validation
- Created comprehensive middleware tests

### Stage 3: User Management Integration ✅

- Enhanced user utilities with authorization support
- Integrated authentication with user operations
- Added user-specific authorization checks
- Created integration tests for user operations

### Stage 4: Startup Integration ✅

- Integrated environment validation at application startup
- Updated PM2 configuration for proper environment handling
- Added fail-fast behavior with clear error messages
- Created comprehensive startup integration tests

## Configuration

### Environment Variables

#### Required Variables

- **BEACON_AUTH**: Secret key for API authentication
  - Must be a non-empty string
  - Should be a secure, randomly generated value
  - Used for bearer token validation

#### Example Configuration

```bash
# Production
BEACON_AUTH=your-secure-secret-key-here

# Development
BEACON_AUTH=dev-secret-key-123

# Testing (handled automatically in tests)
BEACON_AUTH=test-secret-key
```

### PM2 Configuration

The `ecosystem.config.cjs` file has been updated to support proper environment variable handling:

```javascript
module.exports = {
  apps: [
    {
      name: "beacon-main-server",
      script: "index.js",
      env: {
        NODE_ENV: "production",
        // BEACON_AUTH should be set in the environment or .env file
      },
      env_development: {
        NODE_ENV: "development",
        // BEACON_AUTH should be set in the environment or .env file
      },
    },
    // ... other processes
  ],
};
```

## API Usage

### Authentication Header

All protected API endpoints require the following header:

```http
Authorization: Bearer your-beacon-auth-token
```

### Protected Endpoints

The following endpoints require authentication:

- `POST /api/user/create` - Create new user
- `GET /api/user/:npub` - Get user by npub
- `PUT /api/user/:npub` - Update user
- `DELETE /api/user/:npub` - Delete user
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/:id` - Get conversation
- `PUT /api/conversations/:id` - Update conversation
- `DELETE /api/conversations/:id` - Delete conversation
- `POST /api/queue/add` - Add item to queue
- `GET /api/queue/status` - Get queue status

### Example API Calls

#### Create User

```bash
curl -X POST http://localhost:3256/api/user/create \
  -H "Authorization: Bearer your-beacon-auth-token" \
  -H "Content-Type: application/json" \
  -d '{"npub": "npub1...", "name": "John Doe"}'
```

#### Get User

```bash
curl -X GET http://localhost:3256/api/user/npub1... \
  -H "Authorization: Bearer your-beacon-auth-token"
```

## Deployment Guide

### Prerequisites

1. Node.js (version 18 or higher)
2. MongoDB instance
3. PM2 process manager
4. Environment variables configured

### Deployment Steps

1. **Clone and Install Dependencies**

   ```bash
   git clone <repository-url>
   cd thebeacon
   npm install
   ```

2. **Configure Environment Variables**

   ```bash
   # Create .env file or set environment variables
   echo "BEACON_AUTH=your-secure-secret-key" > .env
   ```

3. **Validate Configuration**

   ```bash
   # Test environment validation
   npm test -- tests/envValidation.test.js
   ```

4. **Start with PM2**

   ```bash
   # Start all processes
   pm2 start ecosystem.config.cjs

   # Check status
   pm2 status

   # View logs
   pm2 logs beacon-main-server
   ```

5. **Verify Deployment**
   ```bash
   # Test API endpoint
   curl -X GET http://localhost:3256/api/user/test \
     -H "Authorization: Bearer your-beacon-auth-token"
   ```

### Production Considerations

1. **Security**

   - Use a strong, randomly generated BEACON_AUTH value
   - Store environment variables securely (not in code)
   - Consider using environment variable management tools
   - Regularly rotate authentication tokens

2. **Monitoring**

   - Monitor PM2 logs for authentication failures
   - Set up alerts for repeated unauthorized access attempts
   - Monitor application startup for environment validation errors

3. **Backup and Recovery**
   - Document environment variable values securely
   - Include environment configuration in disaster recovery plans
   - Test recovery procedures regularly

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- tests/envValidation.test.js
npm test -- tests/auth.middleware.test.js
npm test -- tests/userUtils.integration.test.js
npm test -- tests/startup.integration.test.js

# Run authorization-related tests
npm test -- --testPathPattern="auth|routes.middleware"
```

### Test Coverage

The implementation includes comprehensive test coverage:

- **Environment Validation Tests**: 100% coverage of validation logic
- **Middleware Tests**: Complete authentication flow testing
- **Integration Tests**: End-to-end API authorization testing
- **Startup Tests**: Application startup and environment validation
- **User Utilities Tests**: User management with authorization

### Test Environment

Tests automatically handle environment configuration:

- Temporary environment variable manipulation
- Isolated test execution
- Automatic cleanup after tests
- Mock implementations for external dependencies

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

**Symptoms**: Application exits immediately with environment validation error

**Causes**:

- BEACON_AUTH not set
- BEACON_AUTH set to empty string
- BEACON_AUTH set to invalid value

**Solutions**:

```bash
# Check current environment
echo $BEACON_AUTH

# Set valid value
export BEACON_AUTH=your-secret-key

# Restart application
pm2 restart beacon-main-server
```

#### 2. Authentication Failures

**Symptoms**: API returns 401 Unauthorized

**Causes**:

- Missing Authorization header
- Incorrect bearer token format
- Wrong BEACON_AUTH value

**Solutions**:

```bash
# Verify header format
curl -H "Authorization: Bearer your-token" ...

# Check server logs
pm2 logs beacon-main-server

# Verify environment configuration
npm test -- tests/envValidation.test.js
```

#### 3. PM2 Process Issues

**Symptoms**: Processes not starting or crashing

**Causes**:

- Environment variables not available to PM2
- Configuration errors in ecosystem.config.cjs

**Solutions**:

```bash
# Check PM2 environment
pm2 env beacon-main-server

# Restart with environment
BEACON_AUTH=your-key pm2 restart ecosystem.config.cjs

# Check process status
pm2 status
```

### Debug Commands

```bash
# Test environment validation
node -e "import('./app/utils/envValidation.js').then(m => console.log(m.validateEnvironment()))"

# Test authentication middleware
npm test -- tests/auth.middleware.test.js --verbose

# Check PM2 configuration
pm2 ecosystem ecosystem.config.cjs

# Monitor real-time logs
pm2 logs --lines 100
```

## Security Considerations

### Authentication Security

1. **Token Management**

   - Use cryptographically secure random tokens
   - Implement token rotation policies
   - Store tokens securely (environment variables, not code)

2. **Access Control**

   - All API endpoints require authentication
   - No bypass mechanisms in production
   - Proper error handling without information leakage

3. **Monitoring and Auditing**
   - Log all authentication attempts
   - Monitor for suspicious patterns
   - Implement rate limiting for API endpoints

### Environment Security

1. **Configuration Management**

   - Never commit secrets to version control
   - Use secure environment variable storage
   - Implement proper access controls for configuration

2. **Deployment Security**
   - Validate environment on every startup
   - Fail fast on configuration errors
   - Secure log file access

## Maintenance

### Regular Tasks

1. **Token Rotation**

   - Schedule regular BEACON_AUTH updates
   - Coordinate with API consumers
   - Test rotation procedures

2. **Monitoring**

   - Review authentication logs weekly
   - Monitor for failed authentication attempts
   - Check environment validation logs

3. **Testing**
   - Run full test suite before deployments
   - Test authentication flows regularly
   - Validate environment configuration

### Updates and Changes

1. **Adding New Protected Endpoints**

   - Apply authentication middleware
   - Add integration tests
   - Update documentation

2. **Environment Changes**

   - Update validation logic if needed
   - Test with new environment variables
   - Update deployment documentation

3. **Security Updates**
   - Review authentication implementation
   - Update dependencies regularly
   - Monitor security advisories

## Next Steps

### Potential Enhancements

1. **Advanced Authentication**

   - JWT token support
   - Role-based access control
   - API key management

2. **Enhanced Security**

   - Rate limiting implementation
   - Request signing
   - Audit logging

3. **Operational Improvements**
   - Health check endpoints
   - Metrics collection
   - Automated monitoring

### Migration Considerations

If migrating from this system:

1. Plan token transition strategy
2. Maintain backward compatibility period
3. Update all API consumers
4. Test thoroughly before cutover

## Conclusion

The API authorization system provides a robust, secure foundation for The Beacon project's API access control. The implementation follows security best practices, includes comprehensive testing, and provides clear operational procedures for deployment and maintenance.

For additional support or questions, refer to the test files for implementation examples and the troubleshooting section for common issues.
