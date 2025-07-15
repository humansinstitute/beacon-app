# API Authorization Stage 3 Implementation

## Overview

Stage 3 of the API authorization system has been successfully implemented. This stage applies the authorization middleware to all API routes, introducing **BREAKING CHANGES** that require environment configuration.

## Changes Made

### 1. Updated Route Files

All API route files now include the `requireAuth` middleware:

#### User Routes (`app/api/routes/user.route.js`)

- Added import: `import { requireAuth } from "../middlewares/auth.middleware.js"`
- Applied middleware: `router.use(requireAuth)`
- Protected routes:
  - `GET /api/users/lookup`
  - `GET /api/users/:id`
  - `POST /api/users`
  - `PATCH /api/users/:id`

#### Queue Routes (`app/api/routes/queue.routes.js`)

- Added import: `import { requireAuth } from "../middlewares/auth.middleware.js"`
- Applied middleware: `router.use(requireAuth)`
- Protected routes:
  - `POST /api/queue/add/:queueName`

#### Conversation Routes (`app/api/routes/conversation.route.js`)

- Added import: `import { requireAuth } from "../middlewares/auth.middleware.js"`
- Applied middleware: `router.use(requireAuth)`
- Protected routes:
  - `GET /api/conversations/:conversationId/history`
  - `GET /api/conversations/:conversationId/flow/latest`
  - `GET /api/conversations/flow/:flowId/next-action`
  - `GET /api/conversations/messages/recent`
  - `GET /api/conversations/message/:npub/:messagenumber`
  - `POST /api/conversations`
  - `POST /api/conversations/flow`
  - `POST /api/conversations/:conversationId/messages`
  - `PATCH /api/conversations/:conversationId/flow`
  - `POST /api/conversations/message`
  - `GET /api/conversations/message/:messageId`
  - `PATCH /api/conversations/message/:messageId`
  - `GET /api/conversations/:conversationId`
  - `PATCH /api/conversations/:conversationId`
  - `GET /api/conversations/flow/:flowId`
  - `PATCH /api/conversations/flow/:flowId`
  - `PATCH /api/conversations/flow/:flowId/action`

### 2. Test Implementation

Created comprehensive tests to verify authorization:

#### `tests/routes.middleware.test.js`

- Verifies that authorization middleware is applied to all routes
- Uses mocked controllers to avoid database dependencies
- Confirms middleware execution order

#### `tests/api.authorization.integration.test.js`

- Comprehensive integration tests for all endpoints
- Tests unauthorized access (401 responses)
- Tests invalid tokens (403 responses)
- Tests valid token acceptance
- Tests various authorization header formats
- Tests edge cases and error scenarios

#### `tests/api.routes.auth.test.js`

- Simplified integration tests for basic functionality
- Quick verification of authorization requirements

## BREAKING CHANGES

### Environment Variable Requirement

**CRITICAL**: The `BEACON_AUTH` environment variable MUST be set for the API to function.

```bash
# Example
export BEACON_AUTH="your-secure-token-here"
```

### API Request Requirements

All API requests must now include an Authorization header:

```bash
# Bearer token format (recommended)
Authorization: Bearer your-secure-token-here

# Direct token format (also supported)
Authorization: your-secure-token-here
```

### Error Responses

- **401 Unauthorized**: Missing Authorization header
- **403 Forbidden**: Invalid authorization token
- **500 Internal Server Error**: BEACON_AUTH environment variable not set

## Testing Instructions

### 1. Set Environment Variable

```bash
export BEACON_AUTH="test-token-12345"
```

### 2. Run Authorization Tests

```bash
# Run all auth-related tests
npm test -- --testPathPattern="auth|routes.middleware"

# Run specific test files
npm test -- tests/auth.middleware.test.js
npm test -- tests/routes.middleware.test.js
```

### 3. Manual API Testing

#### Without Authorization (Should Fail)

```bash
curl -X GET http://localhost:3000/api/users/lookup
# Expected: 401 Unauthorized
```

#### With Valid Authorization (Should Work)

```bash
curl -X GET http://localhost:3000/api/users/lookup \
  -H "Authorization: Bearer test-token-12345"
# Expected: Success (may return other errors due to missing data)
```

#### With Invalid Authorization (Should Fail)

```bash
curl -X GET http://localhost:3000/api/users/lookup \
  -H "Authorization: Bearer invalid-token"
# Expected: 403 Forbidden
```

## Deployment Checklist

### Pre-Deployment

- [ ] Set `BEACON_AUTH` environment variable in production
- [ ] Update API documentation with authorization requirements
- [ ] Notify API consumers of breaking changes
- [ ] Test all endpoints with valid authorization

### Post-Deployment

- [ ] Verify all endpoints require authorization
- [ ] Test error responses for unauthorized requests
- [ ] Monitor logs for authentication failures
- [ ] Update client applications to include Authorization headers

## Security Considerations

1. **Token Security**: The `BEACON_AUTH` token should be:

   - Randomly generated and sufficiently long
   - Stored securely in environment variables
   - Not logged or exposed in error messages
   - Rotated regularly

2. **HTTPS Required**: Authorization tokens should only be transmitted over HTTPS in production

3. **Rate Limiting**: Consider implementing rate limiting for failed authentication attempts

## Next Steps

After successful deployment and testing:

1. **Stage 4**: Implement role-based access control (if planned)
2. **Stage 5**: Add API key management and rotation
3. **Stage 6**: Implement audit logging for API access

## Troubleshooting

### Common Issues

1. **500 Error on All Endpoints**

   - Check that `BEACON_AUTH` environment variable is set
   - Restart the application after setting the variable

2. **401 Errors with Valid Token**

   - Verify Authorization header format
   - Check for extra spaces or special characters
   - Ensure token matches `BEACON_AUTH` exactly (case-sensitive)

3. **Tests Failing**
   - Ensure all dependencies are installed (`npm install`)
   - Check that test environment has proper mocks
   - Verify Jest configuration supports ES modules

### Support

For issues or questions regarding the authorization implementation, refer to:

- `docs/api_auth.md` - Complete authorization system documentation
- `tests/auth.middleware.test.js` - Middleware unit tests
- `app/api/middlewares/auth.middleware.js` - Middleware implementation
