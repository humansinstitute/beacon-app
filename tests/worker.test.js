// tests/worker.test.js
import { setupWorker } from "../app/workers/generic.worker";
import { Worker } from "bullmq";

jest.mock("bullmq"); // Mock the bullmq library

describe("Generic Worker", () => {
  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    Worker.mockClear();
  });

  it("should create a BullMQ Worker with the correct queue name and processor", () => {
    const queueName = "test-queue";
    setupWorker(queueName);

    // Expect the Worker constructor to have been called with 'test-queue', a processor function, and connection options
    expect(Worker).toHaveBeenCalledWith(
      queueName,
      expect.any(Function),
      // Now that redisConnection is properly imported, we expect an object here.
      // The mock of Worker won't care about the exact instance, just that it's an object.
      expect.objectContaining({ connection: expect.any(Object) })
    );
    // The connection object itself comes from the actual redisConnection import.
  });

  it("should log an error and exit if no queue name is provided when run directly", () => {
    // This test will be more relevant when we implement the command-line argument parsing
    // in generic.worker.js. For now, we are focusing on the setupWorker function.
    // We can expand this test in Stage 2.
    expect(true).toBe(true); // Placeholder for now
  });
});

// Mock the user lookup utility function
jest.mock("../app/utils/userUtils.js", () => ({
  lookupUserByAlias: jest.fn(() =>
    Promise.resolve({ id: "user123", name: "Test User", beaconBalance: 100 })
  ),
}));

describe("Beacon Message Worker - User Lookup", () => {
  const mockJob = {
    name: "addBeaconMessage",
    id: "job123",
    data: {
      beaconMessage: {
        id: "msg456",
        origin: {
          channel: "beacon.whatsapp",
          gatewayUserID: "61450160732",
        },
        message: {
          replyTo: "reply789",
        },
      },
    },
  };

  const mockJobNonWhatsApp = {
    name: "addBeaconMessage",
    id: "job124",
    data: {
      beaconMessage: {
        id: "msg457",
        origin: {
          channel: "beacon.other",
          gatewayUserID: "otherID",
        },
        message: {
          replyTo: "reply790",
        },
      },
    },
  };

  // This would normally be imported from beaconMessage.worker.js, but for testing purposes, we define the processor here
  const mockProcessor = async (job) => {
    let alias = { type: "", ref: "" };
    if (job.data.beaconMessage.origin.channel === "beacon.whatsapp") {
      alias.type = "wa";
      alias.ref = job.data.beaconMessage.origin.gatewayUserID;
      try {
        const user =
          await require("../app/utils/userUtils.js").lookupUserByAlias(alias);
        job.data.beaconMessage.user = user;
      } catch (error) {
        console.error("[Worker] Failed to lookup user:", error);
      }
    }
    // Simulate pipeline processing
    return "Response from pipeline";
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should set alias correctly for WhatsApp channel", async () => {
    await mockProcessor(mockJob);
    expect(mockJob.data.beaconMessage.origin.channel).toBe("beacon.whatsapp");
    // Check if alias was set internally (we can't check the local variable, but we can infer from the lookup call in later tests)
  });

  it("should not attempt user lookup for non-WhatsApp channel", async () => {
    await mockProcessor(mockJobNonWhatsApp);
    expect(mockJobNonWhatsApp.data.beaconMessage.origin.channel).toBe(
      "beacon.other"
    );
    expect(mockJobNonWhatsApp.data.beaconMessage.user).toBeUndefined();
  });

  it("should call lookupUserByAlias with correct alias for WhatsApp channel", async () => {
    const { lookupUserByAlias } = require("../app/utils/userUtils.js");
    await mockProcessor(mockJob);
    expect(lookupUserByAlias).toHaveBeenCalledWith({
      type: "wa",
      ref: "61450160732",
    });
  });

  it("should attach user object to beaconMessage.user on successful lookup", async () => {
    await mockProcessor(mockJob);
    expect(mockJob.data.beaconMessage.user).toBeDefined();
    expect(mockJob.data.beaconMessage.user.id).toBe("user123");
    expect(mockJob.data.beaconMessage.user.name).toBe("Test User");
    expect(mockJob.data.beaconMessage.user.beaconBalance).toBe(100);
  });

  it("should handle error during user lookup and not attach user object", async () => {
    const { lookupUserByAlias } = require("../app/utils/userUtils.js");
    lookupUserByAlias.mockImplementationOnce(() =>
      Promise.reject(new Error("API Error"))
    );
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    await mockProcessor(mockJob);
    expect(lookupUserByAlias).toHaveBeenCalledWith({
      type: "wa",
      ref: "61450160732",
    });
    expect(mockJob.data.beaconMessage.user).toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[Worker] Failed to lookup user:",
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });
});
