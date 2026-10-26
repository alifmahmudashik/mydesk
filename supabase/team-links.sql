-- ---------------------------------------------------------------------------
-- Team links: meeting rooms and other shared links shown on the Team page.
-- Everyone on the team can see them; owners/admins add and edit them in the app
-- (Team page). Safe to re-run.
-- (Also included in schema.sql.)
-- ---------------------------------------------------------------------------

create table if not exists team_links (
  id uuid primary key default gen_random_uuid(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  title text not null,
  url text not null,
  note text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table team_links enable row level security;
drop policy if exists "team_links_select" on team_links;
create policy "team_links_select" on team_links for select using (auth.uid() is not null);
drop policy if exists "team_links_admin" on team_links;
create policy "team_links_admin" on team_links for all using (is_admin()) with check (is_admin());
