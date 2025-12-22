type Bucket = {
  tokens: number;
  lastRefill: number;
  lastSeen: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10000;

export type RateLimitResult = {
  allowed: boolean;
  retryAfter?: number;
};

export function getClientIp(request: Request): string {
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return "unknown";
}

export function checkRateLimit(
  key: string,
  max: number,
  windowSec: number
): RateLimitResult {
  const now = Date.now() / 1000;
  const rate = max / windowSec;
  const bucket = buckets.get(key) ?? {
    tokens: max,
    lastRefill: now,
    lastSeen: now,
  };

  const elapsed = now - bucket.lastRefill;
  if (elapsed > 0) {
    bucket.tokens = Math.min(max, bucket.tokens + elapsed * rate);
    bucket.lastRefill = now;
  }

  bucket.lastSeen = now;

  if (bucket.tokens < 1) {
    const retryAfter = Math.ceil((1 - bucket.tokens) / rate);
    buckets.set(key, bucket);
    return { allowed: false, retryAfter };
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
  cleanupBuckets(now, windowSec);
  return { allowed: true };
}

function cleanupBuckets(now: number, windowSec: number) {
  if (buckets.size < MAX_BUCKETS) {
    return;
  }
  const cutoff = now - windowSec * 10;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.lastSeen < cutoff) {
      buckets.delete(key);
    }
  }
}
