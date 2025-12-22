# iRecommend API

## Local setup

1. Install dependencies:

```bash
cd apps/api
npm install
```

2. Create a local env file:

```bash
cp .env.example .env
```

3. Fill in:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORT` (default `4000`)
- `CORS_ORIGIN` (default `http://localhost:3000`)
- Optional caching/rate limit/timeouts (see below)

4. Run the API:

```bash
npm run dev
```

## Apply the Supabase schema

1. Open Supabase SQL Editor.
2. Paste and run `apps/api/db/schema.sql`.

This creates the tables, constraints, and indexes used by the API.

## Apply search schema

1. Open Supabase SQL Editor.
2. Paste and run `apps/api/db/search.sql`.

This adds full-text search support (tsvector + GIN index) and the `search_reviews` RPC.

## Apply moderation schema

1. Open Supabase SQL Editor.
2. Paste and run `apps/api/db/moderation.sql`.

This adds roles/statuses (profiles/reviews/comments) and the reports table for moderation.

## Apply engagement schema

1. Open Supabase SQL Editor.
2. Paste and run `apps/api/db/engagement.sql`.

This adds view/comment counters, saved reviews, and helper RPCs for profile stats.

## Example requests

```bash
curl "http://localhost:4000/api/categories"
```

```bash
curl "http://localhost:4000/api/categories/1/subcategories"
```

```bash
curl "http://localhost:4000/api/reviews/popular?limit=8"
```

```bash
curl "http://localhost:4000/api/reviews/latest?limit=6"
```

```bash
curl "http://localhost:4000/api/reviews?categoryId=1&sort=latest&page=1&pageSize=10"
```

```bash
curl "http://localhost:4000/api/reviews/slug/iphone-15-pro-max-review"
```

```bash
curl "http://localhost:4000/api/reviews/550e8400-e29b-41d4-a716-446655440000/comments?limit=10"
```

```bash
curl "http://localhost:4000/api/users/jane_doe"
```

```bash
curl "http://localhost:4000/api/users/jane_doe/reviews?page=1&pageSize=10"
```

```bash
curl "http://localhost:4000/api/search?q=iphone&categoryId=1&page=1&pageSize=10"
```

```bash
curl "http://localhost:4000/api/sitemap/reviews?part=1&pageSize=5000"
```

```bash
curl "http://localhost:4000/api/sitemap/categories"
```

## Moderation endpoints

Public reporting (auth required):
- `POST /api/reviews/:id/report`
- `POST /api/comments/:id/report`
- `POST /api/users/:userId/report`

Admin/moderator:
- `GET /api/admin/reports?status=&page=&pageSize=`
- `PATCH /api/admin/reports/:id`
- `PATCH /api/admin/reviews/:id/status`
- `PATCH /api/admin/comments/:id/status`
- `PATCH /api/admin/users/:userId/role` (admin only)

## Redis caching + rate limiting

If `REDIS_URL` is set, the API uses Redis for:
- Shared response cache (read endpoints)
- Distributed rate limiting

If `REDIS_URL` is not set, it falls back to in-memory LRU caching and a memory rate limiter (intended for dev only).

## Recommended env vars (defaults)

- `REDIS_URL` (optional)
- `RATE_LIMIT_WINDOW_SEC=60`
- `RATE_LIMIT_MAX=60`
- `REQUEST_BODY_LIMIT=1mb`
- `SERVER_TIMEOUT_MS=30000`
- `SERVER_HEADERS_TIMEOUT_MS=35000`
- `SERVER_KEEP_ALIVE_TIMEOUT_MS=5000`
- `CACHE_MAX_ITEMS=500`
- `CACHE_TTL_CATEGORIES_SEC=21600`
- `CACHE_TTL_SUBCATEGORIES_SEC=21600`
- `CACHE_TTL_POPULAR_SEC=45`
- `CACHE_TTL_LATEST_SEC=45`
- `CACHE_TTL_REVIEW_LIST_SEC=60`
- `CACHE_TTL_REVIEW_SEC=90`
- `CACHE_TTL_USER_SEC=90`
- `CACHE_TTL_USER_REVIEWS_SEC=90`
- `CACHE_TTL_SEARCH_SEC=30`
- `CACHE_TTL_SITEMAP_SEC=300`

## Search implementation

- Full-text search uses a generated `search_vector` column (title + excerpt + sanitized content_html).
- The API calls the `search_reviews` Postgres function to rank results via `ts_rank`.
- Results are cached for a short TTL.

## Sitemap endpoints

- `GET /api/sitemap/reviews?part=&pageSize=` returns paged review slugs and timestamps.
- `GET /api/sitemap/categories` returns all categories for `/catalog/reviews/[id]`.
- Both endpoints are cached (see `CACHE_TTL_SITEMAP_SEC`).

## Production readiness notes

- Run the API behind a reverse proxy with TLS (nginx, Caddy, or Cloudflare).
- Use a process manager (pm2 or systemd) to keep the server alive.
- Enable Redis for shared caching and rate limiting.
- Set `CORS_ORIGIN` to the exact web origin(s).

## Frontend switch plan (mock -> API)

1. Set `NEXT_PUBLIC_API_BASE_URL` in `apps/web/.env.local` to the API base URL (for example, `http://localhost:4000`).
2. Replace mock data imports with fetch calls to the API endpoints:
   - Categories: `GET /api/categories`
   - Review lists: `GET /api/reviews`, `/api/reviews/popular`, `/api/reviews/latest`
   - Review detail: `GET /api/reviews/slug/:slug`
   - Comments: `GET /api/reviews/:id/comments`
   - User profile and reviews: `GET /api/users/:username` and `/api/users/:username/reviews`
   - Search: `GET /api/search`
3. Map API responses directly to the existing frontend types in `apps/web/src/types.ts`.
