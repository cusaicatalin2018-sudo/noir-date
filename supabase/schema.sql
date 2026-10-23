-- Noir starter schema. Run in Supabase SQL Editor after creating a project.
-- The browser may use only the publishable/anon key; never expose service_role.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  birth_date date not null,
  bio text not null default '' check (char_length(bio) <= 500),
  city text not null default '',
  discoverable boolean not null default true,
  created_at timestamptz not null default now(),
  constraint profiles_adult_only check (birth_date <= (current_date - interval '18 years')::date)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user),
  check (from_user <> to_user)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references public.profiles(id) on delete cascade,
  user_high uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_low < user_high),
  unique (user_low, user_high)
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

create index if not exists likes_to_user_idx on public.likes (to_user);

create or replace function public.is_conversation_member(target_conversation uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation and cm.user_id = (select auth.uid())
  );
$$;

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.likes enable row level security;
alter table public.matches enable row level security;

drop policy if exists "Members can view discoverable adult profiles" on public.profiles;
create policy "Members can view discoverable adult profiles"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (discoverable and birth_date <= (current_date - interval '18 years')::date));
drop policy if exists "Members can create their own adult profile" on public.profiles;
create policy "Members can create their own adult profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) and birth_date <= (current_date - interval '18 years')::date);
drop policy if exists "Members can update their own profile" on public.profiles;
create policy "Members can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and birth_date <= (current_date - interval '18 years')::date);

drop policy if exists "Members can read their conversations" on public.conversations;
create policy "Members can read their conversations"
  on public.conversations for select to authenticated
  using (public.is_conversation_member(id));
drop policy if exists "Members can read conversation membership" on public.conversation_members;
create policy "Members can read conversation membership"
  on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));
drop policy if exists "Members can read messages in their conversations" on public.messages;
create policy "Members can read messages in their conversations"
  on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id));
drop policy if exists "Members can send messages as themselves" on public.messages;
create policy "Members can send messages as themselves"
  on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id));

grant select, insert, update on public.profiles to authenticated;
grant select on public.conversations, public.conversation_members to authenticated;
grant select, insert on public.messages to authenticated;

drop policy if exists "Users can read likes involving them" on public.likes;
create policy "Users can read likes involving them" on public.likes for select to authenticated
  using (from_user = (select auth.uid()) or to_user = (select auth.uid()));
drop policy if exists "Users can read their matches" on public.matches;
create policy "Users can read their matches" on public.matches for select to authenticated
  using (user_low = (select auth.uid()) or user_high = (select auth.uid()));
grant select on public.likes, public.matches to authenticated;

create or replace function public.like_profile(target_user uuid)
returns table (is_match boolean, match_id uuid)
language plpgsql security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  low_user uuid;
  high_user uuid;
  created_match uuid;
begin
  if actor is null then raise exception 'Sign in is required'; end if;
  if target_user is null or target_user = actor then raise exception 'Invalid profile'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = target_user and p.discoverable
      and p.birth_date <= (current_date - interval '18 years')::date
  ) then raise exception 'Profile unavailable'; end if;

  insert into public.likes(from_user, to_user) values (actor, target_user)
    on conflict (from_user, to_user) do nothing;

  if exists (select 1 from public.likes l where l.from_user = target_user and l.to_user = actor) then
    low_user := least(actor, target_user);
    high_user := greatest(actor, target_user);
    insert into public.matches(user_low, user_high) values (low_user, high_user)
      on conflict (user_low, user_high) do update set user_low = excluded.user_low
      returning id into created_match;
    return query select true, created_match;
  else
    return query select false, null::uuid;
  end if;
end;
$$;
revoke all on function public.like_profile(uuid) from public, anon;
grant execute on function public.like_profile(uuid) to authenticated;

create or replace function public.create_match_conversation()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  new_conversation uuid;
begin
  insert into public.conversations default values returning id into new_conversation;
  insert into public.conversation_members(conversation_id, user_id)
    values (new_conversation, new.user_low), (new_conversation, new.user_high);
  return new;
end;
$$;
drop trigger if exists on_noir_match_create_conversation on public.matches;
create trigger on_noir_match_create_conversation
  after insert on public.matches for each row execute procedure public.create_match_conversation();

-- Profiles are created after email confirmation. The database repeats the age
-- check so a browser-side age prompt alone cannot bypass the rule.
create or replace function public.create_noir_profile()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  user_birth_date date;
  user_display_name text;
begin
  user_birth_date := (new.raw_user_meta_data ->> 'birth_date')::date;
  user_display_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  if user_birth_date is null or user_birth_date > (current_date - interval '18 years')::date then
    raise exception 'Noir is available only to adults aged 18 or older';
  end if;
  insert into public.profiles (id, display_name, birth_date)
  values (new.id, coalesce(user_display_name, 'Membru Noir'), user_birth_date);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_noir_profile on auth.users;
create trigger on_auth_user_created_noir_profile
  after insert on auth.users
  for each row execute procedure public.create_noir_profile();

