/**
 * Authorization middleware for API endpoints
 * Validates Bearer token authentication against process.env.BEACON_AUTH
 */

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const expectedAuth = process.env.BEACON_AUTH;

  if (!expectedAuth) {
    console.error("[Auth Middleware] BEACON_AUTH environment variable not set");
    return res.status(500).json({
      error: "Server configuration error",
    });
  }

  if (!authHeader) {
    return res.status(401).json({
      error: "Authorization header required",
    });
  }

  // Support both "Bearer token" and direct token formats
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (token !== expectedAuth) {
    return res.status(403).json({
      error: "Invalid authorization token",
    });
  }

  next();
};
