-- ---------------------------------------------------------------------------
-- Improvement: team learning (shared resources, takeaways, personal goals)
-- Safe to run on its own and safe to re-run. Also included in schema.sql.
-- ---------------------------------------------------------------------------

-- Personal learning goals ("Get better at server-side tracking").
create table if not exists learning_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  title text not null,
  target_date date,
  status text not null default 'active' check (status in ('active','done')),
  created_at timestamptz not null default now()
);

-- One resource for one person to learn. Sharing with several people (or "everyone")
-- creates one row each, so everybody tracks their own progress and takeaway.
create table if not exists learning_items (
  id uuid primary key default gen_random_uuid(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  assignee_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid references learning_goals (id) on delete set null,
  title text not null,
  url text,
  kind text not null default 'article' check (kind in ('article','video','course','book','podcast','tool','other')),
  note text,
  status text not null default 'todo' check (status in ('todo','learning','done')),
  takeaway text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists learning_items_assignee_idx on learning_items (assignee_id, status);

alter table learning_goals enable row level security;
alter table learning_items enable row level security;

-- Everyone on the team can see everyone's learning (that's the point: sharing).
drop policy if exists "learning_goals_select" on learning_goals;
create policy "learning_goals_select" on learning_goals for select using (auth.uid() is not null);
drop policy if exists "learning_goals_write" on learning_goals;
create policy "learning_goals_write" on learning_goals for all
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

drop policy if exists "learning_items_select" on learning_items;
create policy "learning_items_select" on learning_items for select using (auth.uid() is not null);
-- Anyone can share something with anyone (including themselves).
drop policy if exists "learning_items_insert" on learning_items;
create policy "learning_items_insert" on learning_items for insert
  with check (created_by = auth.uid());
-- The learner, the person who shared it, or an admin can update / remove it.
drop policy if exists "learning_items_update" on learning_items;
create policy "learning_items_update" on learning_items for update
  using (assignee_id = auth.uid() or created_by = auth.uid() or is_admin());
drop policy if exists "learning_items_delete" on learning_items;
create policy "learning_items_delete" on learning_items for delete
  using (assignee_id = auth.uid() or created_by = auth.uid() or is_admin());

-- Inbox: "Alif shared something for you to learn" and "Mahedi finished what you shared".
create or replace function public.learning_items_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' and new.created_by is not null and new.assignee_id is distinct from new.created_by then
    perform notify(new.assignee_id, 'learning_shared', new.created_by, 'learning', new.id, null,
      new.title, new.note, '/improvement?item=' || new.id,
      'learning_shared:' || new.id, null, null);
  end if;
  if tg_op = 'UPDATE' and new.status = 'done' and old.status is distinct from 'done'
     and new.created_by is not null and new.created_by is distinct from new.assignee_id then
    perform notify(new.created_by, 'learning_done', coalesce(v_actor, new.assignee_id), 'learning', new.id, null,
      new.title, new.takeaway, '/improvement?item=' || new.id,
      'learning_done:' || new.id, null, null);
  end if;
  return null;
end $$;

drop trigger if exists learning_items_after_write on learning_items;
create trigger learning_items_after_write after insert or update on learning_items
  for each row execute function public.learning_items_after_write();
