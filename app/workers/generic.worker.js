// app/workers/generic.worker.js
import { Worker } from "bullmq";
import redisConnection from "../libs/redis.js";

const processor = async (job) => {
  /* NEW: pretty-print the full payload so we know JSON is unmarshalled */
  console.log(
    `📨  [${job.queueName}] Received job ${job.id}\n` +
      JSON.stringify(job.data, null, 2)
  );

  await job.updateProgress(100);
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

// import { fileURLToPath } from "url";
// import path from "path"; // Import path module

/* ---------- Universal bootstrap (Node ⬌ PM2) ---------- */

/**
 * Returns the first CLI argument that is
 *  - NOT the PM2 wrapper (ends with ".js"), and
 *  - NOT a Node/PM2 flag ("--something")
 */
const findQueueName = () => {
  return process.argv
    .slice(2) // skip node + PM2 wrapper
    .find((arg) => !arg.endsWith(".js") && !arg.startsWith("-"));
};

const queueName = findQueueName(); // "bm_in" or "bm_out" in prod

// ✅ run when a queue name is supplied (Node or PM2)
// 🚫 skip when imported in Jest (no queue argument)
if (queueName) {
  console.log(`Bootstrapping worker for CLI arg queue: ${queueName}`);

  setupWorker(queueName).catch((err) => {
    console.error("Fatal worker error:", err);
    process.exit(1);
  });
}

// /* ---------- CLI bootstrap (PM2-safe) ---------- */

// // true  ➜  script launched directly (node or PM2)
// // false ➜  script was merely imported in a unit-test
// const isDirectRun =
//   // 1️⃣ basic case: node app/workers/generic.worker.js
//   import.meta.url === new URL(`file://${process.argv[1]}`).href ||
//   // 2️⃣ PM2 fork case: argv list still contains the worker’s name
//   process.argv.slice(1).some((a) => a.endsWith("generic.worker.js"));

// if (isDirectRun) {
//   const queueName = process.argv[2]; // e.g. "bm_in"
//   if (!queueName) {
//     console.error("Usage: node generic.worker.js <queueName>");
//     process.exit(1);
//   }
//   setupWorker(queueName).catch((err) => {
//     console.error("Fatal worker error:", err);
//     process.exit(1);
//   });
// }
