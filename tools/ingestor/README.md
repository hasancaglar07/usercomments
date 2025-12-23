# iRecommend Ingestor

Python crawler/ingestor for iRecommend.ru that discovers categories, finds new reviews, translates to multiple languages with Groq, processes images, and writes to Supabase in an idempotent, low-load way.

## Requirements
- Python 3.10+
- Supabase project with tables from `ingestor/db/schema.sql`
- Groq API key
- Cloudflare R2 bucket with S3-compatible credentials

## Install
```bash
cd tools/ingestor
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Configure
Copy `.env.example` to `.env` and fill in values.

Key fields:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `R2_*`

Optional:
- `LOG_FILE` for file logging
- `USER_AGENT` for the crawler

## Apply schema
Use the reference schema in `ingestor/db/schema.sql`.
Example:
```bash
psql "$SUPABASE_DB_URL" -f tools/ingestor/ingestor/db/schema.sql
```

## Cloudflare R2 notes
- Create a bucket and make it public (or configure a public CDN URL).
- Generate S3-compatible access keys.
- Set `R2_PUBLIC_BASE_URL` to the public bucket base URL.
- The ingestor uploads to `public/reviews/<review_id>/<sha1>.webp`.

## Groq setup
- Create an API key in Groq console.
- Set `GROQ_API_KEY` and optional `GROQ_MODEL`.

## Run
Single run:
```bash
python -m ingestor.main --once
```

Loop mode with jitter sleep:
```bash
python -m ingestor.main
```

Dry run (no DB writes or uploads):
```bash
python -m ingestor.main --once --dry-run
```

## Troubleshooting
- `HTTP 403/429`: reduce `MAX_NEW_REVIEWS_PER_LOOP` or increase loop sleep window.
- `Invalid JSON from Groq`: the ingestor retries once with a repair prompt.
- `Slug conflict`: a short hash suffix is appended automatically.
- `Supabase permission errors`: verify service role key and RLS policies.
- `Image upload errors`: confirm R2 endpoint, region, and bucket name.

## Notes
- Reviews are deduped via `source_map` + `reviews.source_url`.
- Translations are written per language with canonical paths like `/<lang>/content/<slug>`.
- The crawler runs sequentially with retries/backoff to keep load low.
