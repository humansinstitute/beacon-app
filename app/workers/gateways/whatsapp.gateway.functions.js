// app/workers/gateways/whatsapp.gateway.functions.js
// Extracted functions for testing purposes

import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { validateBeaconAuth } from "../../utils/envValidation.js";

// Define the function to transform and queue the message
export const transformAndQueueMessage = async (message) => {
  try {
    // Validate BEACON_AUTH environment variable
    const authValidation = validateBeaconAuth();
    if (!authValidation.success) {
      console.error(`[WhatsApp Gateway] ${authValidation.error}`);
      throw new Error(
        `Authorization configuration error: ${authValidation.error}`
      );
    }

    const beaconMessageId = uuidv4();
    const timestamp = Date.now();

    const beaconMessagePayload = {
      beaconMessage: {
        id: beaconMessageId,
        message: {
          content: message.body,
          role: "user",
          messageID: message.id.id,
          replyTo: message.hasQuotedMsg ? message._data.quotedStanzaID : null,
          ts: timestamp,
        },
        origin: {
          channel: "beacon.whatsapp",
          gatewayUserID: message.from,
          gatewayMessageID: message.id.id,
          gatewayReplyTo: null, // As per requirement
          gatewayNpub: process.env.WA_GATEWAY_NPUB,
        },
      },
    };

    // Construct base URL for API calls
    const baseURL =
      process.env.API_BASE_URL ||
      `${process.env.SERVER_URL}:${process.env.API_SERVER_PORT}`;

    console.log(`Sending message to beacon queue bm_in: ${beaconMessageId}`);
    await axios.post(`${baseURL}/api/queue/add/bm_in`, beaconMessagePayload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.BEACON_AUTH}`,
      },
    });
    console.log(
      `Message ${beaconMessageId} successfully sent to beacon queue.`
    );
  } catch (error) {
    console.error(
      `Error sending message to beacon queue: ${error.message}`,
      error
    );
    // Re-throw authorization errors so they can be caught by tests
    if (error.message.includes("Authorization configuration error")) {
      throw error;
    }
  }
};

// Define the function to process outbound messages
export const processOutboundMessage = async (message, clientInstance) => {
  try {
    console.log("[WhatsApp Gateway] Processing outbound message:", message);

    // Validate input parameters
    if (!message) {
      throw new Error("Message data is undefined or null");
    }

    if (!message.chatID) {
      throw new Error("Message chatID is undefined or null");
    }

    if (!message.message) {
      throw new Error("Message content is undefined or null");
    }

    if (!clientInstance) {
      throw new Error("WhatsApp client instance is undefined or null");
    }

    console.log(
      `[WhatsApp Gateway] Sending message to chatID: ${message.chatID}, content: ${message.message}`
    );

    // Send the message using the WhatsApp Web.js client
    const sentMessage = await clientInstance.sendMessage(
      message.chatID,
      message.message
    );

    console.log("[WhatsApp Gateway] Raw sentMessage response:", sentMessage);

    // Validate the response from sendMessage
    if (!sentMessage) {
      throw new Error(
        "sendMessage returned undefined - client may not be ready"
      );
    }

    if (!sentMessage.id) {
      throw new Error(
        "sentMessage.id is undefined - unexpected response structure"
      );
    }

    if (!sentMessage.id.id) {
      throw new Error(
        "sentMessage.id.id is undefined - unexpected response structure"
      );
    }

    console.log(
      `[WhatsApp Gateway] Message sent to ${message.chatID}:`,
      sentMessage.id.id
    );

    // Return success with the sent message ID
    return {
      success: true,
      messageId: message.beaconMessageId,
      whatsappMessageId: sentMessage.id.id,
    };
  } catch (error) {
    console.error(
      "[WhatsApp Gateway] Error processing outbound message:",
      error
    );
    throw error;
  }
};
