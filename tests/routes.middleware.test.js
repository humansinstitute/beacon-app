/**
 * Test to verify authorization middleware is applied to routes
 */

import express from "express";
import userRoutes from "../app/api/routes/user.route.js";
import queueRoutes from "../app/api/routes/queue.routes.js";
import conversationRoutes from "../app/api/routes/conversation.route.js";

// Mock the auth middleware to verify it's being called
jest.mock("../app/api/middlewares/auth.middleware.js", () => ({
  requireAuth: jest.fn((req, res, next) => {
    // Mark that auth was called
    req.authCalled = true;
    next();
  }),
}));

// Mock the controllers to avoid database dependencies
jest.mock("../app/api/controllers/user.controller.js", () => ({
  getUser: jest.fn((req, res) => res.json({ authCalled: req.authCalled })),
  lookupUser: jest.fn((req, res) => res.json({ authCalled: req.authCalled })),
  createUser: jest.fn((req, res) => res.json({ authCalled: req.authCalled })),
  updateUser: jest.fn((req, res) => res.json({ authCalled: req.authCalled })),
}));

jest.mock("../app/api/controllers/queue.controller.js", () => ({
  addMessage: jest.fn((req, res) => res.json({ authCalled: req.authCalled })),
}));

jest.mock("../app/api/controllers/conversation.controller.js", () => ({
  getConversationHistory: jest.fn((req, res) =>
    res.json({ authCalled: req.authCalled })
  ),
  getLatestConversationFlow: jest.fn((req, res) =>
    res.json({ authCalled: req.authCalled })
  ),
  getFlowNextAction: jest.fn((req, res) =>
    res.json({ authCalled: req.authCalled })
  ),
  getRecentBeaconMessages: jest.fn((req, res) =>
    res.json({ authCalled: req.authCalled })
  ),
  getMessagesByNpub: jest.fn((req, res) =>
    res.json({ authCalled: req.authCalled })
  ),
  createNewConversation: jest.fn((req, res) =>
    res.json({ authCalled: req.authCalled })
  ),
  createNewFlow: jest.fn((req, res) =>
    res.json({ authCalled: req.authCalled })
  ),
  addMessageToConversation: jest.fn((req, res) =>
    res.json({ authCalled: req.authCalled })
  ),
  updateConvActiveFlow: jest.fn((req, res) =>
    res.json({ authCalled: req.authCalled })
  ),
  createBeaconMessage: jest.fn((req, res) =>
    res.json({ authCalled: req.authCalled })
  ),
  getBeaconMessageById: jest.fn((req, res) =>
    res.json({ authCalled: req.authCalled })
  ),
  updateBeaconMessage: jest.fn((req, res) =>
    res.json({ authCalled: req.authCalled })
  ),
  getConversationById: jest.fn((req, res) =>
    res.json({ authCalled: req.authCalled })
  ),
  updateConversation: jest.fn((req, res) =>
    res.json({ authCalled: req.authCalled })
  ),
  getFlowById: jest.fn((req, res) => res.json({ authCalled: req.authCalled })),
  updateFlow: jest.fn((req, res) => res.json({ authCalled: req.authCalled })),
  updateFlowAction: jest.fn((req, res) =>
    res.json({ authCalled: req.authCalled })
  ),
}));

import request from "supertest";

describe("Routes Middleware Application", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/users", userRoutes);
    app.use("/api/queue", queueRoutes);
    app.use("/api/conversations", conversationRoutes);
  });

  test("User routes have auth middleware applied", async () => {
    const response = await request(app).get("/api/users/lookup").expect(200);

    expect(response.body.authCalled).toBe(true);
  });

  test("Queue routes have auth middleware applied", async () => {
    const response = await request(app).post("/api/queue/add/test").expect(200);

    expect(response.body.authCalled).toBe(true);
  });

  test("Conversation routes have auth middleware applied", async () => {
    const response = await request(app)
      .get("/api/conversations/123/history")
      .expect(200);

    expect(response.body.authCalled).toBe(true);
  });
});
