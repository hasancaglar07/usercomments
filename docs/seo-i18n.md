# SEO + I18N Architecture

## Routing
- Public pages are served under `/{lang}/...` where `lang` is one of `en`, `tr`, `es`, `de`, `ar`.
- Default language is detected from browser/region (Accept-Language + geo). Missing or unknown prefixes redirect to the detected language (fallback: `/en`) while preserving path and query.
- Arabic (`ar`) renders with `dir="rtl"` and `lang="ar"`.
- Russian (`ru`) content is not exposed publicly.

## Canonical + Hreflang
- Canonical URL always points to the current language URL.
- `hreflang` alternates are emitted for each supported language.
- `x-default` points to the `/en/...` URL.
- Review detail pages use language-specific slugs from `review_translations.slug`.

## Missing Translations
- If a requested translation does not exist, the user is redirected to the `/en/...` version.
- This keeps SEO consistent and avoids orphaned language URLs.

## Sitemap Strategy
- `/sitemap.xml` is an index listing per-language sitemaps:
  - `/sitemap-en.xml`
  - `/sitemap-tr.xml`
  - `/sitemap-es.xml`
  - `/sitemap-de.xml`
  - `/sitemap-ar.xml`
- Each per-language sitemap includes:
  - Homepage
  - Catalog
  - Category pages
  - Review detail pages
- Sharding is supported via `/sitemap-{lang}-{part}.xml` when URLs exceed 50k.
- Sitemaps are cached at the edge for 30-60 minutes.
