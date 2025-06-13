// tests/messageUtils.integration.test.js
/**
 * Integration tests for messageUtils.js conversation analysis functionality
 * Tests end-to-end integration with worker, pipeline, and service components
 */

import { analyzeConversation } from "../app/utils/messageUtils.js";
import * as conversationService from "../app/api/services/conversation.service.js";
import * as everestService from "../app/api/services/everest.service.js";
import conversationAnalyst from "../app/src/agents/converstationAnalysis.js";

// Mock all external dependencies
jest.mock("../app/api/services/conversation.service.js");
jest.mock("../app/api/services/everest.service.js");
jest.mock("../app/src/agents/converstationAnalysis.js");

describe("MessageUtils Integration Tests", () => {
  // Test data fixtures
  const validMessage = {
    content: "Hey, can you help me with my account?",
    role: "user",
    messageID: "msg_12345",
    ts: Math.floor(Date.now() / 1000),
  };

  const validOrigin = {
    channel: "beacon.whatsapp",
    gatewayUserID: "61450160732",
    gatewayMessageID: "wa_msg_123",
    gatewayNpub: "npub1gateway123",
    userNpub: "npub1user456",
  };

  const validUser = {
    _id: "user_id_123",
    name: "John Doe",
    npub: "npub1user456",
  };

  const mockExistingMessages = [
    {
      message: { content: "Hello, I need help", ts: 1672531200 },
      conversationRef: "conv_123",
    },
    {
      message: { content: "What services do you offer?", ts: 1672531300 },
      conversationRef: "conv_123",
    },
  ];

  const mockConversationData = {
    _id: "conv_123",
    history: ["msg1", "msg2"],
    summaryHistory: [
      { role: "user", content: "Hello, I need help" },
      { role: "assistant", content: "How can I assist you?" },
    ],
    activeFlow: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset console methods to avoid test pollution
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("New Conversation Scenarios", () => {
    test("should handle new user with no message history", async () => {
      // Mock no existing messages
      conversationService.getMessagesByNpub.mockResolvedValue([]);

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

      expect(conversationService.getMessagesByNpub).toHaveBeenCalledWith(
        "npub1user456",
        10
      );
      // Should not call agent services for new users
      expect(conversationAnalyst).not.toHaveBeenCalled();
      expect(everestService.callEverest).not.toHaveBeenCalled();
    });

    test("should handle user without npub", async () => {
      const userWithoutNpub = { _id: "user_123", name: "Test User" };
      const originWithoutNpub = { ...validOrigin, userNpub: undefined };

      const result = await analyzeConversation(
        validMessage,
        originWithoutNpub,
        userWithoutNpub
      );

      expect(result).toEqual({
        isNew: true,
        refId: null,
        data: null,
      });

      expect(conversationService.getMessagesByNpub).not.toHaveBeenCalled();
    });

    test("should handle database error gracefully", async () => {
      conversationService.getMessagesByNpub.mockRejectedValue(
        new Error("Database connection failed")
      );

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

      expect(console.error).toHaveBeenCalledWith(
        "[MessageUtils] Error retrieving messages from database:",
        expect.any(Error)
      );
    });
  });

  describe("Existing Conversation Scenarios", () => {
    test("should handle continuation of existing conversation", async () => {
      // Mock existing messages
      conversationService.getMessagesByNpub.mockResolvedValue(
        mockExistingMessages
      );

      // Mock agent analysis indicating existing conversation
      conversationAnalyst.mockResolvedValue({
        analysis: "continuation",
        confidence: 0.9,
      });

      // Mock Everest service response
      everestService.callEverest.mockResolvedValue({
        message: JSON.stringify({
          isNew: false,
          reasoning:
            "User is continuing previous conversation about account help",
          conversationRef: "conv_123",
        }),
      });

      // Mock conversation retrieval
      conversationService.getConversationById.mockResolvedValue(
        mockConversationData
      );

      const result = await analyzeConversation(
        validMessage,
        validOrigin,
        validUser
      );

      expect(result).toEqual({
        isNew: false,
        refId: "conv_123",
        data: mockConversationData,
      });

      // Verify all service calls were made correctly
      expect(conversationService.getMessagesByNpub).toHaveBeenCalledWith(
        "npub1user456",
        10
      );
      expect(conversationAnalyst).toHaveBeenCalledWith(
        validMessage.content,
        [
          {
            message: "Hello, I need help",
            ts: 1672531200,
            conversationRef: "conv_123",
          },
          {
            message: "What services do you offer?",
            ts: 1672531300,
            conversationRef: "conv_123",
          },
        ],
        "npub1user456"
      );
      expect(everestService.callEverest).toHaveBeenCalledWith(
        { analysis: "continuation", confidence: 0.9 },
        { userID: "user_id_123", userNpub: "npub1user456" }
      );
      expect(conversationService.getConversationById).toHaveBeenCalledWith(
        "conv_123"
      );
    });

    test("should handle topic switch scenario", async () => {
      conversationService.getMessagesByNpub.mockResolvedValue(
        mockExistingMessages
      );
      conversationAnalyst.mockResolvedValue({ analysis: "topic_switch" });

      everestService.callEverest.mockResolvedValue({
        message: JSON.stringify({
          isNew: true,
          reasoning: "User switched to completely different topic",
          conversationRef: null,
        }),
      });

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

    test("should handle conversation retrieval failure", async () => {
      conversationService.getMessagesByNpub.mockResolvedValue(
        mockExistingMessages
      );
      conversationAnalyst.mockResolvedValue({ analysis: "continuation" });

      everestService.callEverest.mockResolvedValue({
        message: JSON.stringify({
          isNew: false,
          reasoning: "Continuing conversation",
          conversationRef: "conv_123",
        }),
      });

      // Mock conversation retrieval failure
      conversationService.getConversationById.mockRejectedValue(
        new Error("Conversation not found")
      );

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

      expect(console.error).toHaveBeenCalledWith(
        "[MessageUtils] Failed to retrieve conversation:",
        expect.any(Error)
      );
    });
  });

  describe("Error Handling Scenarios", () => {
    test("should handle invalid npub format", async () => {
      const invalidUser = { ...validUser, npub: "invalid_npub_format" };

      conversationService.getMessagesByNpub.mockResolvedValue([]);

      const result = await analyzeConversation(
        validMessage,
        validOrigin,
        invalidUser
      );

      expect(result).toEqual({
        isNew: true,
        refId: null,
        data: null,
      });
    });

    test("should handle agent service failure", async () => {
      conversationService.getMessagesByNpub.mockResolvedValue(
        mockExistingMessages
      );
      conversationAnalyst.mockRejectedValue(
        new Error("Agent service unavailable")
      );

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

      expect(console.error).toHaveBeenCalledWith(
        "[MessageUtils] Error in agent, Everest service, or response parsing:",
        expect.objectContaining({
          error: "Agent service unavailable",
          userNpub: "npub1user456",
          messageID: "msg_12345",
        })
      );
    });

    test("should handle Everest service failure", async () => {
      conversationService.getMessagesByNpub.mockResolvedValue(
        mockExistingMessages
      );
      conversationAnalyst.mockResolvedValue({ analysis: "test" });
      everestService.callEverest.mockRejectedValue(
        new Error("Everest API down")
      );

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

    test("should handle malformed LLM response", async () => {
      conversationService.getMessagesByNpub.mockResolvedValue(
        mockExistingMessages
      );
      conversationAnalyst.mockResolvedValue({ analysis: "test" });

      // Mock malformed JSON response
      everestService.callEverest.mockResolvedValue({
        message: "This is not valid JSON",
      });

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

      expect(console.error).toHaveBeenCalledWith(
        "[MessageUtils] Failed to parse LLM response:",
        expect.objectContaining({
          error: expect.stringContaining("Unexpected token"),
          rawResponse: "This is not valid JSON",
        })
      );
    });

    test("should handle LLM response missing required fields", async () => {
      conversationService.getMessagesByNpub.mockResolvedValue(
        mockExistingMessages
      );
      conversationAnalyst.mockResolvedValue({ analysis: "test" });

      // Mock response missing required fields
      everestService.callEverest.mockResolvedValue({
        message: JSON.stringify({
          isNew: true,
          // Missing 'reasoning' and 'conversationRef' fields
        }),
      });

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

    test("should handle edge case: isNew false but no conversationRef", async () => {
      conversationService.getMessagesByNpub.mockResolvedValue(
        mockExistingMessages
      );
      conversationAnalyst.mockResolvedValue({ analysis: "test" });

      everestService.callEverest.mockResolvedValue({
        message: JSON.stringify({
          isNew: false,
          reasoning: "Should be existing but no ref provided",
          conversationRef: null,
        }),
      });

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
  });

  describe("Performance and Logging Tests", () => {
    test("should complete analysis within reasonable time", async () => {
      conversationService.getMessagesByNpub.mockResolvedValue([]);

      const startTime = Date.now();
      await analyzeConversation(validMessage, validOrigin, validUser);
      const endTime = Date.now();

      // Should complete within 5 seconds (generous for integration test)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    test("should log appropriate debug information", async () => {
      conversationService.getMessagesByNpub.mockResolvedValue(
        mockExistingMessages
      );
      conversationAnalyst.mockResolvedValue({ analysis: "test" });

      everestService.callEverest.mockResolvedValue({
        message: JSON.stringify({
          isNew: true,
          reasoning: "New conversation",
          conversationRef: null,
        }),
      });

      await analyzeConversation(validMessage, validOrigin, validUser);

      // Verify key log messages were called
      expect(console.log).toHaveBeenCalledWith(
        "[MessageUtils] Analyzing conversation for message:",
        expect.objectContaining({
          messageID: "msg_12345",
          userNpub: "npub1user456",
        })
      );

      expect(console.log).toHaveBeenCalledWith(
        "[MessageUtils] Retrieving last 10 messages for npub:",
        "npub1user456"
      );
    });
  });

  describe("Data Format Validation", () => {
    test("should properly format messages for agent analysis", async () => {
      const complexMessages = [
        {
          message: { content: "First message", ts: 1672531200 },
          conversationRef: "conv_123",
        },
        {
          message: { content: "Second message", ts: 1672531300 },
          conversationRef: "conv_456",
        },
      ];

      conversationService.getMessagesByNpub.mockResolvedValue(complexMessages);
      conversationAnalyst.mockResolvedValue({ analysis: "test" });

      everestService.callEverest.mockResolvedValue({
        message: JSON.stringify({
          isNew: true,
          reasoning: "Test",
          conversationRef: null,
        }),
      });

      await analyzeConversation(validMessage, validOrigin, validUser);

      expect(conversationAnalyst).toHaveBeenCalledWith(
        validMessage.content,
        [
          {
            message: "First message",
            ts: 1672531200,
            conversationRef: "conv_123",
          },
          {
            message: "Second message",
            ts: 1672531300,
            conversationRef: "conv_456",
          },
        ],
        "npub1user456"
      );
    });

    test("should handle messages with missing content", async () => {
      const messagesWithMissingContent = [
        {
          message: { ts: 1672531200 }, // Missing content
          conversationRef: "conv_123",
        },
      ];

      conversationService.getMessagesByNpub.mockResolvedValue(
        messagesWithMissingContent
      );
      conversationAnalyst.mockResolvedValue({ analysis: "test" });

      everestService.callEverest.mockResolvedValue({
        message: JSON.stringify({
          isNew: true,
          reasoning: "Test",
          conversationRef: null,
        }),
      });

      await analyzeConversation(validMessage, validOrigin, validUser);

      expect(conversationAnalyst).toHaveBeenCalledWith(
        validMessage.content,
        [
          {
            message: undefined, // Should handle undefined content
            ts: 1672531200,
            conversationRef: "conv_123",
          },
        ],
        "npub1user456"
      );
    });
  });
});
