-- Search indexes and functions for review/product translations.
-- Run after docs/i18n.sql and docs/db-products.sql.

create extension if not exists "pg_trgm";

alter table if exists review_translations
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

create index if not exists idx_review_translations_search_vector
  on review_translations using gin (search_vector);

create index if not exists idx_review_translations_title_trgm
  on review_translations using gin (title gin_trgm_ops);

alter table if exists product_translations
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored;

create index if not exists idx_product_translations_search_vector
  on product_translations using gin (search_vector);

create index if not exists idx_product_translations_name_trgm
  on product_translations using gin (name gin_trgm_ops);

create or replace function public.search_reviews_i18n(
  query text,
  target_lang text,
  category_id int default null,
  page int default 1,
  page_size int default 10
)
returns table (
  review_id uuid,
  review_slug text,
  review_title text,
  review_excerpt text,
  review_content_html text,
  rating_avg numeric,
  rating_count int,
  views int,
  votes_up int,
  votes_down int,
  photo_urls jsonb,
  photo_count int,
  comment_count int,
  recommend boolean,
  pros text[],
  cons text[],
  review_category_id int,
  review_sub_category_id int,
  product_id uuid,
  created_at timestamptz,
  profile_username text,
  profile_pic_url text,
  product_slug text,
  product_name text,
  translation_lang text,
  translation_slug text,
  translation_title text,
  translation_excerpt text,
  translation_content_html text,
  translation_meta_title text,
  translation_meta_description text,
  total_count bigint,
  score real
)
language sql
stable
as $$
  with search_query as (
    select
      websearch_to_tsquery('simple', $1) as tsq,
      $1 as raw_query,
      '%' || replace(replace($1, '%', '\\%'), '_', '\\_') || '%' as pattern
  ),
  filtered as (
    select
      r.id as review_id,
      r.slug as review_slug,
      r.title as review_title,
      r.excerpt as review_excerpt,
      r.content_html as review_content_html,
      r.rating_avg,
      r.rating_count,
      r.views,
      r.votes_up,
      r.votes_down,
      r.photo_urls,
      r.photo_count,
      r.comment_count,
      r.recommend,
      r.pros,
      r.cons,
      r.category_id as review_category_id,
      r.sub_category_id as review_sub_category_id,
      r.product_id,
      r.created_at,
      p.username as profile_username,
      p.profile_pic_url,
      prod.slug as product_slug,
      prod.name as product_name,
      rt.lang as translation_lang,
      rt.slug as translation_slug,
      rt.title as translation_title,
      rt.excerpt as translation_excerpt,
      rt.content_html as translation_content_html,
      rt.meta_title as translation_meta_title,
      rt.meta_description as translation_meta_description,
      (
        ts_rank_cd(rt.search_vector, search_query.tsq) * 0.75 +
        similarity(rt.title, search_query.raw_query) * 0.2 +
        (ln(coalesce(r.votes_up, 0) + 1) + ln(coalesce(r.views, 0) + 1)) * 0.05
      ) as score
    from review_translations rt
    join reviews r on r.id = rt.review_id
    left join profiles p on p.user_id = r.user_id
    left join products prod on prod.id = r.product_id
    cross join search_query
    where rt.lang = $2
      and r.status = 'published'
      and ($3 is null or r.category_id = $3)
      and (
        rt.search_vector @@ search_query.tsq
        or rt.title ilike search_query.pattern
      )
  ),
  counted as (
    select *, count(*) over() as total_count
    from filtered
  )
  select *
  from counted
  order by score desc nulls last, created_at desc, review_id desc
  limit greatest($5, 1)
  offset (greatest($4, 1) - 1) * greatest($5, 1);
$$;

create or replace function public.search_products_i18n(
  query text,
  target_lang text,
  limit_count int default 10,
  include_pending boolean default false
)
returns table (
  product_id uuid,
  translation_lang text,
  translation_slug text,
  translation_name text,
  translation_description text,
  score real
)
language sql
stable
as $$
  with search_query as (
    select
      websearch_to_tsquery('simple', $1) as tsq,
      $1 as raw_query,
      '%' || replace(replace($1, '%', '\\%'), '_', '\\_') || '%' as pattern
  )
  select
    p.id as product_id,
    pt.lang as translation_lang,
    pt.slug as translation_slug,
    pt.name as translation_name,
    pt.description as translation_description,
    (
      ts_rank_cd(pt.search_vector, search_query.tsq) * 0.75 +
      similarity(pt.name, search_query.raw_query) * 0.2 +
      ln(coalesce(ps.review_count, 0) + 1) * 0.05
    ) as score
  from product_translations pt
  join products p on p.id = pt.product_id
  left join product_stats ps on ps.product_id = p.id
  cross join search_query
  where pt.lang = $2
    and (
      p.status in ('published', 'hidden')
      or ($4 is true and p.status = 'pending')
    )
    and (
      pt.search_vector @@ search_query.tsq
      or pt.name ilike search_query.pattern
      or pt.slug ilike search_query.pattern
    )
  order by score desc nulls last, product_id desc
  limit greatest($3, 1);
$$;
