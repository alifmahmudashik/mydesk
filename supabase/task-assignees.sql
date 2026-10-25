-- ---------------------------------------------------------------------------
-- Several people per task. Run once in the Supabase SQL editor; safe to re-run.
-- (Already included in schema.sql.)
-- ---------------------------------------------------------------------------

-- Several people can work on one task. assignee_id stays as the first of them (kept in
-- sync by a trigger) so older code and emails keep working.
alter table tasks add column if not exists assignee_ids uuid[] not null default '{}';
update tasks set assignee_ids = array[assignee_id] where assignee_id is not null and cardinality(assignee_ids) = 0;
create index if not exists idx_tasks_assignee_ids on tasks using gin (assignee_ids);

-- Keep assignee_ids (the list) and assignee_id (the first person) in step, whichever
-- one the app wrote. Duplicates are dropped and order is kept.
create or replace function public.tasks_sync_assignees() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if cardinality(coalesce(new.assignee_ids, '{}')) = 0 and new.assignee_id is not null then
      new.assignee_ids := array[new.assignee_id];
    end if;
  elsif new.assignee_ids is not distinct from old.assignee_ids and new.assignee_id is distinct from old.assignee_id then
    new.assignee_ids := case when new.assignee_id is null then '{}'::uuid[] else array[new.assignee_id] end;
  end if;
  new.assignee_ids := coalesce((
    select array_agg(u order by o) from (
      select u, min(o) as o from unnest(coalesce(new.assignee_ids, '{}')) with ordinality as x(u, o)
      where u is not null group by u
    ) d
  ), '{}');
  new.assignee_id := new.assignee_ids[1];
  return new;
end $$;

drop trigger if exists tasks_assignees_sync on tasks;
create trigger tasks_assignees_sync before insert or update on tasks
  for each row execute function public.tasks_sync_assignees();

-- Assignment notifications go to everyone newly added.
create or replace function public.tasks_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_proj text; v_uid uuid;
begin
  select title into v_proj from projects where id = new.project_id;
  -- Everyone newly added to the task (not yourself). Keyed per task+person: editing the
  -- task, or re-adding the same person, never re-sends.
  foreach v_uid in array coalesce(new.assignee_ids, '{}') loop
    if v_uid is distinct from v_actor
       and (tg_op = 'INSERT' or not (v_uid = any(coalesce(old.assignee_ids, '{}')))) then
      perform notify(v_uid, 'assigned', v_actor, 'task', new.id, new.project_id,
        new.title, v_proj, '/tasks/' || new.id,
        'assigned:' || new.id || ':' || v_uid, 'assigned',
        jsonb_build_object('project', v_proj, 'ref', task_ref(new.id), 'due', new.due_date));
    end if;
  end loop;
  if tg_op = 'UPDATE' and new.status = 'done' and old.status is distinct from 'done'
     and new.created_by is not null and new.created_by is distinct from v_actor then
    perform notify(new.created_by, 'completed', v_actor, 'task', new.id, new.project_id,
      new.title, v_proj, '/tasks/' || new.id,
      'completed:' || new.id || ':' || extract(epoch from now())::bigint, null, null);
  end if;
  return null;
end $$;

drop trigger if exists tasks_after_write on tasks;
create trigger tasks_after_write after insert or update of assignee_id, assignee_ids, status on tasks
  for each row execute function public.tasks_after_write();

-- Comment notifications go to every assignee.
create or replace function public.comments_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_task record; v_uid uuid; v_excerpt text;
begin
  select t.id, t.title, t.project_id, t.assignee_ids, t.created_by, p.title as project_title into v_task
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
      select unnest(coalesce(v_task.assignee_ids, '{}')) as u
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

-- "Due tomorrow" goes to every assignee.
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
    select t.id, t.title, t.due_date, a.uid as assignee_id, t.project_id, p.title as project_title, task_ref(t.id) as ref
    from tasks t join projects p on p.id = t.project_id
    cross join lateral unnest(coalesce(t.assignee_ids, '{}')) as a(uid)
    where t.due_date = current_date + 1 and t.status not in ('done','cancelled')
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

-- Removing a member takes them off every task.
create or replace function public.prepare_member_removal(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where id = p_user and role = 'owner') then
    raise exception 'The owner cannot be removed';
  end if;
  update tasks set assignee_ids = array_remove(assignee_ids, p_user) where p_user = any(assignee_ids);
  update tasks set assignee_id = null where assignee_id = p_user;
  update subtasks set assignee_id = null where assignee_id = p_user;
  delete from client_members where user_id = p_user;
end $$;
revoke execute on function public.prepare_member_removal(uuid) from public, anon, authenticated;
