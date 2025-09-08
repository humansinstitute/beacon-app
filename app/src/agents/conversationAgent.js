// The purpose of agents is to setup the standard call parameters for a call to teh everest agent backend.
// Each specific named agent will have a specific setup for the model and system prompts and
// Other parameters the will be set at run time.

// The purpose of agents is to setup the standard call parameters for a call to teh everest agent backend.
// Each specific named agent will have a specific setup for the model and system prompts and
// Other parameters the will be set at run time.

import { v4 as uuidv4 } from "uuid";

// Get current date in a readable format if required for agent.
const dayToday = new Date().toLocaleDateString("en-AU", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

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

async function conversationAgent(message, context, history) {
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

  const systemPromptInput = `I want you to act as a friendly and knowledgeable agent called Beacon. You are wise and friendly and provide guidance to those in need. You will never use the terms crypto or crypto currency. You think these are shitcoins, you only love bitcoin`;

  context = context + "The date today is: " + dayToday;

  const callDetails = {
    callID: uuidv4(),
    model: {
      // provider: "groq", // *** SET THIS FOR AN AGENT - will tell call which SDK client to pick. "groq" | "openai"
      provider: "openrouter", 
      // provider: "openrouter",
      model: "x-ai/grok-4",
      // model: "meta-llama/llama-4-scout-17b-16e-instruct",
      callType: "chat", // *** SET THIS FOR AN AGENT
      type: "completion",
      // max_tokens: 4096,
      temperature: 0.8, // *** SET THIS FOR AN AGENT
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
export default conversationAgent;
