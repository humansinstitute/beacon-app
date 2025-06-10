// tests/jest.globalTeardown.js
import redisConnection from "../app/libs/redis.js";

export default async () => {
  if (redisConnection && typeof redisConnection.quit === "function") {
    console.log("Jest globalTeardown: Attempting to close Redis connection...");
    try {
      await redisConnection.quit();
      console.log("Jest globalTeardown: Redis connection closed successfully.");
    } catch (error) {
      console.error(
        "Jest globalTeardown: Error closing Redis connection:",
        error
      );
    }
  } else {
    console.warn(
      "Jest globalTeardown: Redis connection not found or 'quit' method is missing."
    );
  }
};
