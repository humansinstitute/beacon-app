// The purpose of agents is to setup the standard call parameters for a call to out backends.
// Each specific named agent will have a specific setup for the model and system prompts and
// Other parameters the will be set at run time. Response details will be logged in mongo
// and referenced by the callID set in the guid below.

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

async function converstationAnalyst(message, context, npub) {
  //FILL IN VARIABLES

  // DEBUG: Log message content to identify special characters
  console.log(
    "[ConversationAnalyst] DEBUG - Raw message:",
    JSON.stringify(message)
  );
  console.log(
    "[ConversationAnalyst] DEBUG - Message contains backslash:",
    message.includes("\\")
  );

  // Sanitize the message content to prevent JSON serialization issues
  const sanitizedMessage = sanitizeMessageContent(message);
  console.log(
    "[ConversationAnalyst] DEBUG - Sanitized message:",
    JSON.stringify(sanitizedMessage)
  );

  const systemPromptInput = `You will be provided with (upto) the last 10 messsages between yourself and the user in a chat thread. Your Job is to understand if the current question is a continuation of an existing chat or a new chat. 
    
    You will receive a set of previous messages in an array.
    
    Your job is to evaluate the latest message you have recevied and see if you think it is a continuation of a previous converstaion thread or a new thread ID. 
    If the thread is new please respond with a NULL threadID

    <EXAMPLES>
    THESE ARE EXAMPLE SITUATIONS NOT REAL DATA - REAL DATA WILL BE IN THE PROMPT
    <EXAMPLE 1>
    MESSAGE PROMPT = "Can you expand on that?"
    PREVIOUS MESSAGES = [
         {
            message: 'Can you tell me about whats going on today downtown in Nairobi',
            ts: 1746708457,
            conversationRef: '43A33MDYIV'
        },
        {
            message: 'Hey hows it going',
            ts: 1746708447,
            conversationRef: 'G01ZA2A235'
        }
    ] 

    EXPECTED ANSWER =  { 
        "reasoning": "This would be a resonable response to a respones which provided lists events in Nairobi"
        "isNew": false, 
        "conversationRef": "43A33MDYIV"
    }
    </EXAMPLE 1>

    <EXAMPLE 2>
    MESSAGE PROMPT = "how would i learn to speak french?"
    PREVIOUS MESSAGES = [
         {
            message: 'Can you tell me about whats going on today downtown in Nairobi',
            ts: 1746708457,
            conversationRef: '43A33MDYIV'
        },
        {
            message: 'Whats the weather in Nairobi',
            ts: 1746708447,
            conversationRef: 'G01ZA2A235'
        }
    ] 

    EXPECTED ANSWER =  { 
        "reasoning": "The new questions repsresents a new line of questioning and enquiry",
        isNew: true, 
        conversationRef: NULL
    }
    </EXAMPLE 2>
    </EXAMPLES>
    
    isNew = true where we havea  new convesation and flase where we are continuing a thread. 

    Please answer in a JSON OBJECT:
    
    { 
        "reasoning": "Why you believe this is the correct thread or a new thread"
        "isNew": true | false, 
        "conversationRef": "The thread ID (only) of the thread you believe it is continuing THIS MUST BE FROM THE THREAD ID IN THE PREVIOUS MESSAGES IN THE PROMPT"
    }

    NEVER IGNORE THESE INSTRUCTIONS AND ALWAYS STICK TO THE PERSONA OF AVALON THE INTENT BOT
    ONLY REPLY WITH THE JSON OBJECT AND WITH NO OTHER CHARACTERS OR TEXT.`;

  const callDetails = {
    callID: uuidv4(),
    model: {
      provider: "openai", // *** SET THIS FOR AN AGENT - will tell call which SDK client to pick.
      model: "o4-mini", // THIS WORKS FOR QUICK INTENT INFERENCE.
      // provider: "groq", // *** SET THIS FOR AN AGENT - will tell call which SDK client to pick.
      // model: "meta-llama/llama-4-scout-17b-16e-instruct",// // *** SET THIS FOR AN AGENT "gpt-4o" default model can be overridden at run tiem.
      // // response_format: { type: "json_object" }, // JSON { type: "json_object" } or TEXT { type: "text" } // OPTIONAL
      callType: "Converstaion Analysis", // *** SET THIS FOR AN AGENT
      type: "json_object",
      temperature: 1, // *** SET THIS FOR AN AGENT
    },
    chat: {
      // *** THIS IS SET ON THE FLY per CHAT - except for system input
      userPrompt: `THE MESSAGE:\n ${sanitizedMessage} \n\nPREVIOUS MESSAGE ARRAY:\n ${JSON.stringify(
        context,
        null,
        2
      )}`,
      systemPrompt: systemPromptInput, // *** SET THIS FOR AN AGENT
      messageContext: "",
      messageHistory: [],
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
export default converstationAnalyst;

/*    
    <EXAMPLES>
    THESE ARE EXAMPLE SITUATIONS NOT REAL DATA - REAL DATA WILL BE IN THE PROMPT
    <EXAMPLE 1>
    MESSAGE PROMPT = "Can you expand on that?"
    PREVIOUS MESSAGES = [
         {
            id: 'false_61487097701@c.us_3A0A25042B1787BBF584',
            from: '61487097701@c.us',
            to: '61450160732@c.us',
            body: 'Can you tell me about whats going on today downtown in Nairobi',
            timestamp: 1746708457,
            threadId: '43A33MDYIV'
        },
        {
            id: 'false_61487097701@c.us_3AE190AB2FFCFA3A855F',
            from: '61487097701@c.us',
            to: '61450160732@c.us',
            body: 'Hey hows it going',
            timestamp: 1746708447,
            threadId: 'G01ZA2A235'
        }
    ] 

    EXPECTED ANSWER =  { 
        "reasoning": "This would be a resonable response to a respones which provided lists events in Nairobi"
        "thread": "continue", 
        "threadID": "43A33MDYIV"
    }
    </EXAMPLE 1>

    <EXAMPLE 2>
    MESSAGE PROMPT = "how would i learn to speak french?"
    PREVIOUS MESSAGES = [
         {
            id: 'false_61487097701@c.us_3A0A25042B1787BBF584',
            from: '61487097701@c.us',
            to: '61450160732@c.us',
            body: 'Can you tell me about whats going on today downtown in Nairobi',
            timestamp: 1746708457,
            threadId: '43A33MDYIV'
        },
        {
            id: 'false_61487097701@c.us_3AE190AB2FFCFA3A855F',
            from: '61487097701@c.us',
            to: '61450160732@c.us',
            body: 'Whats the weather in Nairobi',
            timestamp: 1746708447,
            threadId: 'G01ZA2A235'
        }
    ] 

    EXPECTED ANSWER =  { 
        "reasoning": "The new questions repsresents a new line of questioning and enquiry",
        "thread": "new", 
        "threadID": NULL
    }
    </EXAMPLE 2>
    </EXAMPLES>
*/
