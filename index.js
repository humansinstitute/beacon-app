import express from "express";
import conversationRoutes from "./app/api/routes/conversation.route.js";
import queueRoutes from "./app/api/routes/queue.routes.js"; // Import new queue routes
import { connectDB, disconnectDB } from "./libs/db.js"; // Import new DB functions

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// API routes
app.use("/api/conversations", conversationRoutes);
app.use("/api/queue", queueRoutes); // Use new queue routes

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// mongod instance is now managed within libs/db.js

async function startServer() {
  try {
    await connectDB(); // Connect to DB using the new centralized function
    // The console log for DB connection is now in connectDB

    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Could not start server:", error);
    process.exit(1); // Exit if server fails to start
  }
}

async function stopServer() {
  try {
    await disconnectDB(); // Disconnect DB using the new centralized function
    // The console log for DB disconnection is now in disconnectDB
    // Note: This function might be called by tests or graceful shutdown.
    // If app.close() is needed for an HTTP server, that should be separate.
  } catch (error) {
    console.error("Error stopping server components:", error);
  }
}

// Graceful shutdown
// We need a reference to the HTTP server to close it gracefully
let httpServer;

if (process.env.NODE_ENV !== "test") {
  // Start server and store the httpServer instance
  (async () => {
    await connectDB();
    // Import and start the worker in non-test environments
    await import("./app/workers/beaconMessage.worker.js");
    httpServer = app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })();
} else {
  // For testing, we might not start the server automatically here,
  // or we might export a function that returns the app for supertest.
  // The current test setup imports 'app' and 'startServer'/'stopServer'.
  // 'startServer' in test context will call connectDB.
  // 'app' is used by supertest.
}

process.on("SIGINT", async () => {
  console.log("SIGINT signal received: closing HTTP server and DB");
  if (httpServer) {
    httpServer.close(async () => {
      console.log("HTTP server closed.");
      await disconnectDB();
      process.exit(0);
    });
  } else {
    await disconnectDB();
    process.exit(0);
  }
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM signal received: closing HTTP server and DB");
  if (httpServer) {
    httpServer.close(async () => {
      console.log("HTTP server closed.");
      await disconnectDB();
      process.exit(0);
    });
  } else {
    await disconnectDB();
    process.exit(0);
  }
});

// If startServer is called directly (e.g. by tests or if not in 'test' env and not using require.main check)
// This block ensures `startServer` is available for explicit calls.
// The `if (process.env.NODE_ENV !== "test")` block above handles automatic startup.

export { app, startServer, stopServer }; // mongoose export removed
