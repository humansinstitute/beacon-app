// app/workers/beaconMessage.worker.js
import { Worker } from "bullmq";
import IORedis from "ioredis";

// At the top of beaconMessage.worker.js
import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "../../libs/db.js";

// Debug: Log the MongoDB URI being used
console.log("[Worker] NODE_ENV:", process.env.NODE_ENV);
console.log("[Worker] MONGO_URI:", process.env.MONGO_URI ? "Set" : "Not set");
if (process.env.MONGO_URI) {
  console.log(
    "[Worker] MONGO_URI value:",
    process.env.MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")
  );
}

const QUEUE_NAME = "bm_in";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // Important for BullMQ worker as well
});

console.log(
  `Beacon message worker connecting to queue: ${QUEUE_NAME} on ${REDIS_URL}`
);

import { lookupUserByAlias } from "../utils/userUtils.js";
import { processConversationPipeline } from "../src/pipeline/conversation.js";
import { addMessageToQueue } from "../utils/queueUtils.js";
import { analyzeConversation } from "../utils/messageUtils.js";
import { Conversation, BeaconMessage } from "../../models/index.js";

// Initialize database connection and worker
async function initializeWorker() {
  try {
    await connectDB();
    console.log("[Worker] Database connected successfully");
  } catch (error) {
    console.error("[Worker] Failed to connect to database:", error);
    process.exit(1);
  }

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === "addBeaconMessage") {
        console.log(`[Worker] Processing job ${job.id}:`, job.data);

        // Check if the message is from WhatsApp channel and lookup user if so
        let alias = { type: "", ref: "" };
        if (job.data.beaconMessage.origin.channel === "beacon.whatsapp") {
          alias.type = "wa";
          alias.ref = job.data.beaconMessage.origin.gatewayUserID;
          console.log(`[Worker] Looking up user for alias:`, alias);
          try {
            const user = await lookupUserByAlias(alias);
            if (user) {
              job.data.beaconMessage.user = user;
              console.log(
                `[Worker] User object attached to beaconMessage:`,
                user
              );
            } else {
              console.log(`[Worker] No user found for alias:`, alias);
            }
          } catch (error) {
            console.error(
              `[Worker] Failed to lookup user for alias ${alias.type}:${alias.ref}:`,
              error
            );
          }
        }

        // Analyze conversation context
        let conversation = null;
        try {
          console.log("[Worker] Analyzing conversation context...");
          const existingConversation = analyzeConversation(
            job.data.beaconMessage.message,
            job.data.beaconMessage.origin,
            job.data.beaconMessage.user
          );

          if (existingConversation.isNew) {
            // Create new conversation
            console.log("[Worker] Creating new conversation...");
            conversation = new Conversation({
              history: [], // Will be populated after BeaconMessage creation
              summaryHistory: [
                {
                  role: job.data.beaconMessage.message.role,
                  content: job.data.beaconMessage.message.content,
                },
              ],
              activeFlow: null,
            });

            await conversation.save();
            console.log(
              `[Worker] New conversation created with ID: ${conversation._id}`
            );

            // Attach conversation to job data for pipeline processing
            job.data.conversation = conversation;
          } else {
            // Load existing conversation (future implementation)
            console.log(
              `[Worker] Loading existing conversation: ${existingConversation.refId}`
            );
            conversation = existingConversation.data;
            job.data.conversation = conversation;
          }
        } catch (error) {
          console.error(
            "[Worker] Error in conversation analysis/creation:",
            error
          );
          // Continue processing without conversation context
          job.data.conversation = null;
        }

        try {
          // Process the message through the conversation pipeline
          const responseMessage = await processConversationPipeline(job.data);
          console.log("[Worker] Pipeline response message:", responseMessage);

          // Create BeaconMessage and update conversation if we have one
          if (conversation) {
            try {
              console.log(
                "[Worker] Creating BeaconMessage with conversation reference..."
              );

              // Construct proper origin object with userNpub
              const originWithUserNpub = {
                ...job.data.beaconMessage.origin,
                userNpub: job.data.beaconMessage.user?.npub || null,
              };

              // Create BeaconMessage with conversation reference
              const beaconMessage = new BeaconMessage({
                message: job.data.beaconMessage.message,
                response: {
                  content: responseMessage,
                  role: "agent",
                  messageID: `response_${job.data.beaconMessage.message.messageID}`,
                  replyTo: job.data.beaconMessage.message.messageID,
                  ts: Math.floor(Date.now() / 1000),
                },
                origin: originWithUserNpub,
                conversationRef: conversation._id,
                flowRef: null, // Will be set when flows are implemented
              });

              await beaconMessage.save();
              console.log(
                `[Worker] BeaconMessage created with ID: ${beaconMessage._id}`
              );

              // Update conversation history
              conversation.history.push(beaconMessage._id);
              conversation.summaryHistory.push({
                role: "agent",
                content: responseMessage,
              });

              await conversation.save();
              console.log(
                "[Worker] Conversation updated with BeaconMessage and response"
              );

              // Store beaconMessage ID for response queue
              job.data.beaconMessageId = beaconMessage._id;
            } catch (error) {
              console.error(
                "[Worker] Error creating BeaconMessage or updating conversation:",
                error
              );
              // Continue with response even if conversation tracking fails
            }
          }

          // Format the message for WhatsApp
          const whatsappMessage = {
            chatID: job.data.beaconMessage.origin.gatewayUserID,
            message: responseMessage,
            options: {
              quotedMessageId: job.data.beaconMessage.message.replyTo,
            },
            beaconMessageId:
              job.data.beaconMessageId || job.data.beaconMessage.id,
          };

          // Add the message to the bm_out queue
          console.log(
            "[Worker] Adding response to bm_out queue:",
            whatsappMessage
          );
          await addMessageToQueue(
            "bm_out",
            whatsappMessage,
            "sendWhatsAppMessage"
          );
          console.log("[Worker] Response added to bm_out queue successfully");
        } catch (error) {
          console.error("[Worker] Error processing job:", error);
          throw error;
        }
      } else {
        console.warn(`[Worker] Received job with unexpected name: ${job.name}`);
      }
    },
    {
      connection: redisConnection,
      concurrency: 5, // Example: process up to 5 jobs concurrently
    }
  );

  worker.on("completed", (job, result) => {
    console.log(`[Worker] Job ${job.id} completed.`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[Worker] Job ${job.id} failed with error: ${err.message}`,
      err.stack
    );
  });

  worker.on("error", (err) => {
    console.error("[Worker] BullMQ worker error:", err);
  });

  console.log("Beacon message worker started and listening for jobs.");

  // Graceful shutdown for the worker
  const gracefulShutdown = async (signal) => {
    console.log(
      `[Worker] ${signal} received. Closing worker and Redis connection...`
    );
    try {
      await worker.close();
      console.log("[Worker] BullMQ worker closed.");
      await redisConnection.quit();
      console.log("[Worker] Redis connection closed.");
      process.exit(0);
    } catch (error) {
      console.error("[Worker] Error during graceful shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}

// Initialize the worker
initializeWorker();
