# Cashu API Reference

## Overview

This document provides comprehensive API reference for the Cashu integration feature, including NC Tools service integration, pipeline components, and agent configurations. This reference is intended for developers working with or extending the Cashu functionality.

## NC Tools Service Integration

### Base Configuration

```javascript
// Service Configuration
baseURL: process.env.NCTOOLS_API_URL || "http://localhost:3000";
timeout: parseInt(process.env.NCTOOLS_TIMEOUT) || 30000;
defaultMint: process.env.CASHU_DEFAULT_MINT ||
  "https://mint.minibits.cash/Bitcoin";
```

### Service Methods

#### `ensureWalletExists(npub)`

Creates a Cashu wallet for the user if it doesn't already exist.

**Parameters:**

- `npub` (string): User's Nostr public key in npub format

**Returns:**

```javascript
{
  success: boolean,
  wallet: Object,
  message: string
}
```

**Example:**

```javascript
const result = await ncToolsService.ensureWalletExists("npub1...");
if (result.success) {
  console.log("Wallet ready:", result.wallet);
}
```

**Error Responses:**

```javascript
{
  success: false,
  error: "Invalid npub: must start with npub1",
  type: "VALIDATION_ERROR",
  operation: "ensureWalletExists"
}
```

#### `getBalance(npub)`

Retrieves the current balance of a user's wallet.

**Parameters:**

- `npub` (string): User's Nostr public key in npub format

**Returns:**

```javascript
{
  success: boolean,
  balance: number,
  unit: string,
  message: string
}
```

**Example:**

```javascript
const result = await ncToolsService.getBalance("npub1...");
console.log(`Balance: ${result.balance} ${result.unit}`);
```

#### `generateInvoice(npub, amount)`

Creates a Lightning invoice for minting Cashu tokens.

**Parameters:**

- `npub` (string): User's Nostr public key in npub format
- `amount` (number): Amount in satoshis

**Returns:**

```javascript
{
  success: boolean,
  invoice: string,
  amount: number,
  hash: string,
  message: string
}
```

**Example:**

```javascript
const result = await ncToolsService.generateInvoice("npub1...", 1000);
console.log("Invoice:", result.invoice);
```

#### `payInvoice(npub, invoice)`

Pays a Lightning invoice using wallet tokens (melt operation).

**Parameters:**

- `npub` (string): User's Nostr public key in npub format
- `invoice` (string): Lightning invoice string starting with "lnbc"

**Returns:**

```javascript
{
  success: boolean,
  payment: {
    amount: number,
    fee: number,
    hash: string
  },
  message: string
}
```

**Example:**

```javascript
const result = await ncToolsService.payInvoice("npub1...", "lnbc1000n1p...");
console.log(
  `Paid ${result.payment.amount} sats, fee: ${result.payment.fee} sats`
);
```

#### `sendTokens(npub, amount, recipientPubkey)`

Sends Cashu tokens to another user.

**Parameters:**

- `npub` (string): Sender's Nostr public key in npub format
- `amount` (number): Amount to send in satoshis
- `recipientPubkey` (string): Recipient's public key

**Returns:**

```javascript
{
  success: boolean,
  encodedToken: string,
  amount: number,
  recipient: string,
  message: string
}
```

**Example:**

```javascript
const result = await ncToolsService.sendTokens(
  "npub1...",
  500,
  "recipient_pubkey"
);
console.log("Token sent:", result.encodedToken);
```

#### `receiveTokens(npub, encodedToken, privateKey)`

Receives Cashu tokens from an encoded token string.

**Parameters:**

- `npub` (string): Receiver's Nostr public key in npub format
- `encodedToken` (string): Encoded token string to receive
- `privateKey` (string): Receiver's private key for decryption

**Returns:**

```javascript
{
  success: boolean,
  received: Object,
  message: string
}
```

#### `getWalletInfo(npub)`

Retrieves comprehensive wallet information and status.

**Parameters:**

- `npub` (string): User's Nostr public key in npub format

**Returns:**

