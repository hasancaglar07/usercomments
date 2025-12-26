create table if not exists source_map (
  source_url text primary key,
  source_slug text,
  discovered_at timestamptz default now(),
  last_seen_at timestamptz,
  status text not null default 'new' check (status in ('new','processing','processed','failed')),
  retries int not null default 0,
  last_error text,
  content_hash text
);

create table if not exists categories (
  id bigserial primary key,
  parent_id bigint references categories(id) on delete set null,
  source_url text unique,
  source_key text,
  name text,
  created_at timestamptz default now()
);

-- Note: Profile structure aligned with the project's main schema
create table if not exists profiles (
  user_id uuid primary key default gen_random_uuid(),
  username text unique not null,
  bio text,
  profile_pic_url text,
  role text default 'user',
  created_at timestamptz default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  source_url text unique not null,
  source_slug text,
  slug text,
  title text,
  excerpt text,
  content_html text,
  category_id bigint references categories(id) on delete set null,
  sub_category_id bigint references categories(id) on delete set null,
  user_id uuid references profiles(user_id) on delete set null,
  rating_avg numeric,
  rating_count int default 0,
  votes_up int default 0,
  votes_down int default 0,
  photo_urls jsonb,
  photo_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  status text default 'published',
  source text
);

create table if not exists review_translations (
  review_id uuid not null references reviews(id) on delete cascade,
  lang text not null,
  slug text not null,
  title text not null,
  content_html text,
  meta_title text,
  meta_description text,
  og_title text,
  og_description text,
  canonical_path text,
  primary key (review_id, lang)
);

create unique index if not exists review_translations_lang_slug_key
  on review_translations (lang, slug);


create table if not exists category_translations (
  category_id bigint not null references categories(id) on delete cascade,
  lang text not null,
  name text not null,
  slug text not null,
  primary key (category_id, lang)
);

create unique index if not exists category_translations_lang_slug_key
  on category_translations (lang, slug);
