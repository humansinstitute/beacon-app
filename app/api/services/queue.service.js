// app/api/services/queue.service.js
import { Queue } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

const queues = {};

const getQueue = (queueName) => {
  if (!queues[queueName]) {
    queues[queueName] = new Queue(queueName, { connection: redisConnection });
  }
  return queues[queueName];
};

export const addBeaconMessageToQueue = async (queueName, beaconMessage) => {
  try {
    const queue = getQueue(queueName);
    // It's good practice to ensure beaconMessage has an identifier for logging/tracking
    const jobId = beaconMessage.id || `beacon-${Date.now()}`;
    await queue.add("addBeaconMessage", beaconMessage, {
      jobId: jobId, // Using a unique ID for the job can be helpful
      removeOnComplete: true,
      removeOnFail: 1000, // Keeps failed jobs for a limited time
    });
    console.log(`Beacon message added to queue '${queueName}':`, jobId);
    return { jobId }; // Return the jobId for potential tracking
  } catch (error) {
    console.error(
      `Failed to add beacon message to queue '${queueName}'`,
      error
    );
    throw error; // Re-throw to be caught by the controller
  }
};

// Graceful shutdown
const closeQueues = async () => {
  for (const queueName in queues) {
    if (queues[queueName]) {
      await queues[queueName].close();
    }
  }
};

process.on("SIGINT", async () => {
  console.log("Closing queue connections on SIGINT");
  await closeQueues();
  await redisConnection.quit();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Closing queue connections on SIGTERM");
  await closeQueues();
  await redisConnection.quit();
  process.exit(0);
});
