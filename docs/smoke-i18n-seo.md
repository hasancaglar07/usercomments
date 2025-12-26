# I18N + SEO Smoke Checklist

- `/catalog` redirects to `/<detected-lang>/catalog` (Accept-Language/geo) and preserves query params.
- `/en/catalog` renders and metadata includes canonical + hreflang alternates.
- `/ar/content/<slug>` sets `lang="ar"` and `dir="rtl"` with correct canonical URL.
- `/sitemap.xml` returns an index with 5 language sitemaps.
- `/robots.txt` references `/sitemap.xml`.
- Missing translations on `/de/content/<slug>` redirect to the `/en/...` version.
