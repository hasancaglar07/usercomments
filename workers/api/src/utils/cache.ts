type CacheHandler = () => Promise<Response>;

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

function buildCacheKeyRequest(request: Request): Request {
  const url = new URL(request.url);
  const normalized = normalizeUrl(url);
  return new Request(normalized, { method: "GET" });
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

  const cache = (caches as CacheStorage & { default: Cache }).default ?? caches;
  const cacheKey = buildCacheKeyRequest(request);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const hit = new Response(cached.body, cached);
    hit.headers.set("x-cache", "HIT");
    return hit;
  }

  const response = await handler();
  if (response.ok) {
    const cacheable = new Response(response.body, response);
    cacheable.headers.set("Cache-Control", `public, max-age=${ttlSeconds}`);
    cacheable.headers.set("x-cache", "MISS");
    ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));
    return cacheable;
  }

  return response;
}
