create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.farm_memberships (
  farm_id uuid not null references public.farms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'manager', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (farm_id, user_id)
);

create index farm_memberships_user_id_idx on public.farm_memberships (user_id);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.farm_memberships enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create or replace function public.is_farm_member(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.farm_memberships
    where farm_id = target_farm_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.can_manage_farm(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.farm_memberships
    where farm_id = target_farm_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_farm_member(uuid) from public, anon;
revoke all on function public.can_manage_farm(uuid) from public, anon;
grant execute on function public.is_farm_member(uuid) to authenticated;
grant execute on function public.can_manage_farm(uuid) to authenticated;

create policy "Farm members can read their farms"
  on public.farms for select to authenticated
  using ((select public.is_farm_member(id)));

create policy "Farm owners and admins can update their farms"
  on public.farms for update to authenticated
  using ((select public.can_manage_farm(id)))
  with check ((select public.can_manage_farm(id)));

create policy "Farm members can read memberships"
  on public.farm_memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_farm_member(farm_id))
  );

create or replace function public.create_farm(farm_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_farm_id uuid;
  normalized_name text := trim(farm_name);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if normalized_name is null or char_length(normalized_name) not between 1 and 100 then
    raise exception 'Farm name must contain 1 to 100 characters';
  end if;

  insert into public.farms (name)
  values (normalized_name)
  returning id into created_farm_id;

  insert into public.farm_memberships (farm_id, user_id, role)
  values (created_farm_id, auth.uid(), 'owner');

  return created_farm_id;
end;
$$;

revoke all on function public.create_farm(text) from public, anon;
grant execute on function public.create_farm(text) to authenticated;

create or replace function public.api_health_check()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select true;
$$;

revoke all on function public.api_health_check() from public;
grant execute on function public.api_health_check() to anon, authenticated;

grant select, update on public.farms to authenticated;
grant select on public.farm_memberships to authenticated;
grant select, insert, update on public.profiles to authenticated;
