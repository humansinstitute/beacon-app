// app/libs/redis.js
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const isTestEnv = process.env.NODE_ENV === "test";

const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

redisConnection.on("connect", () => {
  if (!isTestEnv) console.log("Connected to Redis");
});

redisConnection.on("error", (err) => {
  if (!isTestEnv) console.error("Redis connection error:", err);
});

export default redisConnection;
