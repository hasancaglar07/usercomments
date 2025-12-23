# Cloudflare Deployment (Pages + Workers)

## Overview
- Web: Cloudflare Pages (Next.js App Router via OpenNext adapter).
- API: Cloudflare Workers (`workers/api`).
- DB/Auth: Supabase (service role key stays server-side only).
- Images: Cloudflare R2 (S3-compatible) with presigned uploads.

## Worker (API) Setup

### Install and run locally
```bash
cd workers/api
npm install
npm run dev
```

### Required secrets
Set these with `wrangler secret put`:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `R2_ENDPOINT`
- `R2_REGION` (optional, default: `auto`)
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`

Example:
```bash
cd workers/api
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put R2_ENDPOINT
wrangler secret put R2_REGION
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put R2_BUCKET
wrangler secret put R2_PUBLIC_BASE_URL
```

### Optional tuning (secrets)
These fall back to defaults if unset:
- `RATE_LIMIT_WINDOW_SEC` (default: 60)
- `RATE_LIMIT_MAX` (default: 60)
- `CACHE_TTL_CATEGORIES_SEC` (default: 21600)
- `CACHE_TTL_SUBCATEGORIES_SEC` (default: 21600)
- `CACHE_TTL_LATEST_SEC` (default: 60)
- `CACHE_TTL_POPULAR_SEC` (default: 60)
- `CACHE_TTL_REVIEW_LIST_SEC` (default: 60)
- `CACHE_TTL_REVIEW_SEC` (default: 90)
- `CACHE_TTL_REVIEW_COMMENTS_SEC` (default: 30)
- `CACHE_TTL_PRODUCTS_SEC` (default: 300)
- `CACHE_TTL_PRODUCT_SEC` (default: 300)
- `CACHE_TTL_PRODUCT_REVIEWS_SEC` (default: 60)
- `CACHE_TTL_USER_SEC` (default: 90)
- `CACHE_TTL_USER_REVIEWS_SEC` (default: 90)
- `CACHE_TTL_SEARCH_SEC` (default: 30)
- `CACHE_TTL_SITEMAP_SEC` (default: 1800)

### Rate limiting note
- The Worker uses an in-memory token bucket per instance. This limits abuse but is not globally consistent across the edge.
- If you need stronger enforcement, plan a future upgrade to Durable Objects or KV-based rate limiting.

### Deploy the Worker
```bash
cd workers/api
npm run deploy
```

## Pages (Web) Setup

### Build locally
```bash
cd apps/web
npm install
npx opennextjs-cloudflare build
```

Pages build output directory:
- `.open-next/assets`

Worker entry (used by OpenNext/Wrangler):
- `.open-next/worker.js`

### OpenNext notes
- `@opennextjs/cloudflare` does not support `export const runtime = "edge";` yet; remove it from pages before deploying.
- If you plan to use `opennextjs-cloudflare preview/deploy/upload`, ensure Wrangler is `>= 3.99.0`.

### Pages environment variables
Set these in Cloudflare Pages:
- `NEXT_PUBLIC_API_BASE_URL` (Worker URL, e.g. `https://api.example.com`)
- Use the Worker origin only (do not append `/api`).
- `NEXT_PUBLIC_SITE_URL` (web URL, e.g. `https://example.com`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_ALLOW_MOCK_FALLBACK=false`

### Recommended routing
- Prefer a single hostname (e.g. `example.com`) and route `/api/*` to the Worker.
- If you use a separate API domain, set `NEXT_PUBLIC_API_BASE_URL` to that domain.

## SEO Notes
- Sitemaps are available via the web routes and via Worker endpoints.
- Worker sitemap endpoints are cached for 30-60 minutes by default.
- Keep `robots.txt` in `apps/web` and ensure it points to the canonical sitemap URLs.
- Product sitemaps are exposed as `sitemap-products-[lang].xml` and paginated by `sitemap-products-[lang]-[part].xml`.
