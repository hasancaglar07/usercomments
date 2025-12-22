import type { Request, Response, NextFunction } from "express";
import { buildCacheKey, setCache, getCache } from "../utils/cache";

type CacheOptions = {
  prefix: string;
  ttlSeconds: number;
};

export function cacheResponse(options: CacheOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") {
      next();
      return;
    }

    const cacheKey = buildCacheKey(
      options.prefix,
      `${req.baseUrl}${req.path}`,
      req.query
    );

    try {
      const cached = await getCache(cacheKey);
      if (cached) {
        res.setHeader("x-cache", "HIT");
        res.json(JSON.parse(cached));
        return;
      }
    } catch {
      // ignore cache errors and continue to handler
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setCache(cacheKey, JSON.stringify(body), options.ttlSeconds).catch(
          () => {
            // ignore cache set errors
          }
        );
      }
      res.setHeader("x-cache", "MISS");
      return originalJson(body);
    };

    next();
  };
}
