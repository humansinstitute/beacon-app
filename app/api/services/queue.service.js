// app/api/services/queue.service.js
import { Queue } from "bullmq";
import IORedis from "ioredis";

const QUEUE_NAME = "beaconMessageQueue";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

const beaconQueue = new Queue(QUEUE_NAME, { connection: redisConnection });

export const addBeaconMessageToQueue = async (beaconMessage) => {
  try {
    // It's good practice to ensure beaconMessage has an identifier for logging/tracking
    const jobId = beaconMessage.id || `beacon-${Date.now()}`;
    await beaconQueue.add("addBeaconMessage", beaconMessage, {
      jobId: jobId, // Using a unique ID for the job can be helpful
      removeOnComplete: true,
      removeOnFail: 1000, // Keeps failed jobs for a limited time
    });
    console.log("Beacon message added to queue:", jobId);
    return { jobId }; // Return the jobId for potential tracking
  } catch (error) {
    console.error("Failed to add beacon message to queue", error);
    throw error; // Re-throw to be caught by the controller
  }
};

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Closing queue connection on SIGINT");
  await beaconQueue.close();
  await redisConnection.quit();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Closing queue connection on SIGTERM");
  await beaconQueue.close();
  await redisConnection.quit();
  process.exit(0);
});
