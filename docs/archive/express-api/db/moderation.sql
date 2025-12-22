create extension if not exists "pgcrypto";

alter table profiles
  add column if not exists role text not null default 'user';

alter table reviews
  add column if not exists status text not null default 'published';

alter table comments
  add column if not exists status text not null default 'published';

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references profiles(user_id) on delete cascade,
  target_type text not null,
  target_id text not null,
  reason text not null,
  details text,
  created_at timestamptz not null default now(),
  status text not null default 'open'
);

create index if not exists idx_reports_status_created_at
  on reports (status, created_at desc);
