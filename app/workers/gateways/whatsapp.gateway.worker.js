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

// Import environment validation and worker functions
import { validateBeaconAuth } from "../../utils/envValidation.js";
import {
  transformAndQueueMessage,
  processOutboundMessage,
} from "./whatsapp.gateway.functions.js";

// Re-export for backward compatibility
export { transformAndQueueMessage, processOutboundMessage };

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

// Only run worker initialization if this is the main module
// Use a different approach that works with Jest
let isMainModule = false;
try {
  isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
} catch (e) {
  // In test environment, import.meta might not be available
  // Check if we're in a test environment
  isMainModule =
    !process.env.JEST_WORKER_ID && !process.env.NODE_ENV?.includes("test");
}

if (isMainModule) {
  acquireLock();
}

// Only initialize worker components if this is the main module
if (isMainModule) {
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
          return await processOutboundMessage(job.data, client);
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
      console.log(
        `[WhatsApp Gateway] Outbound job ${job.id} completed:`,
        result
      );
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
}
