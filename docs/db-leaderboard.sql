-- Leaderboard performance indexes
create index if not exists idx_reviews_published_user_id
  on reviews (user_id)
  where status = 'published';

create index if not exists idx_reviews_published_created_at
  on reviews (created_at desc)
  where status = 'published';

create index if not exists idx_review_votes_up_created_at
  on review_votes (created_at desc, review_id)
  where type = 'up';

create index if not exists idx_review_votes_up_review_id
  on review_votes (review_id, created_at desc)
  where type = 'up';

-- Optional: materialized view for all-time leaderboard stats.
-- Refresh manually or via a scheduled job when needed.
create materialized view if not exists leaderboard_user_stats as
select
  user_id,
  count(*)::bigint as review_count,
  coalesce(sum(views), 0)::bigint as total_views,
  coalesce(sum(votes_up), 0)::bigint as total_votes
from reviews
where status = 'published'
group by user_id;

create unique index if not exists idx_leaderboard_user_stats_user_id
  on leaderboard_user_stats (user_id);

create or replace function public.refresh_leaderboard_user_stats()
returns void
language plpgsql
as $$
begin
  refresh materialized view leaderboard_user_stats;
end;
$$;
