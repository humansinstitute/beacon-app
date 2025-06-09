// app/workers/generic.worker.js
import { Worker } from "bullmq";
import redisConnection from "../libs/redis.js";

const processor = async (job) => {
  console.log(
    `Processing job ${job.id} from queue ${job.queueName} with data:`,
    job.data
  );
  // Actual job processing logic will be added here or delegated based on job type/data.
  // For now, we just log and complete.
  await job.updateProgress(100); // Example of updating progress
  return { status: "completed", jobId: job.id, data: job.data };
};

export const setupWorker = (queueName) => {
  if (!queueName || typeof queueName !== "string" || queueName.trim() === "") {
    console.error("Error: A valid queue name must be provided to setupWorker.");
    return null; // Or throw an error
  }

  console.log(`Initializing worker for queue: ${queueName}`);
  const worker = new Worker(queueName, processor, {
    connection: redisConnection,
    concurrency: 5, // Example: process 5 jobs concurrently
    removeOnComplete: { count: 1000 }, // Keep up to 1000 completed jobs
    removeOnFail: { count: 5000 }, // Keep up to 5000 failed jobs
  });

  worker.on("completed", (job, result) => {
    console.log(
      `Job ${job.id} in queue ${queueName} completed. Result:`,
      result
    );
  });

  worker.on("failed", (job, err) => {
    console.error(
      `Job ${job.id} in queue ${queueName} failed with error:`,
      err.message
    );
  });

  worker.on("error", (err) => {
    console.error(
      `Worker for queue ${queueName} encountered an error:`,
      err.message
    );
  });

  console.log(`Worker for queue ${queueName} started and listening for jobs.`);
  return worker; // Return the worker instance
};

import { fileURLToPath } from "url";
import path from "path"; // Import path module

// Main execution block for ES Modules:
// This allows the script to be run directly to start a worker for a specific queue.
const currentFilePath = fileURLToPath(import.meta.url);
const scriptPath = process.argv[1];

// More robust check for whether the script is being run directly
if (path.resolve(currentFilePath) === path.resolve(scriptPath)) {
  const queueName = process.argv[2]; // Get queue name from command-line argument

  if (!queueName) {
    console.error(
      "Error: Queue name must be provided as a command-line argument."
    );
    console.log("Usage: node app/workers/generic.worker.js <queueName>");
    process.exit(1);
  }

  setupWorker(queueName);
}
