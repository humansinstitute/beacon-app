/**
 * Integration tests for API authorization middleware
 * Tests that all API endpoints require proper authorization
 */

import request from "supertest";
import express from "express";
import userRoutes from "../app/api/routes/user.route.js";
import queueRoutes from "../app/api/routes/queue.routes.js";
import conversationRoutes from "../app/api/routes/conversation.route.js";

// Mock the environment variable for testing
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

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/users", userRoutes);
  app.use("/api/queue", queueRoutes);
  app.use("/api/conversations", conversationRoutes);
  return app;
};

describe("API Authorization Integration Tests", () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  describe("Environment Configuration", () => {
    test("should return 500 when BEACON_AUTH is not set", async () => {
      delete process.env.BEACON_AUTH;
      app = createTestApp();

      const response = await request(app).get("/api/users/lookup").expect(500);

      expect(response.body).toEqual({
        error: "Server configuration error",
      });
    });
  });

  describe("User Routes Authorization", () => {
    const userEndpoints = [
      { method: "get", path: "/api/users/lookup" },
      { method: "get", path: "/api/users/123" },
      { method: "post", path: "/api/users" },
      { method: "patch", path: "/api/users/123" },
    ];

    userEndpoints.forEach(({ method, path }) => {
      test(`${method.toUpperCase()} ${path} should require authorization`, async () => {
        const response = await request(app)[method](path).expect(401);

        expect(response.body).toEqual({
          error: "Authorization header required",
        });
      });

      test(`${method.toUpperCase()} ${path} should reject invalid token`, async () => {
        const response = await request(app)
          [method](path)
          .set("Authorization", "Bearer invalid-token")
          .expect(403);

        expect(response.body).toEqual({
          error: "Invalid authorization token",
        });
      });

      test(`${method.toUpperCase()} ${path} should accept valid Bearer token`, async () => {
        const response = await request(app)
          [method](path)
          .set("Authorization", `Bearer ${TEST_AUTH_TOKEN}`);

        // Should not return 401 or 403 (may return other errors due to missing controllers/data)
        expect(response.status).not.toBe(401);
        expect(response.status).not.toBe(403);
      });

      test(`${method.toUpperCase()} ${path} should accept direct token format`, async () => {
        const response = await request(app)
          [method](path)
          .set("Authorization", TEST_AUTH_TOKEN);

        // Should not return 401 or 403 (may return other errors due to missing controllers/data)
        expect(response.status).not.toBe(401);
        expect(response.status).not.toBe(403);
      });
    });
  });

  describe("Queue Routes Authorization", () => {
    const queueEndpoints = [
      { method: "post", path: "/api/queue/add/test-queue" },
    ];

    queueEndpoints.forEach(({ method, path }) => {
      test(`${method.toUpperCase()} ${path} should require authorization`, async () => {
        const response = await request(app)[method](path).expect(401);

        expect(response.body).toEqual({
          error: "Authorization header required",
        });
      });

      test(`${method.toUpperCase()} ${path} should reject invalid token`, async () => {
        const response = await request(app)
          [method](path)
          .set("Authorization", "Bearer invalid-token")
          .expect(403);

        expect(response.body).toEqual({
          error: "Invalid authorization token",
        });
      });

      test(`${method.toUpperCase()} ${path} should accept valid Bearer token`, async () => {
        const response = await request(app)
          [method](path)
          .set("Authorization", `Bearer ${TEST_AUTH_TOKEN}`);

        // Should not return 401 or 403 (may return other errors due to missing controllers/data)
        expect(response.status).not.toBe(401);
        expect(response.status).not.toBe(403);
      });
    });
  });

  describe("Conversation Routes Authorization", () => {
    const conversationEndpoints = [
      { method: "get", path: "/api/conversations/123/history" },
      { method: "get", path: "/api/conversations/123/flow/latest" },
      { method: "get", path: "/api/conversations/flow/456/next-action" },
      { method: "get", path: "/api/conversations/messages/recent" },
      { method: "get", path: "/api/conversations/message/npub123/1" },
      { method: "post", path: "/api/conversations" },
      { method: "post", path: "/api/conversations/flow" },
      { method: "post", path: "/api/conversations/123/messages" },
      { method: "patch", path: "/api/conversations/123/flow" },
      { method: "post", path: "/api/conversations/message" },
      { method: "get", path: "/api/conversations/message/456" },
      { method: "patch", path: "/api/conversations/message/456" },
      { method: "get", path: "/api/conversations/123" },
      { method: "patch", path: "/api/conversations/123" },
      { method: "get", path: "/api/conversations/flow/456" },
      { method: "patch", path: "/api/conversations/flow/456" },
      { method: "patch", path: "/api/conversations/flow/456/action" },
    ];

    conversationEndpoints.forEach(({ method, path }) => {
      test(`${method.toUpperCase()} ${path} should require authorization`, async () => {
        const response = await request(app)[method](path).expect(401);

        expect(response.body).toEqual({
          error: "Authorization header required",
        });
      });

      test(`${method.toUpperCase()} ${path} should reject invalid token`, async () => {
        const response = await request(app)
          [method](path)
          .set("Authorization", "Bearer invalid-token")
          .expect(403);

        expect(response.body).toEqual({
          error: "Invalid authorization token",
        });
      });

      test(`${method.toUpperCase()} ${path} should accept valid Bearer token`, async () => {
        const response = await request(app)
          [method](path)
          .set("Authorization", `Bearer ${TEST_AUTH_TOKEN}`);

        // Should not return 401 or 403 (may return other errors due to missing controllers/data)
        expect(response.status).not.toBe(401);
        expect(response.status).not.toBe(403);
      });
    });
  });

  describe("Authorization Header Formats", () => {
    test("should handle missing Authorization header", async () => {
      const response = await request(app).get("/api/users/lookup").expect(401);

      expect(response.body).toEqual({
        error: "Authorization header required",
      });
    });

    test("should handle empty Authorization header", async () => {
      const response = await request(app)
        .get("/api/users/lookup")
        .set("Authorization", "")
        .expect(401);

      expect(response.body).toEqual({
        error: "Authorization header required",
      });
    });

    test("should handle Bearer token with extra spaces", async () => {
      const response = await request(app)
        .get("/api/users/lookup")
        .set("Authorization", `Bearer  ${TEST_AUTH_TOKEN}  `);

      // Should not return 401 or 403 (may return other errors due to missing controllers/data)
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });

    test("should handle case-sensitive token comparison", async () => {
      const response = await request(app)
        .get("/api/users/lookup")
        .set("Authorization", `Bearer ${TEST_AUTH_TOKEN.toUpperCase()}`)
        .expect(403);

      expect(response.body).toEqual({
        error: "Invalid authorization token",
      });
    });
  });

  describe("Edge Cases", () => {
    test("should handle malformed Bearer header", async () => {
      const response = await request(app)
        .get("/api/users/lookup")
        .set("Authorization", "Bearer")
        .expect(403);

      expect(response.body).toEqual({
        error: "Invalid authorization token",
      });
    });

    test("should handle Bearer with only spaces", async () => {
      const response = await request(app)
        .get("/api/users/lookup")
        .set("Authorization", "Bearer    ")
        .expect(403);

      expect(response.body).toEqual({
        error: "Invalid authorization token",
      });
    });

    test("should handle non-Bearer authorization schemes", async () => {
      const response = await request(app)
        .get("/api/users/lookup")
        .set("Authorization", `Basic ${TEST_AUTH_TOKEN}`)
        .expect(403);

      expect(response.body).toEqual({
        error: "Invalid authorization token",
      });
    });
  });
});
