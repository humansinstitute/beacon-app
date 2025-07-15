/**
 * Simple integration tests to verify authorization is applied to all routes
 */

import request from "supertest";
import express from "express";
import userRoutes from "../app/api/routes/user.route.js";
import queueRoutes from "../app/api/routes/queue.routes.js";
import conversationRoutes from "../app/api/routes/conversation.route.js";

const ORIGINAL_ENV = process.env;
const TEST_AUTH_TOKEN = "test-auth-token-12345";

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
  process.env.BEACON_AUTH = TEST_AUTH_TOKEN;
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/users", userRoutes);
  app.use("/api/queue", queueRoutes);
  app.use("/api/conversations", conversationRoutes);
  return app;
};

describe("API Routes Authorization", () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  test("User routes require authorization", async () => {
    const response = await request(app).get("/api/users/lookup").expect(401);

    expect(response.body.error).toBe("Authorization header required");
  });

  test("Queue routes require authorization", async () => {
    const response = await request(app).post("/api/queue/add/test").expect(401);

    expect(response.body.error).toBe("Authorization header required");
  });

  test("Conversation routes require authorization", async () => {
    const response = await request(app)
      .get("/api/conversations/123/history")
      .expect(401);

    expect(response.body.error).toBe("Authorization header required");
  });

  test("Valid token allows access to user routes", async () => {
    const response = await request(app)
      .get("/api/users/lookup")
      .set("Authorization", `Bearer ${TEST_AUTH_TOKEN}`);

    // Should not return 401 or 403
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  test("Valid token allows access to queue routes", async () => {
    const response = await request(app)
      .post("/api/queue/add/test")
      .set("Authorization", `Bearer ${TEST_AUTH_TOKEN}`)
      .send({ message: "test" });

    // Should not return 401 or 403
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  test("Valid token allows access to conversation routes", async () => {
    const response = await request(app)
      .get("/api/conversations/123/history")
      .set("Authorization", `Bearer ${TEST_AUTH_TOKEN}`);

    // Should not return 401 or 403
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  test("Invalid token is rejected", async () => {
    const response = await request(app)
      .get("/api/users/lookup")
      .set("Authorization", "Bearer invalid-token")
      .expect(403);

    expect(response.body.error).toBe("Invalid authorization token");
  });
});
