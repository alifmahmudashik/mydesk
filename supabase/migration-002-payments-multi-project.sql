-- Migration 002: payments can cover multiple projects (run once in the Supabase SQL editor
-- if you already created the tables with the original schema.sql).

alter table payments add column if not exists project_ids uuid[] not null default '{}';

update payments
set project_ids = array[project_id]
where project_id is not null and project_ids = '{}';

alter table payments drop column if exists project_id;

drop index if exists idx_payments_project;
create index if not exists idx_payments_projects on payments using gin (project_ids);
