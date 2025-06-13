// tests/conversationTracking.test.js
import { analyzeConversation } from "../app/utils/messageUtils.js";
import { processConversationPipeline } from "../app/src/pipeline/conversation.js";
import { Conversation, BeaconMessage } from "../models/index.js";
import conversationAgent from "../app/src/agents/conversationAgent.js";
import { callEverest } from "../app/api/services/everest.service.js";

// Mock external dependencies
jest.mock("../app/src/agents/conversationAgent.js");
jest.mock("../app/api/services/everest.service.js");
jest.mock("../models/index.js");

describe("Conversation Tracking Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should create new conversation and track message flow", async () => {
    // Mock data
    const mockMessage = {
      content: "Hey what can you do?",
      role: "user",
      messageID: "msg123",
      ts: 1672531200,
    };

    const mockOrigin = {
      channel: "beacon.whatsapp",
      gatewayUserID: "user123",
      gatewayMessageID: "gw_msg123",
      gatewayNpub: "npub123",
      userNpub: "npub456",
    };

    const mockUser = {
      _id: "user_id_123",
      name: "Test User",
      npub: "npub456",
    };

    const mockJobData = {
      beaconMessage: {
        message: mockMessage,
        origin: mockOrigin,
        user: mockUser,
      },
    };

    // Mock conversation creation
    const mockConversation = {
      _id: "conversation_id_123",
      history: [],
      summaryHistory: [{ role: "user", content: "Hey what can you do?" }],
      activeFlow: null,
      save: jest.fn().mockResolvedValue(true),
    };

    const mockBeaconMessage = {
      _id: "beacon_msg_123",
      save: jest.fn().mockResolvedValue(true),
    };

    // Setup mocks
    Conversation.mockImplementation(() => mockConversation);
    BeaconMessage.mockImplementation(() => mockBeaconMessage);
    conversationAgent.mockResolvedValue({
      response: "I'm the Beacon, I can help you!",
      origin: {},
    });
    callEverest.mockResolvedValue({
      message: "I'm the Beacon, I can help you with various tasks!",
    });

    // Test conversation analysis
    const existingConversation = analyzeConversation(
      mockMessage,
      mockOrigin,
      mockUser
    );
    expect(existingConversation).toEqual({
      isNew: true,
      refId: null,
      data: null,
    });

    // Test conversation creation (simulating worker logic)
    expect(existingConversation.isNew).toBe(true);

    const conversation = new Conversation({
      history: [],
      summaryHistory: [
        {
          role: mockMessage.role,
          content: mockMessage.content,
        },
      ],
      activeFlow: null,
    });

    await conversation.save();
    expect(conversation.save).toHaveBeenCalled();

    // Add conversation to job data
    mockJobData.conversation = conversation;

    // Test pipeline processing with conversation context
    const responseMessage = await processConversationPipeline(mockJobData);
    expect(responseMessage).toBe(
      "I'm the Beacon, I can help you with various tasks!"
    );

    // Verify conversation agent was called with correct parameters
    expect(conversationAgent).toHaveBeenCalledWith(
      "Hey what can you do?",
      expect.stringContaining("The users name is: Test User"),
      [] // Empty history since this is a new conversation
    );

    // Test BeaconMessage creation (simulating worker logic)
    const beaconMessage = new BeaconMessage({
      message: mockMessage,
      response: {
        content: responseMessage,
        role: "assistant",
        messageID: `response_${mockMessage.messageID}`,
        replyTo: mockMessage.messageID,
        ts: expect.any(Number),
      },
      origin: mockOrigin,
      conversationRef: conversation._id,
      flowRef: null,
    });

    await beaconMessage.save();
    expect(beaconMessage.save).toHaveBeenCalled();

    // Verify BeaconMessage was created with correct structure
    expect(BeaconMessage).toHaveBeenCalledWith({
      message: mockMessage,
      response: {
        content: responseMessage,
        role: "assistant",
        messageID: `response_${mockMessage.messageID}`,
        replyTo: mockMessage.messageID,
        ts: expect.any(Number),
      },
      origin: mockOrigin,
      conversationRef: conversation._id,
      flowRef: null,
    });
  });

  test("should handle conversation with existing history", async () => {
    const mockJobData = {
      beaconMessage: {
        message: {
          content: "What else can you do?",
          role: "user",
          messageID: "msg456",
          ts: 1672531300,
        },
        origin: { channel: "beacon.whatsapp" },
        user: { _id: "user123", name: "Test User", npub: "npub456" },
      },
      conversation: {
        summaryHistory: [
          { role: "user", content: "Hey what can you do?" },
          { role: "assistant", content: "I can help with various tasks!" },
          { role: "user", content: "What else can you do?" },
        ],
      },
    };

    conversationAgent.mockResolvedValue({
      response: "I can also help with research!",
      origin: {},
    });
    callEverest.mockResolvedValue({
      message: "I can also help with research and analysis!",
    });

    const responseMessage = await processConversationPipeline(mockJobData);
    expect(responseMessage).toBe("I can also help with research and analysis!");

    // Verify conversation agent was called with conversation history (excluding current message)
    expect(conversationAgent).toHaveBeenCalledWith(
      "What else can you do?",
      expect.stringContaining(
        "This is part of an ongoing conversation with 2 previous messages"
      ),
      [
        { role: "user", content: "Hey what can you do?" },
        { role: "assistant", content: "I can help with various tasks!" },
      ]
    );
  });

  test("should handle missing user gracefully", async () => {
    const mockJobData = {
      beaconMessage: {
        message: {
          content: "Hello",
          role: "user",
          messageID: "msg789",
          ts: 1672531400,
        },
        origin: { channel: "beacon.whatsapp" },
        user: null,
      },
    };

    await expect(processConversationPipeline(mockJobData)).rejects.toThrow(
      "User object is required for pipeline processing"
    );
  });
});
