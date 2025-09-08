// app/libs/redis.js
import IORedis from "ioredis";
import config from "../config/index.js";

const REDIS_URL = config.redis.url;

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
