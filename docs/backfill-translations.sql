-- Backfill translations and review content_html
-- Run in Supabase SQL editor. Adjust DEFAULT_LANG if needed.

-- Preview counts before changes
select count(*) as missing_default_category_translations
from categories c
left join category_translations ct
  on ct.category_id = c.id and ct.lang = 'en'
where ct.category_id is null;

select count(*) as missing_default_product_translations
from products p
left join product_translations pt
  on pt.product_id = p.id and pt.lang = 'en'
where pt.product_id is null;

select count(*) as reviews_missing_content_html
from reviews
where (content_html is null or btrim(content_html) = '')
  and excerpt is not null and btrim(excerpt) <> '';

select count(*) as review_translations_missing_content_html
from review_translations
where (content_html is null or btrim(content_html) = '')
  and excerpt is not null and btrim(excerpt) <> '';

-- 1) Ensure default category translations exist
insert into category_translations (category_id, lang, name, slug)
select c.id, 'en', c.name, null
from categories c
left join category_translations ct
  on ct.category_id = c.id and ct.lang = 'en'
where ct.category_id is null;

-- 2) Ensure default product translations exist
insert into product_translations (product_id, lang, slug, name, description)
select p.id, 'en', p.slug, p.name, p.description
from products p
left join product_translations pt
  on pt.product_id = p.id and pt.lang = 'en'
where pt.product_id is null;

-- 3) Backfill empty review content_html from excerpt in reviews
update reviews
set content_html = excerpt
where (content_html is null or btrim(content_html) = '')
  and excerpt is not null and btrim(excerpt) <> '';

-- 4) Backfill empty review content_html from excerpt in review_translations
update review_translations
set content_html = excerpt
where (content_html is null or btrim(content_html) = '')
  and excerpt is not null and btrim(excerpt) <> '';

-- Verify after changes
select count(*) as missing_default_category_translations_after
from categories c
left join category_translations ct
  on ct.category_id = c.id and ct.lang = 'en'
where ct.category_id is null;

select count(*) as missing_default_product_translations_after
from products p
left join product_translations pt
  on pt.product_id = p.id and pt.lang = 'en'
where pt.product_id is null;

select count(*) as reviews_missing_content_html_after
from reviews
where (content_html is null or btrim(content_html) = '')
  and excerpt is not null and btrim(excerpt) <> '';

select count(*) as review_translations_missing_content_html_after
from review_translations
where (content_html is null or btrim(content_html) = '')
  and excerpt is not null and btrim(excerpt) <> '';
