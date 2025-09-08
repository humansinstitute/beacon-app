import { requireAuth } from "../app/api/middlewares/auth.middleware.js";
import { resetConfig } from "../app/config/index.js";
import { configTestHelpers } from "./utils/configMock.js";

describe("Auth Middleware", () => {
  let req, res, next;

  beforeEach(async () => {
    // Set up configuration for auth middleware testing
    await configTestHelpers.setupConfig({
      BEACON_AUTH: "test-secret-token",
      WA_GATEWAY_NPUB: "test-npub",
      MONGO_URI: "mongodb://localhost:27017/test",
      REDIS_URL: "redis://localhost:6379",
    });

    // Mock request, response, and next function
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    // Clear console.error mock
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up configuration mocks
    configTestHelpers.cleanup();

    // Restore console.error
    console.error.mockRestore();
  });

  describe("Environment Variable Validation", () => {
    test("should return 500 when BEACON_AUTH is not set", async () => {
      // Remove BEACON_AUTH from configuration
      configTestHelpers.removeConfig(["BEACON_AUTH"]);
      req.headers.authorization = "Bearer valid-token";

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Server configuration error",
      });
      expect(console.error).toHaveBeenCalledWith(
        "[Auth Middleware] BEACON_AUTH environment variable not set"
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 500 when BEACON_AUTH is empty string", () => {
      // Set BEACON_AUTH to empty string
      configTestHelpers.updateConfig({ BEACON_AUTH: "" });
      req.headers.authorization = "Bearer valid-token";

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Server configuration error",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Authorization Header Validation", () => {
    test("should return 401 when authorization header is missing", () => {
      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Authorization header required",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 401 when authorization header is empty", () => {
      req.headers.authorization = "";

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Authorization header required",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Token Validation", () => {
    test("should return 403 when Bearer token is invalid", () => {
      req.headers.authorization = "Bearer invalid-token";

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid authorization token",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 403 when direct token is invalid", () => {
      req.headers.authorization = "invalid-token";

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid authorization token",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should call next() when Bearer token is valid", () => {
      req.headers.authorization = "Bearer test-secret-token";

      requireAuth(req, res, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("should call next() when direct token is valid", () => {
      req.headers.authorization = "test-secret-token";

      requireAuth(req, res, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("should handle Bearer token with extra spaces", () => {
      req.headers.authorization = "Bearer  test-secret-token";

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid authorization token",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should be case sensitive for Bearer prefix", () => {
      req.headers.authorization = "bearer test-secret-token";

      requireAuth(req, res, next);

      // "bearer" (lowercase) should be treated as direct token, not Bearer format
      // Since "bearer test-secret-token" !== "test-secret-token", it should fail
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid authorization token",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    test("should handle authorization header with only 'Bearer'", () => {
      req.headers.authorization = "Bearer";

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid authorization token",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should handle authorization header with 'Bearer ' (space only)", () => {
      req.headers.authorization = "Bearer ";

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid authorization token",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Configuration Scenarios", () => {
    test("should work with different BEACON_AUTH values", async () => {
      const testToken = "custom-auth-token-12345";
      configTestHelpers.updateConfig({ BEACON_AUTH: testToken });

      req.headers.authorization = `Bearer ${testToken}`;
      requireAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test("should handle configuration validation errors gracefully", async () => {
      // Apply invalid configuration scenario
      configTestHelpers.applyScenario("invalid-config");

      req.headers.authorization = "Bearer any-token";
      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Server configuration error",
      });
    });
  });
});
