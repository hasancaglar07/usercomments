import type { Request, Response, NextFunction } from "express";
import {
  RateLimiterMemory,
  RateLimiterRedis,
  type RateLimiterAbstract,
} from "rate-limiter-flexible";
import { env } from "../env";
import { getRedisClient, isRedisEnabled } from "../utils/redis";

let limiterPromise: Promise<RateLimiterAbstract> | null = null;
let warnedMemory = false;

async function createLimiter(): Promise<RateLimiterAbstract> {
  const points = env.RATE_LIMIT_MAX;
  const duration = env.RATE_LIMIT_WINDOW_SEC;

  if (isRedisEnabled()) {
    const client = await getRedisClient();
    if (client && client.isOpen) {
      return new RateLimiterRedis({
        storeClient: client,
        keyPrefix: "rate",
        points,
        duration,
      });
    }
  }

  if (!warnedMemory) {
    warnedMemory = true;
    console.warn(
      JSON.stringify({
        level: "warn",
        message: "rate_limit_fallback_memory",
      })
    );
  }

  return new RateLimiterMemory({ points, duration });
}

async function getLimiter(): Promise<RateLimiterAbstract> {
  if (!limiterPromise) {
    limiterPromise = createLimiter();
  }
  return limiterPromise;
}

export function rateLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limiter = await getLimiter();
      const key = `${req.ip ?? "unknown"}:${req.baseUrl}${req.path}`;
      await limiter.consume(key);
      next();
    } catch {
      res.status(429).json({ error: "Too Many Requests" });
    }
  };
}
