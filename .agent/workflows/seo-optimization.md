---
description: Advanced SEO Optimization Strategy
---

# UserReview.net SEO Optimization Strategy

To maintain a "SEO Monster" status, follow this continuous improvement workflow.

## 1. Structured Data (Schema.org)
Ensure all new page types implement robust JSON-LD structured data.

- **Product Page**: Uses `Product` schema with `AggregateRating`, `Offers`, and `Review` snippets.
- **Review Page**: Uses `Review` schema linked to `Product` via `itemReviewed`, and includes `Comment` schema for user discussions.
- **Homepage**: Uses `WebSite` (with SearchAction) and `Organization` (with sameAs social links).
- **Profile Page**: Should implement `ProfilePage` and `Person` schema.

## 2. Internal Linking
- **Breadcrumbs**: Ensure every deep page has a `BreadcrumbList`.
- **Related Content**: Always show "Related Reviews" and "Related Products" to create crawl paths.
- **Tags/Categories**: Ensure category pages are indexable and have unique descriptions.

## 3. Performance (Core Web Vitals)
- **Images**: Always use `Next/Image` or Cloudflare R2 optimized URLs.
- **CLS**: Avoid layout shifts by reserving space for ads/images.
- **LCP**: Preload hero images (LCP element) on key pages.

## 4. Internationalization
- **hreflang**: Check `head` tags to ensure all language variants link to each other.
- **Canonicals**: Ensure self-referencing canonicals are correct for each language path.

## 5. Monitoring
- **GSC**: Check Google Search Console weekly for "Unparsable structured data".
- **Sitemap**: Verify `sitemap.xml` updates automatically with new content.

## 6. Content Quality
- **E-E-A-T**: Highlight author expertise (badges, review counts) to satisfy Google's Quality Rater Guidelines.
- **User Generated Content**: Moderate spam comments to prevent "UGC spam" penalties.
