# MyDesk

Client & project management for freelancers and small agencies: clients, projects, tasks with comments and @mentions, an inbox, payments, branded invoices, analytics, and a team layer with per-client access.

**Stack:** React 19 + TypeScript + Vite (frontend) · Vercel Functions (backend API + daily cron) · Supabase (Postgres, Auth, Storage, Realtime) · Resend (email).

```
Browser ──► Vercel (static app + /api functions) ──► Resend (email)
   │                     ▲
   └──► Supabase ────────┘  database triggers queue emails and ping /api/email/dispatch
        (data, login, files, live updates)
```

## What's in it

- **Dashboard**: money at a glance (outstanding, overdue, paid), 6-month revenue chart, "needs chasing" with one-click reminders, up next, next 7 days, live activity.
- **Inbox**: mentions, assignments, completed tasks, overdue payments, invite accepted. Reply to a comment right from the inbox.
- **Tasks**: list (grouped by due date / project / status / assignee) and drag-and-drop board. Task refs like `CPS-12`, rich-text descriptions, subtasks, file attachments and links, labels, estimates, time logging, watchers, comments with @mentions.
- **Projects**: tasks, overview, pinned notes, access checklist, activity. "Duplicate for next month" copies the project and its tasks. A budget creates a payment automatically; marking a project **Finished** settles its payments.
- **Clients**: cards with billed/open money, client page with projects/invoices/payments/notes, full client settings (contact, local time, legal invoicing address, currency, payment terms, brand colour, custom invoice fields), pin to sidebar, archive, delete.
- **Payments**: open / overdue / paid, mark paid (with confetti), email reminders to the client with the invoice PDF attached, bulk "set due dates".
- **Invoices**: live preview editor, add lines from projects, payment methods, PDF export, linked to a payment so status shows paid/unpaid.
- **Analytics**: collected vs outstanding, top clients, open payments by age, payment status, revenue by client, new clients, revenue concentration, CSV export.
- **Team**: invite by email (role + client access), resend/revoke invites, client-access matrix, member pages, remove member (their tasks become unassigned).
- **You**: profile + photo, email notification preferences, light/dark/system theme, password change, Google sign-in.
- **Search & shortcuts**: `Ctrl/⌘ K` search, `T` new task, `P` new project, `G` then `D/T/P/C/$/A/I` to jump.

### Emails (never the same email twice)

Every email goes through an `email_outbox` table with a unique key per event, so the database itself guarantees one email per event:

| Email | When | Who |
|---|---|---|
| Assigned | A task is assigned to you (once per task+person, edits never re-send) | assignee |
| Mentioned | You're @mentioned in a comment or project note | mentioned person |
| New comment | Comment on a task you're assigned to, created or watch (off by default) | them |
| Payment overdue | Once per payment, the day after it's overdue | owner + admins |
| Weekly summary | Mondays at 09:00 Dhaka time | everyone who has it on |
| Invite | When you invite someone | invitee |
| Payment reminder | When you click "Send reminder" | your client (replies go to you) |

Instant emails are sent within seconds: a database trigger calls `/api/email/dispatch` via `pg_net`. A daily Vercel cron (`/api/cron/daily`) queues overdue alerts and weekly summaries, and retries anything that failed.

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
```

- **Demo mode** (no `.env`): seeded sample data in your browser, fully clickable. Add `?as=member` to preview what a member sees.
- **Real data**: copy `.env.example` to `.env`, fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, restart.
- **With the API** (emails, reminders, removing members): `npm i -g vercel`, then `vercel dev` with the server variables below in `.env`.

Checks:

```bash
npm run typecheck    # frontend + API
npm run test:sql     # runs supabase/schema.sql in an in-memory Postgres and checks it
```

## Deploy (Supabase + Vercel + Resend)

Do these in order. Your existing data stays where it is: Supabase keeps the database, nothing is migrated or copied.

### 1. Update the database (Supabase)

1. Supabase dashboard → **SQL Editor** → paste the **whole** of `supabase/schema.sql` → **Run**.
   It's additive and safe to re-run: it only adds new tables/columns/triggers and never changes or deletes existing rows. (`npm run test:sql` proves this against a copy of the previous schema.)
2. **Authentication → URL Configuration**: set **Site URL** to your Vercel URL (e.g. `https://mydesk.vercel.app`) and add it under **Redirect URLs**.
3. Optional, **Google sign-in**: **Authentication → Providers → Google**, paste a Google OAuth client ID/secret (Google Cloud Console → Credentials; authorized redirect URI is the one Supabase shows).

### 2. Email (Resend)

1. Create a [Resend](https://resend.com) account → **Domains** → add your domain (e.g. `alifmahmud.com`) and add the DNS records it shows.
2. **API Keys** → create a key.

### 3. Host the app (Vercel)

1. Push this repo to GitHub, then on [Vercel](https://vercel.com) → **Add New → Project** → import it. Framework: Vite (auto-detected from `vercel.json`).
2. **Settings → Environment Variables** (Production + Preview):

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon / publishable key |
| `SUPABASE_URL` | same as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key (**secret**, server only) |
| `RESEND_API_KEY` | from Resend |
| `EMAIL_FROM` | e.g. `MyDesk <notifications@alifmahmud.com>` (must be on the verified domain) |
| `APP_URL` | your Vercel URL, e.g. `https://mydesk.vercel.app` |
| `CRON_SECRET` | any long random string (e.g. `openssl rand -hex 32`) |

3. **Deploy**. The daily cron in `vercel.json` is picked up automatically.

### 4. Connect instant email delivery

Back in the Supabase SQL Editor, run once (same values as `APP_URL` and `CRON_SECRET`):

```sql
select app_private.configure('https://mydesk.vercel.app', 'YOUR_CRON_SECRET');
```

Without this step, emails still go out, but only once a day with the cron.

### 5. Turn off Cloudflare

Once the Vercel URL works and you've signed in, delete the Cloudflare Pages project (or point your custom domain at Vercel: Vercel → Settings → Domains).

## Project structure

```
api/                      Vercel Functions (Node): email dispatch, daily cron, payment reminders, remove member
  _lib/                   shared server code (Supabase admin client, auth, Resend, email templates, outbox)
src/
  styles/                 tokens.css (light/dark), design.css (ported from mydesk-design.html), app.css
  components/ui/          component kit: modal, menu, tabs, fields, avatar, pills, rich text, @mention composer
  components/domain/      task rows/board, revenue chart, activity items
  components/layout/      app shell (sidebar), command palette
  data/                   zustand store (optimistic updates + realtime), business rules (actions.ts), demo data
  features/               one folder per area: dashboard, inbox, tasks, projects, clients, team, payments, invoices, analytics, settings, auth
  lib/                    formatting, status colours, currency (USD roll-ups), PDF export
supabase/schema.sql       the entire database: tables, row-level security, triggers, email outbox, storage
scripts/test-schema.mjs   database checks (in-memory Postgres)
vercel.json               build, SPA rewrites, daily cron
```

## Roles

- **Owner**: everything. Only one.
- **Admin**: every client, project, payment and invoice; can invite people.
- **Member**: projects, tasks, notes and comments under the clients they're granted. No money, no client contact details.

Enforced by Postgres row-level security, not just the UI.
