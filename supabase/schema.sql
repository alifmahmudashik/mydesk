-- MyDesk — complete database setup (single file, safe to re-run any time).
-- Paste this whole file into the Supabase SQL editor and run it.
--
-- Idempotent by design: every statement uses IF NOT EXISTS / IF EXISTS / CREATE
-- OR REPLACE / DROP POLICY IF EXISTS, so running it again (or on a database that
-- already has some of this applied from an earlier partial run) is always safe —
-- nothing errors, nothing duplicates. This is the ONLY file you need; it replaces
-- the old schema.sql + migration-002..006 chain.
--
-- Entities: clients -> projects -> tasks / access_items / payments / project_notes,
-- plus activity_log, and a collaborator layer (profiles + client_members) with
-- role-based access: owner > admin > member. Granting a member a client gives them
-- full read/write on every project and task under it; payments/budgets/client
-- contact details stay admin-only.

create extension if not exists "pgcrypto";

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  company_name text,
  use_company_name boolean not null default false,
  email text,
  phone text,
  website text,
  country text,
  timezone text,
  status text not null default 'active' check (status in ('active','paused','completed','archived')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  title text not null,
  project_type text,
  description text,
  amount numeric(12,2) default 0,
  currency text not null default 'USD',
  start_date date,
  due_date date,
  status text not null default 'not_started' check (status in ('not_started','in_progress','waiting_for_client','blocked','completed','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid','refunded','overdue')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','review','done','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  due_date date,
  assignee_id uuid references auth.users (id),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists access_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  access_name text not null,
  description text,
  status text not null default 'needed' check (status in ('needed','requested','received','not_needed')),
  is_required boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  -- one invoice can cover multiple projects; membership is app-managed (arrays can't FK)
  project_ids uuid[] not null default '{}',
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  status text not null default 'unpaid' check (status in ('unpaid','partial','paid','refunded','overdue')),
  payment_method text,
  invoice_url text,
  payment_date date,
  due_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists project_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  note text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  actor_id uuid default auth.uid(),
  entity text not null check (entity in ('client','project','task','access_item','payment','note')),
  entity_id uuid not null,
  action text not null check (action in ('created','updated','status_changed','completed','paid','deleted')),
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now()
);

-- Grants a user every project (and task) under this client.
create table if not exists client_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, user_id)
);

-- ============================================================================
-- Column safety net — adds anything an older partial run might be missing.
-- (create table if not exists above only creates NEW tables; it can't retrofit
-- columns onto a table that already existed from an earlier run.)
-- ============================================================================

alter table clients add column if not exists use_company_name boolean not null default false;
alter table tasks add column if not exists assignee_id uuid references auth.users (id);
alter table activity_log add column if not exists actor_id uuid default auth.uid();
alter table payments add column if not exists project_ids uuid[] not null default '{}';

-- Old single-project payments column: migrate any data over, then drop it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'project_id'
  ) then
    update payments set project_ids = array[project_id]
    where project_id is not null and project_ids = '{}';
    alter table payments drop column project_id;
  end if;
end $$;

-- Old per-project membership table: fold any grants up to client-level, then drop it.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'project_members'
  ) then
    insert into client_members (client_id, user_id)
    select distinct p.client_id, pm.user_id
    from project_members pm
    join projects p on p.id = pm.project_id
    on conflict (client_id, user_id) do nothing;
    drop table project_members;
  end if;
end $$;

-- ============================================================================
-- Indexes
-- ============================================================================

create index if not exists idx_projects_client on projects (client_id);
create index if not exists idx_tasks_project on tasks (project_id);
create index if not exists idx_access_project on access_items (project_id);
create index if not exists idx_payments_client on payments (client_id);
create index if not exists idx_payments_projects on payments using gin (project_ids);
create index if not exists idx_notes_project on project_notes (project_id);
create index if not exists idx_activity_created on activity_log (created_at desc);

