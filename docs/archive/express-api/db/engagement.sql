create extension if not exists "pgcrypto";

alter table reviews
  add column if not exists views int not null default 0,
  add column if not exists comment_count int not null default 0;

create table if not exists saved_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(user_id) on delete cascade,
  review_id uuid not null references reviews(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_reviews_unique_user_review unique (user_id, review_id)
);

create index if not exists idx_saved_reviews_user_id
  on saved_reviews (user_id, created_at desc);

create index if not exists idx_reviews_views
  on reviews (views desc);

create or replace function public.increment_review_view(review_id uuid)
returns table (views int)
language sql
volatile
as $$
  update reviews
  set views = views + 1
  where id = review_id
    and status = 'published'
  returning views;
$$;

create or replace function public.get_user_stats(target_user_id uuid)
returns table (
  review_count bigint,
  total_views bigint,
  total_votes bigint,
  total_comments bigint
)
language sql
stable
as $$
  select
    count(*)::bigint as review_count,
    coalesce(sum(views), 0)::bigint as total_views,
    coalesce(sum(votes_up), 0)::bigint as total_votes,
    coalesce(sum(comment_count), 0)::bigint as total_comments
  from reviews
  where user_id = target_user_id
    and status = 'published';
$$;

create or replace function public.get_user_commented_reviews(
  target_user_id uuid,
  page int default 1,
  page_size int default 10
)
returns table (
  id uuid,
  slug text,
  title text,
  excerpt text,
  content_html text,
  rating_avg numeric,
  rating_count int,
  views int,
  votes_up int,
  votes_down int,
  photo_urls jsonb,
  photo_count int,
  comment_count int,
  category_id int,
  sub_category_id int,
  created_at timestamptz,
  profiles jsonb,
  total_count bigint
)
language sql
stable
as $$
  with filtered as (
    select
      r.id,
      r.slug,
      r.title,
      r.excerpt,
      r.content_html,
      r.rating_avg,
      r.rating_count,
      r.views,
      r.votes_up,
      r.votes_down,
      r.photo_urls,
      r.photo_count,
      r.comment_count,
      r.category_id,
      r.sub_category_id,
      r.created_at,
      jsonb_build_object(
        'username', p.username,
        'profile_pic_url', p.profile_pic_url
      ) as profiles,
      c.created_at as comment_created_at
    from comments c
    join reviews r on r.id = c.review_id
    join profiles p on p.user_id = r.user_id
    where c.user_id = target_user_id
      and c.status = 'published'
      and r.status = 'published'
  ),
  deduped as (
    select distinct on (id) *, count(*) over() as total_count
    from filtered
    order by id, comment_created_at desc
  )
  select
    id,
    slug,
    title,
    excerpt,
    content_html,
    rating_avg,
    rating_count,
    views,
    votes_up,
    votes_down,
    photo_urls,
    photo_count,
    comment_count,
    category_id,
    sub_category_id,
    created_at,
    profiles,
    total_count
  from deduped
  order by comment_created_at desc, id desc
  limit greatest(page_size, 1)
  offset (greatest(page, 1) - 1) * greatest(page_size, 1);
$$;

drop function if exists public.search_reviews(text, integer, integer, integer);

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
  views int,
  votes_up int,
  votes_down int,
  photo_urls jsonb,
  photo_count int,
  comment_count int,
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
      r.views,
      r.votes_up,
      r.votes_down,
      r.photo_urls,
      r.photo_count,
      r.comment_count,
      r.category_id,
      r.sub_category_id,
      r.created_at,
      jsonb_build_object(
        'username', p.username,
        'profile_pic_url', p.profile_pic_url
      ) as profiles,
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

create or replace function public.sync_review_comment_count()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    if new.status = 'published' then
      update reviews
      set comment_count = comment_count + 1
      where id = new.review_id;
    end if;
    return new;
  elsif (tg_op = 'UPDATE') then
    if old.status <> new.status then
      if old.status = 'published' then
        update reviews
        set comment_count = greatest(comment_count - 1, 0)
        where id = new.review_id;
      elsif new.status = 'published' then
        update reviews
        set comment_count = comment_count + 1
        where id = new.review_id;
      end if;
    end if;
    return new;
  elsif (tg_op = 'DELETE') then
    if old.status = 'published' then
      update reviews
      set comment_count = greatest(comment_count - 1, 0)
      where id = old.review_id;
    end if;
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_comments_sync_count on comments;
create trigger trg_comments_sync_count
after insert or update or delete on comments
for each row execute function public.sync_review_comment_count();
