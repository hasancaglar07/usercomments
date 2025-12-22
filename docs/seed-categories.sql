-- Seed base categories and subcategories for an initial catalog.
-- Run after schema.sql, search.sql, and moderation.sql.
with seed(name, parent_name) as (
  values
    ('Technology', null),
    ('Beauty', null),
    ('Hotels', null),
    ('Movies', null),
    ('Travel', null),
    ('Health', null),
    ('Automotive', null),
    ('Books', null),
    ('Finance', null),
    ('Kids', null),
    ('Smartphones', 'Technology'),
    ('Laptops', 'Technology'),
    ('Skincare', 'Beauty'),
    ('Makeup', 'Beauty'),
    ('Boutique Hotels', 'Hotels'),
    ('Budget Hotels', 'Hotels'),
    ('Action', 'Movies'),
    ('Drama', 'Movies')
)
insert into categories (name, parent_id)
select
  seed.name,
  parent.id
from seed
left join categories parent
  on parent.name = seed.parent_name
  and parent.parent_id is null
left join categories existing
  on existing.name = seed.name
  and (
    (seed.parent_name is null and existing.parent_id is null)
    or existing.parent_id = parent.id
  )
where existing.id is null
  and (seed.parent_name is null or parent.id is not null);
