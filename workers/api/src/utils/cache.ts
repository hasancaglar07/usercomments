type CacheHandler = () => Promise<Response>;

const CACHE_META_TIME_HEADER = "x-cache-time";
const CACHE_META_TTL_HEADER = "x-cache-ttl";

function buildCacheControl(ttlSeconds: number): string {
  const swrSeconds = Math.max(0, Math.floor(ttlSeconds / 2));
  const staleIfErrorSeconds = Math.max(ttlSeconds, swrSeconds * 2);
  const cacheControlParts = [
    "public",
    `max-age=${ttlSeconds}`,
    `s-maxage=${ttlSeconds}`,
  ];
  if (swrSeconds > 0) {
    cacheControlParts.push(`stale-while-revalidate=${swrSeconds}`);
  }
  cacheControlParts.push(`stale-if-error=${staleIfErrorSeconds}`);
  return cacheControlParts.join(", ");
}

function buildCacheableResponse(
  response: Response,
  ttlSeconds: number
): Response {
  const cacheable = new Response(response.body, response);
  cacheable.headers.set("Cache-Control", buildCacheControl(ttlSeconds));
  cacheable.headers.set(CACHE_META_TIME_HEADER, String(Date.now()));
  cacheable.headers.set(CACHE_META_TTL_HEADER, String(ttlSeconds));
  return cacheable;
}

function getCacheStatus(cached: Response, ttlSeconds: number): "HIT" | "STALE" {
  const cachedAt = Number(cached.headers.get(CACHE_META_TIME_HEADER));
  const cachedTtl = Number(cached.headers.get(CACHE_META_TTL_HEADER));
  const effectiveTtl =
    Number.isFinite(cachedTtl) && cachedTtl > 0 ? cachedTtl : ttlSeconds;
  if (!Number.isFinite(cachedAt) || cachedAt <= 0) {
    return "STALE";
  }
  const ageSeconds = Math.floor((Date.now() - cachedAt) / 1000);
  return ageSeconds >= effectiveTtl ? "STALE" : "HIT";
}

function stripCacheMetaHeaders(response: Response): Response {
  const stripped = new Response(response.body, response);
  stripped.headers.delete(CACHE_META_TIME_HEADER);
  stripped.headers.delete(CACHE_META_TTL_HEADER);
  return stripped;
}

async function revalidateCache(
  cache: Cache,
  cacheKey: Request,
  ttlSeconds: number,
  handler: CacheHandler
): Promise<void> {
  const response = await handler();
  if (!response.ok) {
    return;
  }
  const cacheable = buildCacheableResponse(response, ttlSeconds);
  await cache.put(cacheKey, cacheable.clone());
}

function normalizeUrl(url: URL): string {
  const entries: Array<[string, string]> = Array.from(
    url.searchParams.entries()
  );
  if (entries.length === 0) {
    return url.toString();
  }

  entries.sort((a, b) => {
    const keyCompare = a[0].localeCompare(b[0]);
    if (keyCompare !== 0) {
      return keyCompare;
    }
    return a[1].localeCompare(b[1]);
  });

  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    params.append(key, value);
  }

  const normalized = new URL(url.toString());
  normalized.search = params.toString();
  return normalized.toString();
}

export function buildCacheKeyRequest(request: Request): Request {
  const url = new URL(request.url);
  const normalized = normalizeUrl(url);
  return new Request(normalized, { method: "GET" });
}

export function buildCacheKeyFromUrl(url: string): Request {
  return buildCacheKeyRequest(new Request(url));
}

export async function purgeCacheUrls(urls: string[]): Promise<number> {
  const cache = (caches as CacheStorage & { default: Cache }).default ?? caches;
  let deleted = 0;
  for (const url of urls) {
    const key = buildCacheKeyFromUrl(url);
    const didDelete = await cache.delete(key);
    if (didDelete) {
      deleted += 1;
    }
  }
  return deleted;
}

export async function cacheResponse(
  request: Request,
  ctx: ExecutionContext,
  ttlSeconds: number,
  handler: CacheHandler
): Promise<Response> {
  if (request.method !== "GET") {
    return handler();
  }

  if (request.headers.get("authorization")) {
    return handler();
  }

  const cacheControl = request.headers.get("cache-control")?.toLowerCase() ?? "";
  if (cacheControl.includes("no-store") || cacheControl.includes("no-cache")) {
    return handler();
  }
  const pragma = request.headers.get("pragma")?.toLowerCase() ?? "";
  if (pragma.includes("no-cache")) {
    return handler();
  }

  const cache = (caches as CacheStorage & { default: Cache }).default ?? caches;
  const cacheKey = buildCacheKeyRequest(request);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const cacheStatus = getCacheStatus(cached, ttlSeconds);
    const hit = stripCacheMetaHeaders(cached);
    hit.headers.set("x-cache", cacheStatus);
    if (cacheStatus === "STALE") {
      ctx.waitUntil(revalidateCache(cache, cacheKey, ttlSeconds, handler));
    }
    return hit;
  }

  const response = await handler();
  if (response.ok) {
    const cacheable = buildCacheableResponse(response, ttlSeconds);
    const clientResponse = stripCacheMetaHeaders(cacheable.clone());
    clientResponse.headers.set("x-cache", "MISS");
    ctx.waitUntil(cache.put(cacheKey, cacheable));
    return clientResponse;
  }

  return response;
}
