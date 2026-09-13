import "server-only";
import { AppError } from "@/lib/errors";

/**
 * Fixed-window rate limiter. Uses Redis when REDIS_URL is set (correct across
 * serverless instances); otherwise falls back to an in-process map, which is good
 * enough for local development and single-instance deployments.
 */
interface Options { limit: number; windowSeconds: number }

const memory = new Map<string, { count: number; resetAt: number }>();

async function redisIncr(key: string, windowSeconds: number): Promise<number | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const { default: IORedis } = await import("ioredis");
    const client = getRedis(IORedis);
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, windowSeconds);
    return count;
  } catch {
    return null; // Redis unavailable: fall back rather than blocking the request.
  }
}

type RedisCtor = typeof import("ioredis").default;
let redis: InstanceType<RedisCtor> | null = null;
function getRedis(Ctor: RedisCtor) {
  if (!redis) redis = new Ctor(process.env.REDIS_URL!, { maxRetriesPerRequest: 2, lazyConnect: false });
  return redis;
}

export async function rateLimit(key: string, { limit, windowSeconds }: Options): Promise<void> {
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const scoped = `rl:${key}:${window}`;

  const viaRedis = await redisIncr(scoped, windowSeconds);
  if (viaRedis !== null) {
    if (viaRedis > limit) throw new AppError("RATE_LIMITED", "You're doing that a bit too quickly. Please wait a moment and try again.");
    return;
  }

  const now = Date.now();
  const entry = memory.get(scoped);
  if (!entry || entry.resetAt < now) {
    memory.set(scoped, { count: 1, resetAt: now + windowSeconds * 1000 });
    if (memory.size > 5000) for (const [k, v] of memory) if (v.resetAt < now) memory.delete(k);
    return;
  }
  entry.count += 1;
  if (entry.count > limit) throw new AppError("RATE_LIMITED", "You're doing that a bit too quickly. Please wait a moment and try again.");
}
