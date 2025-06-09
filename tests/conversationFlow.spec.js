// __tests__/conversationFlow.spec.js
// ----------------------------------------------------------
import request from "supertest";
import { app, startServer, stopServer } from "../index.js"; // Adjust path as needed
import { connectDB, disconnectDB, getMongooseInstance } from "../libs/db.js"; // <-- Import new DB functions

import { BeaconMessage, Conversation, Flow } from "../models/index.js"; // <-- adjust path
import {
  getLatestFlow,
  getBeaconHistory,
  getRecentMessages,
  getNextAction,
} from "../app/api/services/conversation.service.js"; // <-- adjust path

/**
 * Helpers – build one tiny data set we can reuse across tests
 */
async function seedMockData() {
  /* Conversation */
  const conv = await Conversation.create({
    summaryHistory: [],
    history: [],
  });

  /* Flow with one closed step & one open */
  const flow = await Flow.create({
    type: "conversation",
    workflow: [
      {
        order: 1,
        action: { type: "agent", target: "conversation" },
        output: "filled-in answer",
        exit: { field: "output", eval: "!=", value: null },
        state: "closed",
      },
      {
        order: 2,
        action: "userMessage",
        output: null,
        exit: { field: "output", eval: "!=", value: null },
        state: "open",
      },
    ],
    state: "awaiting user follow-up",
    conversationRef: conv._id,
  });

  conv.activeFlow = flow._id;
  await conv.save();

  /* Beacon messages: 3 from the user + 3 agent responses */
  for (let i = 0; i < 3; i++) {
    const msg = await BeaconMessage.create({
      message: {
        content: `user msg ${i}`,
        role: "user",
        messageID: `u${i}`,
        ts: Date.now() / 1000 + i,
      },
      response: {
        content: `agent reply ${i}`,
        role: "agent",
        messageID: `a${i}`,
        replyTo: `u${i}`,
        ts: Date.now() / 1000 + i + 0.1,
      },
      origin: {
        channel: "waGateway",
        gatewayUserID: "123",
        gatewayMessageID: `wa${i}`,
        gatewayReplyTo: null,
        gatewayNpub: "npub_gateway",
        userNpub: "npub_user",
      },
      conversationRef: conv._id,
      flowRef: flow._id,
    });

    conv.history.push(msg._id);
    conv.summaryHistory.push({ role: "user", content: msg.message.content });
  }
  await conv.save();

  return { conv, flow };
}

/* ---------------------------------------------------------- */
/*                       TEST SUITE                           */
/* ---------------------------------------------------------- */

let server; // mongod is now managed by db.js

beforeAll(async () => {
  await connectDB(); // Connect to the in-memory DB
  server = app; // Use the exported app for supertest
  // Ensure seedMockData uses the established mongoose connection
  // If seedMockData needs direct mongoose, it can use getMongooseInstance()
  await seedMockData(); // put data in place
});

afterAll(async () => {
  const mongooseInstance = getMongooseInstance();
  if (mongooseInstance.connection.readyState === 1) {
    // 1 === connected
    await mongooseInstance.connection.dropDatabase();
  }
  await disconnectDB(); // Disconnect MongoDB and stop in-memory server
  // stopServer() from index.js might still be needed if it does more than DB ops
  // For now, assuming stopServer in index.js will be refactored or its DB part is covered
});

describe("Conversation / Flow helper queries", () => {
  test("getLatestFlow() returns the most recent flow for a conversation", async () => {
    const conv = await Conversation.findOne();
    const flow = await getLatestFlow(conv._id);

    expect(flow).toBeTruthy();
    expect(flow.conversationRef.toString()).toBe(conv._id.toString());
  });

  test("getBeaconHistory() is ordered oldest → newest", async () => {
    const conv = await Conversation.findOne();
    const history = await getBeaconHistory(conv._id);

    expect(history).toHaveLength(3);
    expect(history[0].message.content).toBe("user msg 0");
    expect(history[2].message.content).toBe("user msg 2");
  });

  test("getNextAction() returns the first open workflow step", async () => {
    const flow = await Flow.findOne();
    const next = await getNextAction(flow._id);

    expect(next).toBeTruthy();
    expect(next.order).toBe(2);
    expect(next.state).toBe("open");
  });

  test("getRecentMessages() pulls 5 or fewer messages from active convos", async () => {
    const recent = await getRecentMessages();
    expect(recent.length).toBeGreaterThan(0);
    recent.forEach((bm) => {
      expect(bm.response).toBeDefined();
    });
  });
});

