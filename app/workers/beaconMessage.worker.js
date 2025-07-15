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
import { processCashuPipeline } from "../src/pipeline/cashuInteraction.pipeline.js";
import { addMessageToQueue } from "../utils/queueUtils.js";
import { analyzeConversation } from "../utils/messageUtils.js";
import { Conversation, BeaconMessage } from "../../models/index.js";
import intentAgent from "../src/agents/intentAgent.js";
import { callEverest } from "../api/services/everest.service.js";

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
          const existingConversation = await analyzeConversation(
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
            // Load existing conversation and add current user message
            console.log(
              `[Worker] Loading existing conversation: ${existingConversation.refId}`
            );
            conversation = existingConversation.data;

            // Add the current user message to summaryHistory
            conversation.summaryHistory.push({
              role: job.data.beaconMessage.message.role,
              content: job.data.beaconMessage.message.content,
            });

            // Save the conversation with the new user message before processing
            await conversation.save();
            console.log("[Worker] Added user message to existing conversation");

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
          // Classify message intent and route to appropriate pipeline
          let responseMessage;

          try {
            // Classify message intent
            console.log("[Worker] Classifying message intent...");
            console.log(
              "[Worker] DEBUG - Message content:",
              JSON.stringify(job.data.beaconMessage.message.content)
            );

            // Clean conversation history to remove MongoDB _id properties that cause Groq API errors
            let cleanedHistory = [];
            if (job.data.conversation?.summaryHistory) {
              cleanedHistory = job.data.conversation.summaryHistory.map(
                (msg) => ({
                  role: msg.role,
                  content: msg.content,
                  // Explicitly exclude _id and other MongoDB properties
                })
              );
              console.log("[Worker] DEBUG - Cleaned conversation history:", {
                originalLength: job.data.conversation.summaryHistory.length,
                cleanedLength: cleanedHistory.length,
                sampleCleaned: cleanedHistory[0] || null,
              });
            }

            const intentAgentData = await intentAgent(
              job.data.beaconMessage.message.content,
              `The users name is: ${
                job.data.beaconMessage.user?.name || "Unknown"
              }.\n`,
              cleanedHistory
            );

            console.log("[Worker] DEBUG - Intent agent data created:", {
              callID: intentAgentData.callID,
              model: intentAgentData.model,
              userPrompt: intentAgentData.chat.userPrompt,
              systemPromptPreview:
                intentAgentData.chat.systemPrompt.substring(0, 200) + "...",
            });

            // Call Everest to get intent classification
            console.log(
              "[Worker] DEBUG - Calling Everest for intent classification..."
            );
            const intentResponse = await callEverest(intentAgentData, {
              userID: job.data.beaconMessage.user?._id,
              userNpub: job.data.beaconMessage.user?.npub,
            });

            console.log("[Worker] DEBUG - Raw Everest response:", {
              callID: intentResponse.callID,
              billingID: intentResponse.billingID,
              messageType: typeof intentResponse.message,
              messageLength: intentResponse.message?.length,
              messagePreview: intentResponse.message?.substring(0, 200),
              usage: intentResponse.usage,
            });

            let intentResult;
            try {
              console.log(
                "[Worker] DEBUG - Attempting to parse intent response..."
              );
              console.log(
                "[Worker] DEBUG - Full response message:",
                JSON.stringify(intentResponse.message)
              );
              intentResult = JSON.parse(intentResponse.message);
              console.log(
                "[Worker] DEBUG - Successfully parsed intent result:",
                intentResult
              );
            } catch (parseError) {
              console.error(
                "[Worker] ERROR - Failed to parse intent response:",
                {
                  error: parseError.message,
                  rawMessage: intentResponse.message,
                  messageType: typeof intentResponse.message,
                  messageLength: intentResponse.message?.length,
                }
              );
              console.warn(
                "[Worker] Failed to parse intent response, defaulting to conversation"
              );
              intentResult = { intent: "conversation" };
            }

            console.log(
              `[Worker] Intent classified as: ${intentResult.intent}`
            );
            console.log(
              "[Worker] DEBUG - Full intent result object:",
              intentResult
            );

            // Route to appropriate pipeline
            if (intentResult.intent === "cashu") {
              console.log("[Worker] Routing to Cashu pipeline...");
              responseMessage = await processCashuPipeline(job.data);
            } else {
              console.log("[Worker] Routing to conversation pipeline...");
              responseMessage = await processConversationPipeline(job.data);
            }
          } catch (intentError) {
            console.error(
              "[Worker] Error in intent classification or pipeline processing:",
              intentError
            );
            // Fallback to conversation pipeline
            console.log("[Worker] Falling back to conversation pipeline...");
            responseMessage = await processConversationPipeline(job.data);
          }

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
                  role: "assistant",
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
              console.log(
                `[Worker] Before update - conversation history length: ${conversation.history.length}, summaryHistory length: ${conversation.summaryHistory.length}`
              );

              conversation.history.push(beaconMessage._id);
              conversation.summaryHistory.push({
                role: "assistant",
                content: responseMessage,
              });

              await conversation.save();
              console.log(
                `[Worker] After update - conversation history length: ${conversation.history.length}, summaryHistory length: ${conversation.summaryHistory.length}`
              );
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
