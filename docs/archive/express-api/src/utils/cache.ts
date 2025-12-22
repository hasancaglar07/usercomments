import type { Request } from "express";
import { LRUCache } from "lru-cache";
import { env } from "../env";
import { getRedisClient, isRedisEnabled } from "./redis";

const CACHE_NAMESPACE = "irec";
const DEFAULT_MAX_ITEMS = 500;

const memoryCache = new LRUCache<string, string>({
  max: env.CACHE_MAX_ITEMS ?? DEFAULT_MAX_ITEMS,
});

let warnedMemory = false;

function normalizeQuery(query: Request["query"]): string {
  const entries: Array<[string, string]> = [];
  for (const key of Object.keys(query).sort()) {
    const value = query[key];
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      const sortedValues = value.map(String).sort();
      for (const item of sortedValues) {
        entries.push([key, item]);
      }
      continue;
    }
    if (typeof value === "object") {
      entries.push([key, JSON.stringify(value)]);
      continue;
    }
    entries.push([key, String(value)]);
  }

  if (entries.length === 0) {
    return "";
  }

  const params = new URLSearchParams();
  for (const [key, value] of entries.sort((a, b) => {
    const keyCompare = a[0].localeCompare(b[0]);
    if (keyCompare !== 0) {
      return keyCompare;
    }
    return a[1].localeCompare(b[1]);
  })) {
    params.append(key, value);
  }
  return params.toString();
}

export function buildCacheKey(
  prefix: string,
  path: string,
  query?: Request["query"]
): string {
  const normalizedQuery = query ? normalizeQuery(query) : "";
  const querySuffix = normalizedQuery ? `?${normalizedQuery}` : "";
  return `${CACHE_NAMESPACE}:${prefix}:${path}${querySuffix}`;
}

export function buildPrefix(prefix: string): string {
  return `${CACHE_NAMESPACE}:${prefix}:`;
}

export async function getCache(key: string): Promise<string | null> {
  if (isRedisEnabled()) {
    const client = await getRedisClient();
    if (client) {
      try {
        return await client.get(key);
      } catch {
        // fall back to memory cache
      }
    }
  }

  if (!warnedMemory) {
    warnedMemory = true;
    console.warn(
      JSON.stringify({
        level: "warn",
        message: "cache_fallback_memory",
      })
    );
  }

  return memoryCache.get(key) ?? null;
}

export async function setCache(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  if (isRedisEnabled()) {
    const client = await getRedisClient();
    if (client) {
      try {
        await client.set(key, value, { EX: ttlSeconds });
        return;
      } catch {
        // fall back to memory cache
      }
    }
  }

  memoryCache.set(key, value, { ttl: ttlSeconds * 1000 });
}

export async function deleteCache(key: string): Promise<void> {
  if (isRedisEnabled()) {
    const client = await getRedisClient();
    if (client) {
      try {
        await client.del(key);
        return;
      } catch {
        // fall back to memory cache
      }
    }
  }

  memoryCache.delete(key);
}

export async function deleteByPrefix(prefix: string): Promise<void> {
  if (isRedisEnabled()) {
    const client = await getRedisClient();
    if (!client) {
      return;
    }
    try {
      const match = `${prefix}*`;
      let cursor = 0;
      do {
        const result = await client.scan(cursor, { MATCH: match, COUNT: 200 });
        cursor = result.cursor;
        if (result.keys.length > 0) {
          await client.del(result.keys);
        }
      } while (cursor !== 0);
      return;
    } catch {
      // fall back to memory cache
    }
  }

  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}
