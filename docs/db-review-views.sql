-- Review view events (for leaderboard trending + analytics)
create table if not exists review_views (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  review_author_id uuid not null,
  viewer_user_id uuid,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_review_views_review_author_created_at
  on review_views (review_author_id, created_at desc);

create index if not exists idx_review_views_review_id_created_at
  on review_views (review_id, created_at desc);

create index if not exists idx_review_views_created_at
  on review_views (created_at desc);
