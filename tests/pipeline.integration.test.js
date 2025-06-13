// tests/pipeline.integration.test.js
/**
 * Integration tests for conversation pipeline
 * Tests the pipeline's integration with conversation analysis results
 */

import { processConversationPipeline } from "../app/src/pipeline/conversation.js";
import conversationAgent from "../app/src/agents/conversationAgent.js";
import { callEverest } from "../app/api/services/everest.service.js";

// Mock dependencies
jest.mock("../app/src/agents/conversationAgent.js");
jest.mock("../app/api/services/everest.service.js");

describe("Conversation Pipeline Integration Tests", () => {
  const mockUser = {
    _id: "user_id_123",
    name: "John Doe",
    npub: "npub1user456",
  };

  const mockMessage = {
    content: "Hello, I need help with my account",
    role: "user",
    messageID: "msg_12345",
    ts: Math.floor(Date.now() / 1000),
  };

  const mockOrigin = {
    channel: "beacon.whatsapp",
    gatewayUserID: "61450160732",
    gatewayMessageID: "wa_msg_123",
    userNpub: "npub1user456",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    conversationAgent.mockResolvedValue({
      analysis: "user_inquiry",
      intent: "account_help",
      confidence: 0.9,
    });

    callEverest.mockResolvedValue({
      message:
        "Thank you for your message. I can help you with your account. What specific issue are you experiencing?",
    });

    // Suppress console logs
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("New Conversation Pipeline", () => {
    test("should process new conversation without history", async () => {
      const jobData = {
        beaconMessage: {
          message: mockMessage,
          origin: mockOrigin,
          user: mockUser,
        },
        conversation: null, // No conversation context
      };

      const result = await processConversationPipeline(jobData);

      expect(conversationAgent).toHaveBeenCalledWith(
        mockMessage.content,
        "The users name is: John Doe.\nNo conversation context available, treating as new conversation",
        []
      );

      expect(callEverest).toHaveBeenCalledWith(
        expect.objectContaining({
          analysis: "user_inquiry",
          intent: "account_help",
          confidence: 0.9,
          origin: expect.objectContaining({
            channel: "beacon.whatsapp",
            gatewayUserID: "61450160732",
            userNpub: "npub1user456",
          }),
        }),
        {
          userID: "user_id_123",
          userNpub: "npub1user456",
        }
      );

      expect(result).toBe(
        "Thank you for your message. I can help you with your account. What specific issue are you experiencing?"
      );
    });

    test("should handle missing user gracefully", async () => {
      const jobData = {
        beaconMessage: {
          message: mockMessage,
          origin: mockOrigin,
          user: null, // No user
        },
        conversation: null,
      };

      await expect(processConversationPipeline(jobData)).rejects.toThrow(
        "User object is required for pipeline processing"
      );

      expect(conversationAgent).not.toHaveBeenCalled();
      expect(callEverest).not.toHaveBeenCalled();
    });
  });

  describe("Existing Conversation Pipeline", () => {
    test("should process conversation with history", async () => {
      const mockConversation = {
        _id: "conv_123",
        summaryHistory: [
          { role: "user", content: "Hello, I need help" },
          { role: "assistant", content: "How can I assist you?" },
          { role: "user", content: "I have an account issue" }, // Current message
        ],
        history: ["msg1", "msg2", "msg3"],
      };

      const jobData = {
        beaconMessage: {
          message: mockMessage,
          origin: mockOrigin,
          user: mockUser,
        },
        conversation: mockConversation,
      };

      const result = await processConversationPipeline(jobData);

      // Should exclude the current message from history (slice(0, -1))
      const expectedHistory = [
        { role: "user", content: "Hello, I need help" },
        { role: "assistant", content: "How can I assist you?" },
      ];

      expect(conversationAgent).toHaveBeenCalledWith(
        mockMessage.content,
        "The users name is: John Doe.\nThis is part of an ongoing conversation with 2 previous messages.\n",
        expectedHistory
      );

      expect(callEverest).toHaveBeenCalledWith(
        expect.objectContaining({
          analysis: "user_inquiry",
          origin: expect.objectContaining({
            channel: "beacon.whatsapp",
            userNpub: "npub1user456",
          }),
        }),
        {
          userID: "user_id_123",
          userNpub: "npub1user456",
        }
      );

      expect(result).toBe(
        "Thank you for your message. I can help you with your account. What specific issue are you experiencing?"
      );
    });

    test("should handle conversation with empty history", async () => {
      const mockConversation = {
        _id: "conv_123",
        summaryHistory: [
          { role: "user", content: "Current message" }, // Only current message
        ],
        history: ["msg1"],
      };

      const jobData = {
        beaconMessage: {
          message: mockMessage,
          origin: mockOrigin,
          user: mockUser,
        },
        conversation: mockConversation,
      };

      const result = await processConversationPipeline(jobData);

      // Should have empty history after excluding current message
      expect(conversationAgent).toHaveBeenCalledWith(
        mockMessage.content,
        "The users name is: John Doe.\nThis is part of an ongoing conversation with 0 previous messages.\n",
        []
      );

      expect(result).toBe(
        "Thank you for your message. I can help you with your account. What specific issue are you experiencing?"
      );
    });

    test("should handle conversation without summaryHistory", async () => {
      const mockConversation = {
        _id: "conv_123",
        summaryHistory: null, // No summary history
        history: ["msg1"],
      };

      const jobData = {
        beaconMessage: {
          message: mockMessage,
          origin: mockOrigin,
          user: mockUser,
        },
        conversation: mockConversation,
      };

      const result = await processConversationPipeline(jobData);

      expect(conversationAgent).toHaveBeenCalledWith(
        mockMessage.content,
        "The users name is: John Doe.\nNo conversation context available, treating as new conversation",
        []
      );

      expect(result).toBe(
        "Thank you for your message. I can help you with your account. What specific issue are you experiencing?"
      );
    });
  });

  describe("Error Handling", () => {
    test("should handle conversation agent failure", async () => {
      conversationAgent.mockRejectedValue(
        new Error("Agent service unavailable")
      );

      const jobData = {
        beaconMessage: {
          message: mockMessage,
          origin: mockOrigin,
          user: mockUser,
        },
        conversation: null,
      };

      await expect(processConversationPipeline(jobData)).rejects.toThrow(
        "Agent service unavailable"
      );

      expect(callEverest).not.toHaveBeenCalled();
    });

    test("should handle Everest service failure", async () => {
      callEverest.mockRejectedValue(new Error("Everest API unavailable"));

      const jobData = {
        beaconMessage: {
          message: mockMessage,
          origin: mockOrigin,
          user: mockUser,
        },
        conversation: null,
      };

      await expect(processConversationPipeline(jobData)).rejects.toThrow(
        "Everest API unavailable"
      );

      expect(conversationAgent).toHaveBeenCalled();
    });

    test("should handle user with missing name", async () => {
      const userWithoutName = {
        _id: "user_id_123",
        npub: "npub1user456",
        // name is missing
      };

      const jobData = {
        beaconMessage: {
          message: mockMessage,
          origin: mockOrigin,
          user: userWithoutName,
        },
        conversation: null,
      };

      const result = await processConversationPipeline(jobData);

      expect(conversationAgent).toHaveBeenCalledWith(
        mockMessage.content,
        "The users name is: Unknown.\nNo conversation context available, treating as new conversation",
        []
      );

      expect(result).toBe(
        "Thank you for your message. I can help you with your account. What specific issue are you experiencing?"
      );
    });

    test("should handle malformed conversation data", async () => {
      const malformedConversation = {
        _id: "conv_123",
        // summaryHistory is undefined, not null or array
        history: ["msg1"],
      };

      const jobData = {
        beaconMessage: {
          message: mockMessage,
          origin: mockOrigin,
          user: mockUser,
        },
        conversation: malformedConversation,
      };

      const result = await processConversationPipeline(jobData);

      // Should treat as new conversation when summaryHistory is undefined
      expect(conversationAgent).toHaveBeenCalledWith(
        mockMessage.content,
        "The users name is: John Doe.\nNo conversation context available, treating as new conversation",
        []
      );

      expect(result).toBe(
        "Thank you for your message. I can help you with your account. What specific issue are you experiencing?"
      );
    });
  });

  describe("Data Flow Integration", () => {
    test("should properly merge origin data", async () => {
      const agentData = {
        analysis: "test_analysis",
        origin: {
          agentChannel: "internal",
          agentId: "agent_123",
        },
      };

      conversationAgent.mockResolvedValue(agentData);

      const jobData = {
        beaconMessage: {
          message: mockMessage,
          origin: mockOrigin,
          user: mockUser,
        },
        conversation: null,
      };

      await processConversationPipeline(jobData);

      expect(callEverest).toHaveBeenCalledWith(
        expect.objectContaining({
          analysis: "test_analysis",
          origin: expect.objectContaining({
            // Should contain both agent and beacon message origin data
            agentChannel: "internal",
            agentId: "agent_123",
            channel: "beacon.whatsapp",
            gatewayUserID: "61450160732",
            userNpub: "npub1user456",
          }),
        }),
        {
          userID: "user_id_123",
          userNpub: "npub1user456",
        }
      );
    });

    test("should handle agent data without origin", async () => {
      const agentDataWithoutOrigin = {
        analysis: "test_analysis",
        // No origin property
      };

      conversationAgent.mockResolvedValue(agentDataWithoutOrigin);

      const jobData = {
        beaconMessage: {
          message: mockMessage,
          origin: mockOrigin,
          user: mockUser,
        },
        conversation: null,
      };

      await processConversationPipeline(jobData);

      expect(callEverest).toHaveBeenCalledWith(
        expect.objectContaining({
          analysis: "test_analysis",
          origin: mockOrigin, // Should use beacon message origin
        }),
        {
          userID: "user_id_123",
          userNpub: "npub1user456",
        }
      );
    });

    test("should handle complex conversation history", async () => {
      const complexConversation = {
        _id: "conv_complex_123",
        summaryHistory: [
          { role: "user", content: "I need help with billing" },
          {
            role: "assistant",
            content: "I can help with billing. What's the issue?",
          },
          { role: "user", content: "My card was charged twice" },
          { role: "assistant", content: "Let me check your account" },
          { role: "user", content: "Thank you" },
          { role: "assistant", content: "I found the duplicate charge" },
          { role: "user", content: "Can you refund it?" }, // Current message
        ],
        history: ["msg1", "msg2", "msg3", "msg4", "msg5", "msg6", "msg7"],
      };

      const jobData = {
        beaconMessage: {
          message: mockMessage,
          origin: mockOrigin,
          user: mockUser,
        },
        conversation: complexConversation,
      };

      await processConversationPipeline(jobData);

      // Should exclude the last message (current) from history
      const expectedHistory = complexConversation.summaryHistory.slice(0, -1);

      expect(conversationAgent).toHaveBeenCalledWith(
        mockMessage.content,
        "The users name is: John Doe.\nThis is part of an ongoing conversation with 6 previous messages.\n",
        expectedHistory
      );
    });
  });

  describe("Performance Tests", () => {
    test("should complete pipeline processing within reasonable time", async () => {
      const jobData = {
        beaconMessage: {
          message: mockMessage,
          origin: mockOrigin,
          user: mockUser,
        },
        conversation: null,
      };

      const startTime = Date.now();
      await processConversationPipeline(jobData);
      const endTime = Date.now();

      // Should complete within 1 second for integration test
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test("should handle large conversation history efficiently", async () => {
      // Create a conversation with many messages
      const largeHistory = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i + 1}`,
      }));

      const largeConversation = {
        _id: "conv_large_123",
        summaryHistory: [
          ...largeHistory,
          { role: "user", content: "Current message" },
        ],
        history: Array.from({ length: 101 }, (_, i) => `msg${i + 1}`),
      };

      const jobData = {
        beaconMessage: {
          message: mockMessage,
          origin: mockOrigin,
          user: mockUser,
        },
        conversation: largeConversation,
      };

      const startTime = Date.now();
      await processConversationPipeline(jobData);
      const endTime = Date.now();

      // Should still complete within reasonable time even with large history
      expect(endTime - startTime).toBeLessThan(2000);

      // Should pass the full history (excluding current message) to agent
      expect(conversationAgent).toHaveBeenCalledWith(
        mockMessage.content,
        "The users name is: John Doe.\nThis is part of an ongoing conversation with 100 previous messages.\n",
        largeHistory
      );
    });
  });

  describe("Logging and Debug Information", () => {
    test("should log appropriate debug information", async () => {
      const mockConversation = {
        _id: "conv_123",
        summaryHistory: [
          { role: "user", content: "Previous message" },
          { role: "user", content: "Current message" },
        ],
        history: ["msg1", "msg2"],
      };

      const jobData = {
        beaconMessage: {
          message: mockMessage,
          origin: mockOrigin,
          user: mockUser,
        },
        conversation: mockConversation,
      };

      await processConversationPipeline(jobData);

      expect(console.log).toHaveBeenCalledWith(
        "[Pipeline] Using conversation history with 1 messages"
      );
    });

    test("should log when no conversation context is available", async () => {
      const jobData = {
        beaconMessage: {
          message: mockMessage,
          origin: mockOrigin,
          user: mockUser,
        },
        conversation: null,
      };

      await processConversationPipeline(jobData);

      expect(console.log).toHaveBeenCalledWith(
        "[Pipeline] No conversation context available, treating as new conversation"
      );
    });
  });
});
