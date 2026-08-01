-- Migration 006: members get full project/task management and team assignment
-- within the clients they've been granted — not just view access.
-- Run once in the Supabase SQL editor (requires migrations 004 and 005 already applied).
--
-- What members can now do inside a granted client: create/edit/delete projects,
-- create/edit/delete tasks (already allowed since migration-004), grant/revoke
-- OTHER people's access to that same client, and promote/demote any non-owner
-- user between admin and member. Still off-limits to members: budgets, payments,
-- client contact details (enforced in the UI — see hooks/usePermissions), and
-- changing who owns the workspace.

-- Projects: members get full CRUD (was: select + update only) within clients
-- they can see. Runs alongside the existing admin-only "projects_admin_all".
drop policy if exists "projects_member_select" on projects;
drop policy if exists "projects_member_update" on projects;
create policy "projects_member_all" on projects for all
  using (client_id in (select my_client_ids()))
  with check (client_id in (select my_client_ids()));

-- client_members: a member can grant/revoke access to any client they
-- themselves can already see (inviting teammates onto their own accounts).
drop policy if exists "cm_admin_all" on client_members;
drop policy if exists "cm_member_select" on client_members;
create policy "cm_all" on client_members for all
  using (is_admin() or client_id in (select my_client_ids()))
  with check (is_admin() or client_id in (select my_client_ids()));

-- profiles: any signed-in user may attempt a role change; guard_role_change()
-- (redefined below) decides what's actually allowed.
drop policy if exists "profiles_update" on profiles;
create policy "profiles_update" on profiles for update
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Anyone may promote/demote another user between admin and member. Two
-- exceptions stay locked down: the owner role itself only changes hands via
-- the owner, and nobody can change their own role (blocks self-escalation).
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
