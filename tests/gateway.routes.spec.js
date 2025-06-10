import request from "supertest";
import { app } from "../index.js";
import mongoose from "mongoose";

import { BeaconMessage } from "../models/index.js";

// Default: Mock sendMessage to always throw (simulate error)
jest.mock("../app/workers/gateways/whatsapp.gateway.worker.js", () => ({
  sendMessage: jest.fn().mockRejectedValue(new Error("Simulated error")),
}));

describe("Gateway Routes", () => {
  beforeAll(async () => {
    // Optionally, connect to a test DB if needed
    // await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  });

  afterAll(async () => {
    // Optionally, disconnect from test DB if needed
    // await mongoose.disconnect();
  });

  describe("POST /api/gateway/signal", () => {
    it("should respond with 200 and log body", async () => {
      const payload = {
        chatID: "12345",
        content: "Hello signal",
        options: { quotedMessageId: "67890" },
        beaconMessageID: "test-beacon-id",
      };
      const logSpy = jest.spyOn(console, "log").mockImplementation();
      const res = await request(app).post("/api/gateway/signal").send(payload);
      expect(res.status).toBe(200);
      expect(logSpy).toHaveBeenCalledWith(payload);
      logSpy.mockRestore();
    });
  });

  describe("POST /api/gateway/wa", () => {
    it("should respond with 500 on error (invalid beaconMessageID)", async () => {
      const payload = {
        chatID: "12345",
        content: "Hello wa",
        options: { quotedMessageId: "67890" },
        beaconMessageID: new mongoose.Types.ObjectId().toString(), // always valid, non-existent
      };
      const res = await request(app).post("/api/gateway/wa").send(payload);
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("error");
    }, 10000); // Increase timeout to 10s

    it("should respond with 200 and return messageID/timestamp on success", async () => {
      // Patch the mock to resolve for this test only
      const {
        sendMessage,
      } = require("../app/workers/gateways/whatsapp.gateway.worker.js");
      sendMessage.mockResolvedValueOnce({
        success: true,
        messageID: "mock-msg-id",
      });

      // Insert a BeaconMessage to update
      const beacon = await BeaconMessage.create({
        message: {
          content: "test",
          role: "user",
          messageID: "orig-msg-id",
          replyTo: null,
          ts: Math.floor(Date.now() / 1000),
        },
        origin: {
          channel: "beacon.whatsapp",
          gatewayUserID: "test-user",
          gatewayMessageID: "orig-msg-id",
          gatewayReplyTo: null,
          gatewayNpub: "npub-test",
          userNpub: "npub-user",
        },
      });

      const payload = {
        chatID: "61487097701@c.us",
        content: "This is test data for beacon",
        options: { quotedMessageId: "3EB08FC33CD181CBECDD87" },
        beaconMessageID: beacon._id.toString(),
      };

      const res = await request(app).post("/api/gateway/wa").send(payload);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("messageID", "mock-msg-id");
      expect(res.body).toHaveProperty("timestamp");

      // Check that the BeaconMessage was updated
      const updated = await BeaconMessage.findById(beacon._id);
      expect(updated.response).toBeDefined();
      expect(updated.response.messageID).toBe("mock-msg-id");
      expect(updated.response.role).toBe("agent");
      expect(updated.response.content).toBe(payload.content);
    });
  });
});
