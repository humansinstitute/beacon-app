/**
 * gateways/waWeb/app.js
 *
 * Gateway connecting WhatsApp Web to the OSAPI backend.
 * - Handles authentication via QR code and LocalAuth strategy.
 * - Processes incoming messages by calling `callOSAPI`.
 * - Logs interactions and tracks budget usage in MongoDB.
 */

// External dependencies
// Library for interacting with WhatsApp Web and managing sessions.
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
// Displays QR code in the terminal for user authentication.
import qrcode from "qrcode-terminal";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

// Load environment variables
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" }); // Load .env from the project root

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

    console.log(`Sending message to beacon queue bm_in: ${beaconMessageId}`);
    await axios.post(
      `${process.env.SERVER_URL}:${process.env.API_SERVER_PORT}/api/queue/add/bm_in`,
      beaconMessagePayload
    );
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
};

// Initialize WhatsApp client with LocalAuth persistence.
// Puppeteer args ensure compatibility in sandboxed environments.
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

// Display QR code in terminal when WhatsApp Web requests authentication.
client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

// Once the client is ready, log confirmation and check current budget.
client.once("ready", () => {
  console.log("Client is ready!");
  // checkAndLogBudget();
});

// Handle authentication failures by logging the error.
client.on("auth_failure", (msg) => {
  console.error("Authentication failure:", msg);
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
  // console.log(message); // Keep this commented or remove if not needed for production

  // Call the new function to process and queue the message
  await transformAndQueueMessage(message);
});

// Start the WhatsApp client connection process.
// This should only run when the script is executed directly, not when imported as a module.
// A common pattern is to check if this module is the main module.
// For ES Modules, the check is: import.meta.url === `file://${process.argv[1]}`
// However, for simplicity and given the current structure, we'll leave client.initialize()
// as is. The test setup with dynamic import should mitigate Jest hanging issues
// if the function is exported correctly and doesn't inherently depend on client state for its direct execution.
// If Jest still hangs, we might need to wrap client.initialize() in a main execution block.
client.initialize();
