# Configuration & Secrets Management System

This document describes the centralized configuration and secrets management system for The Beacon application. This system replaces the scattered `process.env` references throughout the application with a unified, validated, and secure configuration management approach.

## Overview

The configuration system provides:

- **Centralized Configuration**: All environment variables are defined in a single schema
- **Docker Secrets Support**: Automatic fallback from Docker secrets to environment variables
- **Type Conversion**: Automatic conversion of string environment variables to appropriate types
- **Validation**: Comprehensive validation with constraints and error reporting
- **Sensitive Data Protection**: Automatic redaction of sensitive information in logs
- **Default Values**: Sensible defaults for optional configuration parameters
- **ES Modules Support**: Full compatibility with the project's ES module architecture

## Architecture

The system consists of three main components:

### 1. Configuration Manager (`configManager.js`)

The core engine that handles:

- Loading values from Docker secrets or environment variables
- Type conversion (string, number, boolean, array)
- Validation against constraints
- Sensitive data redaction
- Error handling and reporting

### 2. Configuration Schema (`schema.js`)

Defines all configuration parameters with:

- Environment variable names
- Docker secret names
- Data types and constraints
- Default values
- Descriptions
- Required/optional flags

### 3. Configuration Index (`index.js`)

The main entry point that:

- Initializes the configuration system
- Provides convenient access methods
- Handles startup validation
- Exports configuration sections

## Usage

### Basic Usage

```javascript
import { config, getConfig } from "../app/config/index.js";

// Access configuration sections
const dbConfig = config.database;
const authConfig = config.auth;

// Access specific values
const mongoUri = getConfig("database.mongoUri");
const port = getConfig("app.port", 3000);
```

### Configuration Sections

The configuration is organized into logical sections:

#### Application Settings (`config.app`)

- `nodeEnv`: Application environment (development/production/test)
- `port`: Application port number
- `apiServerPort`: API server port
- `serverUrl`: Base server URL
- `debug`: Debug logging flag
- `logLevel`: Logging level

#### Database (`config.database`)

- `mongoUri`: MongoDB connection URI
- `mongodbUri`: Alternative MongoDB URI

#### Redis (`config.redis`)

- `url`: Redis connection URL

#### Authentication (`config.auth`)

- `beaconAuth`: Main authentication token
- `password`: Generic password field
- `secretKey`: Generic secret key

#### WhatsApp (`config.whatsapp`)

- `gatewayNpub`: WhatsApp gateway Nostr public key
- `sharedSession`: Enable shared session mode
- `branchSessions`: Enable branch-specific sessions
- `autoMigrateSession`: Enable automatic session migration
- And many more WhatsApp-specific settings

#### External Services (`config.services`)

- `nctoolsApiUrl`: NC Tools API URL
- `nctoolsTimeout`: NC Tools timeout
- `everestApiKey`: Everest AI API key
- And other service configurations

#### Cashu (`config.cashu`)

- `defaultMint`: Default Cashu mint URL
- `minAmount`: Minimum amount in satoshis
- `maxAmount`: Maximum amount in satoshis

### Docker Secrets Support

The system automatically tries to load configuration from Docker secrets first, then falls back to environment variables:

```bash
# Docker secret (preferred)
echo "mongodb://user:pass@host:27017/db" | docker secret create mongo_uri -

# Environment variable (fallback)
export MONGO_URI="mongodb://user:pass@host:27017/db"
```

### Type Conversion

Environment variables are automatically converted to appropriate types:

```javascript
// String values
process.env.SERVER_URL = "http://localhost";
config.app.serverUrl; // → "http://localhost"

// Number values
process.env.PORT = "3000";
config.app.port; // → 3000

// Boolean values
process.env.DEBUG = "true";
config.app.debug; // → true

// Array values
process.env.WA_SHARED_BRANCHES = "main,develop,staging";
config.whatsapp.sharedBranches; // → ["main", "develop", "staging"]
```

### Validation

The system validates all configuration values against defined constraints:

```javascript
// Port must be between 1 and 65535
process.env.PORT = "99999"; // Will throw validation error

// BEACON_AUTH must be at least 8 characters
process.env.BEACON_AUTH = "short"; // Will throw validation error

// NODE_ENV must be one of the allowed values
process.env.NODE_ENV = "invalid"; // Will throw validation error
```

### Sensitive Data Protection

Sensitive configuration is automatically redacted in logs:

```javascript
// Raw configuration (use with caution)
const rawConfig = getRawConfig();
console.log(rawConfig.auth.beaconAuth); // → "actual-secret-token"

// Redacted configuration (safe for logging)
const safeConfig = getAllConfig();
console.log(safeConfig.auth.beaconAuth); // → "[REDACTED]"
```

## Environment Variables

### Required Variables

These environment variables must be set for the application to start:

- `MONGO_URI`: MongoDB connection string
- `REDIS_URL`: Redis connection URL
- `BEACON_AUTH`: Authentication token (minimum 8 characters)
- `WA_GATEWAY_NPUB`: WhatsApp gateway Nostr public key

### Optional Variables with Defaults

These variables have sensible defaults but can be overridden:

