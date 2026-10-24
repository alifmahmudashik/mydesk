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
  company_address text,
  brand_color text,
  -- Extra label/value pairs shown on this client's invoices (e.g. "VAT Number").
  invoice_fields jsonb not null default '[]'::jsonb,
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
  status text not null default 'not_started' check (status in ('not_started','in_progress','waiting_for_client','blocked','completed','finished','cancelled')),
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

-- The sender's own business/payment details, reused as the default on every
-- invoice. Singleton in practice (the app always upserts the one row it finds).
create table if not exists invoice_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  business_name text,
  business_address text,
  email text,
  brand_color text,
  -- Named payment method profiles (e.g. "Wise", "Payoneer"), each its own set of custom
  -- fields — pick one per invoice instead of re-typing bank details every time.
  payment_profiles jsonb not null default '[]'::jsonb,
  default_note text,
  created_at timestamptz not null default now()
);

-- Generated invoices — admin-only, never exposed to members (same as payments).
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  number text not null,
  issue_date date,
  due_date date,
  currency text not null default 'USD',
  line_items jsonb not null default '[]'::jsonb,
  tax_rate numeric(6,3) not null default 0,
  notes text,
  brand_color text,
  -- Snapshot of the payment profile fields picked at generation time.
  payment_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Column safety net — adds anything an older partial run might be missing.
-- (create table if not exists above only creates NEW tables; it can't retrofit
-- columns onto a table that already existed from an earlier run.)
-- ============================================================================

alter table clients add column if not exists use_company_name boolean not null default false;
alter table clients add column if not exists company_address text;
alter table clients add column if not exists brand_color text;
alter table clients add column if not exists invoice_fields jsonb not null default '[]'::jsonb;
alter table tasks add column if not exists assignee_id uuid references auth.users (id);
alter table activity_log add column if not exists actor_id uuid default auth.uid();
alter table payments add column if not exists project_ids uuid[] not null default '{}';
alter table invoice_settings add column if not exists payment_profiles jsonb not null default '[]'::jsonb;
alter table invoices add column if not exists payment_fields jsonb not null default '[]'::jsonb;

-- Old flat payment_fields on invoice_settings: wrap into a single "Default" payment
-- profile so nobody's saved bank details vanish, then drop it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invoice_settings' and column_name = 'payment_fields'
  ) then
    update invoice_settings
    set payment_profiles = jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid()::text, 'name', 'Default', 'fields', payment_fields)
    )
    where payment_profiles = '[]'::jsonb and jsonb_array_length(payment_fields) > 0;
    alter table invoice_settings drop column payment_fields;
  end if;
end $$;

-- 'finished' is a newer addition to the status list — widen the check constraint
-- on databases created before it existed (a plain CREATE TABLE IF NOT EXISTS above
-- can't alter a constraint on a table that's already there).
alter table projects drop constraint if exists projects_status_check;
alter table projects add constraint projects_status_check
  check (status in ('not_started','in_progress','waiting_for_client','blocked','completed','finished','cancelled'));

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
create index if not exists idx_invoices_client on invoices (client_id);

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
    'project_notes','activity_log','profiles','client_members',
    'invoice_settings','invoices'
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
        'project_notes','activity_log','profiles','client_members',
        'invoice_settings','invoices'
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

-- payments / invoice_settings / invoices: strictly admin-only (never granted to members).
create policy "payments_admin_all" on payments for all using (is_admin()) with check (is_admin());
create policy "invoice_settings_admin_all" on invoice_settings for all using (is_admin()) with check (is_admin());
create policy "invoices_admin_all" on invoices for all using (is_admin()) with check (is_admin());

-- activity_log: admins see all; members write their own entries and read them back.
create policy "activity_admin_all" on activity_log for all using (is_admin()) with check (is_admin());
create policy "activity_member_insert" on activity_log for insert
  with check (actor_id = auth.uid());
create policy "activity_member_select" on activity_log for select using (actor_id = auth.uid());

