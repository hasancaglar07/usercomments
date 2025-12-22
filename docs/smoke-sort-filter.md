# Sort + Filter Smoke Checklist

## Prereqs
- Web app running with `NEXT_PUBLIC_API_BASE_URL` set.
- API running with seed data in categories, reviews, and subcategories.

## Web Smoke Steps
1) `/catalog` sort changes list order
- Load `/catalog` (no params). Confirm default sort is latest.
- Change sort to "Highest Rated" and confirm list order changes.
- Change sort to "Most Discussed" and confirm list order changes.
- Pagination keeps `sort` in the URL and list order stays consistent.

2) `/catalog` category filter + pagination
- Click a category pill; URL includes `categoryId` and list updates.
- Click another pill; URL updates `categoryId` and list updates.
- Paginate and confirm `categoryId` stays in URL and filter remains applied.

3) `/catalog/reviews/[id]` subcategory chip + sort + pagination
- Open a category page like `/catalog/reviews/1`.
- Click a subcategory chip; URL includes `subCategoryId` and list updates.
- Change sort; URL includes `sort` and list order updates.
- Paginate; URL preserves `subCategoryId` and `sort`.

4) Reload state
- On `/catalog` with `sort` + `categoryId` set, reload and confirm UI matches URL.
- On `/catalog/reviews/[id]` with `sort` + `subCategoryId` set, reload and confirm UI matches URL.

5) `/search`
- Search with `/search?q=term`.
- Select a category filter; URL includes `categoryId` and results update.
- Paginate; URL preserves `q` and `categoryId`.

## API Checks
- `/api/reviews?sort=latest` orders by `created_at desc`.
- `/api/reviews?sort=popular` orders by `votes_up desc`.
- `/api/reviews?sort=rating` orders by `rating_avg desc`, then `rating_count desc`.
- `/api/reviews?categoryId=X&subCategoryId=Y` filters correctly.
- `/api/search` is rank-based (no `sort` parameter supported in UI).

## Cache Validation
- Repeat `/api/reviews` requests with different `sort/categoryId/subCategoryId/page` values and confirm they are cached independently (check `x-cache` header and response differences).
