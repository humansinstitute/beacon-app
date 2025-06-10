// Library for interacting with WhatsApp Web and managing sessions.
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
// Import qrcode for image generation
import qr from "qrcode";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

// Load environment variables from project root
import dotenv from "dotenv";
dotenv.config();

console.log("[DIAG] Current working directory:", process.cwd());
console.log(
  "[DIAG] Session storage path:",
  path.join(process.cwd(), ".wwebjs_auth")
);

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
client.on("qr", (qrCode) => {
  // Display QR in terminal
  qrcode.generate(qrCode, { small: true });

  // Generate a unique filename in the same directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const qrFilename = path.join(__dirname, `whatsapp_qr.png`);

  // Check if the QR code file already exists and delete it
  if (fs.existsSync(qrFilename)) {
    fs.unlinkSync(qrFilename);
    console.log(`Deleted existing QR code image: ${qrFilename}`);
  }

  // Generate and save QR code image
  qr.toFile(qrFilename, qrCode, (err) => {
    if (err) {
      console.error("Failed to save QR code image:", err);
    } else {
      console.log(`QR code image saved to: ${qrFilename}`);
    }
  });
});

// Once the client is ready, log confirmation and check current budget.
client.once("ready", () => {
  console.log("Client is ready!");
  // checkAndLogBudget();
});

// Handle authentication failures by logging the error.
client.on("auth_failure", (msg) => {
  console.error("[DIAG] Authentication failure:", msg);
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

// If Jest still hangs, we might need to wrap client.initialize() in a main execution block.
client.initialize();
