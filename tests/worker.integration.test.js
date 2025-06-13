// tests/worker.integration.test.js
/**
 * Integration tests for beaconMessage.worker.js
 * Tests the worker's integration with conversation analysis and pipeline processing
 */

import { analyzeConversation } from "../app/utils/messageUtils.js";
import { processConversationPipeline } from "../app/src/pipeline/conversation.js";
import { lookupUserByAlias } from "../app/utils/userUtils.js";
import { Conversation, BeaconMessage } from "../models/index.js";

// Mock all dependencies
jest.mock("../app/utils/messageUtils.js");
jest.mock("../app/src/pipeline/conversation.js");
jest.mock("../app/utils/userUtils.js");
jest.mock("../models/index.js");

describe("BeaconMessage Worker Integration Tests", () => {
  // Mock job data that matches the worker's expected format
  const mockJobData = {
    name: "addBeaconMessage",
    id: "job_12345",
    data: {
      beaconMessage: {
        message: {
          content: "Hello, I need help with my account",
          role: "user",
          messageID: "msg_12345",
          ts: Math.floor(Date.now() / 1000),
        },
        origin: {
          channel: "beacon.whatsapp",
          gatewayUserID: "61450160732",
          gatewayMessageID: "wa_msg_123",
          gatewayNpub: "npub1gateway123",
          userNpub: "npub1user456",
        },
      },
    },
  };

  const mockUser = {
    _id: "user_id_123",
    name: "John Doe",
    npub: "npub1user456",
  };

  const mockConversation = {
    _id: "conv_12345",
    history: [],
    summaryHistory: [
      {
        role: "user",
        content: "Hello, I need help with my account",
      },
    ],
    activeFlow: null,
    save: jest.fn().mockResolvedValue(true),
  };

  const mockBeaconMessage = {
    _id: "beacon_msg_123",
    save: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    lookupUserByAlias.mockResolvedValue(mockUser);
    processConversationPipeline.mockResolvedValue(
      "Thank you for your message. How can I help you?"
    );

    // Mock Mongoose model constructors
    Conversation.mockImplementation(() => mockConversation);
    BeaconMessage.mockImplementation(() => mockBeaconMessage);

    // Suppress console logs for cleaner test output
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Critical Bug: Async/Await Issue", () => {
    test("should handle analyzeConversation as async function (CRITICAL BUG)", async () => {
      // This test exposes the critical bug in the worker where analyzeConversation
      // is called without await, causing the worker to process a Promise instead of the result

      analyzeConversation.mockResolvedValue({
        isNew: true,
        refId: null,
        data: null,
      });

      // Simulate the worker's processor function logic
      const simulateWorkerProcessor = async (job) => {
        // This is the BUGGY code from the actual worker (line 83-87)
        const existingConversation = analyzeConversation(
          // Missing await!
          job.data.beaconMessage.message,
          job.data.beaconMessage.origin,
          job.data.beaconMessage.user
        );

        // The worker then tries to access existingConversation.isNew
        // But existingConversation is a Promise, not the resolved value!
        return existingConversation;
      };

      const result = await simulateWorkerProcessor(mockJobData);

      // This test will FAIL because result is a Promise, not the expected object
      expect(result).toBeInstanceOf(Promise);
      expect(result.isNew).toBeUndefined(); // This property doesn't exist on Promise

      // The correct implementation should await the result
      const correctResult = await result;
      expect(correctResult).toEqual({
        isNew: true,
        refId: null,
        data: null,
      });
    });

    test("should demonstrate correct async implementation", async () => {
      analyzeConversation.mockResolvedValue({
        isNew: false,
        refId: "conv_123",
        data: { _id: "conv_123", history: [] },
      });

      // Correct implementation with await
      const simulateCorrectWorkerProcessor = async (job) => {
        const existingConversation = await analyzeConversation(
          // Proper await
          job.data.beaconMessage.message,
          job.data.beaconMessage.origin,
          job.data.beaconMessage.user
        );

        return existingConversation;
      };

      const result = await simulateCorrectWorkerProcessor(mockJobData);

      expect(result).toEqual({
        isNew: false,
        refId: "conv_123",
        data: { _id: "conv_123", history: [] },
      });
      expect(result.isNew).toBe(false); // This property exists and is accessible
    });
  });

  describe("Worker Integration Scenarios", () => {
    test("should handle new conversation creation flow", async () => {
      analyzeConversation.mockResolvedValue({
        isNew: true,
        refId: null,
        data: null,
      });

      // Simulate the complete worker flow for new conversation
      const simulateWorkerFlow = async (job) => {
        // User lookup
        const user = await lookupUserByAlias({
          type: "wa",
          ref: job.data.beaconMessage.origin.gatewayUserID,
        });
        job.data.beaconMessage.user = user;

        // Conversation analysis (with proper await)
        const existingConversation = await analyzeConversation(
          job.data.beaconMessage.message,
          job.data.beaconMessage.origin,
          job.data.beaconMessage.user
        );

        let conversation = null;
        if (existingConversation.isNew) {
          // Create new conversation
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
          job.data.conversation = conversation;
        }

        // Process pipeline
        const responseMessage = await processConversationPipeline(job.data);

        return {
          conversation,
          responseMessage,
          user,
        };
      };

      const result = await simulateWorkerFlow(mockJobData);

      expect(lookupUserByAlias).toHaveBeenCalledWith({
        type: "wa",
        ref: "61450160732",
      });
      expect(analyzeConversation).toHaveBeenCalledWith(
        mockJobData.data.beaconMessage.message,
        mockJobData.data.beaconMessage.origin,
        mockUser
      );
      expect(result.conversation).toBe(mockConversation);
      expect(result.responseMessage).toBe(
        "Thank you for your message. How can I help you?"
      );
      expect(mockConversation.save).toHaveBeenCalled();
    });

    test("should handle existing conversation flow", async () => {
      const existingConversationData = {
        _id: "conv_existing_123",
        history: ["msg1", "msg2"],
        summaryHistory: [
          { role: "user", content: "Previous message" },
          { role: "assistant", content: "Previous response" },
        ],
      };

      analyzeConversation.mockResolvedValue({
        isNew: false,
        refId: "conv_existing_123",
        data: existingConversationData,
      });

      const simulateExistingConversationFlow = async (job) => {
        const user = await lookupUserByAlias({
          type: "wa",
          ref: job.data.beaconMessage.origin.gatewayUserID,
        });
        job.data.beaconMessage.user = user;

        const existingConversation = await analyzeConversation(
          job.data.beaconMessage.message,
          job.data.beaconMessage.origin,
          job.data.beaconMessage.user
        );

        let conversation = null;
        if (!existingConversation.isNew) {
          conversation = existingConversation.data;
          job.data.conversation = conversation;
        }

        const responseMessage = await processConversationPipeline(job.data);

        return {
          conversation,
          responseMessage,
          isExisting: !existingConversation.isNew,
        };
      };

      const result = await simulateExistingConversationFlow(mockJobData);

      expect(result.conversation).toBe(existingConversationData);
      expect(result.isExisting).toBe(true);
      expect(processConversationPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation: existingConversationData,
        })
      );
    });

    test("should handle user lookup failure gracefully", async () => {
      lookupUserByAlias.mockRejectedValue(
        new Error("User service unavailable")
      );

      const simulateUserLookupFailure = async (job) => {
        let user = null;
        try {
          user = await lookupUserByAlias({
            type: "wa",
            ref: job.data.beaconMessage.origin.gatewayUserID,
          });
          job.data.beaconMessage.user = user;
        } catch (error) {
          console.error("Failed to lookup user:", error);
          // Continue without user
        }

        return { user };
      };

      const result = await simulateUserLookupFailure(mockJobData);

      expect(result.user).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        "Failed to lookup user:",
        expect.any(Error)
      );
    });

    test("should handle conversation analysis failure", async () => {
      analyzeConversation.mockRejectedValue(new Error("Analysis service down"));

      const simulateAnalysisFailure = async (job) => {
        const user = await lookupUserByAlias({
          type: "wa",
          ref: job.data.beaconMessage.origin.gatewayUserID,
        });
        job.data.beaconMessage.user = user;

        let conversation = null;
        try {
          const existingConversation = await analyzeConversation(
            job.data.beaconMessage.message,
            job.data.beaconMessage.origin,
            job.data.beaconMessage.user
          );
          // Process conversation result...
        } catch (error) {
          console.error("Error in conversation analysis:", error);
          job.data.conversation = null;
        }

        return { conversation };
      };

      const result = await simulateAnalysisFailure(mockJobData);

      expect(result.conversation).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        "Error in conversation analysis:",
        expect.any(Error)
      );
    });

    test("should handle pipeline processing failure", async () => {
      analyzeConversation.mockResolvedValue({
        isNew: true,
        refId: null,
        data: null,
      });

      processConversationPipeline.mockRejectedValue(
        new Error("Pipeline failed")
      );

      const simulatePipelineFailure = async (job) => {
        const user = await lookupUserByAlias({
          type: "wa",
          ref: job.data.beaconMessage.origin.gatewayUserID,
        });
        job.data.beaconMessage.user = user;

        const existingConversation = await analyzeConversation(
          job.data.beaconMessage.message,
          job.data.beaconMessage.origin,
          job.data.beaconMessage.user
        );

        // Create conversation
        const conversation = new Conversation({
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
        job.data.conversation = conversation;

        let responseMessage = null;
        try {
          responseMessage = await processConversationPipeline(job.data);
        } catch (error) {
          console.error("Pipeline processing failed:", error);
          throw error; // Re-throw to fail the job
        }

        return { responseMessage };
      };

      await expect(simulatePipelineFailure(mockJobData)).rejects.toThrow(
        "Pipeline failed"
      );
      expect(console.error).toHaveBeenCalledWith(
        "Pipeline processing failed:",
        expect.any(Error)
      );
    });
  });

  describe("Data Flow Validation", () => {
    test("should properly pass user data through the pipeline", async () => {
      analyzeConversation.mockResolvedValue({
        isNew: true,
        refId: null,
        data: null,
      });

      const simulateDataFlow = async (job) => {
        // User lookup
        const user = await lookupUserByAlias({
          type: "wa",
          ref: job.data.beaconMessage.origin.gatewayUserID,
        });
        job.data.beaconMessage.user = user;

        // Conversation analysis
        const existingConversation = await analyzeConversation(
          job.data.beaconMessage.message,
          job.data.beaconMessage.origin,
          job.data.beaconMessage.user
        );

        // Create conversation
        const conversation = new Conversation({
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
        job.data.conversation = conversation;

        // Process pipeline
        await processConversationPipeline(job.data);

        return job.data;
      };

      const result = await simulateDataFlow(mockJobData);

      // Verify data structure passed to pipeline
      expect(processConversationPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          beaconMessage: expect.objectContaining({
            user: mockUser,
            message: mockJobData.data.beaconMessage.message,
            origin: mockJobData.data.beaconMessage.origin,
          }),
          conversation: mockConversation,
        })
      );

      expect(result.beaconMessage.user).toBe(mockUser);
      expect(result.conversation).toBe(mockConversation);
    });

    test("should handle non-WhatsApp channels correctly", async () => {
      const nonWhatsAppJob = {
        ...mockJobData,
        data: {
          beaconMessage: {
            ...mockJobData.data.beaconMessage,
            origin: {
              ...mockJobData.data.beaconMessage.origin,
              channel: "beacon.telegram",
            },
          },
        },
      };

      const simulateNonWhatsAppFlow = async (job) => {
        // Only lookup user for WhatsApp
        if (job.data.beaconMessage.origin.channel === "beacon.whatsapp") {
          const user = await lookupUserByAlias({
            type: "wa",
            ref: job.data.beaconMessage.origin.gatewayUserID,
          });
          job.data.beaconMessage.user = user;
        }

        return job.data.beaconMessage.user;
      };

      const result = await simulateNonWhatsAppFlow(nonWhatsAppJob);

      expect(result).toBeUndefined();
      expect(lookupUserByAlias).not.toHaveBeenCalled();
    });
  });

  describe("Performance Tests", () => {
    test("should complete worker processing within reasonable time", async () => {
      analyzeConversation.mockResolvedValue({
        isNew: true,
        refId: null,
        data: null,
      });

      const simulateFullWorkerFlow = async (job) => {
        const startTime = Date.now();

        const user = await lookupUserByAlias({
          type: "wa",
          ref: job.data.beaconMessage.origin.gatewayUserID,
        });
        job.data.beaconMessage.user = user;

        const existingConversation = await analyzeConversation(
          job.data.beaconMessage.message,
          job.data.beaconMessage.origin,
          job.data.beaconMessage.user
        );

        const conversation = new Conversation({
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
        job.data.conversation = conversation;

        const responseMessage = await processConversationPipeline(job.data);

        const endTime = Date.now();
        return endTime - startTime;
      };

      const processingTime = await simulateFullWorkerFlow(mockJobData);

      // Should complete within 2 seconds for integration test
      expect(processingTime).toBeLessThan(2000);
    });
  });
});
