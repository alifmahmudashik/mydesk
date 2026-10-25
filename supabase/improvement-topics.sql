-- ---------------------------------------------------------------------------
-- Improvement: topics (learning paths). A topic ("Google Tag Manager") has
-- lessons ("How to set it up"), each lesson has resources (videos, docs, links),
-- and everyone tracks their own progress per lesson.
-- Run after improvement.sql. Safe to re-run. Also included in schema.sql.
-- ---------------------------------------------------------------------------

create table if not exists learning_topics (
  id uuid primary key default gen_random_uuid(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  title text not null,
  description text,
  color text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists learning_lessons (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references learning_topics (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  title text not null,
  details text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists learning_lessons_topic_idx on learning_lessons (topic_id, position);

create table if not exists learning_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references learning_lessons (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  title text not null,
  url text,
  kind text not null default 'article' check (kind in ('article','video','course','book','podcast','tool','other')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists learning_resources_lesson_idx on learning_resources (lesson_id);

-- Who is learning a topic.
create table if not exists learning_topic_members (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references learning_topics (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (topic_id, user_id)
);

-- One row per person per lesson they've started or finished.
create table if not exists learning_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references learning_lessons (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'learning' check (status in ('learning','done')),
  takeaway text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (lesson_id, user_id)
);

alter table learning_topics enable row level security;
alter table learning_lessons enable row level security;
alter table learning_resources enable row level security;
alter table learning_topic_members enable row level security;
alter table learning_progress enable row level security;

-- Helper: the person who created a topic can manage everything inside it.
create or replace function public.learning_topic_owner(p_topic uuid) returns uuid
language sql stable security definer set search_path = public as
$$ select created_by from learning_topics where id = p_topic $$;

-- Topics: everyone sees them; anyone can start one; creator or admin edits/deletes.
drop policy if exists "learning_topics_select" on learning_topics;
create policy "learning_topics_select" on learning_topics for select using (auth.uid() is not null);
drop policy if exists "learning_topics_insert" on learning_topics;
create policy "learning_topics_insert" on learning_topics for insert with check (created_by = auth.uid());
drop policy if exists "learning_topics_update" on learning_topics;
create policy "learning_topics_update" on learning_topics for update using (created_by = auth.uid() or is_admin());
drop policy if exists "learning_topics_delete" on learning_topics;
create policy "learning_topics_delete" on learning_topics for delete using (created_by = auth.uid() or is_admin());

-- Lessons and resources: anyone can add (learning together); the author, the topic
-- creator or an admin can edit/remove.
drop policy if exists "learning_lessons_select" on learning_lessons;
create policy "learning_lessons_select" on learning_lessons for select using (auth.uid() is not null);
drop policy if exists "learning_lessons_insert" on learning_lessons;
create policy "learning_lessons_insert" on learning_lessons for insert with check (created_by = auth.uid());
drop policy if exists "learning_lessons_update" on learning_lessons;
create policy "learning_lessons_update" on learning_lessons for update
  using (created_by = auth.uid() or learning_topic_owner(topic_id) = auth.uid() or is_admin());
drop policy if exists "learning_lessons_delete" on learning_lessons;
create policy "learning_lessons_delete" on learning_lessons for delete
  using (created_by = auth.uid() or learning_topic_owner(topic_id) = auth.uid() or is_admin());

drop policy if exists "learning_resources_select" on learning_resources;
create policy "learning_resources_select" on learning_resources for select using (auth.uid() is not null);
drop policy if exists "learning_resources_insert" on learning_resources;
create policy "learning_resources_insert" on learning_resources for insert with check (created_by = auth.uid());
drop policy if exists "learning_resources_update" on learning_resources;
create policy "learning_resources_update" on learning_resources for update
  using (created_by = auth.uid() or is_admin()
         or learning_topic_owner((select topic_id from learning_lessons where id = lesson_id)) = auth.uid());
drop policy if exists "learning_resources_delete" on learning_resources;
create policy "learning_resources_delete" on learning_resources for delete
  using (created_by = auth.uid() or is_admin()
         or learning_topic_owner((select topic_id from learning_lessons where id = lesson_id)) = auth.uid());

-- Members: join yourself or add a teammate; leave yourself, or be removed by whoever
-- added you, the topic creator or an admin.
drop policy if exists "learning_members_select" on learning_topic_members;
create policy "learning_members_select" on learning_topic_members for select using (auth.uid() is not null);
drop policy if exists "learning_members_insert" on learning_topic_members;
create policy "learning_members_insert" on learning_topic_members for insert with check (added_by = auth.uid());
drop policy if exists "learning_members_delete" on learning_topic_members;
create policy "learning_members_delete" on learning_topic_members for delete
  using (user_id = auth.uid() or added_by = auth.uid() or learning_topic_owner(topic_id) = auth.uid() or is_admin());

-- Progress: everyone sees it; you only change your own.
drop policy if exists "learning_progress_select" on learning_progress;
create policy "learning_progress_select" on learning_progress for select using (auth.uid() is not null);
drop policy if exists "learning_progress_own" on learning_progress;
create policy "learning_progress_own" on learning_progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Inbox: "Alif added you to Google Tag Manager".
create or replace function public.learning_members_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  if new.added_by is not null and new.added_by is distinct from new.user_id then
    select title into v_title from learning_topics where id = new.topic_id;
    perform notify(new.user_id, 'topic_added', new.added_by, 'learning_topic', new.topic_id, null,
      v_title, null, '/improvement/topics/' || new.topic_id,
      'topic_added:' || new.topic_id || ':' || new.user_id, null, null);
  end if;
  return null;
end $$;

drop trigger if exists learning_members_after_insert on learning_topic_members;
create trigger learning_members_after_insert after insert on learning_topic_members
  for each row execute function public.learning_members_after_insert();