- `NODE_ENV`: "development"
- `PORT`: 3000
- `API_SERVER_PORT`: 3256
- `SERVER_URL`: "http://localhost"
- `DEBUG`: false
- `LOG_LEVEL`: "info"
- `NCTOOLS_API_URL`: "http://localhost:3000"
- `CASHU_DEFAULT_MINT`: "https://mint.minibits.cash/Bitcoin"

### Complete Variable List

For a complete list of all supported environment variables, see the schema definition in `schema.js` or use:

```javascript
import { getAllEnvVars, getRequiredEnvVars } from "../app/config/schema.js";

console.log("All variables:", getAllEnvVars());
console.log("Required variables:", getRequiredEnvVars());
```

## Docker Secrets

The system supports Docker secrets for sensitive configuration. Secret names follow a convention:

| Environment Variable | Docker Secret Name |
| -------------------- | ------------------ |
| `MONGO_URI`          | `mongo_uri`        |
| `BEACON_AUTH`        | `beacon_auth`      |
| `WA_GATEWAY_NPUB`    | `wa_gateway_npub`  |
| `EVEREST_API_KEY`    | `everest_api_key`  |

### Creating Docker Secrets

```bash
# Create secrets
echo "mongodb://user:pass@host:27017/db" | docker secret create mongo_uri -
echo "your-secret-token" | docker secret create beacon_auth -
echo "npub1..." | docker secret create wa_gateway_npub -

# Use in docker-compose.yml
services:
  app:
    secrets:
      - mongo_uri
      - beacon_auth
      - wa_gateway_npub
```

## Advanced Usage

### Custom Initialization

```javascript
import { initializeConfig } from "../app/config/index.js";

// Initialize with custom options
const config = initializeConfig({
  validateOnStartup: true,
  throwOnValidationError: false,
  logWarnings: true,
});
```

### Configuration Reloading

```javascript
import { reloadConfig } from "../app/config/index.js";

// Reload configuration (useful for testing)
const newConfig = reloadConfig();
```

### Validation Status

```javascript
import {
  isConfigValid,
  getConfigErrors,
  getConfigWarnings,
} from "../app/config/index.js";

if (!isConfigValid()) {
  console.error("Configuration errors:", getConfigErrors());
}

const warnings = getConfigWarnings();
if (warnings.length > 0) {
  console.warn("Configuration warnings:", warnings);
}
```

## Migration Guide

### Phase 1: Infrastructure (Current)

- ✅ Core configuration system implemented
- ✅ Schema defined for all environment variables
- ✅ Docker secrets support
- ✅ Validation and type conversion
- ✅ Unit tests

### Phase 2: Migration (Next)

Replace existing `process.env` references:

```javascript
// Before
const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/db";

// After
import { config } from "../app/config/index.js";
const mongoUri = config.database.mongoUri;
```

### Phase 3: Cleanup

- Remove direct `process.env` access
- Update documentation
- Add configuration validation to CI/CD

## Testing

The configuration system includes comprehensive unit tests:

```bash
# Run configuration tests
npm test -- tests/configManager.test.js tests/configSchema.test.js tests/configIndex.test.js
```

### Test Coverage

- ✅ Configuration loading and validation
- ✅ Docker secrets fallback mechanism
- ✅ Type conversion and constraints
- ✅ Sensitive data redaction
- ✅ Error handling and edge cases
- ✅ ES modules compatibility

## Error Handling

The system provides detailed error messages for common issues:

### Missing Required Configuration

```
Required configuration BEACON_AUTH is missing.
Check Docker secret 'beacon_auth' or environment variable 'BEACON_AUTH'
```

### Validation Errors

```
beaconAuth must have at least 8 characters/items, got 5
mongoUri does not match required pattern: ^mongodb://.+
PORT must be at least 1, got 0
```

### Type Conversion Errors

```
Invalid number value for PORT: not-a-number
Invalid boolean value for DEBUG: maybe
```

## Best Practices

1. **Use Configuration Sections**: Access configuration through the organized sections rather than individual getConfig calls
2. **Handle Sensitive Data**: Always use redacted configuration for logging
3. **Validate Early**: Let the system validate configuration at startup rather than during runtime
4. **Use Docker Secrets**: Prefer Docker secrets over environment variables for sensitive data
5. **Set Defaults**: Define sensible defaults for optional configuration
6. **Document Changes**: Update the schema when adding new configuration parameters

## Troubleshooting

### Configuration Not Loading

- Check that required environment variables are set
- Verify Docker secrets are properly mounted
- Check file permissions for Docker secrets

### Validation Errors

- Review constraint definitions in the schema
- Check data types and formats
- Verify enum values are correct

### Type Conversion Issues

- Ensure boolean values use "true"/"false" or "1"/"0"
- Check number formats for numeric values
- Verify array values are comma-separated

## Contributing

When adding new configuration parameters:

1. Add the parameter to the appropriate section in `schema.js`
2. Include type, constraints, and description
3. Add Docker secret name for sensitive data
4. Update tests to cover the new parameter
5. Update this documentation

## Security Considerations

- Sensitive configuration is automatically redacted in logs
- Docker secrets are preferred over environment variables
- Configuration validation prevents injection attacks
- Type conversion ensures data integrity
- Error messages don't expose sensitive values

## Performance

- Configuration is loaded once at startup
- Validation occurs during initialization, not runtime
- Redaction is performed on-demand for logging
- Memory usage is minimal with lazy evaluation
