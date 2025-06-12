import { processConversationPipeline } from "../app/src/pipeline/conversation.js";
import conversationAgent from "../app/src/agents/conversationAgent.js";
import { callEverest } from "../app/api/services/everest.service.js";

jest.mock("../app/src/agents/conversationAgent.js");
jest.mock("../app/api/services/everest.service.js");

describe("Conversation Pipeline", () => {
  test("should process job data and return response message", async () => {
    const mockJobData = {
      beaconMessage: { message: { content: "Hello" }, origin: {} },
    };
    conversationAgent.mockResolvedValue({ response: "Hi there", origin: {} });
    callEverest.mockResolvedValue({ message: "Hi there from Everest" });
    const result = await processConversationPipeline(mockJobData);
    expect(result).toBe("Hi there from Everest");
  });

  test("should handle errors from conversation agent", async () => {
    const mockJobData = {
      beaconMessage: { message: { content: "Hello" }, origin: {} },
    };
    conversationAgent.mockRejectedValue(new Error("Agent error"));
    await expect(processConversationPipeline(mockJobData)).rejects.toThrow(
      "Agent error"
    );
  });

  test("should handle errors from Everest API", async () => {
    const mockJobData = {
      beaconMessage: { message: { content: "Hello" }, origin: {} },
    };
    conversationAgent.mockResolvedValue({ response: "Hi there", origin: {} });
    callEverest.mockRejectedValue(new Error("Everest API error"));
    await expect(processConversationPipeline(mockJobData)).rejects.toThrow(
      "Everest API error"
    );
  });
});