describe("API Endpoints", () => {
  let createdConversationId;
  let createdFlowId;

  test("POST /api/conversations - should create a new conversation", async () => {
    const res = await request(server)
      .post("/api/conversations")
      .send({ summaryHistory: [], history: [] });
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty("_id");
    createdConversationId = res.body._id;
  });

  test("POST /api/conversations/flow - should create a new flow", async () => {
    const res = await request(server)
      .post("/api/conversations/flow")
      .send({
        type: "conversation", // Changed from "test-flow"
        workflow: [{ order: 1, action: "test_action" }],
        conversationRef: createdConversationId,
      });
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty("_id");
    expect(res.body.conversationRef).toEqual(createdConversationId);
    createdFlowId = res.body._id;
  });

  test("PATCH /api/conversations/:conversationId/flow - should update conversation active flow", async () => {
    const res = await request(server)
      .patch(`/api/conversations/${createdConversationId}/flow`)
      .send({ flowId: createdFlowId });
    expect(res.statusCode).toEqual(200);
    expect(res.body.activeFlow).toEqual(createdFlowId);
  });

  test("GET /api/conversations/:conversationId/history - should get conversation history", async () => {
    // First, add a message to ensure history is not empty
    await request(server)
      .post(`/api/conversations/${createdConversationId}/messages`)
      .send({
        flowId: createdFlowId,
        messageData: {
          content: "Test message for history",
          role: "user",
          messageID: "hist01",
          ts: Date.now() / 1000,
        },
        originData: {
          channel: "test",
          gatewayUserID: "testUser",
          gatewayMessageID: "testMsg01",
          gatewayNpub: "npub_test",
          userNpub: "npub_user_test",
        },
      });

    const res = await request(server).get(
      `/api/conversations/${createdConversationId}/history`
    );
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].message.content).toBe("Test message for history");
  });

  test("GET /api/conversations/:conversationId/flow/latest - should get latest flow", async () => {
    const res = await request(server).get(
      `/api/conversations/${createdConversationId}/flow/latest`
    );
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("_id");
    expect(res.body._id).toEqual(createdFlowId);
  });

  test("GET /api/conversations/flow/:flowId/next-action - should get next action for a flow", async () => {
    // Assuming the seeded flow has an open action
    const seededFlow = await Flow.findOne({ type: "conversation" }); // from seedMockData
    const res = await request(server).get(
      `/api/conversations/flow/${seededFlow._id}/next-action`
    );
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("order");
    expect(res.body.state).toEqual("open");
  });

  test("POST /api/conversations/:conversationId/messages - should add a message to a conversation", async () => {
    const messageData = {
      content: "Hello there",
      role: "user",
      messageID: "msg01",
      ts: Date.now() / 1000,
    };
    const originData = {
      channel: "test",
      gatewayUserID: "testUser",
      gatewayMessageID: "testMsg01",
      gatewayNpub: "npub_test",
      userNpub: "npub_user_test",
    };
    const res = await request(server)
      .post(`/api/conversations/${createdConversationId}/messages`)
      .send({ flowId: createdFlowId, messageData, originData });
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty("_id");
    expect(res.body.message.content).toEqual("Hello there");
    expect(res.body.conversationRef).toEqual(createdConversationId);
  });

  test("GET /api/conversations/messages/recent - should get recent messages", async () => {
    // This test relies on the seeded data having active conversations with messages
    const res = await request(server).get("/api/conversations/messages/recent");
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    // The seedMockData creates 3 messages. getRecentMessages limits to 5.
    // If other tests create messages in active convos, this might be > 3
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    expect(res.body.length).toBeLessThanOrEqual(5);
  });

  // New tests for beaconMessage CRUD
  describe("BeaconMessage CRUD", () => {
    let createdBeaconMessageId;
    const initialMessageData = {
      content: "Initial beacon message",
      role: "user",
      messageID: "bm01",
      ts: Date.now() / 1000,
    };
    const initialOriginData = {
      channel: "test-beacon",
      gatewayUserID: "beaconUser",
      gatewayMessageID: "beaconMsg01",
      userNpub: "npub_test_user_beacon", // Added missing field
      gatewayNpub: "npub_test_gateway_beacon", // Added missing field
    };

    test("POST /api/conversations/message - should create a new beacon message", async () => {
      const res = await request(server)
        .post("/api/conversations/message")
        .send({
          messageData: initialMessageData,
          originData: initialOriginData,
          // conversationRef and flowRef can be optional for a new message not yet tied to a conversation/flow
        });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty("_id");
      expect(res.body.message.content).toEqual("Initial beacon message");
      createdBeaconMessageId = res.body._id;
    });

    test("GET /api/conversations/message/:messageId - should retrieve a specific beacon message", async () => {
      const res = await request(server).get(
        `/api/conversations/message/${createdBeaconMessageId}`
      );
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty("_id");
      expect(res.body._id).toEqual(createdBeaconMessageId);
      expect(res.body.message.content).toEqual("Initial beacon message");
    });

    test("PATCH /api/conversations/message/:messageId - should update a beacon message", async () => {
      const updatedMessageData = {
        content: "Updated beacon message content",
        role: "user", // Role might not change, or could
        ts: Date.now() / 1000, // Timestamp will likely update
      };
      const res = await request(server)
        .patch(`/api/conversations/message/${createdBeaconMessageId}`)
        .send({ messageData: updatedMessageData });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty("_id");
      expect(res.body._id).toEqual(createdBeaconMessageId);
      expect(res.body.message.content).toEqual(
        "Updated beacon message content"
      );
    });
  });

  // New tests for conversation CRUD (excluding create, which is already tested)
  describe("Conversation CRUD (Update/Get)", () => {
    // createdConversationId is available from previous tests
    test("GET /api/conversations/:conversationId - should retrieve a specific conversation", async () => {
      const res = await request(server).get(
        `/api/conversations/${createdConversationId}`
      );
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty("_id");
      expect(res.body._id).toEqual(createdConversationId);
    });

    test("PATCH /api/conversations/:conversationId - should update a conversation", async () => {
      const updatedSummary = [
        { role: "system", content: "Conversation updated" },
      ];
      const res = await request(server)
        .patch(`/api/conversations/${createdConversationId}`)
        .send({ summaryHistory: updatedSummary });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty("_id");
      expect(res.body.summaryHistory[0].content).toEqual(
        "Conversation updated"
      );
    });
  });

  // New tests for flow CRUD (excluding create, which is already tested)
  describe("Flow CRUD (Update/Get/Update Action)", () => {
    // createdFlowId is available from previous tests
    test("GET /api/conversations/flow/:flowId - should retrieve a specific flow", async () => {
      const res = await request(server).get(
        `/api/conversations/flow/${createdFlowId}`
      );
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty("_id");
      expect(res.body._id).toEqual(createdFlowId);
    });

    test("PATCH /api/conversations/flow/:flowId - should update a flow", async () => {
      const updatedWorkflow = [
        { order: 1, action: "updated_action", state: "closed" },
      ];
      const res = await request(server)
        .patch(`/api/conversations/flow/${createdFlowId}`)
        .send({ workflow: updatedWorkflow, state: "completed" });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty("_id");
      expect(res.body.workflow[0].action).toEqual("updated_action");
      expect(res.body.state).toEqual("completed");
    });

    test("PATCH /api/conversations/flow/:flowId/action - should update an action in a flow", async () => {
      // First, ensure the flow has an action to update. Let's use the createdFlowId.
      // We might need to fetch it to know its current workflow or assume one.
      // For this test, let's assume the flow created earlier has an action at order: 1
      // and we want to update its state or output.
      const actionUpdate = {
        order: 1, // The order of the action to update
        output: "User provided input for action 1",
        state: "closed",
      };
      const res = await request(server)
        .patch(`/api/conversations/flow/${createdFlowId}/action`)
        .send(actionUpdate);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty("_id");
      // Verify that the specific action was updated
      const updatedFlow = await Flow.findById(createdFlowId);
      const targetAction = updatedFlow.workflow.find(
        (a) => a.order === actionUpdate.order
      );
      expect(targetAction).toBeDefined();
      expect(targetAction.output).toEqual(actionUpdate.output);
      expect(targetAction.state).toEqual(actionUpdate.state);
    });
  });
});
