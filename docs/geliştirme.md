# Gelistirme Plani (Audit + Uygulama)

## Summary of Current Gaps
- Production pages can fall back to mock data or static stitched HTML when the API fails.
- Core navigation is broken in list views (catalog/search/home cards are not clickable).
- Catalog and category pagination controls render as buttons with no navigation.
- Category page content is hardcoded (title, description, tags), not sourced from API categories/subcategories.
- Several UI actions are placeholders (filters, sort, forms, CTA buttons).

## Inventory

### Current app routes (`apps/web/app`)
- `/`
- `/catalog`
- `/catalog/reviews/[id]`
- `/content/[slug]`
- `/users/[username]`
- `/user/login`
- `/node/add/review`
- `/forgot-password`
- `/contact`
- `/privacy-policy`
- `/terms-of-use`
- `/search`
- `/health`
- `/robots.txt`
- `/sitemap.xml`
- `/sitemap-categories.xml`
- `/sitemap-reviews-[part].xml`

### Stitch coverage mapping (`stitch_homepage/*/code.html`)
- `stitch_homepage/homepage` -> `/`
- `stitch_homepage/catalog_page` -> `/catalog`
- `stitch_homepage/category_page__güzellik_ve_sağlık` -> `/catalog/reviews/[id]`
- `stitch_homepage/individual_review_page` -> `/content/[slug]`
- `stitch_homepage/user_profile_page` -> `/users/[username]`
- `stitch_homepage/login_page` -> `/user/login`
- `stitch_homepage/add_review_page` -> `/node/add/review`
- `stitch_homepage/forgot_password_page` -> `/forgot-password`
- `stitch_homepage/contact_us_page` -> `/contact`
- `stitch_homepage/privacy_policy_page` -> `/privacy-policy`
- `stitch_homepage/terms_of_use_page` -> `/terms-of-use`

### Missing stitched routes
- None found. (`/catalog/list/[id-subid]` is not present in stitch.)

## Audit Findings (Per Page)

### `/` (homepage)
- Navigation links: review cards are not clickable to `/content/[slug]`.
- Buttons: "Load More Reviews" and filter pills do nothing.
- Forms: header search form is wired to `/search`.
- Categories/subcategories: secondary nav is static; popular categories use API but fallback to mock.
- Data source: API with mock fallback in `apps/web/app/(site)/page.tsx`.
- API mismatches: none blocking.

### `/catalog`
- Navigation links: review cards are not clickable to `/content/[slug]`.
- Buttons: sort select and category filter pills are static.
- Pagination: buttons are not linked (no navigation).
- Data source: API with mock fallback in `apps/web/app/(site)/catalog/page.tsx`.
- API mismatches: `sort` query is ignored; only "latest" is used.

### `/catalog/reviews/[id]`
- Navigation links: breadcrumb label and page heading are hardcoded.
- Buttons: subcategory chips and sort select are static.
- Pagination: buttons are not linked (no navigation).
- Categories/subcategories: no dynamic subcategory filter; "Popular Tags" uses mock.
- Data source: API with mock fallback in `apps/web/app/(site)/catalog/reviews/[id]/page.tsx`.
- API mismatches: API supports `subCategoryId`, UI does not pass it.

### `/content/[slug]`
- Navigation links: breadcrumb categories are hardcoded.
- Buttons: vote/comment rely on client script; require auth.
- Forms: comment form is wired via `ReviewDetailClient`.
- Data source: uses API, but falls back to `fallbackBodyHtml` when API fails.
- API mismatches: placeholder view counts and author stats are hardcoded.

### `/users/[username]`
- Navigation links: "Read full review" link works; tabs are query-only.
- Buttons: Follow/Message/More buttons are static.
- Data source: API with mock fallback in `apps/web/app/(site)/users/[username]/page.tsx`.
- API mismatches: profile stats beyond `reviewCount` are not provided by API (UI derives some).

### `/user/login`
- Buttons: social login buttons are static.
- Forms: sign-in/sign-up wired to Supabase; session does not persist.
- Data source: Supabase auth only.

### `/node/add/review`
- Buttons: upload/rating/publish wired; "Save Draft" is static.
- Forms: category select uses API but falls back to static options.
- Categories/subcategories: no subcategory selection.
- Data source: API categories + create review.

### `/search`
- Navigation links: review cards are not clickable to `/content/[slug]`.
- Pagination: buttons are not linked (no navigation).
- Data source: API only when query exists; fallback categories are mock.
- API mismatches: no category filter UI for search.

### `/privacy-policy`, `/terms-of-use`, `/contact`
- Forms: contact form `action="#"` and attachment button are static.
- Data source: static pages.

### `/health`
- Works; shows API reachability via `/api/health`.

## Backlog (Prioritized)

### P0 - Production Blockers

