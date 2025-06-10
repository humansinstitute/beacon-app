import { sendMessage } from "../app/workers/gateways/whatsapp.gateway.worker.js";

describe("WhatsApp Gateway Worker", () => {
  describe("sendMessage", () => {
    it("should resolve with success and messageID", async () => {
      // This will attempt to call the real client; test should fail until implementation.
      await expect(
        sendMessage("12345@c.us", "Test content", { quotedMessageId: "67890" })
      ).resolves.toMatchObject({
        success: true,
        messageID: expect.any(String),
      });
    });
  });
});