-- ============================================================================
-- Functions & triggers
-- ============================================================================

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
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role in ('owner','admin')) $$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'owner') $$;

create or replace function public.my_client_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select client_id from client_members where user_id = auth.uid() $$;

create or replace function public.my_project_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select id from projects where client_id in (select my_client_ids()) $$;

-- Anyone may promote/demote another user between admin and member. Two
-- exceptions stay locked down: the owner role only changes hands via the
-- owner, and nobody can change their own role (blocks self-escalation).
create or replace function public.guard_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    if new.role = 'owner' or old.role = 'owner' then
      if not is_owner() then
        raise exception 'Only the owner can change the owner role';
      end if;
    elsif new.id = auth.uid() then
      raise exception 'You cannot change your own role';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_role_guard on profiles;
create trigger profiles_role_guard
  before update on profiles
  for each row execute function public.guard_role_change();

-- Backfill profiles for any auth users that predate the profiles table;
-- make the earliest one owner if there isn't one yet.
insert into profiles (id, email, display_name, role)
select u.id, coalesce(u.email, ''), split_part(coalesce(u.email, 'user'), '@', 1), 'member'
from auth.users u
on conflict (id) do nothing;

update profiles set role = 'owner'
where id = (select id from profiles order by created_at limit 1)
  and not exists (select 1 from profiles where role = 'owner');

-- ============================================================================
-- Row level security
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'clients','projects','tasks','access_items','payments',
    'project_notes','activity_log','profiles','client_members'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Clean slate: drop every policy that actually exists on these tables, whatever
-- it's named. A name-based drop list can't catch policies from schema versions
-- it doesn't know about — and Postgres OR's multiple permissive policies
-- together, so one leftover "select using (true)" from an old version silently
-- overrides every restriction added since. Reading directly from pg_policies
-- means nothing can ever survive a re-run.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in (
        'clients','projects','tasks','access_items','payments',
        'project_notes','activity_log','profiles','client_members'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- profiles: any signed-in user can see the team and attempt role changes;
-- guard_role_change() decides what's actually allowed.
create policy "profiles_select" on profiles for select using (auth.uid() is not null);
create policy "profiles_update" on profiles for update
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- client_members: admins manage any; members grant/revoke access to clients
-- they themselves can already see (inviting teammates onto their own accounts).
create policy "cm_all" on client_members for all
  using (is_admin() or client_id in (select my_client_ids()))
  with check (is_admin() or client_id in (select my_client_ids()));

-- clients: admins everything; members read clients they've been granted.
create policy "clients_admin_all" on clients for all using (is_admin()) with check (is_admin());
create policy "clients_member_select" on clients for select
  using (id in (select my_client_ids()));

-- projects: admins everything; members full CRUD within clients they can see.
create policy "projects_admin_all" on projects for all using (is_admin()) with check (is_admin());
create policy "projects_member_all" on projects for all
  using (client_id in (select my_client_ids()))
  with check (client_id in (select my_client_ids()));

-- tasks / access_items / project_notes: admins everything; members full CRUD
-- within projects under their granted clients.
do $$
declare t text;
begin
  foreach t in array array['tasks','access_items','project_notes'] loop
    execute format('create policy "%s_admin_all" on %I for all using (is_admin()) with check (is_admin())', t, t);
    execute format('create policy "%s_member_all" on %I for all using (project_id in (select my_project_ids())) with check (project_id in (select my_project_ids()))', t, t);
  end loop;
end $$;

-- payments: strictly admin-only (never granted to members).
create policy "payments_admin_all" on payments for all using (is_admin()) with check (is_admin());

-- activity_log: admins see all; members write their own entries and read them back.
create policy "activity_admin_all" on activity_log for all using (is_admin()) with check (is_admin());
create policy "activity_member_insert" on activity_log for insert
  with check (actor_id = auth.uid());
create policy "activity_member_select" on activity_log for select using (actor_id = auth.uid());
