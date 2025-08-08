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
export const processOutboundMessage = async (message, clientInstance, retryCount = 0) => {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds
  const CLIENT_READY_TIMEOUT = 10000; // 10 seconds
  const MESSAGE_CONFIRMATION_DELAY = 1000; // 1 second to wait for message confirmation

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

    // Check client readiness before attempting to send
    const isClientReady = await checkClientReadiness(clientInstance, CLIENT_READY_TIMEOUT);
    
    if (!isClientReady) {
      const error = new Error("WhatsApp client is not ready for sending messages");
      error.code = 'CLIENT_NOT_READY';
      throw error;
    }

    console.log(
      `[WhatsApp Gateway] Sending message to chatID: ${message.chatID}, content: ${message.message}`
    );

    // Track message sending attempt
    let messageSentSuccessfully = false;
    let sentMessageId = null;

    // Set up a temporary listener to detect if our message was sent
    const messageListener = (msg) => {
      if (msg.fromMe && msg.to === message.chatID && msg.body === message.message) {
        messageSentSuccessfully = true;
        sentMessageId = msg.id._serialized;
        console.log("[WhatsApp Gateway] Message send confirmed via message_create event:", sentMessageId);
      }
    };

    // Add the listener temporarily
    clientInstance.on('message_create', messageListener);

    try {
      // Send the message using the WhatsApp Web.js client
      const sentMessage = await clientInstance.sendMessage(
        message.chatID,
        message.message
      );

      console.log("[WhatsApp Gateway] Raw sentMessage response:", sentMessage);

      // Wait a moment for the message_create event to fire
      await new Promise(resolve => setTimeout(resolve, MESSAGE_CONFIRMATION_DELAY));

      // Remove the temporary listener
      clientInstance.removeListener('message_create', messageListener);

      // Check if we have a valid response OR if we detected the message was sent
      if (sentMessage && sentMessage.id && sentMessage.id.id) {
        // Standard successful response
        console.log(
          `[WhatsApp Gateway] Message sent to ${message.chatID}:`,
          sentMessage.id.id
        );

        return {
          success: true,
          messageId: message.beaconMessageId,
          whatsappMessageId: sentMessage.id.id,
        };
      } else if (messageSentSuccessfully && sentMessageId) {
        // Message was sent successfully despite undefined response
        console.log(
          `[WhatsApp Gateway] Message sent successfully (confirmed via event) to ${message.chatID}:`,
          sentMessageId
        );

        return {
          success: true,
          messageId: message.beaconMessageId,
          whatsappMessageId: sentMessageId,
        };
      } else {
        // Neither method confirmed the message was sent
        const error = new Error("sendMessage returned undefined and no confirmation received - client may not be ready");
        error.code = 'SEND_MESSAGE_UNDEFINED';
        throw error;
      }
    } catch (sendError) {
      // Remove the temporary listener in case of error
      clientInstance.removeListener('message_create', messageListener);
      throw sendError;
    }

  } catch (error) {
    console.error(
      "[WhatsApp Gateway] Error processing outbound message:",
      error
    );

    // Implement retry logic for client readiness issues only
    if ((error.code === 'CLIENT_NOT_READY' || error.code === 'SEND_MESSAGE_UNDEFINED') && retryCount < MAX_RETRIES) {
      console.log(
        `[WhatsApp Gateway] Retrying message send (attempt ${retryCount + 1}/${MAX_RETRIES}) after ${RETRY_DELAY}ms delay`
      );
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      
      // Recursive retry with incremented count
      return await processOutboundMessage(message, clientInstance, retryCount + 1);
    }

    // If all retries exhausted or different error, throw the error
    if (retryCount >= MAX_RETRIES) {
      console.error(
        `[WhatsApp Gateway] All retry attempts exhausted for message to ${message.chatID}`
      );
    }
    
    throw error;
  }
};

// Helper function to check if the WhatsApp client is ready for sending messages
const checkClientReadiness = async (clientInstance, timeout = 10000) => {
  try {
    // Check if client has basic properties indicating it's initialized
    if (!clientInstance.info) {
      console.log("[WhatsApp Gateway] Client info not available - client not ready");
      return false;
    }

    // Try to get client state - this is a lightweight operation
    const state = await Promise.race([
      clientInstance.getState(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeout)
      )
    ]);

    // Check if state indicates the client is ready
    const isReady = state === 'CONNECTED';
    
    console.log(`[WhatsApp Gateway] Client readiness check: state=${state}, ready=${isReady}`);
    
    return isReady;
  } catch (error) {
    console.log(`[WhatsApp Gateway] Client readiness check failed: ${error.message}`);
    return false;
  }
};
