# Testing Infrastructure Documentation

## Overview

This document describes the updated testing infrastructure for Phase 3 of the Configuration & Secrets Management feature. The testing system has been enhanced to work seamlessly with the new centralized configuration system while maintaining test isolation and repeatability.

## Key Changes

### 1. Jest Configuration Updates

The Jest configuration has been updated to better support ES modules and the new configuration system:

- **Enhanced ES Modules Support**: Improved module resolution and transformation
- **Configuration-Specific Settings**: Added test timeout, module directories, and coverage settings
- **Test Isolation**: Clear mocks and restore mocks between tests
- **Performance Optimization**: Optimized for configuration loading scenarios

### 2. Configuration Mocking System

A comprehensive configuration mocking system has been implemented in `tests/utils/configMock.js`:

#### Core Components

- **ConfigMock Class**: Main class for managing configuration mocks
- **configTestHelpers**: Convenient helper functions for common test scenarios
- **configValidationHelpers**: Specialized helpers for testing configuration validation

#### Key Features

- **Isolated Configuration**: Each test gets a clean configuration state
- **Scenario Support**: Pre-defined configuration scenarios (development, production, team-collaboration, etc.)
- **Dynamic Updates**: Ability to update configuration during tests
- **Validation Testing**: Tools for testing configuration validation and error scenarios

### 3. Test Setup Enhancements

#### Global Setup (`tests/setup.js`)

- Automatic configuration cleanup between tests
- Enhanced error reporting for configuration issues
- Suppressed non-essential console output during tests
- Global timeout settings for configuration loading

#### Environment Setup (`tests/env.setup.js`)

- Comprehensive default test environment variables
- Isolation from production/development environments
- Configuration validation settings for tests
- Disabled PM2 and Git integration in test environment

## Usage Guide

### Basic Configuration Testing

```javascript
import { configTestHelpers } from "./utils/configMock.js";

describe("My Test Suite", () => {
  beforeEach(async () => {
    await configTestHelpers.setupConfig({
      BEACON_AUTH: "test-auth-token",
      MONGO_URI: "mongodb://localhost:27017/test",
      // ... other config
    });
  });

  afterEach(() => {
    configTestHelpers.cleanup();
  });

  test("should work with configuration", () => {
    // Your test code here
  });
});
```

### Using Configuration Scenarios

```javascript
test("should handle development environment", () => {
  configTestHelpers.applyScenario("development");
  // Test development-specific behavior
});

test("should handle production environment", () => {
  configTestHelpers.applyScenario("production");
  // Test production-specific behavior
});
```

### Dynamic Configuration Updates

```javascript
test("should handle configuration changes", () => {
  // Update configuration during test
  configTestHelpers.updateConfig({
    BEACON_AUTH: "new-auth-token",
    DEBUG: "true",
  });

  // Remove configuration keys
  configTestHelpers.removeConfig(["OPTIONAL_KEY"]);

  // Test behavior with updated configuration
});
```

### Configuration Validation Testing

```javascript
import { configValidationHelpers } from "./utils/configMock.js";

test("should validate configuration", async () => {
  const result = await configValidationHelpers.testValidation(
    {
      BEACON_AUTH: "valid-token",
      // ... other config
    },
    true
  ); // Should pass validation

  expect(result.isValid).toBe(true);
});

test("should handle validation errors", async () => {
  await configValidationHelpers.testErrorScenario(
    {
      BEACON_AUTH: "short", // Invalid
    },
    ["BEACON_AUTH"]
  );
});
```

### Isolated Test Configuration

```javascript
// Test with completely isolated configuration
configTestHelpers.testWithConfig(
  "should work with specific config",
  {
    BEACON_AUTH: "test-token",
    PORT: "3001",
  },
  async () => {
    // Test code here - configuration is automatically cleaned up
  }
);

// Describe block with shared configuration
configTestHelpers.describeWithConfig(
  "Feature Tests",
  {
    BEACON_AUTH: "test-token",
  },
  () => {
    test("test 1", () => {
      /* ... */
    });
    test("test 2", () => {
      /* ... */
    });
  }
);
```

## Available Configuration Scenarios

### Built-in Scenarios

