-- i18n tables for localized content.
-- Run after core schema (reviews, categories).

create table if not exists review_translations (
  review_id uuid not null references reviews(id) on delete cascade,
  lang text not null,
  slug text not null,
  title text not null,
  excerpt text,
  content_html text,
  meta_title text,
  meta_description text,
  primary key (review_id, lang)
);

-- Keep slugs globally unique to support slug lookup without lang fallback ambiguity.
create unique index if not exists review_translations_slug_key
  on review_translations (slug);
create index if not exists review_translations_lang_idx
  on review_translations (lang);

create table if not exists category_translations (
  category_id int not null references categories(id) on delete cascade,
  lang text not null,
  name text not null,
  slug text,
  primary key (category_id, lang)
);

create index if not exists category_translations_lang_idx
  on category_translations (lang);

-- Apply to existing databases.
create extension if not exists unaccent;

create or replace function slugify_ascii(value text) returns text as $$
  select trim(both '-' from regexp_replace(
    lower(
      unaccent(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(
                          replace(
                            replace(coalesce(value, ''), chr(305), 'i'),
                            chr(304),
                            'i'
                          ),
                          chr(223),
                          'ss'
                        ),
                        chr(241),
                        'n'
                      ),
                      chr(209),
                      'n'
                    ),
                    chr(230),
                    'ae'
                  ),
                  chr(198),
                  'ae'
                ),
                chr(248),
                'o'
              ),
              chr(216),
              'o'
            ),
            chr(339),
            'oe'
          ),
          chr(338),
          'oe'
        )
      )
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
$$ language sql immutable;

alter table if exists review_translations
  add column if not exists excerpt text;
alter table if exists category_translations
  add column if not exists slug text;

insert into category_translations (category_id, lang, name)
select c.id, 'en', c.name
from categories c
left join category_translations ct
  on ct.category_id = c.id
  and ct.lang = 'en'
where ct.category_id is null;

-- Optional backfill for default language excerpts.
update review_translations as rt
set excerpt = r.excerpt
from reviews as r
where rt.review_id = r.id
  and rt.excerpt is null
  and rt.lang = 'en';

with candidate_slugs as (
  select
    ct.category_id,
    ct.lang,
    nullif(slugify_ascii(ct.name), '') as base_slug,
    row_number() over (
      partition by ct.lang, nullif(slugify_ascii(ct.name), '')
      order by ct.category_id
    ) as slug_rank
  from category_translations ct
  where coalesce(ct.slug, '') = ''
),
resolved as (
  select
    category_id,
    lang,
    case
      when base_slug is null then null
      when slug_rank = 1 then base_slug
      else base_slug || '-' || slug_rank
    end as slug
  from candidate_slugs
)
update category_translations ct
set slug = resolved.slug
from resolved
where ct.category_id = resolved.category_id
  and ct.lang = resolved.lang
  and resolved.slug is not null;

-- If this fails, ensure slugs are unique per language before re-running.
create unique index if not exists category_translations_lang_slug_key
  on category_translations (lang, slug)
  where slug is not null;
