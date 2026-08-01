-- MyDesk v2 schema (run in Supabase SQL editor)
-- Entities: clients -> projects -> tasks / access_items / payments / project_notes, plus activity_log.

create extension if not exists "pgcrypto";

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
  entity text not null check (entity in ('client','project','task','access_item','payment','note')),
  entity_id uuid not null,
  action text not null check (action in ('created','updated','status_changed','completed','paid','deleted')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_client on projects (client_id);
create index if not exists idx_tasks_project on tasks (project_id);
create index if not exists idx_access_project on access_items (project_id);
create index if not exists idx_payments_client on payments (client_id);
create index if not exists idx_payments_projects on payments using gin (project_ids);
create index if not exists idx_notes_project on project_notes (project_id);
create index if not exists idx_activity_created on activity_log (created_at desc);

-- Row level security: single owner baseline.
-- NOTE (fresh installs): after this file, also run migrations 002-006 in order —
-- migration-004 replaces these policies with role-based ones (owner/admin/member),
-- migration-005 moves collaborator access grants from per-project to per-client, and
-- migration-006 gives members full project/task management within granted clients.
do $$
declare t text;
begin
  foreach t in array array['clients','projects','tasks','access_items','payments','project_notes','activity_log'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "owner_all" on %I', t);
    execute format('create policy "owner_all" on %I for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
  end loop;
end $$;
