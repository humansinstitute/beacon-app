// tests/whatsapp.gateway.test.js
import { jest } from "@jest/globals";
import axios from "axios"; // Actual import, will be mocked by jest.mock
import { v4 as uuidv4 } from "uuid"; // Actual import, will be mocked

// Mock 'axios'
jest.mock("axios");

// Mock 'uuid'
jest.mock("uuid", () => ({
  ...jest.requireActual("uuid"), // Import and retain default exports
  v4: jest.fn(), // Mock only v4
}));

// Module to be tested (will be imported dynamically)
let transformAndQueueMessage;

// Mock Date.now() for consistent timestamps
const MOCK_DATE_NOW = 1700000000000; // Example timestamp
let dateNowSpy;

// Set required environment variables for the test
const MOCK_WA_GATEWAY_NPUB = "npub_mock_value_for_test";
const MOCK_SERVER_URL = "http://localhost";
const MOCK_API_SERVER_PORT = "3256";

describe("WhatsApp Gateway - transformAndQueueMessage", () => {
  beforeAll(async () => {
    process.env.WA_GATEWAY_NPUB = MOCK_WA_GATEWAY_NPUB;
    process.env.SERVER_URL = MOCK_SERVER_URL;
    process.env.API_SERVER_PORT = MOCK_API_SERVER_PORT;
    dateNowSpy = jest.spyOn(global.Date, "now").mockReturnValue(MOCK_DATE_NOW);

    try {
      // Dynamically import the function to ensure mocks are applied.
      // This will fail if the export doesn't exist, which is correct for TDD.
      const module = await import(
        "../app/workers/gateways/whatsapp.gateway.worker.js"
      );
      // Ensure we only assign if the import is successful and the export exists
      if (module && typeof module.transformAndQueueMessage === "function") {
        transformAndQueueMessage = module.transformAndQueueMessage;
      } else {
        transformAndQueueMessage = undefined;
      }
    } catch (e) {
      // console.error("Failed to import transformAndQueueMessage. This is expected if not yet implemented.", e.message);
      transformAndQueueMessage = undefined; // Ensure it's undefined if import fails
    }
  });

  afterAll(() => {
    if (dateNowSpy) {
      dateNowSpy.mockRestore(); // Restore original Date.now()
    }
  });

  beforeEach(() => {
    // Reset mocks before each test
    if (axios.post && typeof axios.post.mockClear === "function") {
      axios.post.mockClear();
    }
    if (uuidv4 && typeof uuidv4.mockClear === "function") {
      uuidv4.mockClear();
      uuidv4.mockReturnValue("mock-uuid-1234"); // Consistent UUID for tests
    }
  });

  const sampleWhatsAppMessage = {
    _data: {
      id: { id: "WHATSAPP_MSG_ID_123" }, // Simplified for test clarity
      body: "Hello from WhatsApp",
      from: "61487097701@c.us",
      hasQuotedMsg: true,
      quotedStanzaID: "QUOTED_MSG_ID_789",
    },
    id: { id: "WHATSAPP_MSG_ID_123" }, // message.id.id
    from: "61487097701@c.us", // message.from
    body: "Hello from WhatsApp", // message.body
    hasQuotedMsg: true, // message.hasQuotedMsg
  };

  const sampleWhatsAppMessageNoQuote = {
    ...sampleWhatsAppMessage,
    _data: {
      ...sampleWhatsAppMessage._data,
      hasQuotedMsg: false,
      quotedStanzaID: undefined,
    },
    hasQuotedMsg: false,
  };

  test("transformAndQueueMessage function should be importable for testing", () => {
    // This test primarily checks if the dynamic import in beforeAll worked.
    // It will fail until transformAndQueueMessage is exported.
    expect(typeof transformAndQueueMessage).toBe("function");
  });

  test("should transform a WhatsApp message with a quote and post it to the bm_in queue", async () => {
    if (typeof transformAndQueueMessage !== "function") {
      // This test should fail if the function is not available.
      throw new Error(
        "transformAndQueueMessage is not defined. Ensure it is exported from the worker."
      );
    }

    await transformAndQueueMessage(sampleWhatsAppMessage);

    const expectedBeaconMessagePayload = {
      beaconMessage: {
        id: "mock-uuid-1234",
        message: {
          content: "Hello from WhatsApp",
          role: "user",
          messageID: "WHATSAPP_MSG_ID_123",
          replyTo: "QUOTED_MSG_ID_789",
          ts: MOCK_DATE_NOW,
        },
        origin: {
          channel: "beacon.whatsapp",
          gatewayUserID: "61487097701@c.us",
          gatewayMessageID: "WHATSAPP_MSG_ID_123",
          gatewayReplyTo: null,
          gatewayNpub: MOCK_WA_GATEWAY_NPUB,
        },
      },
    };

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      `${MOCK_SERVER_URL}:${MOCK_API_SERVER_PORT}/api/queue/add/bm_in`,
      expectedBeaconMessagePayload
    );
  });

  test("should transform a WhatsApp message without a quote (replyTo should be null)", async () => {
    if (typeof transformAndQueueMessage !== "function") {
      // This test should fail if the function is not available.
      throw new Error(
        "transformAndQueueMessage is not defined. Ensure it is exported from the worker."
      );
    }

    await transformAndQueueMessage(sampleWhatsAppMessageNoQuote);

    const expectedBeaconMessagePayload = {
      beaconMessage: {
        id: "mock-uuid-1234",
        message: {
          content: "Hello from WhatsApp",
          role: "user",
          messageID: "WHATSAPP_MSG_ID_123",
          replyTo: null,
          ts: MOCK_DATE_NOW,
        },
        origin: {
          channel: "beacon.whatsapp",
          gatewayUserID: "61487097701@c.us",
          gatewayMessageID: "WHATSAPP_MSG_ID_123",
          gatewayReplyTo: null,
          gatewayNpub: MOCK_WA_GATEWAY_NPUB,
        },
      },
    };

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      `${MOCK_SERVER_URL}:${MOCK_API_SERVER_PORT}/api/queue/add/bm_in`,
      expectedBeaconMessagePayload
    );
  });

  test("should log an error and not throw if posting to queue fails", async () => {
    if (typeof transformAndQueueMessage !== "function") {
      // This test should fail if the function is not available.
      throw new Error(
        "transformAndQueueMessage is not defined. Ensure it is exported from the worker."
      );
    }

    axios.post.mockRejectedValueOnce(new Error("Network Error"));
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Expect the function to handle the error gracefully (e.g., log it) and not throw.
    await expect(
      transformAndQueueMessage(sampleWhatsAppMessage)
    ).resolves.not.toThrow();

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error sending message to beacon queue"),
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });
});
