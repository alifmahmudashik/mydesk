# MyDesk

Client & project management dashboard for freelancers and small agencies — clients, projects, tasks, access checklists, payments/invoices, and a team layer with per-project collaborator access.

React 19 + TypeScript + Vite · Tailwind CSS v4 · Framer Motion · Radix UI · TipTap · Supabase (Postgres + Auth).

## Features

- **Asana-style workspace** — clients in the sidebar, project cards per client, tabbed project detail (Overview / Tasks / Checklist / Notes) with a rich-text description
- **Payments/invoices** — one invoice can cover multiple projects; creating a project with a budget auto-creates its invoice; confetti when you mark one paid
- **Team & roles** — owner / admin / member; granting a member a client gives them full control over every project and task under it — create, edit, delete, assign teammates, invite others, filterable by assignee — while budgets, payments, and client contact details stay admin-only, enforced by Postgres row-level security
- **Design system first** — one component kit, one status-color convention, full dark mode, optimistic updates + skeleton loading
- **Demo mode** — runs fully client-side with seeded data when no Supabase env is set

## Run

```bash
npm install
npm run dev
```

- **Demo mode** (no `.env`): seeded demo data, fully interactive, persisted to localStorage.
- **Supabase mode**:
  1. Create a [Supabase](https://supabase.com) project
  2. In the SQL editor run, in order: `supabase/schema.sql`, then `migration-002` through `-006`
  3. Copy `.env.example` → `.env` and fill in your project URL + anon/publishable key
  4. Restart the dev server and sign up — the first account becomes the workspace owner

## Design system

`design-system/mydesk/MASTER.md` is the source of truth — tokens, status-color convention, motion vocabulary, component rules. Read it before building any new screen; compose only the components in `src/components/ui`.

## Structure

```
src/
  index.css            # theme tokens (light/dark) — the only place colors live
  lib/                 # status convention, motion vocabulary, formatters, derive helpers
  data/                # zustand store (optimistic updates + activity log), demo seed
  hooks/               # auth, theme, role permissions
  components/ui/       # THE component kit — Button, StatusPill, Modal, DatePicker, RichText…
  components/layout/   # app shell (sidebar + clients list), page transitions
  features/            # dashboard, clients, projects, tasks, payments, team, auth
supabase/              # schema.sql + ordered migrations (multi-project invoices, display
                       # names, collaborators/RLS)
```
