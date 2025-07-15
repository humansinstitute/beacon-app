# Cashu Interaction Feature Implementation

## Overview

The Cashu Interaction feature enables WhatsApp users to perform Bitcoin/Lightning operations through natural language messaging using Cashu eCash tokens. This implementation provides a seamless bridge between conversational interfaces and Bitcoin financial operations, allowing users to manage their Bitcoin wallets through simple text commands.

## Architecture

### System Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   WhatsApp      │    │   Beacon App     │    │   NC Tools      │
│   Gateway       │◄──►│   Worker System  │◄──►│   Service       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Intent         │
                       │   Classification │
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Cashu          │
                       │   Pipeline       │
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Operation      │
                       │   Execution      │
                       └──────────────────┘
```

### Data Flow

1. **Message Reception**: WhatsApp message received via gateway
2. **User Lookup**: System identifies user by WhatsApp ID and retrieves Nostr identity
3. **Intent Classification**: AI agent determines if message is Cashu-related
4. **Operation Classification**: Specialized Cashu agent extracts operation type and parameters
5. **Wallet Validation**: Ensures user has a Cashu wallet (creates if needed)
6. **Operation Execution**: Performs the requested Bitcoin/Lightning operation
7. **Response Formatting**: Formats result for user-friendly WhatsApp display
8. **Message Delivery**: Sends response back through WhatsApp gateway

## Components Implemented

### 1. NC Tools Service Layer (`app/api/services/nctools.service.js`)

**Purpose**: Provides abstraction layer for NC Tools API integration

**Key Features**:

- Axios-based HTTP client with timeout and retry logic
- Comprehensive error handling with user-friendly error messages
- Input validation for npub, amounts, and invoices
- Automatic wallet creation and management
- Support for all major Cashu operations

**Methods**:

- [`ensureWalletExists(npub)`](app/api/services/nctools.service.js:128): Creates wallet if it doesn't exist
- [`getBalance(npub)`](app/api/services/nctools.service.js:154): Retrieves wallet balance
- [`generateInvoice(npub, amount)`](app/api/services/nctools.service.js:179): Creates Lightning invoice for minting
- [`payInvoice(npub, invoice)`](app/api/services/nctools.service.js:211): Pays Lightning invoice (melt operation)
- [`sendTokens(npub, amount, recipientPubkey)`](app/api/services/nctools.service.js:242): Sends Cashu tokens
- [`receiveTokens(npub, encodedToken, privateKey)`](app/api/services/nctools.service.js:279): Receives Cashu tokens
- [`getWalletInfo(npub)`](app/api/services/nctools.service.js:313): Comprehensive wallet status
- [`healthCheck()`](app/api/services/nctools.service.js:350): Service availability check

**Configuration**:

```javascript
baseURL: process.env.NCTOOLS_API_URL || "http://localhost:3000";
timeout: parseInt(process.env.NCTOOLS_TIMEOUT) || 30000;
defaultMint: process.env.CASHU_DEFAULT_MINT ||
  "https://mint.minibits.cash/Bitcoin";
