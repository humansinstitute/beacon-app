import conversationAgent from "../agents/conversationAgent.js";
import { callEverest } from "../../api/services/everest.service.js";

/**
 * Processes the conversation pipeline by calling the conversation agent and Everest API.
 * @param {Object} jobData - The job data containing the beacon message.
 * @returns {Promise<string>} The response message from Everest API.
 */
export async function processConversationPipeline(jobData) {
  // Extract conversation history if available
  let conversationHistory = [];
  let contextInfo = `The users name is: ${
    jobData.beaconMessage.user?.name || "Unknown"
  }.\n`;

  if (jobData.conversation && jobData.conversation.summaryHistory) {
    // Use conversation history for context, excluding the current message
    const rawHistory = jobData.conversation.summaryHistory.slice(0, -1);

    // Clean the conversation history by removing MongoDB-specific fields
    conversationHistory = rawHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    contextInfo += `This is part of an ongoing conversation with ${conversationHistory.length} previous messages.\n`;
    console.log(
      `[Pipeline] Using conversation history with ${conversationHistory.length} messages`
    );
  } else {
    console.log(
      "[Pipeline] No conversation context available, treating as new conversation"
    );
  }

  const agentData = await conversationAgent(
    jobData.beaconMessage.message.content,
    contextInfo,
    conversationHistory
  );
  agentData.origin = {
    ...agentData.origin,
    ...jobData.beaconMessage.origin,
  };

  const user = jobData.beaconMessage.user;

  // DEBUG: Add comprehensive logging for user object validation
  console.log("[Pipeline] DEBUG - User object validation:", {
    hasJobData: !!jobData,
    hasBeaconMessage: !!jobData?.beaconMessage,
    hasUser: !!user,
    userKeys: user ? Object.keys(user) : null,
    userId: user?._id,
    userNpub: user?.npub,
    userName: user?.name,
    messageOrigin: jobData?.beaconMessage?.origin,
  });

  if (!user) {
    console.error(
      "[Pipeline] ERROR - User object is missing from jobData.beaconMessage.user"
    );
    console.error("[Pipeline] ERROR - This typically happens when:");
    console.error("  1. User lookup failed in the worker");
    console.error("  2. Message is not from WhatsApp channel");
    console.error("  3. User is not registered in the system");
    throw new Error("User object is required for pipeline processing");
  }

  const response = await callEverest(agentData, {
    userID: user._id,
    userNpub: user.npub,
  });
  return response.message;
}
