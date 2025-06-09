// app/libs/redis.js
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // Keep retrying indefinitely
  // enableOfflineQueue: false, // If true, commands are queued when offline
});

redisConnection.on("connect", () => {
  console.log("Connected to Redis");
});

redisConnection.on("error", (err) => {
  console.error("Redis connection error:", err);
});

export default redisConnection;
