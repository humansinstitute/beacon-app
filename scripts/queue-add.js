import { Queue } from "bullmq";
import redisConnection from "../app/libs/redis.js";

const queueName = process.argv[2];
const message = JSON.parse(process.argv[3]);

const queue = new Queue(queueName, { connection: redisConnection });

async function addMessage() {
  try {
    await queue.add("default", message);
    console.log(`Message added to queue '${queueName}':`, message);
  } catch (error) {
    console.error(`Error adding message to queue '${queueName}':`, error);
  } finally {
    await queue.close();
  }
}

addMessage();
