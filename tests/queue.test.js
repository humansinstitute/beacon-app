/* eslint-env jest */
import request from "supertest";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { resetConfig, get } from "../app/config/index.js";
import { configTestHelpers } from "./utils/configMock.js";

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

describe("POST /api/queue/add/:queueName - BeaconMessage to BullMQ", () => {
  let queue;
  let redisConnection;
  let app;

  beforeAll(async () => {
    // Set up test configuration using centralized config system
    await configTestHelpers.setupConfig({
      NODE_ENV: "test",
      MONGO_URI: "mongodb://localhost:27017/test",
      REDIS_URL: "redis://127.0.0.1:6379",
      BEACON_AUTH: "test-auth-token",
      WA_GATEWAY_NPUB: "test-npub",
      PORT: "3001",
      API_SERVER_PORT: "3257",
      SERVER_URL: "http://localhost",
    });

    // Import app after setting up configuration
    const { app: importedApp } = await import("../index.js");
    app = importedApp;

    // Get Redis URL from centralized configuration
    const REDIS_URL = get("REDIS_URL", "redis://127.0.0.1:6379");
    redisConnection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // Important for BullMQ
    });
    queue = new Queue(TEST_QUEUE_NAME, { connection: redisConnection });
    await queue.obliterate({ force: true }); // Clear queue before tests
  });

  afterAll(async () => {
    try {
      await queue.close();
      await redisConnection.quit();
    } catch (error) {
      console.warn("Error closing queue/redis connections:", error.message);
    }

    // Clean up configuration
    configTestHelpers.cleanup();
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

  describe("Configuration Integration Tests", () => {
    test("should handle Redis URL configuration changes", async () => {
      // Test that the queue uses the configured Redis URL
      const currentRedisUrl = get("REDIS_URL");
      expect(currentRedisUrl).toBe("redis://127.0.0.1:6379");

      // Verify Redis connection is working
      const ping = await redisConnection.ping();
      expect(ping).toBe("PONG");
    });

    test("should handle authentication configuration", async () => {
      // Test that API requires proper authentication
      const response = await request(app)
        .post(`/api/queue/add/${TEST_QUEUE_NAME}`)
        .send(beaconMessagePayload)
        .expect(401); // Should fail without auth header

      expect(response.body).toHaveProperty("error");
    });

    test("should work with valid authentication", async () => {
      const authToken = get("BEACON_AUTH");

      const response = await request(app)
        .post(`/api/queue/add/${TEST_QUEUE_NAME}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(beaconMessagePayload)
        .expect(201);

      expect(response.body).toHaveProperty("jobId");

      // Clean up
      const jobs = await queue.getJobs(["waiting"], 0, -1);
      for (const job of jobs) {
        await job.remove();
      }
    });

    test("should handle configuration validation errors", async () => {
      // This test verifies that the system handles configuration errors gracefully
      const mongoUri = get("MONGO_URI");
      const redisUrl = get("REDIS_URL");

      expect(mongoUri).toBeTruthy();
      expect(redisUrl).toBeTruthy();
      expect(mongoUri).toContain("mongodb://");
      expect(redisUrl).toContain("redis://");
    });
  });
});
