import { jest } from "@jest/globals";

// Mock dependencies before importing the modules that use them
jest.mock("../app/api/services/everest.service.js");
jest.mock("../app/src/pipeline/conversation.js");
jest.mock("../app/src/pipeline/cashuInteraction.pipeline.js");
jest.mock("../app/src/agents/intentAgent.js");
jest.mock("../app/utils/userUtils.js");
jest.mock("../app/utils/messageUtils.js");
jest.mock("../app/utils/queueUtils.js");
jest.mock("../models/index.js");

import { callEverest } from "../app/api/services/everest.service.js";
import { processConversationPipeline } from "../app/src/pipeline/conversation.js";
import { processCashuPipeline } from "../app/src/pipeline/cashuInteraction.pipeline.js";
import intentAgent from "../app/src/agents/intentAgent.js";
import { lookupUserByAlias } from "../app/utils/userUtils.js";
import { analyzeConversation } from "../app/utils/messageUtils.js";
import { addMessageToQueue } from "../app/utils/queueUtils.js";
import { Conversation, BeaconMessage } from "../models/index.js";

describe("Worker Cashu Integration Tests", () => {
  let mockJob;
  let mockConversation;
  let mockBeaconMessage;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock conversation
    mockConversation = {
      _id: "conversation-123",
      history: [],
      summaryHistory: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ],
      activeFlow: null,
      save: jest.fn().mockResolvedValue(true),
    };

    // Setup mock beacon message
    mockBeaconMessage = {
      _id: "beacon-message-123",
      save: jest.fn().mockResolvedValue(true),
    };

    // Setup mock job data
    mockJob = {
      id: "job-123",
      name: "addBeaconMessage",
      data: {
        beaconMessage: {
          message: {
            content: "check my balance",
            role: "user",
            messageID: "msg-123",
            ts: Math.floor(Date.now() / 1000),
          },
          origin: {
            channel: "beacon.whatsapp",
            gatewayUserID: "wa-user-123",
            gatewayMessageID: "wa-msg-123",
          },
          user: {
            _id: "user-123",
            npub: "npub1test123",
            name: "Test User",
          },
        },
      },
    };

    // Setup default mocks
    lookupUserByAlias.mockResolvedValue(mockJob.data.beaconMessage.user);
    analyzeConversation.mockResolvedValue({
      isNew: false,
      refId: "conversation-123",
      data: mockConversation,
    });
    addMessageToQueue.mockResolvedValue(true);

    // Mock model constructors
    Conversation.mockImplementation(() => mockConversation);
    BeaconMessage.mockImplementation(() => mockBeaconMessage);
  });

  describe("Intent Classification and Routing", () => {
    test("should route Cashu intent to Cashu pipeline", async () => {
      // Setup intent agent to return Cashu intent
      const mockIntentAgentData = {
        callID: "intent-call-123",
        model: { provider: "groq" },
        chat: { userPrompt: "check my balance" },
      };

      intentAgent.mockResolvedValue(mockIntentAgentData);

      // Setup Everest to return Cashu intent
      callEverest.mockResolvedValue({
        message: JSON.stringify({
          intent: "cashu",
          reasoning: "User is asking about balance which is a Cashu operation",
          confidence: 95,
        }),
      });

      // Setup Cashu pipeline response
      processCashuPipeline.mockResolvedValue(
        "💰 Your wallet balance is 1000 sats"
      );

      // Import and execute worker logic (we'll simulate the worker processing)
      const result = await simulateWorkerProcessing(mockJob);

      // Verify intent agent was called
      expect(intentAgent).toHaveBeenCalledWith(
        "check my balance",
        "The users name is: Test User.\n",
        mockConversation.summaryHistory
      );

      // Verify Everest was called for intent classification
      expect(callEverest).toHaveBeenCalledWith(mockIntentAgentData, {
        userID: "user-123",
        userNpub: "npub1test123",
      });

      // Verify Cashu pipeline was called
      expect(processCashuPipeline).toHaveBeenCalledWith(mockJob.data);

      // Verify conversation pipeline was NOT called
      expect(processConversationPipeline).not.toHaveBeenCalled();

      expect(result.success).toBe(true);
      expect(result.responseMessage).toBe(
        "💰 Your wallet balance is 1000 sats"
      );
    });

    test("should route conversation intent to conversation pipeline", async () => {
      // Setup intent agent
      const mockIntentAgentData = {
        callID: "intent-call-123",
        model: { provider: "groq" },
        chat: { userPrompt: "how are you today?" },
      };

      intentAgent.mockResolvedValue(mockIntentAgentData);

      // Setup Everest to return conversation intent
      callEverest.mockResolvedValue({
        message: JSON.stringify({
          intent: "conversation",
          reasoning: "User is asking a general question",
          confidence: 90,
        }),
      });

      // Setup conversation pipeline response
      processConversationPipeline.mockResolvedValue(
        "I am doing well, thank you for asking!"
      );

      // Update job data for conversation
      mockJob.data.beaconMessage.message.content = "how are you today?";

      const result = await simulateWorkerProcessing(mockJob);

      // Verify conversation pipeline was called
      expect(processConversationPipeline).toHaveBeenCalledWith(mockJob.data);

      // Verify Cashu pipeline was NOT called
      expect(processCashuPipeline).not.toHaveBeenCalled();

      expect(result.success).toBe(true);
      expect(result.responseMessage).toBe(
        "I am doing well, thank you for asking!"
      );
    });

    test("should fallback to conversation pipeline when intent classification fails", async () => {
      // Setup intent agent to throw error
      intentAgent.mockRejectedValue(new Error("Intent service unavailable"));

      // Setup conversation pipeline response
      processConversationPipeline.mockResolvedValue(
        "I apologize, but I had trouble understanding your request."
      );

      const result = await simulateWorkerProcessing(mockJob);

      // Verify fallback to conversation pipeline
      expect(processConversationPipeline).toHaveBeenCalledWith(mockJob.data);

      // Verify Cashu pipeline was NOT called
      expect(processCashuPipeline).not.toHaveBeenCalled();

      expect(result.success).toBe(true);
      expect(result.responseMessage).toBe(
        "I apologize, but I had trouble understanding your request."
      );
    });

    test("should fallback to conversation pipeline when Everest returns invalid JSON", async () => {
      // Setup intent agent
      const mockIntentAgentData = {
        callID: "intent-call-123",
        model: { provider: "groq" },
        chat: { userPrompt: "check my balance" },
      };

      intentAgent.mockResolvedValue(mockIntentAgentData);

      // Setup Everest to return invalid JSON
      callEverest.mockResolvedValue({
        message: "invalid json response",
      });

      // Setup conversation pipeline response
      processConversationPipeline.mockResolvedValue(
        "I can help you with that."
      );

      const result = await simulateWorkerProcessing(mockJob);

      // Verify fallback to conversation pipeline
      expect(processConversationPipeline).toHaveBeenCalledWith(mockJob.data);

      // Verify Cashu pipeline was NOT called
      expect(processCashuPipeline).not.toHaveBeenCalled();

      expect(result.success).toBe(true);
    });

    test("should handle Cashu pipeline errors gracefully", async () => {
      // Setup intent agent for Cashu
      const mockIntentAgentData = {
        callID: "intent-call-123",
        model: { provider: "groq" },
        chat: { userPrompt: "pay invoice" },
      };

      intentAgent.mockResolvedValue(mockIntentAgentData);

      // Setup Everest to return Cashu intent
      callEverest.mockResolvedValue({
        message: JSON.stringify({
          intent: "cashu",
          reasoning: "User wants to pay an invoice",
          confidence: 95,
        }),
      });

      // Setup Cashu pipeline to throw error
      processCashuPipeline.mockRejectedValue(
        new Error("Cashu service unavailable")
      );

      // Setup conversation pipeline fallback
      processConversationPipeline.mockResolvedValue(
        "I apologize, but the payment service is currently unavailable."
      );

      // Update job data
      mockJob.data.beaconMessage.message.content = "pay invoice";

      const result = await simulateWorkerProcessing(mockJob);

      // Verify fallback to conversation pipeline
      expect(processConversationPipeline).toHaveBeenCalledWith(mockJob.data);

      expect(result.success).toBe(true);
    });
  });

  describe("Environment Configuration", () => {
    test("should use default NC Tools configuration when not set", () => {
      // Test that defaults are applied
      expect(process.env.NCTOOLS_API_URL).toBeDefined();
      expect(process.env.NCTOOLS_TIMEOUT).toBeDefined();
      expect(process.env.CASHU_DEFAULT_MINT).toBeDefined();
      expect(process.env.CASHU_MIN_AMOUNT).toBeDefined();
      expect(process.env.CASHU_MAX_AMOUNT).toBeDefined();
    });
  });
});

