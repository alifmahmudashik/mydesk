-- Migration 004: collaborators — user profiles, per-project access, role-based RLS.
-- Run once in the Supabase SQL editor. Roles: owner (you) > admin > member.
-- Members only see projects they're granted, their tasks/checklist/notes, and client
-- names via those projects. Payments are admin-only.

-- ---------- Profiles ----------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile on signup; the very first user becomes the owner.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, display_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    split_part(coalesce(new.email, 'user'), '@', 1),
    case when not exists (select 1 from profiles) then 'owner' else 'member' end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that already exist; make the earliest one owner if none is.
insert into profiles (id, email, display_name, role)
select u.id, coalesce(u.email, ''), split_part(coalesce(u.email, 'user'), '@', 1), 'member'
from auth.users u
on conflict (id) do nothing;

update profiles set role = 'owner'
where id = (select id from profiles order by created_at limit 1)
  and not exists (select 1 from profiles where role = 'owner');

-- ---------- Project membership ----------
create table if not exists project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

-- ---------- Helper functions (security definer so policies can use them) ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role in ('owner','admin')) $$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'owner') $$;

create or replace function public.my_project_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select project_id from project_members where user_id = auth.uid() $$;

-- Only the owner may change roles (guards against self-promotion via the API).
create or replace function public.guard_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not is_owner() then
    raise exception 'Only the owner can change roles';
  end if;
  return new;
end $$;

drop trigger if exists profiles_role_guard on profiles;
create trigger profiles_role_guard
  before update on profiles
  for each row execute function public.guard_role_change();

-- ---------- Activity log: record who did it ----------
alter table activity_log add column if not exists actor_id uuid default auth.uid();

-- ---------- Row level security ----------
alter table profiles enable row level security;
alter table project_members enable row level security;

-- Replace the single-owner policies with role-aware ones.
do $$
declare t text;
begin
  foreach t in array array['clients','projects','tasks','access_items','payments','project_notes','activity_log'] loop
    execute format('drop policy if exists "owner_all" on %I', t);
  end loop;
end $$;

-- profiles: any signed-in user can see the team; self or owner can update (role guarded by trigger)
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select using (auth.uid() is not null);
drop policy if exists "profiles_update" on profiles;
create policy "profiles_update" on profiles for update
  using (id = auth.uid() or is_owner()) with check (id = auth.uid() or is_owner());

-- project_members: admins manage; members can see their own grants
drop policy if exists "pm_admin_all" on project_members;
create policy "pm_admin_all" on project_members for all using (is_admin()) with check (is_admin());
drop policy if exists "pm_member_select" on project_members;
create policy "pm_member_select" on project_members for select using (user_id = auth.uid());

-- clients: admins everything; members read clients behind their granted projects
drop policy if exists "clients_admin_all" on clients;
create policy "clients_admin_all" on clients for all using (is_admin()) with check (is_admin());
drop policy if exists "clients_member_select" on clients;
create policy "clients_member_select" on clients for select
  using (exists (select 1 from projects p where p.client_id = clients.id and p.id in (select my_project_ids())));

-- projects: admins everything; members read + update (status etc.) granted projects
drop policy if exists "projects_admin_all" on projects;
create policy "projects_admin_all" on projects for all using (is_admin()) with check (is_admin());
drop policy if exists "projects_member_select" on projects;
create policy "projects_member_select" on projects for select using (id in (select my_project_ids()));
drop policy if exists "projects_member_update" on projects;
create policy "projects_member_update" on projects for update
  using (id in (select my_project_ids())) with check (id in (select my_project_ids()));

-- tasks / access_items / project_notes: admins everything; members full CRUD within granted projects
do $$
declare t text;
begin
  foreach t in array array['tasks','access_items','project_notes'] loop
    execute format('drop policy if exists "%s_admin_all" on %I', t, t);
    execute format('create policy "%s_admin_all" on %I for all using (is_admin()) with check (is_admin())', t, t);
    execute format('drop policy if exists "%s_member_all" on %I', t, t);
    execute format('create policy "%s_member_all" on %I for all using (project_id in (select my_project_ids())) with check (project_id in (select my_project_ids()))', t, t);
  end loop;
end $$;

-- payments: strictly admin-only
drop policy if exists "payments_admin_all" on payments;
create policy "payments_admin_all" on payments for all using (is_admin()) with check (is_admin());

-- activity_log: admins see all; members write their own entries and read them back
drop policy if exists "activity_admin_all" on activity_log;
create policy "activity_admin_all" on activity_log for all using (is_admin()) with check (is_admin());
drop policy if exists "activity_member_insert" on activity_log;
create policy "activity_member_insert" on activity_log for insert
  with check (actor_id = auth.uid());
drop policy if exists "activity_member_select" on activity_log;
create policy "activity_member_select" on activity_log for select using (actor_id = auth.uid());