```javascript
{
  success: boolean,
  wallet: {
    npub: string,
    balance: number,
    unit: string,
    mint: string
  },
  message: string
}
```

#### `healthCheck()`

Performs a health check on the NC Tools service.

**Returns:**

```javascript
{
  success: boolean,
  status: Object,
  message: string
}
```

### Error Handling

All service methods return structured error objects:

```javascript
{
  operation: string,
  timestamp: string,
  success: false,
  error: string,
  type: "CONNECTION_ERROR" | "TIMEOUT_ERROR" | "API_ERROR" | "UNKNOWN_ERROR",
  message: string,
  status?: number
}
```

**Error Types:**

- `CONNECTION_ERROR`: NC Tools service unavailable
- `TIMEOUT_ERROR`: Request timeout
- `API_ERROR`: HTTP error from NC Tools
- `UNKNOWN_ERROR`: Unexpected error

## Pipeline Integration

### `processCashuPipeline(jobData)`

Main pipeline function that orchestrates Cashu operations.

**Parameters:**

```javascript
jobData = {
  beaconMessage: {
    user: {
      npub: string,
      name: string,
      _id: string
    },
    message: {
      content: string,
      role: string,
      messageID: string
    },
    origin: Object
  },
  conversation?: {
    summaryHistory: Array
  }
}
```

**Returns:**

- `string`: Response message for the user

**Pipeline Flow:**

1. Validate user context
2. Ensure wallet exists
3. Extract operation intent using Cashu Intent Agent
4. Execute operation based on type
5. Format and return response

### Operation Handlers

#### `executeBalanceCheck(userNpub)`

**Parameters:**

- `userNpub` (string): User's npub

**Returns:**

```javascript
{
  success: boolean,
  message: string
}
```

#### `executePayInvoice(userNpub, invoice)`

**Parameters:**

- `userNpub` (string): User's npub
- `invoice` (string): Lightning invoice

**Returns:**

```javascript
{
  success: boolean,
  message: string
}
```

#### `executeGenerateInvoice(userNpub, amount)`

**Parameters:**

- `userNpub` (string): User's npub
- `amount` (number): Amount in satoshis

**Returns:**

```javascript
{
  success: boolean,
  message: string
}
```

#### `executeSendTokens(userNpub, amount, recipient)`

**Parameters:**

- `userNpub` (string): User's npub
- `amount` (number): Amount in satoshis
- `recipient` (string): Recipient identifier

**Returns:**

```javascript
{
  success: boolean,
  message: string
}
```

### Response Formatters

#### `formatBalanceResponse(balance)`

**Parameters:**

- `balance` (number): Wallet balance in sats

**Returns:**

- `string`: Formatted balance message

**Example Output:**

```
💰 Your wallet balance is 5,000 sats
```

#### `formatPaymentResponse(paymentResult)`

**Parameters:**

- `paymentResult` (Object): Payment result from NC Tools

**Returns:**

- `string`: Formatted payment confirmation

**Example Output:**

```
✅ Payment sent! Paid 1,000 sats. Fee: 2 sats
```

#### `formatInvoiceResponse(invoice, amount)`

**Parameters:**

- `invoice` (string): Generated Lightning invoice
- `amount` (number): Invoice amount

**Returns:**

- `string`: Formatted invoice message

**Example Output:**

```
📄 Here's your invoice for 1,000 sats:

lnbc10u1p3xnhl2pp5...

Share this with someone to receive payment.
```

#### `formatErrorResponse(error, operation)`

**Parameters:**

- `error` (Object): Error object from NC Tools
- `operation` (string): Operation that failed

**Returns:**

- `string`: User-friendly error message

## Agent Configuration

### Cashu Intent Agent

#### Configuration

```javascript
{
  model: {
    provider: "groq",
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    callType: "Cashu Operation Classification",
    type: "json_object",
    temperature: 0.3
  }
}
```

#### Input Parameters

```javascript
cashuIntentAgent(message, context, history);
```

**Parameters:**

- `message` (string): User message content
- `context` (string): Contextual information about the user
- `history` (Array): Conversation history

