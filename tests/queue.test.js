/* eslint-env jest */
import request from "supertest";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { app } from "../index.js"; // Assuming app is exported from index.js
// BeaconMessage model might not be directly needed in this test if we only check queue data
// import { BeaconMessage } from '../models/index.js';

/** ------------------------------------------------------------------ *
 *  Helpers                                                             *
 *  ------------------------------------------------------------------ */
const objectId = (suffix = "") =>
  (
    Date.now().toString(16) +
    "xxxxxxxxxxxxxxxx".replace(/x/g, () =>
      Math.floor(Math.random() * 16).toString(16)
    )
  ).slice(0, 24 - suffix.length) + suffix;

/** ------------------------------------------------------------------ *
 *  Test Configuration                                                  *
 *  ------------------------------------------------------------------ */
const TEST_QUEUE_NAME = "test";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

describe("POST /api/queue/add/:queueName - BeaconMessage to BullMQ", () => {
  let queue;
  let redisConnection;

  beforeAll(async () => {
    redisConnection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // Important for BullMQ
    });
    queue = new Queue(TEST_QUEUE_NAME, { connection: redisConnection });
    await queue.obliterate({ force: true }); // Clear queue before tests
  });

  afterAll(async () => {
    await queue.close();
    await redisConnection.quit();
  });

  /** -------- BeaconMessage fixture -------- */
  const beaconMessagePayload = {
    message: {
      content: "API test: Add to BullMQ",
      role: "user",
      messageID: "api-bullmq-test-001",
      replyTo: null,
      ts: Math.floor(Date.now() / 1000),
    },
    response: null,
    origin: {
      channel: "apiTestChannel",
      gatewayUserID: "apiTestGatewayUser",
      gatewayMessageID: "apiTestGatewayMsg001",
      gatewayReplyTo: null,
      gatewayNpub: "npubApiGatewayTest",
      userNpub: "npubApiUserTest",
    },
    conversationRef: objectId("conv-api"),
    flowRef: objectId("flow-api"),
  };

  test("should add a BeaconMessage to the specified queue via API and return 201", async () => {
    const response = await request(app)
      .post(`/api/queue/add/${TEST_QUEUE_NAME}`)
      .send(beaconMessagePayload)
      .expect("Content-Type", /json/)
      .expect(201);

    expect(response.body).toHaveProperty("jobId");

    // Verify the job is in the queue
    const waitingCount = await queue.getWaitingCount();
    expect(waitingCount).toBe(1);

    const jobs = await queue.getJobs(["waiting"], 0, 0); // Get the first waiting job
    expect(jobs.length).toBe(1);
    const jobInQueue = jobs[0];

    expect(jobInQueue.name).toBe("addBeaconMessage"); // Or whatever name the service uses
    expect(jobInQueue.data.message.content).toEqual(
      beaconMessagePayload.message.content
    );
    expect(jobInQueue.data.origin.channel).toEqual(
      beaconMessagePayload.origin.channel
    );

    // Clean up the job for this test run (optional, as obliterate runs beforeAll)
    await jobInQueue.remove();
    expect(await queue.getWaitingCount()).toBe(0);
  }, 20000); // Increased timeout for API call + queue interaction
});
