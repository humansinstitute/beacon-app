import { Worker } from "bullmq";
import redisConnection from "../libs/redis.js";
import { connectDB, disconnectDB } from "../../libs/db.js";
import { BeaconMessage, Conversation, Flow } from "../../models/index.js";
import mongoose from "mongoose";

const QUEUE_NAME = "bm_in";

const processor = async (job) => {
  await connectDB();

  try {
    const message = job.data;

    // Create beacon message
    const beaconMsg = new BeaconMessage({
      message: {
        content: message.content,
        role: message.role,
        messageID: message.messageID,
        replyTo: message.replyTo,
        ts: message.ts,
      },
      origin: message.origin,
    });
    await beaconMsg.save();

    // Generate test objects
    const conversationId = new mongoose.Types.ObjectId();
    const flowId = new mongoose.Types.ObjectId();
    const beaconMessageId = beaconMsg._id;

    const testFlow = {
      _id: flowId,
      type: "conversation",
      workflow: [
        {
          order: 1,
          action: {
            type: "agent",
            target: "conversation",
          },
          output:
            "I can provide information, research, banking services etc, what do you need?",
          exit: {
            field: "output",
            eval: "!=",
            value: "NULL",
          },
          state: "closed",
        },
        {
          order: 2,
          action: "userMessage",
          output: null,
          exit: {
            field: "output",
            eval: "!=",
            value: "NULL",
          },
          state: "open",
        },
      ],
      state: "awaiting user response",
      data: [
        { userPreference: "banking" },
        { sessionStart: new Date("2024-01-15T10:30:00Z") },
      ],
      conversationRef: conversationId,
      createdAt: new Date("2024-01-15T10:30:00Z"),
      updatedAt: new Date("2024-01-15T10:30:15Z"),
    };

    const testConversation = {
      _id: conversationId,
      summaryHistory: [
        {
          role: "user",
          content: "Hey what can you do?",
        },
        {
          role: "agent",
          content:
            "I can provide information, research, banking services etc, what do you need?",
        },
      ],
      history: [beaconMessageId],
      activeFlow: flowId,
      createdAt: new Date("2024-01-15T10:30:00Z"),
      updatedAt: new Date("2024-01-15T10:30:15Z"),
    };

    const conversation = new Conversation(testConversation);
    const flow = new Flow(testFlow);
    await Promise.all([conversation.save(), flow.save()]);

    // Update beacon message with references
    beaconMsg.conversationRef = conversation._id;
    beaconMsg.flowRef = flow._id;
    await beaconMsg.save();

    // Create WhatsApp message
    const whatsappMsg = {
      chatID: beaconMsg.origin.gatewayUserID,
      message: "This is a boiler plate message",
      quotedMessage: beaconMsg.origin.gatewayMessageID,
      beaconMessageID: beaconMsg._id.toString(),
    };

    console.log("WhatsApp message:", whatsappMsg);

    return { status: "completed" };
  } catch (error) {
    console.error("Error processing job:", error);
    throw error;
  } finally {
    await disconnectDB();
  }
};

const worker = new Worker(QUEUE_NAME, processor, {
  connection: redisConnection,
  concurrency: 5,
});

worker.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed. Result:`, result);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed with error:`, err.message);
});

const gracefulShutdown = async () => {
  await worker.close();
  process.exit(0);
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

console.log(`Beacon worker started, listening on queue: ${QUEUE_NAME}`);