```

### 2. Cashu Intent Agent (`app/src/agents/cashuIntentAgent.js`)

**Purpose**: Specialized AI agent for detailed Cashu operation classification

**Operation Types Supported**:

- `balance`: Check Bitcoin/Cashu wallet balance
- `pay_invoice`: Pay Lightning invoice using wallet tokens
- `receive_invoice`: Generate Lightning invoice to receive payment
- `send_tokens`: Send Cashu tokens to another user
- `unknown`: Cashu-related but operation unclear

**AI Model Configuration**:

- Provider: Groq
- Model: `meta-llama/llama-4-scout-17b-16e-instruct`
- Temperature: 0.3 (low for consistent classification)
- Response Type: JSON object

**Parameter Extraction**:

- Lightning invoices: Full invoice strings starting with "lnbc"
- Amounts: Numbers with units (sats, satoshis, bitcoin, btc)
- Recipients: Names, usernames, @mentions after send/transfer keywords
- Natural language processing: "five thousand sats" = 5000

**Confidence Scoring**:

- 90-100: Very clear operation with explicit keywords
- 70-89: Clear operation but some parameter ambiguity
- 50-69: Operation type clear but parameters unclear
- 30-49: Some uncertainty about operation type
- 10-29: High uncertainty, likely 'unknown'

### 3. Cashu Pipeline (`app/src/pipeline/cashuInteraction.pipeline.js`)

**Purpose**: Orchestrates the complete Cashu operation workflow

**Pipeline Stages**:

1. **User Validation**: Ensures user has valid npub
2. **Wallet Initialization**: Creates wallet if needed via NC Tools
3. **Intent Extraction**: Uses Cashu Intent Agent for operation classification
4. **Operation Routing**: Dispatches to appropriate execution function
5. **Response Formatting**: Creates user-friendly response messages

**Operation Handlers**:

- [`executeBalanceCheck(userNpub)`](app/src/pipeline/cashuInteraction.pipeline.js:140): Balance inquiry
- [`executePayInvoice(userNpub, invoice)`](app/src/pipeline/cashuInteraction.pipeline.js:165): Lightning payment
- [`executeGenerateInvoice(userNpub, amount)`](app/src/pipeline/cashuInteraction.pipeline.js:199): Invoice creation
- [`executeSendTokens(userNpub, amount, recipient)`](app/src/pipeline/cashuInteraction.pipeline.js:235): Token transfer

**Error Handling**:

- Connection errors: Service unavailable messages
- Timeout errors: Retry suggestions
- Validation errors: Parameter correction guidance
- Insufficient balance: Clear balance vs. requirement messaging

**Response Formatting**:

- Balance: `💰 Your wallet balance is {amount} sats`
- Payment: `✅ Payment sent! Paid {amount} sats. Fee: {fee} sats`
- Invoice: `📄 Here's your invoice for {amount} sats:\n\n{invoice}`
- Send: `✅ Sent {amount} sats successfully to {recipient}`

### 4. Worker Integration (`app/workers/beaconMessage.worker.js`)

**Purpose**: Integrates Cashu pipeline into the main message processing workflow

**Integration Points**:

1. **Intent Classification**: Uses [`intentAgent`](app/workers/beaconMessage.worker.js:148) to determine if message is Cashu-related
2. **Pipeline Routing**: Routes Cashu intents to [`processCashuPipeline`](app/workers/beaconMessage.worker.js:179)
3. **Fallback Handling**: Falls back to conversation pipeline on errors
4. **Conversation Tracking**: Maintains conversation history for context

**Message Flow**:

```javascript
// Intent classification
const intentResult = JSON.parse(intentResponse.message);

// Route to appropriate pipeline
if (intentResult.intent === "cashu") {
  responseMessage = await processCashuPipeline(job.data);
} else {
  responseMessage = await processConversationPipeline(job.data);
}
```

### 5. Environment Configuration

**Required Environment Variables**:

```bash
# NC Tools Integration
NCTOOLS_API_URL=http://localhost:3000
NCTOOLS_TIMEOUT=30000

# Default Cashu Settings
CASHU_DEFAULT_MINT=https://mint.minibits.cash/Bitcoin
CASHU_MIN_AMOUNT=1
CASHU_MAX_AMOUNT=1000000
```

## Features Implemented

### Core Functionality

1. **Automatic Wallet Management**

   - Creates Cashu wallets automatically for new users
   - Links wallets to user's Nostr identity (npub)
   - Handles wallet initialization errors gracefully

2. **Balance Checking**

   - Real-time balance queries
   - Clear balance display with units
   - Error handling for service unavailability

3. **Lightning Invoice Payment**

   - Validates Lightning invoice format (lnbc prefix)
   - Checks sufficient balance before payment
   - Provides payment confirmation with fees
   - Handles payment failures with specific error messages

4. **Invoice Generation**

   - Creates Lightning invoices for receiving payments
   - Validates amount parameters
   - Returns shareable invoice strings
   - Integrates with default mint configuration

5. **Token Sending**

   - Peer-to-peer Cashu token transfers
   - Balance validation before sending
   - Recipient identification and validation
   - Transaction confirmation messages

6. **Natural Language Processing**
   - Understands various phrasings for operations
   - Extracts amounts from natural language
   - Handles ambiguous requests with helpful guidance
   - Provides operation suggestions for unclear intents

