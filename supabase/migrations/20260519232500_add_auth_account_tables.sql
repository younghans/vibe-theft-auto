create table if not exists public.game_users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create index if not exists game_users_admin_idx
  on public.game_users (is_admin)
  where is_admin is true;

create table if not exists public.player_saves (
  world_key text not null,
  user_id uuid not null references public.game_users(id) on delete cascade,
  snapshot jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (world_key, user_id)
);

create index if not exists player_saves_user_updated_at_idx
  on public.player_saves (user_id, updated_at desc);

create or replace function public.set_current_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_player_saves_updated_at on public.player_saves;
create trigger set_player_saves_updated_at
  before update on public.player_saves
  for each row
  execute function public.set_current_updated_at();

create or replace function public.handle_new_game_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.game_users (id, display_name, created_at)
  values (
    new.id,
    nullif(
      coalesce(
        new.raw_user_meta_data->>'display_name',
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
      ),
      ''
    ),
    coalesce(new.created_at, now())
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_game_user on auth.users;
create trigger on_auth_user_created_game_user
  after insert on auth.users
  for each row
  execute function public.handle_new_game_user();

insert into public.game_users (id, display_name, created_at)
select
  users.id,
  nullif(
    coalesce(
      users.raw_user_meta_data->>'display_name',
      users.raw_user_meta_data->>'full_name',
      users.raw_user_meta_data->>'name',
      split_part(users.email, '@', 1)
    ),
    ''
  ) as display_name,
  users.created_at
from auth.users
on conflict (id) do nothing;

alter table public.game_users enable row level security;
alter table public.player_saves enable row level security;

revoke all on table public.game_users from anon, authenticated;
revoke all on table public.player_saves from anon, authenticated;

grant select on table public.game_users to authenticated;

drop policy if exists "game_users_select_own" on public.game_users;
create policy "game_users_select_own"
  on public.game_users
  for select
  to authenticated
  using ((select auth.uid()) = id);
