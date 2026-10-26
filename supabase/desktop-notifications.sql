-- ---------------------------------------------------------------------------
-- Desktop notifications instead of email while you're online.
-- The app pings heartbeat() every minute while it's open. If you were seen in the
-- last 3 minutes AND you allowed desktop notifications, notify() skips the email:
-- you get a desktop pop-up instead. Otherwise the email goes out as before.
-- Safe to re-run. (Also included in schema.sql.)
-- ---------------------------------------------------------------------------

-- No RLS policies: only the functions below read or write it.
create table if not exists user_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  desktop boolean not null default false
);
alter table user_presence enable row level security;

-- Called by the app every minute while it's open (p_online = false when the tab closes).
create or replace function public.heartbeat(p_desktop boolean, p_online boolean default true) returns void
language sql security definer set search_path = public as $$
  insert into user_presence (user_id, last_seen_at, desktop)
  select auth.uid(), case when p_online then now() else now() - interval '1 hour' end, coalesce(p_desktop, false)
  where auth.uid() is not null
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at, desktop = excluded.desktop;
$$;
revoke execute on function public.heartbeat(boolean, boolean) from public, anon;
grant execute on function public.heartbeat(boolean, boolean) to authenticated;

create or replace function public.online_on_desktop(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_presence
                 where user_id = p_user and desktop and last_seen_at > now() - interval '3 minutes')
$$;
revoke execute on function public.online_on_desktop(uuid) from public, anon, authenticated;

-- Inbox notification + (optionally) its email, both deduped by p_key.
-- No email while the person is online with desktop notifications on.
create or replace function public.notify(
  p_user uuid, p_type text, p_actor uuid, p_entity text, p_entity_id uuid, p_project uuid,
  p_title text, p_excerpt text, p_link text, p_key text, p_email_kind text, p_payload jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare v_emailed boolean := false; v_email text;
begin
  if p_user is null then return; end if;
  if exists (select 1 from notifications where dedupe_key = p_key) then return; end if;
  if p_email_kind is not null and wants_email(p_user, p_email_kind) and not online_on_desktop(p_user) then
    select email into v_email from profiles where id = p_user;
    v_emailed := enqueue_email('email:' || p_key, p_user, v_email, p_type,
      coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('title', p_title, 'excerpt', p_excerpt,
        'link', p_link, 'actor', person_name(p_actor)));
  end if;
  insert into notifications (user_id, type, actor_id, entity, entity_id, project_id, title, excerpt, link, emailed, dedupe_key)
  values (p_user, p_type, p_actor, p_entity, p_entity_id, p_project, p_title, p_excerpt, p_link, v_emailed, p_key)
  on conflict (dedupe_key) do nothing;
end $$;
revoke execute on function public.notify(uuid, text, uuid, text, uuid, uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;
