// app/workers/beaconMessage.worker.js
import { Worker } from "bullmq";
import IORedis from "ioredis";

const QUEUE_NAME = "beaconMessageQueue";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // Important for BullMQ worker as well
});

console.log(
  `Beacon message worker connecting to queue: ${QUEUE_NAME} on ${REDIS_URL}`
);

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    if (job.name === "addBeaconMessage") {
      console.log(`[Worker] Processing job ${job.id}:`, job.data);
      // Simulate some processing time
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.log(`[Worker] Finished processing job ${job.id}`);
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
