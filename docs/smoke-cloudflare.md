# Cloudflare Worker Smoke Checklist

## Prerequisites
- `cd workers/api && npm install`
- Secrets configured (via `wrangler secret put`):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `B2_S3_ENDPOINT`
  - `B2_S3_REGION`
  - `B2_S3_ACCESS_KEY_ID`
  - `B2_S3_SECRET_ACCESS_KEY`
  - `B2_S3_BUCKET`
  - `B2_PUBLIC_BASE_URL`

## Run locally
```bash
cd workers/api
npm run dev
```

## Curl checks (local)
```bash
# Health
curl -i http://localhost:8787/api/health

# Categories (expect cache headers + x-cache)
curl -i http://localhost:8787/api/categories

# Latest reviews
curl -i http://localhost:8787/api/reviews/latest

# Search
curl -i "http://localhost:8787/api/search?q=test"

# Presign upload (auth required; expect 401 without token)
curl -i -X POST http://localhost:8787/api/uploads/presign \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.jpg","contentType":"image/jpeg"}'
```

## Rate limiting notes
- Write endpoints are rate-limited per IP and per user (in-memory).
- Expect `429 Too Many Requests` after bursts; `Retry-After` header is included.
- This is per-instance only; global enforcement requires Durable Objects or KV.