### Error Handling and Resilience

1. **Service Availability**

   - Health checks for NC Tools service
   - Graceful degradation when service unavailable
   - Clear error messages for users
   - Automatic retry suggestions

2. **Input Validation**

   - Npub format validation
   - Amount range checking
   - Lightning invoice format verification
   - Recipient identifier validation

3. **Transaction Safety**
   - Balance verification before operations
   - Double-confirmation for large amounts
   - Clear transaction status reporting
   - Rollback handling for failed operations

### User Experience Features

1. **Conversational Interface**

   - Natural language command processing
   - Context-aware responses
   - Helpful error messages
   - Operation guidance and examples

2. **WhatsApp Integration**

   - Emoji-rich response formatting
   - Message threading and replies
   - Conversation history maintenance
   - Seamless gateway integration

3. **Security and Privacy**
   - Nostr-based identity management
   - No storage of sensitive keys
   - Secure communication with NC Tools
   - User data protection

## Testing Implementation

### Test Coverage

1. **Unit Tests**

   - NC Tools service methods
   - Cashu intent agent classification
   - Pipeline operation handlers
   - Error handling scenarios

2. **Integration Tests**

   - End-to-end message processing
   - Service integration validation
   - Worker pipeline testing
   - Error recovery testing

3. **Test Files**
   - [`tests/cashu.integration.test.js`](tests/cashu.integration.test.js): Agent integration testing
   - [`tests/cashuIntentAgent.test.js`](tests/cashuIntentAgent.test.js): Intent classification testing
   - [`tests/cashuInteraction.pipeline.test.js`](tests/cashuInteraction.pipeline.test.js): Pipeline testing
   - [`tests/nctools.service.test.js`](tests/nctools.service.test.js): Service layer testing

### Test Scenarios

1. **Happy Path Testing**

   - Successful balance checks
   - Successful invoice payments
   - Successful invoice generation
   - Successful token transfers

2. **Error Condition Testing**

   - Service unavailability
   - Invalid input parameters
   - Insufficient balance scenarios
   - Network timeout handling

3. **Edge Case Testing**
   - Very large amounts
   - Very small amounts
   - Malformed Lightning invoices
   - Non-existent recipients

## Performance Considerations

### Optimization Features

1. **Connection Pooling**

   - Reused HTTP connections to NC Tools
   - Configurable timeout settings
   - Request/response logging for debugging

2. **Caching Strategy**

   - Wallet existence caching
   - Balance caching with TTL
   - Service health status caching

3. **Async Processing**
   - Non-blocking operation execution
   - Concurrent request handling
   - Queue-based message processing

### Monitoring and Logging

1. **Comprehensive Logging**

   - Request/response logging
   - Error tracking and categorization
   - Performance metrics collection
   - User operation auditing

2. **Health Monitoring**
   - Service availability checks
   - Response time monitoring
   - Error rate tracking
   - Queue depth monitoring

## Security Implementation

### Security Features

1. **Input Sanitization**

   - Message content sanitization
   - Parameter validation
   - SQL injection prevention
   - XSS protection

2. **Authentication**

   - Nostr-based user identity
   - Secure npub validation
   - No password storage required

3. **Communication Security**
   - HTTPS for NC Tools communication
   - Encrypted message handling
   - Secure key management

## Future Enhancements

### Planned Features

1. **Advanced Operations**

   - Multi-signature transactions
   - Scheduled payments
   - Recurring transactions
   - Transaction history queries

2. **Enhanced UX**

   - Transaction confirmations
   - Balance notifications
   - Payment reminders
   - Rich media responses

3. **Integration Expansions**
   - Multiple mint support
   - Cross-chain operations
   - DeFi integrations
   - Merchant payment flows

## Conclusion

The Cashu Interaction feature provides a robust, user-friendly interface for Bitcoin operations through WhatsApp messaging. The implementation emphasizes security, reliability, and ease of use while maintaining the flexibility to extend functionality as the ecosystem evolves.

The modular architecture ensures maintainability and testability, while the comprehensive error handling provides a smooth user experience even when underlying services experience issues.