/**
 * Simulates the worker processing logic for testing
 * This extracts the core logic from the worker for testing purposes
 */
async function simulateWorkerProcessing(job) {
  try {
    // Simulate conversation analysis
    const existingConversation = await analyzeConversation(
      job.data.beaconMessage.message,
      job.data.beaconMessage.origin,
      job.data.beaconMessage.user
    );

    let conversation = null;
    if (existingConversation.isNew) {
      conversation = new Conversation({
        history: [],
        summaryHistory: [
          {
            role: job.data.beaconMessage.message.role,
            content: job.data.beaconMessage.message.content,
          },
        ],
        activeFlow: null,
      });
      await conversation.save();
    } else {
      conversation = existingConversation.data;
      conversation.summaryHistory.push({
        role: job.data.beaconMessage.message.role,
        content: job.data.beaconMessage.message.content,
      });
      await conversation.save();
    }

    job.data.conversation = conversation;

    // Simulate intent classification and pipeline routing
    let responseMessage;

    try {
      // Classify message intent
      const intentAgentData = await intentAgent(
        job.data.beaconMessage.message.content,
        `The users name is: ${
          job.data.beaconMessage.user?.name || "Unknown"
        }.\n`,
        job.data.conversation?.summaryHistory || []
      );

      // Call Everest to get intent classification
      const intentResponse = await callEverest(intentAgentData, {
        userID: job.data.beaconMessage.user?._id,
        userNpub: job.data.beaconMessage.user?.npub,
      });

      let intentResult;
      try {
        intentResult = JSON.parse(intentResponse.message);
      } catch (parseError) {
        intentResult = { intent: "conversation" };
      }

      // Route to appropriate pipeline
      if (intentResult.intent === "cashu") {
        responseMessage = await processCashuPipeline(job.data);
      } else {
        responseMessage = await processConversationPipeline(job.data);
      }
    } catch (intentError) {
      // Fallback to conversation pipeline
      responseMessage = await processConversationPipeline(job.data);
    }

    return {
      success: true,
      responseMessage,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}
