// app/utils/messageUtils.js
/**
 * Message utility functions for conversation analysis and processing
 */

import {
  getMessagesByNpub,
  getConversationById,
} from "../api/services/conversation.service.js";
import converstationAnalyst from "../src/agents/converstationAnalysis.js";
import { callEverest } from "../api/services/everest.service.js";

/**
 * Analyzes a message to determine conversation context
 * Currently returns hardcoded response for new conversations.
 * This will be replaced with intelligent conversation analysis in the future.
 *
 * @param {Object} message - The message object containing content, role, messageID, ts, etc.
 * @param {Object} origin - The origin information (channel, gateway details)
 * @param {Object} user - The user object (optional)
 * @returns {Object} existingConversation object with isNew, refId, and data properties
 */
export async function analyzeConversation(message, origin, user = null) {
  try {
    // Validate required parameters
    if (!message || typeof message !== "object") {
      throw new Error("Message parameter is required and must be an object");
    }

    if (!origin || typeof origin !== "object") {
      throw new Error("Origin parameter is required and must be an object");
    }

    // Extract user npub from parameters
    const userNpub = user?.npub || origin.userNpub;

    if (!userNpub) {
      console.warn(
        "[MessageUtils] No user npub available for conversation analysis"
      );
      return {
        isNew: true,
        refId: null,
        data: null,
      };
    }

    console.log("[MessageUtils] Analyzing conversation for message:", {
      messageID: message.messageID,
      content: message.content?.substring(0, 50) + "...",
      channel: origin.channel,
      userID: user?._id || "unknown",
      userNpub: userNpub,
    });

    // Stage 1: Retrieve and format the last 10 messages for analysis
    console.log(
      "[MessageUtils] Retrieving last 10 messages for npub:",
      userNpub
    );

    let recentMessages = [];
    try {
      const messages = await getMessagesByNpub(userNpub, 10);
      console.log(
        "[MessageUtils] Retrieved messages count:",
        messages?.length || 0
      );

      if (messages && messages.length > 0) {
        // Transform messages to required format
        recentMessages = messages.map((msg) => ({
          message: msg.message.content,
          ts: msg.message.ts,
          conversationRef: msg.conversationRef,
        }));

        console.log("[MessageUtils] Transformed messages for analysis:", {
          count: recentMessages.length,
          sample: recentMessages[0]
            ? {
                messagePreview:
                  recentMessages[0].message?.substring(0, 30) + "...",
                ts: recentMessages[0].ts,
                conversationRef: recentMessages[0].conversationRef,
              }
            : null,
        });
      } else {
        console.log("[MessageUtils] No messages found for npub:", userNpub);
      }
    } catch (dbError) {
      console.error(
        "[MessageUtils] Error retrieving messages from database:",
        dbError
      );
      // Continue with empty messages array - don't fail the entire function
    }

    // Stage 2: Agent integration and Everest service calls
    // Only proceed with agent calls if we have message history
    if (recentMessages.length === 0) {
      console.log(
        "[MessageUtils] No message history found - skipping agent analysis"
      );
      const result = {
        isNew: true,
        refId: null,
        data: null,
      };

      console.log(
        "[MessageUtils] Stage 2 - No context, returning default result:",
        {
          ...result,
          messagesRetrieved: recentMessages.length,
          userNpub: userNpub,
        }
      );

      return result;
    }

    // Prepare context array for agent analysis
    const contextArray = recentMessages;

    console.log(
      "[MessageUtils] Stage 2 - Calling conversation analysis agent:",
      {
        messageContent: message.content?.substring(0, 50) + "...",
        contextCount: contextArray.length,
        userNpub: userNpub,
      }
    );

    try {
      // Call the conversation analysis agent
      const agentData = await converstationAnalyst(
        message.content,
        contextArray,
        userNpub
      );

      console.log("[MessageUtils] Agent analysis completed:", {
        agentDataReceived: !!agentData,
        agentDataType: typeof agentData,
        agentDataKeys: agentData ? Object.keys(agentData) : null,
      });

      // Log the exact prompt and context being sent to Everest
      if (agentData && agentData.chat) {
        console.log("[MessageUtils] DETAILED PROMPT LOGGING - System Prompt:", {
          systemPrompt: agentData.chat.systemPrompt?.substring(0, 200) + "...",
          systemPromptLength: agentData.chat.systemPrompt?.length || 0,
        });

        console.log("[MessageUtils] DETAILED PROMPT LOGGING - User Prompt:", {
          userPrompt: agentData.chat.userPrompt,
          userPromptLength: agentData.chat.userPrompt?.length || 0,
        });

        console.log(
          "[MessageUtils] DETAILED PROMPT LOGGING - Message Context:",
          {
            originalMessage: message.content,
            contextArrayLength: contextArray.length,
            contextArray: contextArray,
          }
        );

        console.log(
          "[MessageUtils] DETAILED PROMPT LOGGING - Model Configuration:",
          {
            provider: agentData.model?.provider,
            model: agentData.model?.model,
            type: agentData.model?.type,
            temperature: agentData.model?.temperature,
            callID: agentData.callID,
          }
        );
      }

      // Call Everest service with agent data
      console.log("[MessageUtils] Calling Everest service:", {
        userID: user?._id,
        userNpub: userNpub,
        hasAgentData: !!agentData,
      });

      const response = await callEverest(agentData, {
        userID: user?._id,
        userNpub: userNpub,
      });

      console.log("[MessageUtils] Everest service response received:", {
        responseReceived: !!response,
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : null,
      });

      // Stage 3: Parse and validate LLM response with graceful error handling
      let analysisResult;
      try {
        console.log("[MessageUtils] Stage 3 - Parsing LLM response:", {
          rawResponse: response?.message,
          responseType: typeof response?.message,
        });

        analysisResult =
          typeof response.message === "string"
            ? JSON.parse(response.message)
            : response.message;

        console.log("[MessageUtils] JSON parsing successful:", {
          parsedKeys: Object.keys(analysisResult),
          parsedResult: analysisResult,
        });

        // Validate required fields
        if (
          !analysisResult.hasOwnProperty("isNew") ||
          !analysisResult.hasOwnProperty("reasoning") ||
          !analysisResult.hasOwnProperty("conversationRef")
        ) {
          throw new Error("Invalid response format - missing required fields");
        }

        console.log("[MessageUtils] Response validation successful:", {
          hasIsNew: analysisResult.hasOwnProperty("isNew"),
          hasReasoning: analysisResult.hasOwnProperty("reasoning"),
          hasConversationRef: analysisResult.hasOwnProperty("conversationRef"),
          isNewValue: analysisResult.isNew,
          conversationRefValue: analysisResult.conversationRef,
        });
      } catch (error) {
        console.error("[MessageUtils] Failed to parse LLM response:", {
          error: error.message,
          rawResponse: response?.message,
          responseType: typeof response?.message,
          userNpub: userNpub,
          messageID: message.messageID,
        });

        console.log(
          "[MessageUtils] Stage 3 - Graceful fallback to new conversation due to parsing error"
        );

        // Graceful fallback to new conversation
        return {
          isNew: true,
          refId: null,
          data: null,
        };
      }

      // Stage 4: Map analysis result to final return format
      console.log(
        "[MessageUtils] Stage 4 - Mapping analysis result to return format:",
        {
          analysisResult: {
            isNew: analysisResult.isNew,
            conversationRef: analysisResult.conversationRef,
            reasoning: analysisResult.reasoning?.substring(0, 100) + "...",
          },
        }
      );

      // Handle New Conversation Case
      if (analysisResult.isNew === true) {
        console.log("[MessageUtils] Analysis determined: NEW conversation");
        return {
          isNew: true,
          refId: null,
          data: null,
        };
      }

      // Handle Existing Conversation Case
      if (analysisResult.isNew === false && analysisResult.conversationRef) {
        try {
          console.log(
            "[MessageUtils] Analysis determined: EXISTING conversation, retrieving data for:",
            analysisResult.conversationRef
          );
          const conversationData = await getConversationById(
            analysisResult.conversationRef
          );
          console.log(
            "[MessageUtils] Successfully retrieved conversation data"
          );
          return {
            isNew: false,
            refId: analysisResult.conversationRef,
            data: conversationData,
          };
        } catch (error) {
          console.error(
            "[MessageUtils] Failed to retrieve conversation:",
            error
          );
          // Fallback to new conversation
          console.log(
            "[MessageUtils] Falling back to new conversation due to retrieval error"
          );
          return {
            isNew: true,
            refId: null,
            data: null,
          };
        }
      }

      // Handle Edge Case: isNew is false but conversationRef is null/empty
      if (analysisResult.isNew === false && !analysisResult.conversationRef) {
        console.log(
          "[MessageUtils] Edge case: Analysis marked as existing but no conversationRef provided, falling back to new conversation"
        );
        return {
          isNew: true,
          refId: null,
          data: null,
        };
      }

      // Final fallback for any unexpected cases
      console.warn(
        "[MessageUtils] Unexpected analysis result format, falling back to new conversation:",
        analysisResult
      );
      return {
        isNew: true,
        refId: null,
        data: null,
      };
    } catch (agentError) {
      console.error(
        "[MessageUtils] Error in agent, Everest service, or response parsing:",
        {
          error: agentError.message,
          stack: agentError.stack,
          userNpub: userNpub,
          messageID: message.messageID,
        }
      );

      // Graceful fallback to existing return format on agent/Everest/parsing failures
      const result = {
        isNew: true,
        refId: null,
        data: null,
      };

      console.log(
        "[MessageUtils] Stage 3 - Falling back to default result due to error:",
        {
          ...result,
          messagesRetrieved: recentMessages.length,
          userNpub: userNpub,
          error: agentError.message,
        }
      );

      return result;
    }
  } catch (error) {
    console.error("[MessageUtils] Error analyzing conversation:", error);
    // Return safe default on error
    return {
      isNew: true,
      refId: null,
      data: null,
    };
  }
}

/**
 * Validates message structure for conversation processing
 * @param {Object} message - The message object to validate
 * @returns {boolean} True if message is valid for conversation processing
 */
export function validateMessageForConversation(message) {
  if (!message || typeof message !== "object") {
    return false;
  }

  // Check required fields
  const requiredFields = ["content", "role", "messageID", "ts"];
  for (const field of requiredFields) {
    if (!message[field]) {
      console.warn(`[MessageUtils] Message missing required field: ${field}`);
      return false;
    }
  }

  // Validate role
  if (!["user", "assistant"].includes(message.role)) {
    console.warn(`[MessageUtils] Invalid message role: ${message.role}`);
    return false;
  }

  return true;
}

/**
 * Extracts conversation-relevant data from a message
 * @param {Object} message - The message object
 * @param {Object} origin - The origin information
 * @param {Object} user - The user object
 * @returns {Object} Extracted conversation data
 */
export function extractConversationData(message, origin, user) {
  return {
    messageContent: message.content,
    messageRole: message.role,
    messageTimestamp: message.ts,
    channel: origin.channel,
    gatewayUserID: origin.gatewayUserID,
    userNpub: user?.npub || origin.userNpub,
    userName: user?.name || "Unknown User",
  };
}
