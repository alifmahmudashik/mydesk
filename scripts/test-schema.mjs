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

console.log(failures ? `\n${failures} check(s) failed` : '\nAll schema checks passed')
process.exit(failures ? 1 : 0)
