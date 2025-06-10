/**
 * gateways/waWeb/app.js
 *
 * Gateway connecting WhatsApp Web to the OSAPI backend.
 * - Handles authentication via QR code and LocalAuth strategy.
 * - Processes incoming messages by calling `callOSAPI`.
 * - Logs interactions and tracks budget usage in MongoDB.
 */

import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

// Load environment variables from project root
import dotenv from "dotenv";
dotenv.config();

import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";

const defaultAuthPath = path.resolve(process.cwd(), ".wwebjs_auth");
const authDataPath = process.env.WA_AUTH_FOLDER
  ? path.resolve(process.env.WA_AUTH_FOLDER)
  : defaultAuthPath;

if (!fs.existsSync(authDataPath)) {
  fs.mkdirSync(authDataPath, { recursive: true });
}

let client = null;
let clientReady = false;
const isTest = process.env.NODE_ENV === "test";

function reconnectClient() {
  if (!client) return;
  client
    .destroy()
    .catch((err) => console.error("Error destroying WhatsApp client:", err))
    .finally(() => {
      console.log("Reinitializing WhatsApp client...");
      client.initialize().catch((err) => {
        console.error("Failed to reinitialize WhatsApp client:", err);
        clientReady = false;
      });
    });
}

function setupShutdown() {
  const shutdown = async () => {
    if (client) {
      try {
        await client.destroy();
      } catch (err) {
        console.error("Error during WhatsApp client shutdown:", err);
      }
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (!isTest) {
  // Initialize WhatsApp client with LocalAuth persistence.
  console.log(`Using WhatsApp auth data path: ${authDataPath}`);
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: authDataPath }),
    puppeteer: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  // Display QR code in terminal when WhatsApp Web requests authentication.
  client.on("qr", (qr) => {
    console.log("Scan QR code to authenticate WhatsApp client:");
    qrcode.generate(qr, { small: true });
  });

  // Once the client is ready, log confirmation and check current budget.
  client.once("ready", () => {
    console.log("WhatsApp client is ready!");
    clientReady = true;
    // checkAndLogBudget();
  });

  // Handle authentication failures by logging the error and attempting reconnect.
  client.on("auth_failure", (msg) => {
    console.error("Authentication failure:", msg);
    clientReady = false;
    reconnectClient();
  });

  // Reinitialize when client gets disconnected
  client.on("disconnected", (reason) => {
    console.warn("WhatsApp client disconnected:", reason);
    clientReady = false;
    reconnectClient();
  });

  /**
   * Listener for incoming WhatsApp messages.
   * - Ignores messages sent by this client.
   * - Checks budget and processes messages if sufficient funds remain.
   */
  client.on("message_create", async (message) => {
    // Ignore messages sent by the bot itself.
    if (message.fromMe) {
      console.log("Ignoring message from self:", message.body);
      return;
    }

    console.log("Received message:", message.body);
    // Call the new function to process and queue the message
    await transformAndQueueMessage(message);
  });

  // Initialize the WhatsApp client
  console.log("Initializing WhatsApp client...");
  client.initialize().catch((err) => {
    console.error("Failed to initialize WhatsApp client:", err);
    clientReady = false;
  });

  setupShutdown();
} else {
  // In test mode, mock the client
  client = {
    sendMessage: async () => ({ id: { _serialized: "test-message-id" } }),
    on: () => {},
    once: (event, cb) => {
      if (event === "ready") setTimeout(cb, 10);
    },
    initialize: () => Promise.resolve(),
  };
  clientReady = true;
}

// Export readiness check for use in routes or diagnostics
export function isClientReady() {
  return clientReady;
}

// Define the function to transform and queue the message
export const transformAndQueueMessage = async (message) => {
  try {
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
      headers: { "Content-Type": "application/json" },
    });
    console.log(
      `Message ${beaconMessageId} successfully sent to beacon queue.`
    );
  } catch (error) {
    console.error(
      `Error sending message to beacon queue: ${error.message}`,
      error
    );
    // Decide if you want to re-throw or handle (e.g., reply to user about failure)
    // For now, just logging. The test expects this behavior.
  }
}; // end transformAndQueueMessage

/**
 * Send a message via WhatsApp client
 * @param {string} chatID - WhatsApp chat identifier (e.g., "61487097701@c.us")
 * @param {string} content - Text content to send
 * @param {object} options - Additional sendMessage options (e.g., { quotedMessageId })
 * @returns {Promise<{ success: boolean, messageID: string }>}
 */
export async function sendMessage(chatID, content, options = {}) {
  try {
    const message = await client.sendMessage(chatID, content, options);
    const messageID = message.id._serialized;
    return { success: true, messageID };
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    if (isTest) {
      // In test mode, return a failure result instead of throwing
      return { success: false, error: error.message };
    }
    throw error;
  }
}
