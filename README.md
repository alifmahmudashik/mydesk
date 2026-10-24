# MyDesk v2

Client & project management for freelancers and small agencies: clients, projects, tasks with comments and @mentions, an inbox, payments, branded invoices, analytics, and a team with per-client access.

| Part | Service | What it does |
|---|---|---|
| Frontend | **Vercel** (React + Vite) | The app you use in the browser |
| Backend | **Vercel Functions** (`/api`) | Sends emails, runs the daily job, payment reminders, removing members |
| Database, login, files | **Supabase** | Postgres data, email/Google sign-in, attachments, live updates |
| Email | **Resend** | Notification, invite and reminder emails |

```
Browser ──► Vercel (app + /api) ──► Resend (email)
   │              ▲
   └──► Supabase ─┘   database triggers queue emails and call /api/email/dispatch
```

---

## Setup guide

Follow the steps in order. Total time: about 30–45 minutes.

### What you need

- A [GitHub](https://github.com) account with this repo
- A [Supabase](https://supabase.com) project (free plan is fine)
- A [Vercel](https://vercel.com) account (sign in with GitHub; free plan is fine)
- A [Resend](https://resend.com) account with a verified domain
- A domain you control, for the app address (e.g. `mydesk.yourdomain.com`)
- Node.js 20+ if you want to run it on your computer

---

### Step 1. Supabase: set up the database

> Already have MyDesk data in this Supabase project? It's safe. The SQL only **adds** new tables, columns and triggers. It never changes or deletes existing rows, and it can be re-run any time. Still, take a backup first: **Database → Backups**.

1. Supabase dashboard → your project → **SQL Editor** → **New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql), copy **the whole file**, paste it in, click **Run**. You should see "Success. No rows returned".
3. Go to **Project Settings → API Keys** and note these three values for later:
   - **Project URL** (e.g. `https://abcd1234.supabase.co`)
   - **Publishable key** (`sb_publishable_…`, or the legacy `anon` key)
   - **Secret key** (`sb_secret_…`, or the legacy `service_role` key). **Keep this private.**
4. **Authentication → URL Configuration**:
   - **Site URL**: your app address, e.g. `https://mydesk.yourdomain.com`
   - **Redirect URLs**: add the same address, plus `http://localhost:5173` if you'll run it locally.
5. Optional, **Google sign-in**: **Authentication → Providers → Google** → enable, then paste a Client ID and Secret from [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (OAuth client, type "Web application"; under "Authorized redirect URIs" use the callback URL Supabase shows on that screen).

### Step 2. Resend: email

1. [Resend](https://resend.com) → **Domains** → **Add domain** → add the DNS records it shows at your DNS provider → wait for **Verified**.
2. **API Keys** → **Create API key** → copy it.
3. Pick a sender address on that domain, e.g. `notifications@yourdomain.com`. It doesn't need a real inbox.

### Step 3. Create your environment variables

Make a random secret for the cron job (any long random string works):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then fill in this list (copy [`.env.example`](.env.example) to `.env` if you want to keep it locally; `.env` is never committed):

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase **publishable** key |
| `SUPABASE_URL` | Supabase Project URL (same as above) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **secret** key |
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | `MyDesk <notifications@yourdomain.com>` |
| `APP_URL` | your app address, e.g. `https://mydesk.yourdomain.com` (no trailing slash) |
| `CRON_SECRET` | the random string you just made |

`VITE_` values are built into the browser app (they're public by design). Everything else stays on the server.

### Step 4. Vercel: deploy

1. [Vercel](https://vercel.com) → **Add New → Project** → import this GitHub repo.
2. Framework preset: **Vite** (detected automatically from `vercel.json`). Leave build settings as they are.
3. Open **Environment Variables** and add every variable from Step 3 (Production and Preview).
4. Click **Deploy**. When it finishes you get a `*.vercel.app` address. Open it to check the sign-in page loads.
5. The daily job in `vercel.json` (`/api/cron/daily`, 03:00 UTC = 09:00 Dhaka) is set up automatically. You can see it under **Settings → Cron Jobs**.

> If you change an environment variable later, redeploy (**Deployments → ⋯ → Redeploy**) so the app picks it up.

### Step 5. Your own domain

1. Vercel → project → **Settings → Domains** → add `mydesk.yourdomain.com`.
2. Vercel shows a DNS record (usually a **CNAME** to `cname.vercel-dns.com`). Add it at your DNS provider.
3. Wait until Vercel shows **Valid Configuration** (minutes, sometimes up to an hour). HTTPS is automatic.
4. Make sure `APP_URL` and the Supabase Site URL (Step 1.4) both use this address.

### Step 6. Connect instant emails

Back in **Supabase → SQL Editor**, run this once with your own app address and `CRON_SECRET`:

```sql
select app_private.configure('https://mydesk.yourdomain.com', 'YOUR_CRON_SECRET');
```

This lets the database ping your app the moment an email is queued, so notifications go out within seconds. Without it, emails still go out, but only once a day.

### Step 7. Sign in and check

1. Open your app address and sign in.
   - **Existing workspace**: use your existing email and password. All your data is there.
   - **Brand-new workspace**: on the sign-in page click **Setting up?** and create the first account. The first account becomes the **owner**.
2. **Workspace settings** (sidebar → your name → Workspace settings): add your business name, address and payment methods. They're used on invoices.
3. Test email: **Team → Invite member** → invite another email address of yours. You should get the invite within a few seconds.
4. Test a reminder: **Payments** → **Remind** on an open payment (the client needs an email address in Client settings).

You're live.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Failed to load data" after sign-in | Check `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in Vercel, then redeploy. Make sure Step 1 (SQL) ran. |
| Login link / reset email opens the wrong site | Supabase → Authentication → URL Configuration: fix Site URL and Redirect URLs. |
| No emails at all | Vercel → project → **Logs**, filter `/api/email/dispatch`. Usually a wrong `RESEND_API_KEY`, or `EMAIL_FROM` not on your verified Resend domain. |
| Emails only arrive once a day | Step 6 wasn't run, or the address/secret don't match `APP_URL` / `CRON_SECRET`. Run it again with the right values. |
| See stuck or failed emails | Supabase SQL: `select template, to_email, status, last_error from email_outbox order by created_at desc limit 20;` |
| "Send reminder" or "Remove member" fails | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` missing in Vercel, then redeploy. |
| Google sign-in error | Provider not enabled in Supabase, or the redirect URI in Google Cloud doesn't match the one Supabase shows. |
| Re-run the SQL after an update | Always safe. Paste the whole `schema.sql` again and Run. |

---

## Run on your computer

```bash
npm install
npm run dev            # http://localhost:5173
```

- **No `.env`**: demo mode with sample data stored in your browser. Add `?as=member` to the URL to see what a member sees.
- **With `.env`**: uses your real Supabase data. Be careful, it's the live database.
- **With the backend** (emails, reminders): `npm i -g vercel`, then `vercel link` and `vercel dev`.

Checks:

```bash
npm run typecheck      # frontend + API types
npm run test:sql       # runs schema.sql in an in-memory Postgres and checks it's safe
npm run build          # production build
```

---

## What's in the app

- **Dashboard**: outstanding / overdue / paid, 6-month revenue chart, payments to chase with one-click reminders, up next, next 7 days, live activity.
- **Inbox**: mentions, assignments, completed tasks, overdue payments, accepted invites. Reply to comments from the inbox.
- **Tasks**: list (grouped by due date / project / status / assignee) and drag-and-drop board; refs like `CPS-12`, rich-text descriptions, subtasks, file attachments and links, labels, estimates, time logging, watchers, comments with @mentions.
- **Projects**: tasks, overview, pinned notes, access checklist, activity. "Duplicate for next month". A budget creates a payment automatically; marking a project **Finished** settles its payments.
- **Clients**: cards with billed/open money; client page with projects, invoices, payments and notes; client settings (contact, local time, legal invoicing address, currency, payment terms, brand colour, custom invoice fields); pin to sidebar; archive; delete.
- **Payments**: open / overdue / paid, mark paid, email reminders with the invoice PDF attached, bulk "set due dates".
- **Invoices**: live preview editor, add lines from projects, payment methods, PDF export, linked to a payment for paid/unpaid status.
- **Analytics**: collected vs outstanding, top clients, open payments by age, payment status, revenue by client, new clients, revenue concentration, CSV export.
- **Team**: invite by email (role + client access), resend/revoke invites, client-access matrix, member pages, remove member.
- **You**: profile photo, email notification preferences, light/dark/system theme, password change, Google sign-in.
- **Shortcuts**: `Ctrl/⌘ K` search · `T` new task · `P` new project · `G` then `D` `T` `P` `C` `$` `A` `I` to jump.

### Emails (never the same email twice)

Every email goes through the `email_outbox` table with a unique key per event, so the database guarantees one email per event.

| Email | When | Who gets it |
|---|---|---|
| Assigned | A task is assigned to you (editing the task never re-sends) | assignee |
| Mentioned | You're @mentioned in a comment or project note | mentioned person |
| New comment | Comment on a task you're assigned to, created or watch (off by default) | them |
| Payment overdue | Once per payment, after it passes its due date | owner + admins |
| Weekly summary | Mondays 09:00 Dhaka time | everyone who has it on |
| Invite | When you invite someone | invitee |
| Payment reminder | When you click **Send reminder** | your client (replies go to you) |

Each person controls their own emails in **Profile & preferences → Notifications**.

### Roles

- **Owner**: everything. Only one.
- **Admin**: every client, project, payment and invoice; can invite people.
- **Member**: projects, tasks, notes and comments under the clients they're granted. No money, no client contact details.

Enforced by Postgres row-level security, not just hidden in the UI.

---

## Project structure

```
api/                      Vercel Functions: email dispatch, daily cron, payment reminders, remove member
  _lib/                   Supabase admin client, auth check, Resend, email templates, outbox sender
src/
  styles/                 tokens.css (light/dark colours), design.css (from mydesk-design.html), app.css
  components/ui/          modal, menu, tabs, form fields, avatars, pills, rich text, @mention composer
  components/domain/      task rows and board, revenue chart, activity items
  components/layout/      sidebar shell, Ctrl+K search
  data/                   store (instant updates + live sync), business rules (actions.ts), demo data
  features/               dashboard, inbox, tasks, projects, clients, team, payments, invoices, analytics, settings, auth
  lib/                    formatting, status colours, currency (USD totals), PDF export
supabase/schema.sql       the whole database: tables, security rules, triggers, email outbox, storage
scripts/test-schema.mjs   database safety checks (in-memory Postgres)
mydesk-design.html        the design reference
vercel.json               build settings, page routing, daily cron
```
