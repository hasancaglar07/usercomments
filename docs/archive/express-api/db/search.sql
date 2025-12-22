create extension if not exists "pg_trgm";

alter table reviews
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(excerpt, '')), 'B') ||
    setweight(
      to_tsvector(
        'simple',
        coalesce(regexp_replace(content_html, '<[^>]+>', ' ', 'g'), '')
      ),
      'C'
    )
  ) stored;

create index if not exists idx_reviews_search_vector
  on reviews using gin (search_vector);

create index if not exists idx_reviews_title_trgm
  on reviews using gin (title gin_trgm_ops);

create or replace function public.search_reviews(
  query text,
  category_id int default null,
  page int default 1,
  page_size int default 10
)
returns table (
  id uuid,
  slug text,
  title text,
  excerpt text,
  rating_avg numeric,
  rating_count int,
  votes_up int,
  votes_down int,
  photo_urls jsonb,
  photo_count int,
  category_id int,
  sub_category_id int,
  created_at timestamptz,
  profiles jsonb,
  total_count bigint,
  rank real
)
language sql
stable
as $$
  with search_query as (
    select websearch_to_tsquery('simple', $1) as tsq
  ),
  filtered as (
    select
      r.id,
      r.slug,
      r.title,
      r.excerpt,
      r.rating_avg,
      r.rating_count,
      r.votes_up,
      r.votes_down,
      r.photo_urls,
      r.photo_count,
      r.category_id,
      r.sub_category_id,
      r.created_at,
      jsonb_build_object('username', p.username) as profiles,
      ts_rank(r.search_vector, search_query.tsq) as rank
    from reviews r
    join profiles p on p.user_id = r.user_id
    cross join search_query
    where r.search_vector @@ search_query.tsq
      and r.status = 'published'
      and ($2 is null or r.category_id = $2)
  ),
  counted as (
    select *, count(*) over() as total_count
    from filtered
  )
  select *
  from counted
  order by rank desc, created_at desc, id desc
  limit greatest($4, 1)
  offset (greatest($3, 1) - 1) * greatest($4, 1);
$$;