-- ############################################################################
-- MyDesk v3: new layout, comments/@mentions, subtasks, attachments, time
-- logging, inbox notifications, email outbox, invites, reminders.
--
-- PURELY ADDITIVE: only new tables, new nullable/defaulted columns, widened
-- check constraints, and functions/triggers/policies. No existing row or column
-- is modified or dropped (apart from one-time backfills of the NEW columns).
-- Safe to re-run.
-- ############################################################################

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- New columns on existing tables
-- ---------------------------------------------------------------------------

alter table profiles add column if not exists full_name text;
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists job_title text;
alter table profiles add column if not exists timezone text;
alter table profiles add column if not exists last_active_at timestamptz;
alter table profiles add column if not exists notification_prefs jsonb not null
  default '{"assigned":true,"mentioned":true,"comment":false,"overdue":true,"weekly":true}'::jsonb;

alter table clients add column if not exists pinned boolean not null default false;
alter table clients add column if not exists default_currency text;
alter table clients add column if not exists payment_terms text;

alter table projects add column if not exists key text;
alter table projects add column if not exists billing_type text;
alter table projects add column if not exists link_url text;
alter table projects add column if not exists link_label text;
alter table projects add column if not exists archived_at timestamptz;
alter table projects add column if not exists completed_at timestamptz;

alter table tasks add column if not exists number integer;
alter table tasks add column if not exists labels text[] not null default '{}';
alter table tasks add column if not exists estimate_minutes integer;
alter table tasks add column if not exists created_by uuid default auth.uid();
alter table tasks add column if not exists completed_at timestamptz;

alter table project_notes add column if not exists pinned boolean not null default false;
alter table project_notes add column if not exists author_id uuid default auth.uid();
alter table project_notes add column if not exists mentions uuid[] not null default '{}';

alter table payments add column if not exists invoice_id uuid references invoices (id) on delete set null;
alter table payments add column if not exists last_reminded_at timestamptz;

alter table invoice_settings add column if not exists default_currency text not null default 'USD';
alter table invoice_settings add column if not exists default_due_days integer not null default 7;
alter table invoice_settings add column if not exists default_tax numeric(6,3) not null default 0;
alter table invoice_settings add column if not exists workspace_name text;

alter table invoices add column if not exists payment_profile_id text;

alter table activity_log add column if not exists project_id uuid;
alter table activity_log add column if not exists meta jsonb not null default '{}'::jsonb;

-- Widen check constraints for the new kinds (every old value stays valid).
alter table activity_log drop constraint if exists activity_log_entity_check;
alter table activity_log add constraint activity_log_entity_check check (entity in (
  'client','project','task','access_item','payment','note',
  'comment','subtask','invoice','member','attachment','time'));
alter table activity_log drop constraint if exists activity_log_action_check;
alter table activity_log add constraint activity_log_action_check check (action in (
  'created','updated','status_changed','completed','paid','deleted',
  'commented','assigned','mentioned','invited','removed','logged','reminded'));

alter table projects drop constraint if exists projects_billing_type_check;
alter table projects add constraint projects_billing_type_check
  check (billing_type is null or billing_type in ('retainer','fixed','hourly'));

-- ---------------------------------------------------------------------------
-- New tables
-- ---------------------------------------------------------------------------

create table if not exists subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  assignee_id uuid references auth.users (id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  body text not null,
  mentions uuid[] not null default '{}',
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  kind text not null default 'file' check (kind in ('file','link')),
  name text not null,
  url text,
  storage_path text,
  size_bytes bigint,
  uploaded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  minutes integer not null check (minutes > 0),
  note text,
  logged_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists task_watchers (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, user_id)
);

-- Inbox. One row per person per event; dedupe_key stops duplicates.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  actor_id uuid references auth.users (id) on delete set null,
  entity text,
  entity_id uuid,
  project_id uuid,
  title text not null,
  excerpt text,
  link text,
  emailed boolean not null default false,
  dedupe_key text unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Every email goes through here. dedupe_key is unique, so one event can never
