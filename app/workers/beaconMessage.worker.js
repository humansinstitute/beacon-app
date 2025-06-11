// app/workers/beaconMessage.worker.js
import { Worker } from "bullmq";
import IORedis from "ioredis";

// At the top of beaconMessage.worker.js
import dotenv from "dotenv";
dotenv.config();

const QUEUE_NAME = "bm_in";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // Important for BullMQ worker as well
});

console.log(
  `Beacon message worker connecting to queue: ${QUEUE_NAME} on ${REDIS_URL}`
);

import conversationAgent from "../src/agents/conversationAgent.js";
import { callEverest } from "../api/services/everest.service.js";

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    if (job.name === "addBeaconMessage") {
      console.log(`[Worker] Processing job ${job.id}:`, job.data);

      try {
        // Call conversation agent with message content
        const agentData = await conversationAgent(
          job.data.beaconMessage.message.content,
          "",
          []
        );

        // Set origin data from job
        agentData.origin = {
          ...agentData.origin,
          ...job.data.beaconMessage.origin,
        };

        // Call Everest service
        const response = await callEverest(agentData);
        console.log("[Worker] Everest API response:", response);
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
