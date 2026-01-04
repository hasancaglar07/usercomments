-- Review list performance indexes (homepage & catalog).
-- Use CONCURRENTLY to avoid blocking writes on large tables.
-- Note: CONCURRENTLY cannot run inside a transaction block.

create index concurrently if not exists idx_reviews_published_photos_created_at
  on reviews (created_at desc, id desc)
  where status = 'published' and photo_count > 0;

create index concurrently if not exists idx_reviews_published_photos_votes_up_views
  on reviews (votes_up desc, views desc, created_at desc)
  where status = 'published' and photo_count > 0;

-- Optional: improves join/filter by language when scanning review_translations.
-- create index concurrently if not exists idx_review_translations_lang_review_id
--   on review_translations (lang, review_id);