#### Response Format

```javascript
{
  type: "balance" | "pay_invoice" | "receive_invoice" | "send_tokens" | "unknown",
  parameters: {
    invoice?: string,
    amount?: number,
    recipient?: string
  },
  confidence: number, // 1-100
  reasoning: string
}
```

#### Operation Types

1. **balance**: Check Bitcoin/Cashu balance

   - Keywords: "check balance", "how much", "wallet balance"
   - Parameters: None

2. **pay_invoice**: Pay Lightning invoice

   - Keywords: "pay invoice", "pay this", contains "lnbc"
   - Parameters: `invoice` (string)

3. **receive_invoice**: Generate invoice

   - Keywords: "create invoice", "generate invoice", "request payment"
   - Parameters: `amount` (number)

4. **send_tokens**: Send Cashu tokens

   - Keywords: "send", "transfer", "give"
   - Parameters: `amount` (number), `recipient` (string)

5. **unknown**: Unclear operation
   - Used when intent is unclear

#### Confidence Scoring

- **90-100**: Very clear operation with explicit keywords
- **70-89**: Clear operation but some parameter ambiguity
- **50-69**: Operation type clear but parameters unclear
- **30-49**: Some uncertainty about operation type
- **10-29**: High uncertainty, likely 'unknown'

### Intent Agent Integration

The main intent agent classifies messages as "cashu" or "conversation":

```javascript
intentAgent(message, context, history);
```

**Response:**

```javascript
{
  intent: "cashu" | "conversation",
  confidence: number,
  reasoning: string
}
```

## Worker Integration

### Message Processing Flow

```javascript
// 1. Intent Classification
const intentResult = JSON.parse(intentResponse.message);

// 2. Route to Pipeline
if (intentResult.intent === "cashu") {
  responseMessage = await processCashuPipeline(job.data);
} else {
  responseMessage = await processConversationPipeline(job.data);
}

// 3. Format Response
const whatsappMessage = {
  chatID: job.data.beaconMessage.origin.gatewayUserID,
  message: responseMessage,
  options: {
    quotedMessageId: job.data.beaconMessage.message.replyTo,
  },
};
```

### Job Data Structure

```javascript
{
  beaconMessage: {
    user: {
      npub: string,
      name: string,
      _id: string
    },
    message: {
      content: string,
      role: "user",
      messageID: string,
      replyTo?: string,
      ts: number
    },
    origin: {
      channel: string,
      gatewayUserID: string,
      gatewayMessageID: string,
      userNpub?: string
    }
  },
  conversation?: {
    _id: string,
    summaryHistory: Array<{
      role: string,
      content: string
    }>
  }
}
```

## Environment Variables

### Required Variables

```bash
# NC Tools Integration
NCTOOLS_API_URL=http://localhost:3000
NCTOOLS_TIMEOUT=30000

# Cashu Configuration
CASHU_DEFAULT_MINT=https://mint.minibits.cash/Bitcoin
CASHU_MIN_AMOUNT=1
CASHU_MAX_AMOUNT=1000000
```

### Optional Variables

```bash
# Logging
LOG_LEVEL=info

# Development
NODE_ENV=development
```

## HTTP Endpoints

### NC Tools API Endpoints

The Cashu service integrates with these NC Tools endpoints:

#### `POST /api/wallet/create`

Creates a new wallet for a user.

**Request:**

```javascript
{
  npub: string,
  mint: string
}
```

#### `GET /api/wallet/{npub}/balance`

Gets wallet balance.

**Response:**

```javascript
{
  balance: number,
  unit: string
}
```

#### `POST /api/wallet/{npub}/mint`

Generates Lightning invoice for minting.

**Request:**

```javascript
{
  amount: number,
  mint: string
}
```

**Response:**

```javascript
{
  invoice: string,
  hash: string
}
```

#### `POST /api/wallet/{npub}/melt`

Pays Lightning invoice.

**Request:**

```javascript
{
  invoice: string;
}
```

#### `POST /api/wallet/{npub}/send`

Sends tokens to recipient.