-- produce a second email. No RLS policies: only the server (service role) reads it.
create table if not exists email_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  to_email text not null,
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','skipped')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null default 'member' check (role in ('admin','member')),
  client_ids uuid[] not null default '{}',
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists payment_reminders (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments (id) on delete cascade,
  sent_by uuid default auth.uid() references auth.users (id) on delete set null,
  to_email text not null,
  subject text,
  created_at timestamptz not null default now()
);

create index if not exists idx_subtasks_task on subtasks (task_id);
create index if not exists idx_comments_task on task_comments (task_id, created_at);
create index if not exists idx_attachments_task on task_attachments (task_id);
create index if not exists idx_time_task on time_entries (task_id);
create index if not exists idx_watchers_task on task_watchers (task_id);
create index if not exists idx_notifications_user on notifications (user_id, created_at desc);
create index if not exists idx_outbox_pending on email_outbox (status, created_at) where status in ('pending','failed','sending');
create index if not exists idx_invites_email on invites (lower(email));
create index if not exists idx_activity_project on activity_log (project_id);
create index if not exists idx_tasks_assignee on tasks (assignee_id);

-- ---------------------------------------------------------------------------
-- One-time backfills of the new columns (only rows where they're still empty)
-- ---------------------------------------------------------------------------

create or replace function public.derive_project_key(p_title text) returns text
language sql immutable as $$
  select coalesce(nullif(upper(left(regexp_replace(coalesce(
    (select string_agg(left(w, 1), '') from regexp_split_to_table(
       regexp_replace(coalesce(p_title, ''), '^[A-Za-z]{3,9}:\s*', ''), '\s+') as w where w ~ '^[A-Za-z]'),
    ''), '[^A-Za-z]', '', 'g'), 3)), ''), 'TSK')
$$;

update projects set key = derive_project_key(title) where key is null;

with numbered as (
  select id, project_id, row_number() over (partition by project_id order by created_at, id) as n
  from tasks where number is null
)
update tasks t
set number = numbered.n + coalesce((select max(t2.number) from tasks t2
                                    where t2.project_id = numbered.project_id and t2.number is not null), 0)
from numbered
where numbered.id = t.id;

update tasks set completed_at = created_at where status = 'done' and completed_at is null;

-- ---------------------------------------------------------------------------
-- Private config (app URL + shared secret for instant email delivery)
-- ---------------------------------------------------------------------------

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
create table if not exists app_private.config (
  key text primary key,
  value text not null
);

-- Run once in the SQL editor after deploying to Vercel:
--   select app_private.configure('https://your-app.vercel.app', '<same value as CRON_SECRET>');
create or replace function app_private.configure(p_app_url text, p_secret text) returns void
language sql security definer set search_path = app_private as $$
  insert into app_private.config (key, value) values ('app_url', rtrim(p_app_url, '/')), ('secret', p_secret)
  on conflict (key) do update set value = excluded.value;
$$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.my_task_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select id from tasks where is_admin() or project_id in (select my_project_ids()) $$;

create or replace function public.person_name(p_id uuid) returns text
language sql stable security definer set search_path = public as
$$ select coalesce(nullif(display_name, ''), nullif(full_name, ''), split_part(email, '@', 1), 'Someone')
   from profiles where id = p_id $$;

create or replace function public.wants_email(p_user uuid, p_kind text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (notification_prefs ->> p_kind)::boolean from profiles where id = p_user),
                  p_kind in ('assigned','mentioned','overdue','weekly','due_soon','access'))
$$;

