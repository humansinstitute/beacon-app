// app/utils/messageUtils.js
/**
 * Message utility functions for conversation analysis and processing
 */

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
export function analyzeConversation(message, origin, user = null) {
  try {
    // Validate required parameters
    if (!message || typeof message !== "object") {
      throw new Error("Message parameter is required and must be an object");
    }

    if (!origin || typeof origin !== "object") {
      throw new Error("Origin parameter is required and must be an object");
    }

    // Log the analysis for debugging
    console.log("[MessageUtils] Analyzing conversation for message:", {
      messageID: message.messageID,
      content: message.content?.substring(0, 50) + "...",
      channel: origin.channel,
      userID: user?._id || "unknown",
    });

    // For now, always return a new conversation
    // This hardcoded response will be replaced with intelligent analysis later
    const result = {
      isNew: true, // boolean: true = new conversation, false = existing
      refId: null, // string: MongoDB ObjectId of existing conversation (null if isNew = true)
      data: null, // object: conversation object if existing (null if isNew = true)
    };

    console.log("[MessageUtils] Conversation analysis result:", result);
    return result;
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
  if (!["user", "agent"].includes(message.role)) {
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