**Request:**

```javascript
{
  amount: number,
  recipientPubkey: string
}
```

**Response:**

```javascript
{
  encodedToken: string;
}
```

#### `POST /api/wallet/{npub}/receive`

Receives tokens from encoded token.

**Request:**

```javascript
{
  encodedToken: string,
  privateKey: string
}
```

#### `GET /health`

Health check endpoint.

**Response:**

```javascript
{
  status: "ok",
  timestamp: string
}
```

## Testing APIs

### Test Utilities

```javascript
// Mock NC Tools responses
const mockNCToolsService = {
  ensureWalletExists: jest.fn(),
  getBalance: jest.fn(),
  generateInvoice: jest.fn(),
  payInvoice: jest.fn(),
  sendTokens: jest.fn(),
  healthCheck: jest.fn(),
};

// Mock job data
const mockJobData = {
  beaconMessage: {
    user: {
      npub: "npub1test...",
      name: "Test User",
      _id: "user123",
    },
    message: {
      content: "check my balance",
      role: "user",
      messageID: "msg123",
    },
    origin: {
      channel: "beacon.whatsapp",
      gatewayUserID: "wa123",
    },
  },
};
```

### Test Examples

```javascript
describe("Cashu Pipeline", () => {
  test("should handle balance check", async () => {
    mockNCToolsService.ensureWalletExists.mockResolvedValue({
      success: true,
      wallet: {},
    });

    mockNCToolsService.getBalance.mockResolvedValue({
      success: true,
      balance: 1000,
      unit: "sats",
    });

    const result = await processCashuPipeline(mockJobData);
    expect(result).toContain("1000 sats");
  });
});
```

## Error Codes and Messages

### Service Error Codes

| Code           | Type             | Description         | User Message                        |
| -------------- | ---------------- | ------------------- | ----------------------------------- |
| `ECONNREFUSED` | CONNECTION_ERROR | Service unavailable | "Cashu services are currently down" |
| `ECONNABORTED` | TIMEOUT_ERROR    | Request timeout     | "The request timed out"             |
| `400`          | API_ERROR        | Bad request         | "Invalid request parameters"        |
| `402`          | API_ERROR        | Insufficient funds  | "Insufficient balance"              |
| `404`          | API_ERROR        | Not found           | "Resource not found"                |
| `500`          | API_ERROR        | Server error        | "Service temporarily unavailable"   |

### Validation Errors

```javascript
// Invalid npub
{
  error: "Invalid npub: must start with npub1",
  type: "VALIDATION_ERROR"
}

// Invalid amount
{
  error: "Invalid amount: must be a positive number",
  type: "VALIDATION_ERROR"
}

// Invalid invoice
{
  error: "Invalid invoice: must be a non-empty string",
  type: "VALIDATION_ERROR"
}
```

## Rate Limiting and Performance

### Request Limits

- **NC Tools Timeout**: 30 seconds (configurable)
- **Concurrent Requests**: Limited by NC Tools capacity
- **Retry Logic**: Automatic retry on timeout

### Performance Considerations

- **Connection Pooling**: HTTP connections reused
- **Request Logging**: All requests logged for debugging
- **Error Caching**: Failed requests cached briefly to prevent spam

## Security Considerations

### Input Validation

All inputs are validated before processing:

```javascript
// Npub validation
if (!npub || !npub.startsWith("npub1")) {
  throw new Error("Invalid npub format");
}

// Amount validation
if (!amount || amount <= 0) {
  throw new Error("Invalid amount");
}

// Invoice validation
if (!invoice || !invoice.startsWith("lnbc")) {
  throw new Error("Invalid Lightning invoice");
}
```

### Message Sanitization

```javascript
function sanitizeMessageContent(message) {
  return message
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}
```

### Secure Communication

- **HTTPS**: All external API calls use HTTPS
- **No Key Storage**: Private keys not stored in the system
- **Request Logging**: Sensitive data excluded from logs

This API reference provides comprehensive documentation for developers working with the Cashu integration feature. For implementation examples, see the source code and test files.
