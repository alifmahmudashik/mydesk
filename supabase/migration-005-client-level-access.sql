-- Migration 005: move collaborator access from per-project to per-client.
-- Run once in the Supabase SQL editor (requires migration-004 already applied).
--
-- Why: granting someone a single project was too narrow — teams actually work
-- like "this person is on the Acme account", not "this person can see exactly
-- one Acme project". Granting a client now gives a member every project under
-- that client, including work assigned to teammates. tasks.assignee_id (already
-- in schema.sql) is unrelated to this access grant — it's just who a task is
-- for, used to filter "my tasks" client-side; it never restricts visibility.

create table if not exists client_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, user_id)
);

-- Backfill: existing project-level grants become client-level grants.
insert into client_members (client_id, user_id)
select distinct p.client_id, pm.user_id
from project_members pm
join projects p on p.id = pm.project_id
on conflict (client_id, user_id) do nothing;

alter table client_members enable row level security;

create or replace function public.my_client_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select client_id from client_members where user_id = auth.uid() $$;

-- Redefine my_project_ids() as "every project under my granted clients" —
-- policies on projects/tasks/access_items/project_notes already call this
-- function, so they pick up the new (broader) scope automatically.
create or replace function public.my_project_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select id from projects where client_id in (select my_client_ids()) $$;

drop policy if exists "pm_admin_all" on project_members;
drop policy if exists "pm_member_select" on project_members;
drop table if exists project_members;

drop policy if exists "clients_member_select" on clients;
create policy "clients_member_select" on clients for select
  using (id in (select my_client_ids()));

drop policy if exists "cm_admin_all" on client_members;
create policy "cm_admin_all" on client_members for all using (is_admin()) with check (is_admin());
drop policy if exists "cm_member_select" on client_members;
create policy "cm_member_select" on client_members for select using (user_id = auth.uid());
