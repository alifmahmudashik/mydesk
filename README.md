# MyDesk

Client and project management for freelancers and small agencies. Clients, projects, tasks with comments and @mentions, an inbox, payments, branded invoices, analytics, team learning, and a team with per-client access. Runs in the browser and as a Windows app.

**Live app:** https://mydesk.alifmahmud.com · **Windows app:** [latest release](https://github.com/alifmahmudashik/mydesk/releases/latest)

## How it fits together

| Part | Service | Job |
|---|---|---|
| Website | **Vercel** (React + Vite) | The app itself |
| Server functions | **Vercel** (`api/`) | Sends emails, daily job, payment reminders, removing members |
| Database, sign-in, files | **Supabase** | Data, email/Google sign-in, attachments, live updates |
| Email | **Resend** | Notification, invite and reminder emails |
| Windows app | **Electron** (`desktop/`) | A window that opens the live site, so it updates with every deploy |

```
Browser / Windows app ──► Vercel (app + api) ──► Resend (email)
          │                     ▲
          └──────► Supabase ────┘  the database queues emails and pings the api
```

---

## Set it up from scratch

About 30 minutes. Do the steps in order.

**You need:** a GitHub account with this repo · a [Supabase](https://supabase.com) project · a [Vercel](https://vercel.com) account · a [Resend](https://resend.com) account · a domain you control (for example `mydesk.yourdomain.com`). Free plans are fine.

### 1. Database (Supabase)

1. Supabase → your project → **SQL Editor** → **New query**.
2. Copy **all** of [`supabase/schema.sql`](supabase/schema.sql), paste it, click **Run**. You should see "Success. No rows returned".
   This one file is the whole database. It's safe to run again any time and never deletes data.
3. **Project Settings → API Keys**: copy the **Project URL**, the **Publishable key** and the **Secret key** (keep the secret one private).
4. **Authentication → URL Configuration**: set **Site URL** to your app address and add it under **Redirect URLs** (add `http://localhost:5173` too if you'll run it locally).
5. Optional, Google sign-in: **Authentication → Providers → Google** → turn on and paste a Client ID and Secret from [Google Cloud](https://console.cloud.google.com/apis/credentials). Use the callback URL Supabase shows as the redirect URI.

### 2. Email (Resend)

1. **Domains → Add domain**, add the DNS records it shows, wait for **Verified**.
2. **API Keys → Create API key** and copy it.
3. Pick a sender address on that domain, like `notifications@yourdomain.com` (no real inbox needed).

### 3. Deploy (Vercel)

1. **Add New → Project** → import this repo. Leave the build settings as they are.
2. Under **Environment Variables**, add these (for Production and Preview):

   | Variable | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabase **publishable** key |
   | `SUPABASE_URL` | Supabase Project URL (same again) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase **secret** key |
   | `RESEND_API_KEY` | Resend API key |
   | `EMAIL_FROM` | `MyDesk <notifications@yourdomain.com>` |
   | `APP_URL` | your app address, no slash at the end |
   | `CRON_SECRET` | any long random text (make one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |

3. Click **Deploy**.
4. **Settings → Domains** → add your domain and create the DNS record Vercel shows. Wait for **Valid Configuration**.

The daily job (overdue payments, due-tomorrow reminders, Monday summary) is set up automatically from `vercel.json`.

### 4. Turn on instant emails

Back in the Supabase SQL Editor, run this once with your own address and `CRON_SECRET`:

```sql
select app_private.configure('https://mydesk.yourdomain.com', 'YOUR_CRON_SECRET');
```

Without this, emails still go out, but only once a day.

### 5. Sign in

1. Open your app. For a new workspace, click **Setting up?** on the sign-in page and create the first account. The first account is the **owner**.
2. Sidebar → your name → **Workspace settings**: add your business name, address and payment methods (used on invoices).
3. Test it: **Team → Invite member** with another email of yours. The invite should arrive within seconds.

Done.

---

## Updating

Most updates need nothing from you:

| What changed | What to do |
|---|---|
| App code (`src/`, `api/`) | Push to GitHub. Vercel deploys in a minute or two. The Windows app picks it up on next open (or `Ctrl+R`). |
| Database (`supabase/schema.sql`) | Paste the whole file into the Supabase SQL Editor again and **Run**. Always safe. |
| Windows app (`desktop/`) | Build a new installer and publish a release (see below). |
| An environment variable | Change it in Vercel, then **Deployments → ⋯ → Redeploy**. |

---

## Windows app

It opens the live site in its own window, with the MyDesk icon and no browser bars, so it always shows the latest deployed version.

**Install:** download `MyDesk-Setup-x.y.z.exe` from [Releases](https://github.com/alifmahmudashik/mydesk/releases/latest) and double-click it. If Windows says "Windows protected your PC", click **More info → Run anyway** (the installer isn't code-signed).

**Release a new version** (only when `desktop/` changes):

```powershell
cd desktop
npm install
# bump "version" in desktop/package.json first
npm run build        # creates desktop/release/MyDesk-Setup-x.y.z.exe
gh release create vX.Y.Z release/MyDesk-Setup-X.Y.Z.exe --title "MyDesk for Windows X.Y.Z"
```

More in [`desktop/README.md`](desktop/README.md).

---

## Run it on your computer

```bash
npm install
npm run dev            # http://localhost:5173
```

- **No `.env` file:** demo mode with sample data kept in your browser. Add `?as=member` to the address to see what a member sees.
- **With a `.env` file** (copy [`.env.example`](.env.example)): uses your real Supabase data, so be careful.
- **Emails and reminders locally:** `npm i -g vercel`, then `vercel link` and `vercel dev`.

Before pushing:

```bash
npm run typecheck      # app + api types
npm run test:sql       # runs schema.sql in a throwaway database and checks it
npm run build          # production build
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Failed to load data" after sign-in | Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel, redeploy, and make sure `schema.sql` was run. |
| A page says "Run supabase/schema.sql" | The database is behind the app. Run `schema.sql` again. |
| Sign-in or reset link opens the wrong site | Supabase → Authentication → URL Configuration: fix Site URL and Redirect URLs. |
| No emails at all | Vercel → **Logs**, filter `/api/email/dispatch`. Usually a wrong `RESEND_API_KEY`, or `EMAIL_FROM` isn't on your verified domain. |
| Emails arrive only once a day | Step 4 wasn't run, or its address/secret don't match `APP_URL` / `CRON_SECRET`. |
| No email while the app is open | Expected: with desktop notifications on, you get a pop-up instead. Emails resume about 3 minutes after you close MyDesk. |
| See stuck or failed emails | In Supabase SQL: `select template, to_email, status, last_error from email_outbox order by created_at desc limit 20;` |
| "Send reminder" or "Remove member" fails | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` missing in Vercel. Add them and redeploy. |
| Google sign-in error | Google isn't turned on in Supabase, or the redirect URI in Google Cloud doesn't match Supabase's. |

---

## What's in the app

- **Dashboard:** outstanding, overdue and earned money; 6-month revenue chart; payments to chase with one-click reminders; up next; next 7 days; live activity. The eye button hides all amounts and counts for screen sharing.
- **Inbox:** mentions, assignments, finished tasks, overdue payments, accepted invites. Reply to comments from here.
- **Tasks:** list and drag-and-drop board, refs like `CPS-12`, several assignees, rich-text descriptions, subtasks, files and links, labels, estimates, time logging, watchers, comments with @mentions.
- **Projects:** grouped by client, with tasks, overview, pinned notes, access checklist and activity. "Duplicate for next month". A budget creates a payment automatically; marking a project **Finished** settles its payments.
- **Clients:** list or cards with billed and open money. Each client page shows a compact stat row, active and completed projects with progress, invoices, payments, notes, and an export of selected projects as a ready-to-send message.
- **Payments & invoices:** one page. Open, overdue and paid payments, each with its invoice (or a **Create** button that pre-fills one from the payment), plus an Invoices tab with every invoice. Mark paid, email reminders with the invoice PDF attached, set due dates in bulk. The invoice editor has a live preview, lines from projects, payment methods and PDF export.
- **Analytics:** three tabs. *Payments*: collected vs outstanding, month by month, open payments by age. *Clients*: projects, revenue (range and all time), average project value, days to pay, last work, quiet clients, best client, revenue concentration. *Team*: your own numbers, plus who did what (projects, tasks done, on-time rate, hours, share of project value) and who worked on each project. CSV export.
- **Improvement:** share videos and articles with teammates, track what each person is learning, save takeaways, set personal goals, and build topics with lessons and resources.
- **Team:** invite by email with a role and client access, resend or revoke invites, client-access matrix, member pages, shared team links (meeting rooms and more).
- **Clock:** what time it is for every client, now or at a time you're planning, with a my-time/their-time converter.
- **You:** profile photo, notification preferences (email, desktop pop-ups, sound), light/dark/system theme, password, Google sign-in.
- **Shortcuts:** `Ctrl/⌘ K` search · `T` new task · `P` new project · `G` then `D` `T` `P` `C` `$` `A` `I` to jump.

### Emails

Each event sends at most one email, guaranteed by the database. While you have MyDesk open with desktop notifications on, you get a pop-up instead of an email.

| Email | When | Who gets it |
|---|---|---|
| Assigned | You're added to a task | the new assignee |
| Mentioned | You're @mentioned in a comment or project note | that person |
| New comment | On a task you're assigned to, created or watch (off by default) | them |
| Due tomorrow | A task or project is due the next day | assignees / people with access |
| Payment overdue | Once per payment, after its due date | owner and admins |
| Weekly summary | Mondays 09:00 Dhaka time | everyone who has it on |
| Invite | You invite someone | the invitee |
| Payment reminder | You click **Send reminder** | your client (replies go to you) |

Everyone controls their own emails under **Profile & preferences → Notifications**.

### Roles

- **Owner:** everything. Only one.
- **Admin:** every client, project, payment and invoice; can invite people.
- **Member:** projects, tasks, notes and comments for the clients they're given. No money and no client contact details.

The database enforces this (row-level security), not just the screens.

---

## Project structure

```
api/                      Vercel functions: email sending, daily job, payment reminders, remove member
  _lib/                   Supabase admin client, auth check, Resend, email templates, outbox
src/
  styles/                 tokens.css (colours), design.css (base design), app.css
  components/             ui (modal, menu, fields, avatars, privacy toggle…), domain (task rows, charts), layout (sidebar, Ctrl+K)
  data/                   store (instant updates + live sync), business rules (actions.ts), demo data
  features/               one folder per page: dashboard, inbox, tasks, projects, clients, team, payments, invoices, analytics, improvement, clock, settings, auth
  lib/                    formatting, status colours, currency, PDF export, privacy mode
supabase/schema.sql       the whole database in one file: tables, security rules, triggers, email outbox, storage
scripts/test-schema.mjs   database checks (runs schema.sql in a throwaway Postgres)
desktop/                  Windows app (Electron): window, icon, installer
vercel.json               build settings, page routing, daily job
```
