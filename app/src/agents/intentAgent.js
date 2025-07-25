// The purpose of agents is to setup the standard call parameters for a call to teh everest agent backend.
// Each specific named agent will have a specific setup for the model and system prompts and
// Other parameters the will be set at run time.

// The purpose of agents is to setup the standard call parameters for a call to teh everest agent backend.
// Each specific named agent will have a specific setup for the model and system prompts and
// Other parameters the will be set at run time.

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

async function intentAgent(message, context, history) {
  //FILL IN VARIABLES

  // Sanitize the message content to prevent JSON serialization issues
  const sanitizedMessage = sanitizeMessageContent(message);
  console.log(
    "[ConversationAgent] DEBUG - Original message:",
    JSON.stringify(message)
  );
  console.log(
    "[ConversationAgent] DEBUG - Sanitized message:",
    JSON.stringify(sanitizedMessage)
  );

  const systemPromptInput = `I would like you to analyse a particular conversation for intent. You will receive a message and the previous messages in a conversation history. Your job will be to analyse it for intent against a short series of potential options with the default use case being "conversation".
  
  The list of options and their reasoning is given below:
  
  1. 'conversation' = this is the default use case. You should respond with conversation if there are no other obvious use cases.
  2. 'research' = this is the questions which would require looking up and researching data from one or more sources on the internet.
  3. 'publish' = the user you are in conversation with is asking you to publish a message to nostr for them.
  4. 'settings' = the user you are in conversation with is asking about their account or wants to change a setting for beacon.
  5. 'cashu' = the user is asking about Bitcoin, Lightning Network, payments, or Cashu operations. Keywords include: "bitcoin", "sats", "lightning", "invoice", "payment", "balance", "wallet", "cashu", "pay", "send", "receive", "lnbc" (Lightning invoice prefix).

  You should respond with a valid JSON object in the exact format below (ensure all field names are quoted):

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

  `;

  const callDetails = {
    callID: uuidv4(),
    model: {
      provider: "groq", // *** SET THIS FOR AN AGENT - will tell call which SDK client to pick. "groq" | "openai"
      // model: "meta-llama/llama-4-scout-17b-16e-instruct",
      model: "meta-llama/llama-4-scout-17b-16e-instruct", // // *** SET THIS FOR AN AGENT "gpt-4o" "meta-llama/llama-4-scout-17b-16e-instruct" default model can be overridden at run time.
      callType: "Set Intent for a conversation", // *** SET THIS FOR AN AGENT
      type: "json_object",
      temperature: 0.5, // *** SET THIS FOR AN AGENT
    },
    chat: {
      // *** THIS IS SET ON THE FLY per CHAT - except for system input
      userPrompt: sanitizedMessage,
      systemPrompt: systemPromptInput, // *** SET THIS FOR AN AGENT
      messageContext: "",
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
      conversationID: "mock-1738", // mock data for quick inegration
      channel: "mock", // mock data for quick inegration
      channelSpace: "MOCK", // mock data for quick inegration
      userID: "mock user", // mock data for quick inegration
      billingID: "testIfNotSet", // Represents the billing identity
    },
  };

  // console.log(callDetails);
  return callDetails;
}
export default intentAgent;
