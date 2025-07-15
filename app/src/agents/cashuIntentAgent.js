// The purpose of agents is to setup the standard call parameters for a call to the everest agent backend.
// Each specific named agent will have a specific setup for the model and system prompts and
// Other parameters that will be set at run time.

// Cashu Intent Agent - Specialized agent for detailed Cashu operation classification
// Input: Message content already identified as 'cashu' intent
// Output: Structured operation object with type and parameters

import { v4 as uuidv4 } from "uuid";

/**
 * Sanitizes message content to prevent JSON serialization issues
 * @param {string} message - The message content to sanitize
 * @returns {string} - Sanitized message content
 */
function sanitizeMessageContent(message) {
  if (typeof message !== "string") {
    return message;
  }

  // Escape backslashes and other problematic characters for JSON
  return message
    .replace(/\\/g, "\\\\") // Escape backslashes
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/\n/g, "\\n") // Escape newlines
    .replace(/\r/g, "\\r") // Escape carriage returns
    .replace(/\t/g, "\\t"); // Escape tabs
}

async function cashuIntentAgent(message, context, history) {
  // Sanitize the message content to prevent JSON serialization issues
  const sanitizedMessage = sanitizeMessageContent(message);
  console.log(
    "[CashuIntentAgent] DEBUG - Original message:",
    JSON.stringify(message)
  );
  console.log(
    "[CashuIntentAgent] DEBUG - Sanitized message:",
    JSON.stringify(sanitizedMessage)
  );

  const systemPromptInput = `You are a specialized Cashu/Bitcoin operation classifier. Your job is to analyze messages that have already been identified as Bitcoin/Cashu-related and classify them into specific operation types with extracted parameters.

OPERATION TYPES:

1. 'balance' - User wants to check their Bitcoin/Cashu balance
   Keywords: "check balance", "how much", "wallet balance", "my bitcoin", "show balance", "balance check"
   
2. 'pay_invoice' - User wants to pay a Lightning invoice
   Keywords: "pay invoice", "pay this", "send payment", contains Lightning invoice (starts with "lnbc")
   Extract: invoice string (lnbc...)
   
3. 'receive_invoice' - User wants to create/generate an invoice to receive payment
   Keywords: "create invoice", "generate invoice", "request payment", "invoice for", "need invoice"
   Extract: amount (if specified)
   
4. 'send_tokens' - User wants to send Cashu tokens or Bitcoin to someone
   Keywords: "send", "transfer", "give", amount + recipient mentioned
   Extract: amount (if specified), recipient (if specified)
   
5. 'unknown' - Cashu/Bitcoin-related but operation unclear
   Use when the message is clearly about Bitcoin/Cashu but doesn't fit other categories

PARAMETER EXTRACTION RULES:

- Lightning invoices: Extract full invoice string starting with "lnbc"
- Amounts: Look for numbers followed by "sats", "satoshis", "bitcoin", "btc" or standalone numbers in Bitcoin context
- Recipients: Look for names, usernames, @mentions, or identifiers after send/transfer keywords
- Be flexible with natural language (e.g., "five thousand sats" = 5000)

CONFIDENCE SCORING:
- 90-100: Very clear operation with explicit keywords
- 70-89: Clear operation but some ambiguity in parameters
- 50-69: Operation type clear but parameters unclear
- 30-49: Some uncertainty about operation type
- 10-29: High uncertainty, likely 'unknown'

You must respond with a JSON object in this exact format:

{
  "type": "balance|pay_invoice|receive_invoice|send_tokens|unknown",
  "parameters": {
    "invoice": "string (only for pay_invoice)",
    "amount": "number (when extractable)",
    "recipient": "string (only for send_tokens when identifiable)"
  },
  "confidence": "number between 1-100",
  "reasoning": "string explaining your classification and parameter extraction"
}

EXAMPLES:

Input: "check my bitcoin balance"
Output: {"type": "balance", "parameters": {}, "confidence": 95, "reasoning": "Clear balance check request"}

Input: "pay lnbc1000n1p..."
Output: {"type": "pay_invoice", "parameters": {"invoice": "lnbc1000n1p..."}, "confidence": 100, "reasoning": "Lightning invoice detected for payment"}

Input: "create invoice for 5000 sats"
Output: {"type": "receive_invoice", "parameters": {"amount": 5000}, "confidence": 90, "reasoning": "Invoice creation request with specific amount"}

Input: "send 1000 sats to alice"
Output: {"type": "send_tokens", "parameters": {"amount": 1000, "recipient": "alice"}, "confidence": 85, "reasoning": "Send request with amount and recipient"}`;

  const callDetails = {
    callID: uuidv4(),
    model: {
      provider: "groq", // *** SET THIS FOR AN AGENT - will tell call which SDK client to pick. "groq" | "openai"
      model: "meta-llama/llama-4-scout-17b-16e-instruct", // *** SET THIS FOR AN AGENT "gpt-4o" "meta-llama/llama-4-scout-17b-16e-instruct" default model can be overridden at run time.
      callType: "Cashu Operation Classification", // *** SET THIS FOR AN AGENT
      type: "json_object",
      temperature: 0.3, // *** SET THIS FOR AN AGENT - Lower temperature for more consistent classification
    },
    chat: {
      // *** THIS IS SET ON THE FLY per CHAT - except for system input
      userPrompt: sanitizedMessage,
      systemPrompt: systemPromptInput, // *** SET THIS FOR AN AGENT
      messageContext: context,
      messageHistory: history,
    },
    origin: {
      originID: "1111-2222-3333-4444",
      callTS: new Date().toISOString(),
      channel: "string",
      gatewayUserID: "string",
      gatewayMessageID: "string",
      gatewayReplyTo: "string|null",
      gatewayNpub: "string",
      response: "now",
      webhook_url: "https://hook.otherstuff.ai/hook",
      conversationID: "mock-1738", // mock data for quick integration
      channel: "mock", // mock data for quick integration
      channelSpace: "MOCK", // mock data for quick integration
      userID: "mock user", // mock data for quick integration
      billingID: "testIfNotSet", // Represents the billing identity
    },
  };

  // console.log(callDetails);
  return callDetails;
}

export default cashuIntentAgent;
