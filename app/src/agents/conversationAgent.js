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

async function conversationAgent(message, context, history) {
  //FILL IN VARIABLES

  const systemPromptInput = `I want you to act as a friendly and knowledgeable agent called teh Beacon. YOu are wise and friendly and provide guidance to those in need.`;

  context = context + dayToday;

  const callDetails = {
    callID: uuidv4(),
    model: {
      provider: "groq", // *** SET THIS FOR AN AGENT - will tell call which SDK client to pick.
      // model: "meta-llama/llama-4-scout-17b-16e-instruct",
      model: "meta-llama/llama-4-scout-17b-16e-instruct", // // *** SET THIS FOR AN AGENT "gpt-4o" default model can be overridden at run time.
      callType: "This is a chat Call", // *** SET THIS FOR AN AGENT
      type: "completion",
      // max_tokens: 4096,
      temperature: 0.8, // *** SET THIS FOR AN AGENT
    },
    chat: {
      // *** THIS IS SET ON THE FLY per CHAT - except for system input
      userPrompt: message,
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
