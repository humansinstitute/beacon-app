# Cashu Balance Request Fix Documentation

## Issue Summary

Cashu balance requests were failing with JSON parsing errors, causing the system to fall back to the conversation pipeline instead of executing the Cashu pipeline.

## Root Cause Analysis

### Primary Issues Identified

1. **JSON Parsing Error in Cashu Pipeline** (`app/src/pipeline/cashuInteraction.pipeline.js:72`)

   - The pipeline was attempting to parse `response.message` as JSON when it was already a parsed object
   - Error: `"[object Object]" is not valid JSON`

2. **Intent Agent Configuration Error** (`app/src/agents/intentAgent.js:71-72`)

   - Duplicate `type` field in model configuration
   - Malformed configuration prevented proper intent classification

3. **Intent Agent JSON Prompt Issue** (`app/src/agents/intentAgent.js:54-60`)
   - AI was generating invalid JSON without quoted field names
   - Everest API was rejecting malformed JSON responses

## Technical Details

### Error Flow

1. User sends: "Can you check my cashu balance?"
2. Intent classification fails due to malformed JSON generation
3. System falls back to conversation pipeline
4. User receives generic response instead of actual balance

### Key Log Evidence

```
[CashuPipeline] Failed to parse operation response: SyntaxError: "[object Object]" is not valid JSON
[Worker] Falling back to conversation pipeline...
```

## Solutions Implemented

### 1. Fixed JSON Parsing Logic in Cashu Pipeline

**File:** `app/src/pipeline/cashuInteraction.pipeline.js`

**Before:**

```javascript
operation = JSON.parse(response.message);
```

**After:**

```javascript
// Handle both string and object responses from Everest service
if (typeof response.message === "string") {
  operation = JSON.parse(response.message);
  console.log("[CashuPipeline] Parsed operation from JSON string:", operation);
} else if (typeof response.message === "object" && response.message !== null) {
  operation = response.message;
  console.log("[CashuPipeline] Using operation object directly:", operation);
} else {
  throw new Error(
    `Unexpected response.message type: ${typeof response.message}`
  );
}

// Validate operation structure
if (!operation || typeof operation !== "object") {
  throw new Error("Operation is not a valid object");
}

if (!operation.type) {
  throw new Error("Operation missing required 'type' field");
}
```

### 2. Fixed Intent Agent Configuration

**File:** `app/src/agents/intentAgent.js`

**Before:**

```javascript
type: "completion",
type: "json_object",
```

**After:**

```javascript
type: "json_object",
```

### 3. Improved Intent Agent JSON Prompt

**File:** `app/src/agents/intentAgent.js`

**Before:**

```javascript
{
  reasoning: "string that gives reasoning as to why you have selected a specific intent",
  intent: "conversation" // One of the options above conversation | research | publish | settings | cashu
  confidence: number // A confidence rating between 1 and 100.
}
```

**After:**

```javascript
{
  "reasoning": "string that gives reasoning as to why you have selected a specific intent",
  "intent": "conversation",
  "confidence": 90
}

IMPORTANT:
- All field names must be in double quotes
- The intent field must be one of: "conversation", "research", "publish", "settings", "cashu"
- The confidence field must be a number between 1 and 100
- Do not include comments in the JSON
```

## Verification Results

### Test Results

- ✅ Intent correctly classified as "cashu"
- ✅ Cashu pipeline executed successfully
- ✅ JSON parsing worked correctly
- ✅ Balance retrieved successfully: "💰 Your wallet balance is 4 sats"
- ✅ Wallet creation/lookup handled existing wallet properly

### Log Evidence of Success

```
[CashuPipeline] Using operation object directly: {
  type: 'balance',
  parameters: {},
  confidence: 90,
  reasoning: 'Clear balance check request for Cashu wallet'
}
[CashuPipeline] Executing operation: balance
[Worker] Pipeline response message: 💰 Your wallet balance is 4 sats
```

## Wallet Creation Flow Verification

The existing wallet handling was already working correctly:

- NC Tools Server properly detects existing wallets
- Returns 200 OK with wallet information
- System continues to balance check without issues

## Impact

### Before Fix

- Cashu balance requests failed with generic error message
- Users received unhelpful responses about contacting Cashu support
- System fell back to conversation pipeline

### After Fix

- Cashu balance requests work correctly
- Users receive actual wallet balance information
- Proper routing through Cashu pipeline
- Enhanced error handling and logging

## Prevention Measures

1. **Type Safety**: Added proper type checking for response objects
2. **Validation**: Added structure validation for operation objects
3. **Enhanced Logging**: Added detailed logging for debugging
4. **JSON Prompt Clarity**: Made JSON format requirements explicit
5. **Configuration Validation**: Removed duplicate configuration fields

## Related Files Modified

- `app/src/pipeline/cashuInteraction.pipeline.js` - JSON parsing fix
- `app/src/agents/intentAgent.js` - Configuration and prompt fixes
- `test-cashu-message.js` - Updated test user data

## Testing Commands

```bash
# Restart system
pm2 restart ecosystem.config.cjs

# Test Cashu balance request
node test-cashu-message.js

# Check logs
tail -f logs/beacon-worker-in/out.json
tail -f logs/beacon-worker-in/error.json
```

## Date: 2025-01-25

## Author: Roo (Claude)

## Status: Resolved
