// app/utils/queueUtils.js
import { Queue } from "bullmq";
import redisConnection from "../libs/redis.js";

// Cache for queue instances
const queues = {};

/**
 * Get or create a queue instance
 * @param {string} queueName - Name of the queue
 * @returns {Queue} - BullMQ Queue instance
 */
export const getQueue = (queueName) => {
  if (!queues[queueName]) {
    queues[queueName] = new Queue(queueName, { connection: redisConnection });
  }
  return queues[queueName];
};

/**
 * Add a message to a specified queue
 * @param {string} queueName - Name of the queue
 * @param {Object} message - Message object to add to the queue
 * @param {string} jobName - Name of the job
 * @returns {Promise<Object>} - Job ID for tracking
 */
export const addMessageToQueue = async (
  queueName,
  message,
  jobName = "processMessage"
) => {
  try {
    const queue = getQueue(queueName);
    // Generate a job ID if not provided
    const jobId = message.id || `${queueName}-${Date.now()}`;

    await queue.add(jobName, message, {
      jobId: jobId,
      removeOnComplete: true,
      removeOnFail: 1000, // Keep failed jobs for a limited time
    });

    console.log(`Message added to queue '${queueName}':`, jobId);
    return { jobId };
  } catch (error) {
    console.error(`Failed to add message to queue '${queueName}'`, error);
    throw error;
  }
};

/**
 * Add a beacon message to the queue (for backward compatibility)
 * @param {string} queueName - Name of the queue
 * @param {Object} beaconMessage - Beacon message object
 * @returns {Promise<Object>} - Job ID for tracking
 */
export const addBeaconMessageToQueue = async (queueName, beaconMessage) => {
  return addMessageToQueue(queueName, beaconMessage, "addBeaconMessage");
};

// Graceful shutdown function
export const closeQueues = async () => {
  for (const queueName in queues) {
    if (queues[queueName]) {
      await queues[queueName].close();
    }
  }
};
