// Runs supabase/schema.sql inside an in-memory Postgres (PGlite) with minimal Supabase
// stand-ins (auth.users, auth.uid(), storage, pg_net, realtime publication), then checks:
//   1. it applies cleanly on top of an existing database that already has data,
//   2. it is safe to re-run (idempotent),
//   3. existing rows are untouched,
//   4. the new triggers (task numbers, notifications, email outbox, invites) work.
//
//   npm run test:sql                       -> fresh DB, seed, re-run, checks
//   node scripts/test-schema.mjs old.sql   -> apply old.sql first (simulates production), then the new file
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const schemaPath = new URL('../supabase/schema.sql', import.meta.url)
const oldPath = process.argv[2]

const STUBS = `
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
alter table storage.objects enable row level security;
create schema extensions;
create schema net;
create table net.calls (url text, body jsonb, headers jsonb);
create function net.http_post(url text, body jsonb, headers jsonb) returns bigint language sql as
  $$ insert into net.calls values (url, body, headers); select 1::bigint $$;
create publication supabase_realtime;
`

// PGlite can't load pg_net; the stub above stands in for it.
const prep = (sql) =>
  sql
    .replace(/create extension if not exists pg_net with schema extensions;/g, '')
    .replace(/create extension if not exists "pgcrypto";/g, 'create extension if not exists pgcrypto;')
    .replace(/extensions\.gen_random_bytes/g, 'gen_random_bytes')

