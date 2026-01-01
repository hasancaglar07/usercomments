-- Product/brand schema additions for iRecommend-style catalog.
create extension if not exists "pgcrypto";

-- Brands
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists brand_translations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  lang text not null,
  slug text not null unique,
  name text not null,
  meta_title text,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, lang)
);

-- Products
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  source_url text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table products
  add column if not exists brand_id uuid references brands(id) on delete set null;
alter table products
  add column if not exists source_url text;

create table if not exists product_translations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  lang text not null,
  slug text not null unique,
  name text not null,
  description text,
  meta_title text,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, lang)
);

create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(user_id) on delete set null
);

create table if not exists product_categories (
  product_id uuid not null references products(id) on delete cascade,
  category_id int not null references categories(id) on delete restrict,
  primary key (product_id, category_id)
);

create table if not exists product_stats (
  product_id uuid primary key references products(id) on delete cascade,
  review_count int not null default 0,
  rating_avg numeric not null default 0,
  rating_count int not null default 0,
  recommend_up int not null default 0,
  recommend_down int not null default 0,
  photo_count int not null default 0,
  updated_at timestamptz not null default now()
);

-- Review extensions
alter table reviews
  add column if not exists product_id uuid references products(id) on delete set null;

alter table reviews
  add column if not exists recommend boolean;

alter table reviews
  add column if not exists pros text[];

alter table reviews
  add column if not exists cons text[];

create index if not exists idx_reviews_product_id on reviews (product_id);
create index if not exists idx_products_status on products (status);
create index if not exists idx_products_source_url on products (source_url);
create index if not exists idx_product_translations_lang on product_translations (lang);
create index if not exists idx_brand_translations_lang on brand_translations (lang);
create index if not exists idx_product_categories_category_id on product_categories (category_id);

-- Stats refresh helpers
create or replace function public.refresh_product_stats(product_uuid uuid)
returns void
language plpgsql
as $$
begin
  if product_uuid is null then
    return;
  end if;

  insert into product_stats (
    product_id,
    review_count,
    rating_avg,
    rating_count,
    recommend_up,
    recommend_down,
    photo_count,
    updated_at
  )
  select
    product_uuid,
    count(*) filter (where r.status = 'published'),
    coalesce(avg(r.rating_avg) filter (where r.status = 'published'), 0),
    count(r.rating_avg) filter (where r.status = 'published' and r.rating_avg is not null),
    count(*) filter (where r.status = 'published' and r.recommend is true),
    count(*) filter (where r.status = 'published' and r.recommend is false),
    coalesce(sum(
      coalesce(
        r.photo_count,
        jsonb_array_length(coalesce(r.photo_urls, '[]'::jsonb))
      )
    ) filter (where r.status = 'published'), 0),
    now()
  from reviews r
  where r.product_id = product_uuid
  on conflict (product_id)
  do update set
    review_count = excluded.review_count,
    rating_avg = excluded.rating_avg,
    rating_count = excluded.rating_count,
    recommend_up = excluded.recommend_up,
    recommend_down = excluded.recommend_down,
    photo_count = excluded.photo_count,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.handle_review_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_product_stats(new.product_id);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.product_id is distinct from old.product_id then
      perform public.refresh_product_stats(old.product_id);
    end if;
    perform public.refresh_product_stats(new.product_id);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.refresh_product_stats(old.product_id);
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_reviews_stats_after_change on reviews;
create trigger trg_reviews_stats_after_change
after insert or update or delete on reviews
for each row execute function public.handle_review_change();