- Route/Page: `/`, `/catalog`, `/catalog/reviews/[id]`, `/users/[username]`, `/search`, `/node/add/review`, `/content/[slug]`
  - Broken/Missing: production can show mock data or stitched fallback when API fails.
  - Root cause: mock imports and fallbacks in `apps/web/app/(site)/*` and `fallbackBodyHtml` in `apps/web/app/(site)/content/[slug]/page.tsx`.
  - Fix steps:
    1) Add `NEXT_PUBLIC_ALLOW_MOCK_FALLBACK` and enforce `NODE_ENV !== "production"` gating.
    2) Replace mock fallbacks with empty data + minimal error banner in production.
    3) Update env examples to include `NEXT_PUBLIC_ALLOW_MOCK_FALLBACK=false`.
  - Acceptance criteria: in production, no data is sourced from `apps/web/data/mock`; API failure shows minimal error state.

- Route/Page: `/`, `/catalog`, `/search`
  - Broken/Missing: review cards are not clickable to detail pages.
  - Root cause: missing anchor in `apps/web/components/cards/ReviewCard.tsx` (homepage + catalog cards).
  - Fix steps: wrap review titles with `<a href="/content/[slug]">`.
  - Acceptance criteria: clicking a review title navigates to `/content/[slug]`.

- Route/Page: `/catalog`, `/search`, `/catalog/reviews/[id]`
  - Broken/Missing: pagination controls do not navigate.
  - Root cause: `apps/web/components/ui/Pagination.tsx` renders buttons without links.
  - Fix steps:
    1) Add `buildHref` support to pagination components.
    2) Pass query-aware builders from pages.
  - Acceptance criteria: pagination updates URL and loads the correct page.

- Route/Page: `/catalog/reviews/[id]`
  - Broken/Missing: category title/breadcrumb and subcategory chips are hardcoded.
  - Root cause: hardcoded text and static chip markup in `apps/web/app/(site)/catalog/reviews/[id]/page.tsx`.
  - Fix steps:
    1) Use API categories to derive category name and breadcrumb.
    2) Render subcategory chips from API and allow filtering by `subCategoryId`.
  - Acceptance criteria: category name and chips reflect API data; filtering by subcategory works.

### P1 - Core UX

- Route/Page: `/catalog`
  - Broken/Missing: sort dropdown and category filter pills are static.
  - Root cause: no query binding in `apps/web/app/(site)/catalog/page.tsx`.
  - Fix steps: bind to `sort` and `categoryId` query params and pass to API.
  - Acceptance criteria: sort/filter updates list.

- Route/Page: `/catalog/reviews/[id]`
  - Broken/Missing: sort dropdown is static.
  - Root cause: `apps/web/components/lists/ReviewList.tsx` select does not update query.
  - Fix steps: bind select to `sort` query param.
  - Acceptance criteria: selecting sort changes API query and list.

- Route/Page: `/node/add/review`
  - Broken/Missing: no subcategory selection.
  - Root cause: add-review form only loads top-level categories.
  - Fix steps: load subcategories after category selection and submit `subCategoryId`.
  - Acceptance criteria: review can be submitted with subcategory.

- Route/Page: `/`
  - Broken/Missing: filter pills and "Load More" are static.
  - Root cause: no handlers in `apps/web/app/(site)/page.tsx` and `apps/web/components/lists/ReviewList.tsx`.
  - Fix steps: add cursor pagination or link to catalog.
  - Acceptance criteria: filtering or load more updates content.

- Route/Page: `/users/[username]`
  - Broken/Missing: tabs and follow/message actions are static.
  - Root cause: UI-only controls in `apps/web/components/lists/ReviewList.tsx`.
  - Fix steps: implement tab filtering or disable with clear state.
  - Acceptance criteria: tabs change visible content or are explicitly disabled.

- Route/Page: `/search`
  - Broken/Missing: no category filter UI.
  - Root cause: no filter controls in `apps/web/app/(site)/search/page.tsx`.
  - Fix steps: add category filter bound to API query.
  - Acceptance criteria: search can be filtered by category.

- Route/Page: `/user/login`, `/node/add/review`, `/content/[slug]`
  - Broken/Missing: auth session is memory-only; actions break after refresh.
  - Root cause: `persistSession: false` in `apps/web/src/lib/supabase.ts` and `getAccessToken` uses in-memory state.
  - Fix steps: enable session persistence and sync `accessToken`.
  - Acceptance criteria: auth persists across refresh and actions work.

### P2 - Polish

- Route/Page: `/contact`, `/forgot-password`, footer newsletter
  - Broken/Missing: forms and CTA buttons are static.
  - Root cause: placeholders in stitched HTML files.
  - Fix steps: wire to backend or mark explicitly as disabled.
  - Acceptance criteria: form submissions either work or show clear disabled state.

- Route/Page: `/content/[slug]`, `/catalog`
  - Broken/Missing: static placeholders (views, breadcrumbs, "Popular in Electronics").
  - Root cause: hardcoded markup in `apps/web/app/(site)/content/[slug]/page.tsx`.
  - Fix steps: replace with API-driven data where available.
  - Acceptance criteria: placeholders replaced with real data or hidden when unavailable.
