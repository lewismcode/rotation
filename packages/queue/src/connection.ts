import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as { __rotationRedis?: IORedis };

/**
 * Shared Redis connection for BullMQ. maxRetriesPerRequest must be null for
 * BullMQ blocking commands.
 */
export function connection(): IORedis {
  if (globalForRedis.__rotationRedis) return globalForRedis.__rotationRedis;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  const client = new IORedis(url, { maxRetriesPerRequest: null });
  globalForRedis.__rotationRedis = client;
  return client;
}
