create table if not exists user_follows (
  follower_user_id uuid not null references profiles(user_id) on delete cascade,
  following_user_id uuid not null references profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_follows_unique unique (follower_user_id, following_user_id),
  constraint user_follows_no_self_follow check (follower_user_id <> following_user_id)
);

create index if not exists idx_user_follows_follower_created
  on user_follows (follower_user_id, created_at desc);

create index if not exists idx_user_follows_following_created
  on user_follows (following_user_id, created_at desc);

alter table user_follows enable row level security;

drop policy if exists user_follows_select_own on user_follows;
create policy user_follows_select_own
  on user_follows for select
  using (follower_user_id = auth.uid());

drop policy if exists user_follows_insert_own on user_follows;
create policy user_follows_insert_own
  on user_follows for insert
  with check (follower_user_id = auth.uid() and follower_user_id <> following_user_id);

drop policy if exists user_follows_delete_own on user_follows;
create policy user_follows_delete_own
  on user_follows for delete
  using (follower_user_id = auth.uid());
