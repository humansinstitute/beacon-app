import request from "supertest";
import { app } from "../index.js";
import { connectDB, disconnectDB, getMongooseInstance } from "../libs/db.js";
import { BeaconMessage, Conversation, Flow } from "../models/index.js";
import { getMessagesByNpub } from "../app/api/services/conversation.service.js";

describe("GET /api/conversations/message/:npub/:messagenumber", () => {
  let testMessages = [];
  const testNpub = "npub1test123456789abcdef";
  const otherNpub = "npub1other987654321fedcba";
  let server;

  beforeAll(async () => {
    await connectDB();
    server = app;
  });

  afterAll(async () => {
    const mongooseInstance = getMongooseInstance();
    if (mongooseInstance.connection.readyState === 1) {
      await mongooseInstance.connection.dropDatabase();
    }
    await disconnectDB();
  });

  beforeEach(async () => {
    // Clean up existing test data
    await BeaconMessage.deleteMany({});
    await Conversation.deleteMany({});
    await Flow.deleteMany({});

    // Create test conversation and flow
    const conversation = await Conversation.create({
      summaryHistory: [],
      history: [],
    });

    const flow = await Flow.create({
      type: "conversation",
      workflow: [],
      conversationRef: conversation._id,
    });

    // Create test messages with different npubs and timestamps
    const baseTime = Date.now() / 1000; // Current time in seconds

    testMessages = await BeaconMessage.create([
      {
        message: {
          content: "Message 1 from test npub",
          role: "user",
          messageID: "msg1",
          ts: baseTime - 300, // 5 minutes ago
        },
        origin: {
          channel: "waGateway",
          gatewayUserID: "user1",
          gatewayMessageID: "gw_msg1",
          gatewayNpub: "npub1gateway123",
          userNpub: testNpub,
        },
        conversationRef: conversation._id,
        flowRef: flow._id,
      },
      {
        message: {
          content: "Message 2 from test npub",
          role: "user",
          messageID: "msg2",
          ts: baseTime - 200, // 3.33 minutes ago
        },
        origin: {
          channel: "waGateway",
          gatewayUserID: "user1",
          gatewayMessageID: "gw_msg2",
          gatewayNpub: "npub1gateway123",
          userNpub: testNpub,
        },
        conversationRef: conversation._id,
        flowRef: flow._id,
      },
      {
        message: {
          content: "Message 3 from test npub (most recent)",
          role: "user",
          messageID: "msg3",
          ts: baseTime - 100, // 1.67 minutes ago
        },
        origin: {
          channel: "waGateway",
          gatewayUserID: "user1",
          gatewayMessageID: "gw_msg3",
          gatewayNpub: "npub1gateway123",
          userNpub: testNpub,
        },
        conversationRef: conversation._id,
        flowRef: flow._id,
      },
      {
        message: {
          content: "Message from other npub",
          role: "user",
          messageID: "msg4",
          ts: baseTime - 50, // Most recent overall, but different npub
        },
        origin: {
          channel: "waGateway",
          gatewayUserID: "user2",
          gatewayMessageID: "gw_msg4",
          gatewayNpub: "npub1gateway123",
          userNpub: otherNpub,
        },
        conversationRef: conversation._id,
        flowRef: flow._id,
      },
    ]);
  });

  afterEach(async () => {
    // Clean up test data
    await BeaconMessage.deleteMany({});
    await Conversation.deleteMany({});
    await Flow.deleteMany({});
  });

  describe("Service function: getMessagesByNpub", () => {
    test("should return messages for specific npub in correct order", async () => {
      const messages = await getMessagesByNpub(testNpub, 10);

      expect(messages).toHaveLength(3);
      expect(messages[0].message.content).toBe(
        "Message 3 from test npub (most recent)"
      );
      expect(messages[1].message.content).toBe("Message 2 from test npub");
      expect(messages[2].message.content).toBe("Message 1 from test npub");

      // Verify all messages have the correct npub
      messages.forEach((msg) => {
        expect(msg.origin.userNpub).toBe(testNpub);
      });
    });

    test("should limit results to specified count", async () => {
      const messages = await getMessagesByNpub(testNpub, 2);

      expect(messages).toHaveLength(2);
      expect(messages[0].message.content).toBe(
        "Message 3 from test npub (most recent)"
      );
      expect(messages[1].message.content).toBe("Message 2 from test npub");
    });

    test("should return empty array for non-existent npub", async () => {
      const messages = await getMessagesByNpub("npub1nonexistent", 10);
      expect(messages).toHaveLength(0);
    });

    test("should handle string messageCount parameter", async () => {
      const messages = await getMessagesByNpub(testNpub, "2");
      expect(messages).toHaveLength(2);
    });
  });

  describe("API Endpoint: GET /api/conversations/message/:npub/:messagenumber", () => {
    test("should return messages for valid npub and count", async () => {
      const response = await request(server)
        .get(`/api/conversations/message/${testNpub}/2`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].message.content).toBe(
        "Message 3 from test npub (most recent)"
      );
      expect(response.body[1].message.content).toBe("Message 2 from test npub");

      // Verify response structure
      response.body.forEach((msg) => {
        expect(msg).toHaveProperty("_id");
        expect(msg).toHaveProperty("message");
        expect(msg).toHaveProperty("origin");
        expect(msg).toHaveProperty("conversationRef");
        expect(msg).toHaveProperty("flowRef");
        expect(msg.origin.userNpub).toBe(testNpub);
      });
    });

    test("should return all messages when count exceeds available", async () => {
      const response = await request(server)
        .get(`/api/conversations/message/${testNpub}/10`)
        .expect(200);

      expect(response.body).toHaveLength(3);
    });

    test("should return empty array for non-existent npub", async () => {
      const response = await request(server)
        .get("/api/conversations/message/npub1nonexistent/5")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    test("should return 400 for invalid message count (non-numeric)", async () => {
      const response = await request(server)
        .get(`/api/conversations/message/${testNpub}/invalid`)
        .expect(400);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toBe(
        "Message number must be a positive integer"
      );
    });

    test("should return 400 for invalid message count (zero)", async () => {
      const response = await request(server)
        .get(`/api/conversations/message/${testNpub}/0`)
        .expect(400);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toBe(
        "Message number must be a positive integer"
      );
    });

    test("should return 400 for invalid message count (negative)", async () => {
      const response = await request(server)
        .get(`/api/conversations/message/${testNpub}/-5`)
        .expect(400);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toBe(
        "Message number must be a positive integer"
      );
    });

    test("should handle large message counts gracefully", async () => {
      const response = await request(server)
        .get(`/api/conversations/message/${testNpub}/1000`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(3); // Only 3 messages exist
    });

    test("should filter messages correctly by npub", async () => {
      // Test with the other npub that has only 1 message
      const response = await request(server)
        .get(`/api/conversations/message/${otherNpub}/10`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].message.content).toBe("Message from other npub");
      expect(response.body[0].origin.userNpub).toBe(otherNpub);
    });
  });

  describe("Edge Cases", () => {
    test("should handle very long npub strings", async () => {
      const longNpub = "npub1" + "a".repeat(100);
      const response = await request(server)
        .get(`/api/conversations/message/${longNpub}/5`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    test("should handle special characters in npub", async () => {
      const specialNpub = "npub1test-special_chars.123";
      const response = await request(server)
        .get(`/api/conversations/message/${encodeURIComponent(specialNpub)}/5`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });
  });
});