-- Queue an email. Returns false (and does nothing) if this dedupe_key was already queued.
create or replace function public.enqueue_email(
  p_key text, p_user uuid, p_to text, p_template text, p_payload jsonb
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_to is null or p_to = '' then return false; end if;
  insert into email_outbox (dedupe_key, user_id, to_email, template, payload)
  values (p_key, p_user, p_to, p_template, coalesce(p_payload, '{}'::jsonb))
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  return v_id is not null;
end $$;

-- Inbox notification + (optionally) its email, both deduped by p_key.
create or replace function public.notify(
  p_user uuid, p_type text, p_actor uuid, p_entity text, p_entity_id uuid, p_project uuid,
  p_title text, p_excerpt text, p_link text, p_key text, p_email_kind text, p_payload jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare v_emailed boolean := false; v_email text;
begin
  if p_user is null then return; end if;
  if exists (select 1 from notifications where dedupe_key = p_key) then return; end if;
  if p_email_kind is not null and wants_email(p_user, p_email_kind) then
    select email into v_email from profiles where id = p_user;
    v_emailed := enqueue_email('email:' || p_key, p_user, v_email, p_type,
      coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('title', p_title, 'excerpt', p_excerpt,
        'link', p_link, 'actor', person_name(p_actor)));
  end if;
  insert into notifications (user_id, type, actor_id, entity, entity_id, project_id, title, excerpt, link, emailed, dedupe_key)
  values (p_user, p_type, p_actor, p_entity, p_entity_id, p_project, p_title, p_excerpt, p_link, v_emailed, p_key)
  on conflict (dedupe_key) do nothing;
end $$;

create or replace function public.task_ref(p_task uuid) returns text
language sql stable security definer set search_path = public as
$$ select coalesce(p.key || '-' || t.number, 'Task') from tasks t join projects p on p.id = t.project_id where t.id = p_task $$;

revoke execute on function public.enqueue_email(text, uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.notify(uuid, text, uuid, text, uuid, uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Number new tasks per project (CPS-1, CPS-2, …) and stamp completed_at.
-- The server always assigns the number (under a per-project lock), so two people
-- adding tasks at the same moment can never get the same ref.
create or replace function public.tasks_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext(new.project_id::text));
    select coalesce(max(number), 0) + 1 into new.number from tasks where project_id = new.project_id;
  end if;
  if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then
    perform pg_advisory_xact_lock(hashtext(new.project_id::text));
    select coalesce(max(number), 0) + 1 into new.number from tasks where project_id = new.project_id;
  end if;
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists tasks_before_write on tasks;
create trigger tasks_before_write before insert or update on tasks
  for each row execute function public.tasks_before_write();

create or replace function public.projects_before_insert() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.key is null or new.key = '' then new.key := derive_project_key(new.title); end if;
  return new;
end $$;

drop trigger if exists projects_before_insert on projects;
create trigger projects_before_insert before insert on projects
  for each row execute function public.projects_before_insert();

-- Assignment + completion notifications.
create or replace function public.tasks_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_proj text;
begin
  select title into v_proj from projects where id = new.project_id;
  if new.assignee_id is not null and new.assignee_id is distinct from v_actor
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    -- Keyed per task+assignee: editing the task (or re-assigning the same person) never re-sends.
    perform notify(new.assignee_id, 'assigned', v_actor, 'task', new.id, new.project_id,
      new.title, v_proj, '/tasks/' || new.id,
      'assigned:' || new.id || ':' || new.assignee_id, 'assigned',
      jsonb_build_object('project', v_proj, 'ref', task_ref(new.id), 'due', new.due_date));
  end if;
  if tg_op = 'UPDATE' and new.status = 'done' and old.status is distinct from 'done'
     and new.created_by is not null and new.created_by is distinct from v_actor then
    perform notify(new.created_by, 'completed', v_actor, 'task', new.id, new.project_id,
      new.title, v_proj, '/tasks/' || new.id,
      'completed:' || new.id || ':' || extract(epoch from now())::bigint, null, null);
  end if;
  return null;
end $$;

drop trigger if exists tasks_after_write on tasks;
create trigger tasks_after_write after insert or update of assignee_id, status on tasks
  for each row execute function public.tasks_after_write();

-- Comments: @mentions get an email; assignee/creator/watchers get an inbox item
-- (and an email only if they turned on "New comment on my tasks").
create or replace function public.comments_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_task record; v_uid uuid; v_excerpt text;
begin
  select t.id, t.title, t.project_id, t.assignee_id, t.created_by, p.title as project_title into v_task
  from tasks t join projects p on p.id = t.project_id where t.id = new.task_id;
  v_excerpt := left(regexp_replace(new.body, '<[^>]+>', '', 'g'), 240);

  foreach v_uid in array coalesce(new.mentions, '{}') loop
    if v_uid is distinct from new.author_id then
      perform notify(v_uid, 'mentioned', new.author_id, 'task', new.task_id, v_task.project_id,
        v_task.title, v_excerpt, '/tasks/' || new.task_id || '#c-' || new.id,
        'mention:c:' || new.id || ':' || v_uid, 'mentioned',
        jsonb_build_object('project', v_task.project_title, 'ref', task_ref(new.task_id), 'where', 'comment'));
    end if;
  end loop;

  for v_uid in
    select distinct u from (
      select v_task.assignee_id as u
      union select v_task.created_by
      union select user_id from task_watchers where task_id = new.task_id
    ) s where u is not null and u is distinct from new.author_id and not (u = any(coalesce(new.mentions, '{}')))
  loop
    perform notify(v_uid, 'comment', new.author_id, 'task', new.task_id, v_task.project_id,
      v_task.title, v_excerpt, '/tasks/' || new.task_id || '#c-' || new.id,
      'comment:' || new.id || ':' || v_uid, 'comment',
      jsonb_build_object('project', v_task.project_title, 'ref', task_ref(new.task_id)));
  end loop;
  return null;
end $$;

drop trigger if exists comments_after_insert on task_comments;
create trigger comments_after_insert after insert on task_comments
  for each row execute function public.comments_after_insert();

-- Project notes: @mentions.
create or replace function public.notes_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text; v_uid uuid; v_excerpt text;
begin
  select title into v_title from projects where id = new.project_id;
  v_excerpt := left(regexp_replace(new.note, '<[^>]+>', '', 'g'), 240);
  foreach v_uid in array coalesce(new.mentions, '{}') loop
    if v_uid is distinct from new.author_id then
      perform notify(v_uid, 'mentioned_note', new.author_id, 'project', new.project_id, new.project_id,
        v_title, v_excerpt, '/projects/' || new.project_id || '?tab=notes',
        'mention:n:' || new.id || ':' || v_uid, 'mentioned',
        jsonb_build_object('project', v_title, 'where', 'note'));
    end if;
  end loop;
  return null;
end $$;

drop trigger if exists notes_after_insert on project_notes;
create trigger notes_after_insert after insert on project_notes
  for each row execute function public.notes_after_insert();

-- Payment marked paid: inbox item for the other admins.
create or replace function public.payments_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_admin uuid; v_client text;
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    select coalesce(case when use_company_name then company_name end, name) into v_client from clients where id = new.client_id;
    for v_admin in select id from profiles where role in ('owner','admin') and id is distinct from auth.uid() loop
      perform notify(v_admin, 'paid', auth.uid(), 'payment', new.id, null,
        coalesce(v_client, 'Client') || ' paid', new.currency || ' ' || new.amount || ' received',
        '/payments?p=' || new.id, 'paid:' || new.id || ':' || v_admin || ':' || extract(epoch from now())::bigint, null, null);
    end loop;
  end if;
  return null;
end $$;

drop trigger if exists payments_after_update on payments;
create trigger payments_after_update after update of status on payments
  for each row execute function public.payments_after_update();

-- Invite created: send the invite email.
create or replace function public.invites_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform enqueue_email('invite:' || new.id || ':0', null, new.email, 'invite',
    jsonb_build_object('token', new.token, 'role', new.role, 'inviter', person_name(new.invited_by)));
  return null;
end $$;

drop trigger if exists invites_after_insert on invites;
create trigger invites_after_insert after insert on invites
  for each row execute function public.invites_after_insert();

-- "Resend" button: queues one more copy (each click is its own event).
create or replace function public.resend_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v invites;
begin
  if not is_admin() then raise exception 'Only admins can resend invites'; end if;
  select * into v from invites where id = p_invite and accepted_at is null and revoked_at is null;
  if not found then raise exception 'Invite not found'; end if;
  perform enqueue_email('invite:' || v.id || ':' || extract(epoch from now())::bigint, null, v.email, 'invite',
    jsonb_build_object('token', v.token, 'role', v.role, 'inviter', person_name(auth.uid())));
end $$;

-- The invite page shows who invited you before sign-up (the token is the secret).
create or replace function public.invite_lookup(p_token text) returns table (email text, role text, inviter text)
language sql stable security definer set search_path = public as $$
  select i.email, i.role, person_name(i.invited_by) from invites i
  where i.token = p_token and i.accepted_at is null and i.revoked_at is null
$$;
grant execute on function public.invite_lookup(text) to anon, authenticated;

-- Instant delivery: ping the Vercel dispatcher whenever an email is queued.
-- If app_private.configure() hasn't been run, emails still go out on the daily cron.
create or replace function public.outbox_after_insert() returns trigger
language plpgsql security definer set search_path = public, app_private, extensions as $$
declare v_url text; v_secret text;
begin
  select value into v_url from app_private.config where key = 'app_url';
  select value into v_secret from app_private.config where key = 'secret';
  if v_url is not null and v_secret is not null then
    perform net.http_post(
      url := v_url || '/api/email/dispatch',
      body := jsonb_build_object('id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret)
    );
  end if;
  return null;
exception when others then
  return null; -- never block the original write because of email
end $$;

drop trigger if exists outbox_after_insert on email_outbox;
create trigger outbox_after_insert after insert on email_outbox
  for each row execute function public.outbox_after_insert();

-- Server-only: lock a batch of pending emails for sending.
create or replace function public.claim_outbox(p_limit int default 25, p_id uuid default null)
returns setof email_outbox
language sql security definer set search_path = public as $$
  update email_outbox set status = 'sending', attempts = attempts + 1
  where id in (
    select id from email_outbox
    where (p_id is null or id = p_id)
      and attempts < 5
      and (status in ('pending','failed')
           or (status = 'sending' and created_at < now() - interval '10 minutes'))
    order by created_at
    limit p_limit
    for update skip locked
  )
  returning *;
$$;
revoke execute on function public.claim_outbox(int, uuid) from public, anon, authenticated;

-- Daily job (Vercel cron, service role): overdue payment alerts (once per payment
-- per due date) + Monday weekly summaries (once per person per week).
create or replace function public.run_daily() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; v_admin uuid; v_client text; v_days int; v_overdue int := 0; v_weekly int := 0; v_due int := 0; v_uid uuid;
begin
  for r in
    select * from payments
    where status in ('unpaid','partial','overdue') and due_date is not null and due_date < current_date
  loop
    select coalesce(case when use_company_name then company_name end, name) into v_client from clients where id = r.client_id;
    v_days := current_date - r.due_date;
    for v_admin in select id from profiles where role in ('owner','admin') loop
      perform notify(v_admin, 'overdue', null, 'payment', r.id, null,
        'Payment overdue · ' || coalesce(v_client, 'Client') || ' · ' || r.currency || ' ' || r.amount,
        'Was due ' || to_char(r.due_date, 'Mon DD') || ' (' || v_days || ' days ago)',
        '/payments?p=' || r.id, 'overdue:' || r.id || ':' || r.due_date || ':' || v_admin, 'overdue',
        jsonb_build_object('client', v_client, 'amount', r.amount, 'currency', r.currency,
                           'due', r.due_date, 'days', v_days));
      v_overdue := v_overdue + 1;
    end loop;
  end loop;

  -- Due soon: open tasks due tomorrow -> their assignee (once per task per due date).
  for r in
    select t.id, t.title, t.due_date, t.assignee_id, t.project_id, p.title as project_title, task_ref(t.id) as ref
    from tasks t join projects p on p.id = t.project_id
    where t.due_date = current_date + 1 and t.status not in ('done','cancelled') and t.assignee_id is not null
  loop
    perform notify(r.assignee_id, 'due_soon', null, 'task', r.id, r.project_id,
      r.title, 'Task due tomorrow · ' || r.project_title, '/tasks/' || r.id,
      'due_task:' || r.id || ':' || r.due_date || ':' || r.assignee_id, 'due_soon',
      jsonb_build_object('kind', 'task', 'project', r.project_title, 'ref', r.ref, 'due', r.due_date));
    v_due := v_due + 1;
  end loop;

  -- Due soon: open projects due tomorrow -> owner/admins + members with access to the client.
  for r in
    select p.id, p.title, p.due_date, p.client_id,
      (select coalesce(case when c.use_company_name then c.company_name end, c.name) from clients c where c.id = p.client_id) as client_name,
      (select count(*) from tasks t where t.project_id = p.id and t.status not in ('done','cancelled')) as open_tasks
    from projects p
    where p.due_date = current_date + 1 and p.archived_at is null
      and p.status not in ('completed','finished','cancelled')
  loop
    for v_uid in
      select id from profiles where role in ('owner','admin')
      union
      select user_id from client_members where client_id = r.client_id
    loop
      perform notify(v_uid, 'due_soon', null, 'project', r.id, r.id,
        r.title, 'Project due tomorrow · ' || coalesce(r.client_name, '') || ' · ' || r.open_tasks || ' open task' || case when r.open_tasks = 1 then '' else 's' end,
        '/projects/' || r.id,
        'due_project:' || r.id || ':' || r.due_date || ':' || v_uid, 'due_soon',
        jsonb_build_object('kind', 'project', 'client', r.client_name, 'open_tasks', r.open_tasks, 'due', r.due_date));
      v_due := v_due + 1;
    end loop;
  end loop;

  if extract(isodow from now() at time zone 'Asia/Dhaka') = 1 then
    for r in select id, email from profiles loop
      if wants_email(r.id, 'weekly') then
        if enqueue_email('weekly:' || r.id || ':' || to_char(now(), 'IYYY-IW'), r.id, r.email, 'weekly',
             jsonb_build_object('user_id', r.id)) then
          v_weekly := v_weekly + 1;
        end if;
      end if;
    end loop;
  end if;
  return jsonb_build_object('overdue_checked', v_overdue, 'due_soon_checked', v_due, 'weekly_queued', v_weekly);
end $$;
revoke execute on function public.run_daily() from public, anon, authenticated;

-- Signup: the first user is owner; invited users get the invite's role + client access.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_inv invites; v_name text;
begin
  v_name := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name');
  select * into v_inv from invites
  where lower(email) = lower(coalesce(new.email, '')) and accepted_at is null and revoked_at is null
  order by created_at desc limit 1;

  insert into profiles (id, email, display_name, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(split_part(coalesce(v_name, ''), ' ', 1), ''), split_part(coalesce(new.email, 'user'), '@', 1)),
    v_name,
    new.raw_user_meta_data ->> 'avatar_url',
    case
      when not exists (select 1 from profiles) then 'owner'
      when v_inv.id is not null then v_inv.role
      else 'member'
    end
  )
  on conflict (id) do nothing;

  if v_inv.id is not null then
    perform set_config('mydesk.skip_access_email', 'on', true);
    insert into client_members (client_id, user_id)
    select c, new.id from unnest(v_inv.client_ids) c
    where exists (select 1 from clients where id = c)
    on conflict (client_id, user_id) do nothing;
    update invites set accepted_at = now() where id = v_inv.id;
    perform set_config('mydesk.skip_access_email', 'off', true);
    if v_inv.invited_by is not null then
      perform notify(v_inv.invited_by, 'invite_accepted', new.id, 'member', new.id, null,
        coalesce(v_name, new.email) || ' accepted your invite', null, '/team/' || new.id,
        'invite_accepted:' || v_inv.id, null, null);
    end if;
  end if;
  return new;
end $$;

-- Access granted: a member is given a client (Team page, project Team checkboxes,
-- member page) -> one inbox item + email, once per client per person.
create or replace function public.client_members_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_client text; v_active int;
begin
  if coalesce(current_setting('mydesk.skip_access_email', true), 'off') = 'on' then return null; end if;
  if new.user_id = auth.uid() then return null; end if;
  if exists (select 1 from profiles where id = new.user_id and role in ('owner','admin')) then return null; end if;
  select coalesce(case when use_company_name then company_name end, name) into v_client from clients where id = new.client_id;
  select count(*) into v_active from projects
  where client_id = new.client_id and archived_at is null and status not in ('completed','finished','cancelled');
  perform notify(new.user_id, 'access_granted', auth.uid(), 'client', new.client_id, null,
    'You now have access to ' || coalesce(v_client, 'a client'),
    v_active || ' active project' || case when v_active = 1 then '' else 's' end,
    '/clients/' || new.client_id,
    'access:' || new.client_id || ':' || new.user_id || ':' || extract(epoch from now())::bigint, 'access',
    jsonb_build_object('client', v_client, 'active', v_active));
  return null;
end $$;

drop trigger if exists client_members_after_insert on client_members;
create trigger client_members_after_insert after insert on client_members
  for each row execute function public.client_members_after_insert();

-- Removing a member: unassign their work first; the server then deletes the login.
create or replace function public.prepare_member_removal(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where id = p_user and role = 'owner') then
    raise exception 'The owner cannot be removed';
  end if;
  update tasks set assignee_id = null where assignee_id = p_user;
  update subtasks set assignee_id = null where assignee_id = p_user;
  delete from client_members where user_id = p_user;
end $$;
revoke execute on function public.prepare_member_removal(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security for v3 tables (+ tightened profile edits)
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'subtasks','task_comments','task_attachments','time_entries','task_watchers',
    'notifications','email_outbox','invites','payment_reminders'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('subtasks','task_comments','task_attachments','time_entries','task_watchers',
                        'notifications','email_outbox','invites','payment_reminders')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Anyone who can see the task can see/add its subtasks, files, time and watchers.
do $$
declare t text;
begin
  foreach t in array array['subtasks','task_attachments','time_entries','task_watchers'] loop
    execute format('create policy "%s_access" on %I for all using (task_id in (select my_task_ids())) with check (task_id in (select my_task_ids()))', t, t);
  end loop;
end $$;

create policy "comments_select" on task_comments for select using (task_id in (select my_task_ids()));
create policy "comments_insert" on task_comments for insert
  with check (task_id in (select my_task_ids()) and author_id = auth.uid());
create policy "comments_update" on task_comments for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "comments_delete" on task_comments for delete using (author_id = auth.uid() or is_admin());

create policy "notifications_own" on notifications for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- email_outbox: intentionally no policies, so only the service role can touch it.

create policy "invites_admin" on invites for all using (is_admin()) with check (is_admin());
create policy "reminders_admin" on payment_reminders for all using (is_admin()) with check (is_admin());

-- Profiles: you edit yourself; admins edit anyone (role changes still pass guard_role_change).
drop policy if exists "profiles_update" on profiles;
create policy "profiles_update" on profiles for update
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- Storage: task attachments (private) + avatars (public)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "mydesk_attachments_rw" on storage.objects;
create policy "mydesk_attachments_rw" on storage.objects for all
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] in (select id::text from my_task_ids() id))
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] in (select id::text from my_task_ids() id));

drop policy if exists "mydesk_avatars_read" on storage.objects;
create policy "mydesk_avatars_read" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "mydesk_avatars_write" on storage.objects;
create policy "mydesk_avatars_write" on storage.objects for insert
  with check (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));
drop policy if exists "mydesk_avatars_update" on storage.objects;
create policy "mydesk_avatars_update" on storage.objects for update
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));
drop policy if exists "mydesk_avatars_delete" on storage.objects;
create policy "mydesk_avatars_delete" on storage.objects for delete
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

-- ---------------------------------------------------------------------------
-- Realtime (live inbox, comments, activity)
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['notifications','task_comments','activity_log','tasks','subtasks'] loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