1. **minimal**: Basic required configuration only
2. **development**: Development environment settings
3. **production**: Production environment settings
4. **team-collaboration**: Team collaboration features enabled
5. **cashu-enabled**: Cashu integration enabled
6. **invalid-config**: Invalid configuration for error testing

### Custom Scenarios

You can create custom scenarios by calling:

```javascript
configTestHelpers.applyScenario("custom-scenario-name");
```

## Test File Updates

### Updated Test Files

The following test files have been updated to use the new configuration system:

1. **tests/auth.middleware.test.js**: Updated to use configuration mocking
2. **tests/queue.test.js**: Enhanced with configuration integration tests
3. **tests/configuration.system.test.js**: Comprehensive configuration system tests
4. **tests/configuration.performance.test.js**: Performance and security tests

### Migration Pattern

When updating existing tests, follow this pattern:

```javascript
// OLD: Direct process.env manipulation
beforeEach(() => {
  process.env.BEACON_AUTH = "test-token";
  process.env.MONGO_URI = "mongodb://localhost:27017/test";
});

// NEW: Configuration mocking
beforeEach(async () => {
  await configTestHelpers.setupConfig({
    BEACON_AUTH: "test-token",
    MONGO_URI: "mongodb://localhost:27017/test",
  });
});

afterEach(() => {
  configTestHelpers.cleanup();
});
```

## Performance Considerations

### Configuration Loading Performance

- Configuration loading is tested to complete within 100ms
- Multiple rapid initializations average under 10ms each
- Configuration access operations complete in under 1ms

### Memory Management

- Configuration mocks are properly cleaned up to prevent memory leaks
- Memory increase during testing is kept under 1MB
- Garbage collection is triggered when available

## Security Testing

### Sensitive Data Protection

- Sensitive configuration values are redacted in logs
- Error messages don't expose sensitive data
- Configuration injection attempts are safely handled

### Validation Security

- Type validation prevents type confusion attacks
- Configuration constraints are enforced for security
- Runtime configuration tampering is prevented

### Environment Isolation

- Test environment is isolated from production
- Cross-environment configuration leakage is prevented
- Test-specific values are used consistently

## Best Practices

### 1. Test Isolation

- Always clean up configuration mocks after each test
- Use `beforeEach` and `afterEach` hooks consistently
- Avoid sharing configuration state between tests

### 2. Configuration Scenarios

- Use predefined scenarios when possible
- Create custom scenarios for specific test needs
- Document any new scenarios you create

### 3. Error Testing

- Test both valid and invalid configuration scenarios
- Verify error messages and handling
- Test edge cases and boundary conditions

### 4. Performance Testing

- Include performance assertions for critical paths
- Test configuration loading under various conditions
- Monitor memory usage in long-running tests

## Troubleshooting

### Common Issues

1. **Configuration Not Cleaned Up**: Ensure `configTestHelpers.cleanup()` is called in `afterEach`
2. **Test Isolation Problems**: Check that tests aren't sharing configuration state
3. **Performance Issues**: Verify configuration mocks are being reused properly
4. **Validation Errors**: Ensure all required configuration is provided in test setup

### Debug Mode

Enable verbose test output:

```bash
JEST_VERBOSE=true npm test
```

### Configuration Debugging

Enable configuration logging in tests:

```javascript
await configTestHelpers.setupConfig(config, {
  logWarnings: true,
  throwOnValidationError: false,
});
```

## Future Enhancements

### Planned Improvements

1. **Snapshot Testing**: Configuration schema snapshot testing
2. **Property-Based Testing**: Random configuration generation for edge case testing
3. **Integration Testing**: Enhanced integration with external services
4. **Performance Monitoring**: Continuous performance regression testing

### Contributing

When adding new tests:

1. Use the configuration mocking system
2. Follow the established patterns
3. Add appropriate cleanup
4. Include both positive and negative test cases
5. Document any new scenarios or patterns

## Related Documentation

- [Configuration System README](../app/config/README.md)
- [Configuration Schema](../app/config/schema.js)
- [Environment Validation](../app/utils/envValidation.js)

## Support

For questions or issues with the testing infrastructure:

1. Check this documentation first
2. Review existing test files for patterns
3. Check the configuration system documentation
4. Create an issue with detailed reproduction steps
