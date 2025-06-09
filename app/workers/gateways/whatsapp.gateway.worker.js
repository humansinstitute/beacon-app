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

// Load environment variables
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" }); // Load .env from the project root

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
  console.log(message);
  const fallbackSent = await message.reply("PONG!");
});

// Start the WhatsApp client connection process.
client.initialize();
