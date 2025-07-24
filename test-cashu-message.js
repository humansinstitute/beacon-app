import { addBeaconMessageToQueue } from "./app/utils/queueUtils.js";

const testMessage = {
  beaconMessage: {
    message: {
      content: "Can you check my cashu balance",
      role: "user",
      messageID: "test-msg-123",
      ts: Math.floor(Date.now() / 1000),
    },
    origin: {
      channel: "beacon.whatsapp",
      gatewayUserID: "test-user-123",
      gatewayMessageID: "test-wa-msg-123",
    },
    user: {
      _id: "test-user-123",
      npub: "npub1test123",
      name: "Test User",
    },
  },
};

async function sendTestMessage() {
  try {
    console.log("Sending test cashu balance message...");
    const result = await addBeaconMessageToQueue("bm_in", testMessage);
    console.log("Message sent successfully:", result);
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

sendTestMessage();
