// Library for interacting with WhatsApp Web and managing sessions.
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
// Import qrcode for image generation
import qr from "qrcode";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import path from "path";
import fs from "fs";

// Load environment variables from project root
import dotenv from "dotenv";
dotenv.config();

const LOCK_FILE = path.join(process.cwd(), ".wwebjs.lock");
const OUTBOUND_QUEUE_NAME = "bm_out";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

function acquireLock() {
  if (fs.existsSync(LOCK_FILE)) {
    const pid = fs.readFileSync(LOCK_FILE, "utf8");
    try {
      process.kill(pid, 0);
      throw new Error("Another instance is already running");
    } catch (e) {
      // Process doesn't exist, continue
    }
  }
  fs.writeFileSync(LOCK_FILE, process.pid.toString());
  console.log(`Acquired lock with PID: ${process.pid}`);
}

function releaseLock() {
  if (fs.existsSync(LOCK_FILE)) {
    const pid = fs.readFileSync(LOCK_FILE, "utf8");
    if (pid === process.pid.toString()) {
      fs.unlinkSync(LOCK_FILE);
      console.log("Released lock");
    }
  }
}

acquireLock();

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
  }
};

// Define the function to process outbound messages
const processOutboundMessage = async (message) => {
  try {
    console.log("[WhatsApp Gateway] Processing outbound message:", message);

    // Send the message using the WhatsApp Web.js client
    const sentMessage = await client.sendMessage(
      message.chatID,
      message.message
    );

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

const outboundRedisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Initialize WhatsApp client with LocalAuth persistence.
const instanceId = process.env.pm_id || "standalone";
console.log(`Using instance ID: ${instanceId}`);

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: path.join(process.cwd(), `.wwebjs_auth_${instanceId}`),
  }),
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  },
});

// Display QR code in terminal when WhatsApp Web requests authentication.
client.on("qr", (qrCode) => {
  qrcode.generate(qrCode, { small: true });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const qrFilename = path.join(__dirname, `whatsapp_qr.png`);

  if (fs.existsSync(qrFilename)) {
    fs.unlinkSync(qrFilename);
    console.log(`Deleted existing QR code image: ${qrFilename}`);
  }

  qr.toFile(qrFilename, qrCode, (err) => {
    if (err) {
      console.error("Failed to save QR code image:", err);
    } else {
      console.log(`QR code image saved to: ${qrFilename}`);
    }
  });
});

client.on("auth_failure", (msg) => {
  console.error("[DIAG] Authentication failure:", msg);
});

client.on("message_create", async (message) => {
  if (message.fromMe) {
    console.log("Ignoring message from self:", message.body);
    return;
  }

  console.log("Received message:", message.body);
  await transformAndQueueMessage(message);
});

client.on("disconnected", (reason) => {
  console.error("Client disconnected:", reason);
  cleanup();
});

let outboundWorker;

client.once("ready", () => {
  console.log("Client is ready!");

  // Add outbound worker after client is ready
  outboundWorker = new Worker(
    OUTBOUND_QUEUE_NAME,
    async (job) => {
      console.log(
        `[WhatsApp Gateway] Processing outbound job ${job.id}:`,
        job.data
      );

      try {
        return await processOutboundMessage(job.data);
      } catch (error) {
        console.error(
          `[WhatsApp Gateway] Error processing outbound job ${job.id}:`,
          error
        );
        throw error;
      }
    },
    {
      connection: outboundRedisConnection,
      concurrency: 5,
    }
  );

  outboundWorker.on("completed", (job, result) => {
    console.log(`[WhatsApp Gateway] Outbound job ${job.id} completed:`, result);
  });

  outboundWorker.on("failed", (job, err) => {
    console.error(`[WhatsApp Gateway] Outbound job ${job.id} failed:`, err);
  });
});

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

async function cleanup() {
  try {
    await client.destroy();
    console.log("Client destroyed");

    if (outboundWorker) {
      await outboundWorker.close();
      console.log("Outbound worker closed");
    }

    await outboundRedisConnection.quit();
    console.log("Outbound Redis connection closed");
  } catch (e) {
    console.error("Cleanup error:", e);
  } finally {
    releaseLock();
    process.exit(0);
  }
}

client.initialize();