const db = new PGlite({ extensions: { pgcrypto } })
const q = (sql, params) => db.query(sql, params)
const as = async (uid, sql, params) => {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ''}', false)`)
  return q(sql, params)
}
let failures = 0
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`)
  if (!cond) failures++
}

await db.exec(STUBS)
await db.exec('create extension if not exists pgcrypto;')

const U1 = '11111111-1111-1111-1111-111111111111' // owner
const U2 = '22222222-2222-2222-2222-222222222222' // member
const U3 = '33333333-3333-3333-3333-333333333333' // invited later

// ---- 1. existing database ----
await db.exec(prep(readFileSync(oldPath ?? schemaPath, 'utf8')))
await q(`insert into auth.users (id, email) values ($1, 'owner@x.com'), ($2, 'member@x.com')`, [U1, U2])
if (!oldPath) {
  // This version: the owner creates their workspace, the member is already on the team.
  const ws = (await as(U1, `select create_workspace('Acme Agency') id`)).rows[0].id
  await db.exec(`select set_config('mydesk.system', 'on', false)`)
  await q(`update profiles set workspace_id = $1 where id = $2`, [ws, U2])
  await db.exec(`select set_config('mydesk.system', 'off', false)`)
}
await as(U1, `insert into clients (id, name, owner_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Yamin Khan', $1)`, [U1])
await as(U1, `insert into projects (id, client_id, title, amount, owner_id) values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Oct: CPC Vending — Google Ads', 100, $1)`, [U1])
for (let i = 1; i <= 3; i++) {
  await as(U1, `insert into tasks (project_id, title, status, owner_id, created_at) values ('bbbbbbbb-0000-0000-0000-000000000001', $1, $2, $3, now() - ($4 || ' days')::interval)`, [`Old task ${i}`, i === 3 ? 'done' : 'todo', U1, String(10 - i)])
}
await as(U1, `insert into payments (client_id, project_ids, amount, status, due_date, owner_id) values ('aaaaaaaa-0000-0000-0000-000000000001', '{bbbbbbbb-0000-0000-0000-000000000001}', 100, 'unpaid', current_date - 10, $1)`, [U1])
await as(U1, `insert into project_notes (project_id, note, owner_id) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Old note', $1)`, [U1])
await as(U1, `insert into client_members (client_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000001', $1)`, [U2])

const snapshot = async () => {
  const out = {}
  for (const t of ['clients', 'projects', 'tasks', 'payments', 'project_notes', 'profiles', 'client_members']) {
    const cols = (await q(`select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position`, [t])).rows.map((r) => r.column_name)
    out[t] = { cols, rows: (await q(`select * from ${t} order by id`)).rows }
  }
  return out
}
const before = await snapshot()

// ---- 2. apply the new schema twice ----
try {
  await db.exec(prep(readFileSync(schemaPath, 'utf8')))
  ok(true, 'new schema applies on top of existing data')
  await db.exec(prep(readFileSync(schemaPath, 'utf8')))
  ok(true, 'new schema re-runs cleanly (idempotent)')
} catch (e) {
  ok(false, `schema failed: ${e.message}`)
  process.exit(1)
}

// ---- 3. existing data untouched (only new columns added) ----
const after = await snapshot()
for (const t of Object.keys(before)) {
  const lost = before[t].cols.filter((c) => !after[t].cols.includes(c))
  ok(lost.length === 0, `${t}: no columns removed${lost.length ? ` (lost ${lost})` : ''}`)
  ok(before[t].rows.length === after[t].rows.length, `${t}: row count unchanged (${before[t].rows.length})`)
  const changed = before[t].rows.filter((r, i) => before[t].cols.some((c) => JSON.stringify(r[c]) !== JSON.stringify(after[t].rows[i]?.[c])))
  ok(changed.length === 0, `${t}: existing values unchanged`)
}
const nums = (await q(`select number from tasks order by created_at`)).rows.map((r) => r.number)
ok(JSON.stringify(nums) === '[1,2,3]', `backfilled task numbers 1..3 by age (${nums})`)
const key = (await q(`select key from projects`)).rows[0].key
ok(key === 'CVG', `backfilled project key from title (got ${key})`)

// ---- 4. new behaviour ----
await as(U1, `select app_private.configure('https://app.example.com', 'secret123')`)
const t4 = await as(U1, `insert into tasks (project_id, title, assignee_id, owner_id) values ('bbbbbbbb-0000-0000-0000-000000000001', 'New task', $1, $2) returning id, number`, [U2, U1])
ok(t4.rows[0].number === 4, `new task gets next number (${t4.rows[0].number})`)
let n = await q(`select * from notifications where user_id = $1 and type = 'assigned'`, [U2])
ok(n.rows.length === 1 && n.rows[0].emailed, 'assignee gets inbox notification + email')
await as(U1, `update tasks set title = 'Renamed' where id = $1`, [t4.rows[0].id])
await as(U1, `update tasks set assignee_id = null where id = $1`, [t4.rows[0].id])
await as(U1, `update tasks set assignee_id = $1 where id = $2`, [U2, t4.rows[0].id])
n = await q(`select count(*)::int c from email_outbox where user_id = $1 and template = 'assigned'`, [U2])
ok(n.rows[0].c === 1, 'editing / re-assigning the same person never sends a second email')
const calls = (await q(`select count(*)::int c from net.calls where url = 'https://app.example.com/api/email/dispatch'`)).rows[0].c
ok(calls === 1, `outbox pings the dispatcher once per queued email (${calls})`)

await as(U2, `insert into task_comments (task_id, body, mentions) values ($1, 'hey @[Owner](${U1})', $2)`, [t4.rows[0].id, `{${U1}}`])
n = await q(`select type, emailed from notifications where user_id = $1 and type = 'mentioned'`, [U1])
ok(n.rows.length === 1 && n.rows[0].emailed, 'mention creates notification + email')
n = await q(`select count(*)::int c from notifications where user_id = $1 and type = 'comment'`, [U1])
ok(n.rows[0].c === 0, 'mentioned person is not double-notified as a plain comment')
n = await q(`select excerpt from notifications where user_id = $1 and type = 'mentioned'`, [U1])
ok(n.rows[0].excerpt === 'hey @Owner', 'mention codes become @Name in the notification text')
await q(`update tasks set status = 'blocked' where id = $1`, [t4.rows[0].id])
await q(`update tasks set status = 'waiting_for_client' where id = $1`, [t4.rows[0].id])
n = await q(`select status from tasks where id = $1`, [t4.rows[0].id])
ok(n.rows[0].status === 'waiting_for_client', 'tasks can be Blocked or Waiting for client')

// RLS: member can read their own notifications only, can't read the outbox.
await db.exec(`grant usage on schema public to authenticated; grant all on all tables in schema public to authenticated;`)
await db.exec(`set role authenticated`)
const mine = await as(U2, `select count(*)::int c from notifications where type <> 'access_granted'`)
const outbox = await as(U2, `select count(*)::int c from email_outbox`)
await db.exec(`reset role`)
ok(mine.rows[0].c === 1, `member sees only their own notifications (${mine.rows[0].c})`)
ok(outbox.rows[0].c === 0, 'member cannot read the email outbox')

const daily1 = (await as(null, `select run_daily() r`)).rows[0].r
const daily2 = (await as(null, `select run_daily() r`)).rows[0].r
n = await q(`select count(*)::int c from email_outbox where template = 'overdue'`)
ok(n.rows[0].c === 1, `overdue payment emailed once across two daily runs (${JSON.stringify(daily1)}, ${JSON.stringify(daily2)})`)

const claimed = await q(`select * from claim_outbox(100)`)
ok(claimed.rows.length >= 3 && claimed.rows.every((r) => r.status === 'sending'), `claim_outbox locks pending emails (${claimed.rows.length})`)
const again = await q(`select * from claim_outbox(100)`)
ok(again.rows.length === 0, 'claimed emails are not handed out twice')

await as(U1, `insert into invites (email, role, client_ids) values ('new@x.com', 'member', '{aaaaaaaa-0000-0000-0000-000000000001}')`)
n = await q(`select count(*)::int c from email_outbox where template = 'invite' and to_email = 'new@x.com'`)
ok(n.rows[0].c === 1, 'invite queues one invite email')
await q(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'NEW@x.com', '{"full_name":"New Person"}')`, [U3])
const p3 = (await q(`select role, full_name from profiles where id = $1`, [U3])).rows[0]
const cm3 = (await q(`select count(*)::int c from client_members where user_id = $1`, [U3])).rows[0].c
ok(p3?.role === 'member' && p3.full_name === 'New Person' && cm3 === 1, 'signup applies the invite (role, name, client access)')
n = await q(`select count(*)::int c from notifications where user_id = $1 and type = 'invite_accepted'`, [U1])
ok(n.rows[0].c === 1, 'inviter is told the invite was accepted')

// Invite acceptance must not also send a separate "you have access" email.
n = await q(`select count(*)::int c from email_outbox where template = 'access_granted' and user_id = $1`, [U3])
ok(n.rows[0].c === 0, 'accepting an invite sends no extra access email')

// A member assigning / @mentioning the owner emails the owner too (works both ways).
const t5 = await as(U2, `insert into tasks (project_id, title, assignee_id) values ('bbbbbbbb-0000-0000-0000-000000000001', 'For the owner', $1) returning id`, [U1])
n = await q(`select count(*)::int c from email_outbox where template = 'assigned' and user_id = $1`, [U1])
ok(n.rows[0].c === 1, 'member assigning a task to the owner emails the owner')
await as(U2, `insert into task_comments (task_id, body, mentions) values ($1, 'ping', $2)`, [t5.rows[0].id, `{${U1}}`])
n = await q(`select count(*)::int c from email_outbox where template = 'mentioned' and user_id = $1`, [U1])
ok(n.rows[0].c === 2, 'member @mentioning the owner emails the owner')
await as(U1, `insert into tasks (project_id, title, assignee_id) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Self', $1)`, [U1])
n = await q(`select count(*)::int c from email_outbox where template = 'assigned' and user_id = $1`, [U1])
ok(n.rows[0].c === 1, 'assigning yourself sends nothing')

// Access granted email when a member is given another client.
await as(U1, `insert into clients (id, name, owner_id) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Tony', $1)`, [U1])
await as(U1, `insert into client_members (client_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000002', $1)`, [U2])
n = await q(`select payload->>'client' as client from email_outbox where template = 'access_granted' and user_id = $1 and payload->>'client' = 'Tony'`, [U2])
ok(n.rows.length === 1, 'giving a member access to a client emails them once')

// Due soon: a task and a project due tomorrow.
await as(U1, `update projects set due_date = current_date + 1 where id = 'bbbbbbbb-0000-0000-0000-000000000001'`)
await as(U1, `update tasks set due_date = current_date + 1 where id = $1`, [t4.rows[0].id])
await as(null, `select run_daily()`)
await as(null, `select run_daily()`)
const dueTask = (await q(`select count(*)::int c from email_outbox where template = 'due_soon' and payload->>'kind' = 'task' and user_id = $1`, [U2])).rows[0].c
const dueProj = (await q(`select count(distinct user_id)::int c, count(*)::int n from email_outbox where template = 'due_soon' and payload->>'kind' = 'project'`)).rows[0]
ok(dueTask === 1, 'task due tomorrow emails its assignee once (two daily runs)')
ok(dueProj.c === 3 && dueProj.n === 3, `project due tomorrow emails owner + members with access, once each (${dueProj.c} people, ${dueProj.n} emails)`)

// Turning the preference off stops it.
await as(U2, `update profiles set notification_prefs = notification_prefs || '{"due_soon": false}' where id = $1`, [U2])
await as(U2, `update tasks set due_date = current_date + 1, title = 'x' where id = $1`, [t5.rows[0].id])
await as(U1, `update tasks set assignee_id = $1 where id = $2`, [U2, t5.rows[0].id])
await as(null, `select run_daily()`)
const afterOff = (await q(`select count(*)::int c from email_outbox where template = 'due_soon' and payload->>'kind' = 'task' and user_id = $1`, [U2])).rows[0].c
ok(afterOff === 1, 'due-soon email respects the person turning it off')

const owner = (await q(`select role from profiles where id = $1`, [U1])).rows[0].role
ok(owner === 'owner', 'first user is still the owner')

// Several people per task: both get notified; assignee_id follows the first; old single-assignee writes still work.
const multi = await as(U1, `insert into tasks (project_id, title, assignee_ids) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Pair task', $1) returning id, assignee_id, assignee_ids`, [[U2, U3]])
ok(multi.rows[0].assignee_id === U2 && multi.rows[0].assignee_ids.length === 2, 'assignee_id follows the first of assignee_ids')
const pairN = (await q(`select count(distinct user_id)::int c from notifications where type = 'assigned' and entity_id = $1`, [multi.rows[0].id])).rows[0].c
ok(pairN === 2, 'every assignee gets the assignment notification')

// Online with desktop notifications on: inbox + pop-up, no email. Offline: email as usual.
await as(U2, `select heartbeat(true)`)
const onl = await as(U1, `insert into tasks (project_id, title, assignee_id) values ('bbbbbbbb-0000-0000-0000-000000000001', 'While online', $1) returning id`, [U2])
const onlN = (await q(`select emailed from notifications where type = 'assigned' and entity_id = $1`, [onl.rows[0].id])).rows
const onlE = (await q(`select count(*)::int c from email_outbox where user_id = $1 and payload->>'title' like '%While online%'`, [U2])).rows[0].c
ok(onlN.length === 1 && onlN[0].emailed === false && onlE === 0, 'online with desktop notifications: inbox only, no email')
await as(U2, `select heartbeat(false, false)`)
const off = await as(U1, `insert into tasks (project_id, title, assignee_id) values ('bbbbbbbb-0000-0000-0000-000000000001', 'While away', $1) returning id`, [U2])
const offN = (await q(`select emailed from notifications where type = 'assigned' and entity_id = $1`, [off.rows[0].id])).rows
ok(offN.length === 1 && offN[0].emailed === true, 'offline: the email goes out')
await as(U2, `select heartbeat(false)`)
const noDesk = await as(U1, `insert into tasks (project_id, title, assignee_id) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Online, no pop-ups', $1) returning id`, [U2])
const noDeskN = (await q(`select emailed from notifications where type = 'assigned' and entity_id = $1`, [noDesk.rows[0].id])).rows
ok(noDeskN[0]?.emailed === true, 'online but desktop notifications not allowed: still emailed')
await as(U1, `update tasks set assignee_ids = $1 where id = $2`, [[U3, U2], multi.rows[0].id])
const again2 = (await q(`select count(*)::int c from notifications where type = 'assigned' and entity_id = $1`, [multi.rows[0].id])).rows[0].c
ok(again2 === 2, 're-ordering assignees sends nothing new')
const legacy = await as(U1, `update tasks set assignee_id = $1 where id = $2 returning assignee_ids`, [U1, multi.rows[0].id])
ok(legacy.rows[0].assignee_ids.length === 1 && legacy.rows[0].assignee_ids[0] === U1, 'writing only assignee_id still works (old app versions)')

// Improvement: sharing a resource notifies the learner; finishing it notifies the sharer.
const li = await as(U1, `insert into learning_items (title, assignee_id, created_by) values ('Server-side GTM course', $1, $2) returning id`, [U2, U1])
const shared = (await q(`select count(*)::int c from notifications where type = 'learning_shared' and user_id = $1`, [U2])).rows[0].c
ok(shared === 1, 'sharing a learning resource notifies the learner')
await as(U2, `update learning_items set status = 'done', takeaway = 'Use a custom loader' where id = $1`, [li.rows[0].id])
const doneN = (await q(`select count(*)::int c from notifications where type = 'learning_done' and user_id = $1`, [U1])).rows[0].c
ok(doneN === 1, 'finishing it notifies the person who shared it')

// Topics: lessons + resources + per-person progress; adding someone to a topic notifies them.
const topic = await as(U1, `insert into learning_topics (title, created_by) values ('Google Tag Manager', $1) returning id`, [U1])
const lesson = await as(U1, `insert into learning_lessons (topic_id, title, position, created_by) values ($1, 'How to set it up', 1, $2) returning id`, [topic.rows[0].id, U1])
await as(U1, `insert into learning_resources (lesson_id, title, url, kind, created_by) values ($1, 'Setup video', 'https://youtube.com/x', 'video', $2)`, [lesson.rows[0].id, U1])
await as(U1, `insert into learning_topic_members (topic_id, user_id, added_by) values ($1, $2, $3)`, [topic.rows[0].id, U2, U1])
const added = (await q(`select count(*)::int c from notifications where type = 'topic_added' and user_id = $1`, [U2])).rows[0].c
ok(added === 1, 'adding someone to a topic notifies them')
await as(U2, `insert into learning_progress (lesson_id, user_id, status, completed_at) values ($1, $2, 'done', now())`, [lesson.rows[0].id, U2])
await as(U1, `delete from learning_topics where id = $1`, [topic.rows[0].id])
const left = (await q(`select (select count(*) from learning_lessons) + (select count(*) from learning_resources) + (select count(*) from learning_progress) + (select count(*) from learning_topic_members) as n`)).rows[0].n
ok(Number(left) === 0, 'deleting a topic removes its lessons, resources, members and progress')

// Code snippets: one parent each, and they go when their task goes.
const snipTask = (await as(U1, `insert into tasks (project_id, title) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Snippet task') returning id`)).rows[0].id
await as(U1, `insert into code_snippets (task_id, title, language, code) values ($1, 'dataLayer push', 'javascript', 'dataLayer.push({ event: "x" })')`, [snipTask])
await as(U1, `insert into code_snippets (project_id, title, code) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Project script', '<script></script>')`)
let bothFailed = false
try {
  await as(U1, `insert into code_snippets (task_id, project_id, code) values ($1, 'bbbbbbbb-0000-0000-0000-000000000001', 'x')`, [snipTask])
} catch {
  bothFailed = true
}
ok(bothFailed, 'a snippet belongs to exactly one task or one project')
await q(`delete from tasks where id = $1`, [snipTask])
n = await q(`select count(*)::int c from code_snippets where task_id = $1`, [snipTask])
ok(n.rows[0].c === 0, 'deleting a task deletes its code snippets')
n = await q(`select count(*)::int c from code_snippets where project_id = 'bbbbbbbb-0000-0000-0000-000000000001'`)
ok(n.rows[0].c === 1, 'project snippets are kept')

// ---- 5. workspaces: anyone can sign up; workspaces never see each other ----
const U4 = '44444444-4444-4444-4444-444444444444' // signs up on their own
const U5 = '55555555-5555-5555-5555-555555555555' // signs up, gets invited afterwards
const ws1 = (await q(`select workspace_id from profiles where id = $1`, [U1])).rows[0].workspace_id
ok(Boolean(ws1), 'existing owner has a workspace')
const team = (await q(`select count(*)::int c from profiles where workspace_id = $1`, [ws1])).rows[0].c
ok(team === 3, `existing team members are all in it (${team})`)
for (const t of ['clients', 'projects', 'tasks', 'payments', 'project_notes', 'invoice_settings', 'learning_items']) {
  const stray = (await q(`select count(*)::int c from ${t} where workspace_id is distinct from $1`, [ws1])).rows[0].c
  ok(stray === 0, `${t}: every existing row belongs to the owner's workspace`)
}

await q(`insert into auth.users (id, email) values ($1, 'solo@y.com')`, [U4])
const p4 = (await q(`select role, workspace_id from profiles where id = $1`, [U4])).rows[0]
ok(p4.role === 'member' && p4.workspace_id === null, 'a new sign-up starts with no workspace (never joins someone else’s)')

await db.exec(`set role authenticated`)
const seesNothing = (await as(U4, `select (select count(*) from clients) + (select count(*) from tasks) + (select count(*) from payments) as n`)).rows[0].n
ok(Number(seesNothing) === 0, 'before setting up, a new person sees no data')
const ws4 = (await as(U4, `select create_workspace('  Solo Studio  ') id`)).rows[0].id
const me4 = (await as(U4, `select role, workspace_id from profiles where id = $1`, [U4])).rows[0]
ok(me4.role === 'owner' && me4.workspace_id === ws4, 'creating a workspace makes you its owner')
const wsRows = (await as(U4, `select name from workspaces`)).rows
ok(wsRows.length === 1 && wsRows[0].name === 'Solo Studio', 'you see only your own workspace (name trimmed)')
const inv4 = (await as(U4, `select workspace_name, email, default_currency from invoice_settings`)).rows
ok(inv4.length === 1 && inv4[0].workspace_name === 'Solo Studio' && inv4[0].email === 'solo@y.com' && inv4[0].default_currency === 'USD', 'workspace settings start from the name and your email')
let blank = false
try { await as(U4, `select create_workspace('   ')`) } catch { blank = true }
ok(blank, 'a workspace needs a name')
let twice = false
try { await as(U4, `select create_workspace('Second')`) } catch { twice = true }
ok(twice, 'you can’t create a second workspace')

const cross = (await as(U4, `select (select count(*) from clients) + (select count(*) from projects) + (select count(*) from tasks)
  + (select count(*) from payments) + (select count(*) from invoices) + (select count(*) from learning_items)
  + (select count(*) from subtasks) + (select count(*) from task_comments) + (select count(*) from code_snippets) as n`)).rows[0].n
ok(Number(cross) === 0, 'the new workspace sees none of the existing workspace’s data')
const people4 = (await as(U4, `select count(*)::int c from profiles`)).rows[0].c
ok(people4 === 1, `the new owner only sees themselves on the team (${people4})`)
await as(U4, `insert into clients (id, name) values ('cccccccc-0000-0000-0000-000000000001', 'Solo client')`)
const ownSees = (await as(U1, `select count(*)::int c from clients where id = 'cccccccc-0000-0000-0000-000000000001'`)).rows[0].c
ok(ownSees === 0, 'the existing owner can’t see the new workspace’s client')
const ownClients = (await as(U1, `select count(*)::int c from clients`)).rows[0].c
ok(ownClients === 2, `the existing owner still sees all their clients (${ownClients})`)

let grab = false
try { await as(U4, `insert into client_members (client_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000001', $1)`, [U4]) } catch { grab = true }
ok(grab, 'you can’t give yourself access to another workspace’s client')
let hop = false
try { await as(U4, `update profiles set workspace_id = $1 where id = $2`, [ws1, U4]) } catch { hop = true }
ok(hop, 'you can’t move yourself into another workspace')
const edited = (await as(U4, `update profiles set role = 'member' where id = $1 returning id`, [U1])).rows.length
ok(edited === 0, 'an owner can’t edit people in another workspace')
let steal = false
try { await as(U4, `insert into tasks (project_id, title, workspace_id) values ('bbbbbbbb-0000-0000-0000-000000000001', 'x', $1)`, [ws1]) } catch { steal = true }
ok(steal, 'you can’t write rows into another workspace')
await db.exec(`reset role`)

// Assigning a task to someone in another workspace never notifies them.
await as(U4, `insert into projects (id, client_id, title) values ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'Solo project')`)
const before4 = (await q(`select count(*)::int c from notifications where user_id = $1`, [U1])).rows[0].c
await as(U4, `insert into tasks (project_id, title, assignee_id) values ('dddddddd-0000-0000-0000-000000000001', 'Spam', $1)`, [U1])
const after4 = (await q(`select count(*)::int c from notifications where user_id = $1`, [U1])).rows[0].c
ok(before4 === after4, 'no notifications across workspaces')

// Overdue alerts only go to that workspace's admins.
await as(U4, `insert into payments (client_id, amount, status, due_date) values ('cccccccc-0000-0000-0000-000000000001', 50, 'unpaid', current_date - 3)`)
await as(null, `select run_daily()`)
const solo = (await q(`select distinct user_id from notifications where type = 'overdue' and title like '%Solo client%'`)).rows
ok(solo.length === 1 && solo[0].user_id === U4, 'overdue alerts go only to that workspace’s admins')

// Signed up first, invited later: the invite shows up and can be accepted.
await q(`insert into auth.users (id, email) values ($1, 'late@x.com')`, [U5])
await as(U1, `insert into invites (email, role, client_ids) values ('late@x.com', 'admin', '{aaaaaaaa-0000-0000-0000-000000000001}')`)
const ws1Name = (await q(`select name from workspaces where id = $1`, [ws1])).rows[0].name
await db.exec(`set role authenticated`)
const pend = (await as(U5, `select * from my_pending_invite()`)).rows
ok(pend.length === 1 && pend[0].workspace === ws1Name, 'an open invite is offered to someone without a workspace')
await as(U5, `select accept_invite($1)`, [pend[0].id])
await db.exec(`reset role`)
const p5 = (await q(`select role, workspace_id from profiles where id = $1`, [U5])).rows[0]
ok(p5.role === 'admin' && p5.workspace_id === ws1, 'accepting it joins that workspace with the invite’s role')

// Storage: admins can only write uploads for their own workspace.
const canWrite = async (uid, name) => (await as(uid, `select can_write_avatar($1) ok`, [name])).rows[0].ok
ok(await canWrite(U4, `${U4}/logo.png`), 'you can upload into your own folder')
ok(!(await canWrite(U4, `${U1}/a.png`)), 'an admin can’t upload into another workspace member’s folder')
ok(await canWrite(U1, `${U2}/a.png`), 'an admin can upload a teammate’s photo')
ok(!(await canWrite(U4, `clients/aaaaaaaa-0000-0000-0000-000000000001/x.png`)), 'an admin can’t upload another workspace’s client logo')
ok(!(await canWrite(U4, `random/x.png`)), 'unknown folders are refused, not errors')

// ---- 6. account and workspace are linked ----
const U6 = '66666666-6666-6666-6666-666666666666' // teammate in the solo workspace
await q(`insert into auth.users (id, email) values ($1, 'mate@y.com')`, [U6])
await as(U4, `insert into invites (email, role, client_ids) values ('late-mate@y.com', 'member', '{}')`)
await db.exec(`select set_config('mydesk.system', 'on', false)`)
await q(`update profiles set workspace_id = $1, role = 'admin' where id = $2`, [ws4, U6])
await db.exec(`select set_config('mydesk.system', 'off', false)`)
await as(U4, `insert into client_members (client_id, user_id) values ('cccccccc-0000-0000-0000-000000000001', $1)`, [U6])
await as(U4, `insert into tasks (project_id, title, assignee_ids) values ('dddddddd-0000-0000-0000-000000000001', 'Shared', $1)`, [[U4, U6]])
await q(`insert into deletion_requests (user_id, kind, workspace_id, token_hash, expires_at) values ($1, 'workspace', $2, 'h', now() + interval '30 minutes')`, [U4, ws4])
const countIn = async (ws) => Number((await q(`select (select count(*) from clients where workspace_id = $1) + (select count(*) from tasks where workspace_id = $1)
  + (select count(*) from invoice_settings where workspace_id = $1) + (select count(*) from invites where workspace_id = $1) as n`, [ws])).rows[0].n)
const dataBefore = await countIn(ws4)
const otherBefore = await countIn(ws1)

// What api/account/delete-confirm does for an owner.
await as(null, `select prepare_workspace_deletion($1)`, [ws4])
await q(`delete from auth.users where id = $1`, [U4])
const wsGone = (await q(`select count(*)::int c from workspaces where id = $1`, [ws4])).rows[0].c
ok(dataBefore > 0 && wsGone === 0 && (await countIn(ws4)) === 0, 'deleting the owner’s account deletes their workspace and all its data')
const mate = (await q(`select workspace_id, role from profiles where id = $1`, [U6])).rows[0]
ok(mate && mate.workspace_id === null && mate.role === 'member', 'teammates keep their login but leave the deleted workspace')
const mateAccess = (await q(`select count(*)::int c from client_members where user_id = $1`, [U6])).rows[0].c
ok(mateAccess === 0, 'teammates lose access to the deleted workspace’s clients')
const reqs = (await q(`select count(*)::int c from deletion_requests where user_id = $1`, [U4])).rows[0].c
ok(reqs === 0, 'pending delete confirmations go with the account')
ok((await countIn(ws1)) === otherBefore, 'other workspaces are untouched')
await db.exec(`set role authenticated`)
const fresh = (await as(U6, `select create_workspace('Mate Co') id`)).rows[0].id
await db.exec(`reset role`)
ok(Boolean(fresh), 'a former teammate can start their own workspace')

// A non-owner deleting their account: their work is unassigned, the workspace stays.
const byU2 = (await q(`select count(*)::int c from tasks where owner_id = $1`, [U2])).rows[0].c
const tasksBefore = (await q(`select count(*)::int c from tasks where workspace_id = $1`, [ws1])).rows[0].c
await as(null, `select prepare_member_removal($1)`, [U2])
await q(`delete from auth.users where id = $1`, [U2])
const stays = (await q(`select count(*)::int c from workspaces where id = $1`, [ws1])).rows[0].c
ok(stays === 1, 'a member deleting their account leaves the workspace in place')
const tasksAfter = (await q(`select count(*)::int c from tasks where workspace_id = $1`, [ws1])).rows[0].c
ok(byU2 > 0 && tasksAfter === tasksBefore, `tasks a removed member created are kept (${byU2} created by them, ${tasksBefore} → ${tasksAfter})`)
let ownerBlocked = false
try { await as(null, `select prepare_member_removal($1)`, [U1]) } catch { ownerBlocked = true }
ok(ownerBlocked, 'the owner can’t be removed like a member (their account goes with the workspace)')

// ---- 7. project-level access, client notes, time on projects ----
const U7 = '77777777-7777-7777-7777-777777777777' // member with one project only
const C1 = 'aaaaaaaa-0000-0000-0000-000000000001'
const P1 = 'bbbbbbbb-0000-0000-0000-000000000001'
const P2 = 'bbbbbbbb-0000-0000-0000-000000000002'
await q(`insert into auth.users (id, email) values ($1, 'proj@x.com')`, [U7])
await db.exec(`select set_config('mydesk.system', 'on', false)`)
await q(`update profiles set workspace_id = $1, role = 'member' where id = $2`, [ws1, U7])
await db.exec(`select set_config('mydesk.system', 'off', false)`)
await as(U1, `insert into projects (id, client_id, title) values ($1, $2, 'Other project')`, [P2, C1])

await db.exec(`set role authenticated`)
const snip = await as(U1, `insert into code_snippets (project_id, title) values ($1, 'Owner code') returning id`, [P1])
ok(snip.rows.length === 1, 'an owner can save code on a project')

ok((await as(U7, `select id from projects`)).rows.length === 0, 'a member with no access sees no projects')
await as(U1, `insert into project_members (project_id, user_id) values ($1, $2)`, [P1, U7])
const seen7 = (await as(U7, `select id from projects`)).rows.map((r) => r.id)
ok(seen7.length === 1 && seen7[0] === P1, 'a project-scope member sees only the shared project')
ok((await as(U7, `select id from clients`)).rows.length === 1, 'they see that project’s client (for its name)')
const t7 = await as(U7, `insert into tasks (project_id, title, assignee_ids) values ($1, 'From project member', $2) returning id`, [P1, [U1]])
ok(t7.rows.length === 1, 'they can add and assign tasks in the shared project')
let made7 = true
try { await as(U7, `insert into projects (client_id, title) values ($1, 'Sneaky')`, [C1]) } catch { made7 = false }
ok(!made7, 'they can’t create projects for the client')
ok((await as(U7, `delete from projects where id = $1 returning id`, [P1])).rows.length === 0, 'they can’t delete the shared project')
ok((await as(U7, `update projects set priority = 'high' where id = $1 returning id`, [P1])).rows.length === 1, 'they can edit the shared project')
let share7 = true
try { await as(U7, `insert into project_members (project_id, user_id) values ($1, $2)`, [P1, U5]) } catch { share7 = false }
ok(!share7, 'a project-scope member can’t share the project onward')
ok((await as(U7, `insert into code_snippets (project_id, title) values ($1, 'Member code') returning id`, [P1])).rows.length === 1, 'they can save code on the shared project')

// Client notes: hidden from members until shared.
await as(U1, `insert into client_notes (client_id, body) values ($1, 'Pays late, be firm')`, [C1])
ok((await as(U7, `select * from client_notes`)).rows.length === 0, 'a private client note is hidden from members')
await as(U1, `update client_notes set shared = true where client_id = $1`, [C1])
ok((await as(U7, `select body from client_notes`)).rows[0]?.body === 'Pays late, be firm', 'a shared client note is visible to the team')

// Time: on the project itself or on a task; hourly projects bill hours × rate.
await as(U1, `update projects set billing_type = 'hourly', hourly_rate = 40 where id = $1`, [P1])
await as(U7, `insert into time_entries (project_id, minutes) values ($1, 90)`, [P1])
await as(U7, `insert into time_entries (task_id, minutes) values ($1, 30)`, [t7.rows[0].id])
let timeOther = true
try { await as(U7, `insert into time_entries (project_id, minutes) values ($1, 30)`, [P2]) } catch { timeOther = false }
ok(!timeOther, 'they can’t log time on a project they don’t have')
await as(U7, `insert into time_timers (project_id) values ($1)`, [P1])
ok((await as(U1, `select * from time_timers`)).rows.length === 0, 'timers are private to the person running them')
await db.exec(`reset role`)
const te = (await q(`select project_id from time_entries where task_id = $1`, [t7.rows[0].id])).rows[0]
ok(te?.project_id === P1, 'time on a task counts toward its project')
const amt = Number((await q(`select amount from projects where id = $1`, [P1])).rows[0].amount)
ok(amt === 80, `hourly amount = 2 h × 40 (${amt})`)
const n7 = (await q(`select title from notifications where user_id = $1 and type = 'access_granted'`, [U7])).rows
ok(n7.length === 1, 'being given a project sends one access notification')
await as(null, `select prepare_member_removal($1)`, [U7])
ok((await q(`select count(*)::int c from project_members where user_id = $1`, [U7])).rows[0].c === 0, 'removing a member clears their project access')

console.log(failures ? `\n${failures} check(s) failed` : '\nAll schema checks passed')
process.exit(failures ? 1 : 0)
