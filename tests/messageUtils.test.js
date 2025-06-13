// tests/messageUtils.test.js
import {
  analyzeConversation,
  validateMessageForConversation,
  extractConversationData,
} from "../app/utils/messageUtils.js";

describe("MessageUtils", () => {
  describe("analyzeConversation", () => {
    const validMessage = {
      content: "Hey what can you do?",
      role: "user",
      messageID: "msg123",
      ts: 1672531200,
    };

    const validOrigin = {
      channel: "beacon.whatsapp",
      gatewayUserID: "user123",
      gatewayMessageID: "gw_msg123",
      gatewayNpub: "npub123",
      userNpub: "npub456",
    };

    const validUser = {
      _id: "user_id_123",
      name: "Test User",
      npub: "npub456",
    };

    test("should return new conversation response for valid input", async () => {
      const result = await analyzeConversation(
        validMessage,
        validOrigin,
        validUser
      );

      expect(result).toEqual({
        isNew: true,
        refId: null,
        data: null,
      });
    });

    test("should work without user parameter", async () => {
      const result = await analyzeConversation(validMessage, validOrigin);

      expect(result).toEqual({
        isNew: true,
        refId: null,
        data: null,
      });
    });

    test("should handle invalid message parameter", async () => {
      const result = await analyzeConversation(null, validOrigin, validUser);

      expect(result).toEqual({
        isNew: true,
        refId: null,
        data: null,
      });
    });

    test("should handle invalid origin parameter", async () => {
      const result = await analyzeConversation(validMessage, null, validUser);

      expect(result).toEqual({
        isNew: true,
        refId: null,
        data: null,
      });
    });

    test("should handle missing message content gracefully", async () => {
      const messageWithoutContent = {
        role: "user",
        messageID: "msg123",
        ts: 1672531200,
      };

      const result = await analyzeConversation(
        messageWithoutContent,
        validOrigin,
        validUser
      );

      expect(result).toEqual({
        isNew: true,
        refId: null,
        data: null,
      });
    });
  });

  describe("validateMessageForConversation", () => {
    test("should validate correct message structure", () => {
      const validMessage = {
        content: "Test message",
        role: "user",
        messageID: "msg123",
        ts: 1672531200,
      };

      expect(validateMessageForConversation(validMessage)).toBe(true);
    });

    test("should reject null message", () => {
      expect(validateMessageForConversation(null)).toBe(false);
    });

    test("should reject non-object message", () => {
      expect(validateMessageForConversation("string")).toBe(false);
    });

    test("should reject message missing content", () => {
      const invalidMessage = {
        role: "user",
        messageID: "msg123",
        ts: 1672531200,
      };

      expect(validateMessageForConversation(invalidMessage)).toBe(false);
    });

    test("should reject message missing role", () => {
      const invalidMessage = {
        content: "Test message",
        messageID: "msg123",
        ts: 1672531200,
      };

      expect(validateMessageForConversation(invalidMessage)).toBe(false);
    });

    test("should reject message with invalid role", () => {
      const invalidMessage = {
        content: "Test message",
        role: "invalid_role",
        messageID: "msg123",
        ts: 1672531200,
      };

      expect(validateMessageForConversation(invalidMessage)).toBe(false);
    });

    test("should accept agent role", () => {
      const validMessage = {
        content: "Test response",
        role: "assistant",
        messageID: "msg123",
        ts: 1672531200,
      };

      expect(validateMessageForConversation(validMessage)).toBe(true);
    });
  });

  describe("extractConversationData", () => {
    const message = {
      content: "Test message content",
      role: "user",
      messageID: "msg123",
      ts: 1672531200,
    };

    const origin = {
      channel: "beacon.whatsapp",
      gatewayUserID: "user123",
      userNpub: "npub456",
    };

    const user = {
      _id: "user_id_123",
      name: "Test User",
      npub: "npub456",
    };

    test("should extract conversation data with user", () => {
      const result = extractConversationData(message, origin, user);

      expect(result).toEqual({
        messageContent: "Test message content",
        messageRole: "user",
        messageTimestamp: 1672531200,
        channel: "beacon.whatsapp",
        gatewayUserID: "user123",
        userNpub: "npub456",
        userName: "Test User",
      });
    });

    test("should extract conversation data without user", () => {
      const result = extractConversationData(message, origin, null);

      expect(result).toEqual({
        messageContent: "Test message content",
        messageRole: "user",
        messageTimestamp: 1672531200,
        channel: "beacon.whatsapp",
        gatewayUserID: "user123",
        userNpub: "npub456",
        userName: "Unknown User",
      });
    });

    test("should handle missing user npub", () => {
      const userWithoutNpub = {
        _id: "user_id_123",
        name: "Test User",
      };

      const result = extractConversationData(message, origin, userWithoutNpub);

      expect(result.userNpub).toBe("npub456"); // Should fall back to origin.userNpub
    });
  });
});
