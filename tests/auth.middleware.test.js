import { requireAuth } from "../app/api/middlewares/auth.middleware.js";

describe("Auth Middleware", () => {
  let req, res, next;
  let originalBeaconAuth;

  beforeEach(() => {
    // Store original environment variable
    originalBeaconAuth = process.env.BEACON_AUTH;

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
    // Restore original environment variable
    if (originalBeaconAuth !== undefined) {
      process.env.BEACON_AUTH = originalBeaconAuth;
    } else {
      delete process.env.BEACON_AUTH;
    }

    // Restore console.error
    console.error.mockRestore();
  });

  describe("Environment Variable Validation", () => {
    test("should return 500 when BEACON_AUTH is not set", () => {
      delete process.env.BEACON_AUTH;
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
      process.env.BEACON_AUTH = "";
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
    beforeEach(() => {
      process.env.BEACON_AUTH = "test-secret-token";
    });

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
    beforeEach(() => {
      process.env.BEACON_AUTH = "test-secret-token";
    });

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
    beforeEach(() => {
      process.env.BEACON_AUTH = "test-secret-token";
    });

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
});
