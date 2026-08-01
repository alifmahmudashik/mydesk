# MyDesk v2 — Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/mydesk/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file. If not, strictly follow the rules below.

**Project:** MyDesk v2 — client & project management dashboard for freelancers/small agencies
**Reference feel:** Linear, Notion, Vercel dashboard, Cal.com — clean, minimal, confident, alive.

---

## 1. Core Principles

1. **One system, zero one-offs.** Every screen composes existing components (`src/components/ui`). Never hand-roll a variant.
2. **Neutral canvas, one accent.** Grays/whites carry the UI; indigo is reserved for primary actions and active states. Status colors follow the single convention in §4.
3. **Motion is purposeful and fast.** 150–300ms, expo-out entrances, ease-in exits, springs for panels. Never linear, never decorative-only, always `prefers-reduced-motion` aware.
4. **Fast-feeling.** Optimistic updates, skeletons (never spinners for content), zero layout shift.

## 2. Color Tokens (CSS vars in `src/index.css`, mapped via Tailwind v4 `@theme inline`)

| Token | Light | Dark |
|---|---|---|
| `--background` | `#FAFAFA` | `#0C0C0E` |
| `--surface` (cards/panels) | `#FFFFFF` | `#141417` |
| `--surface-hover` | `#F4F4F5` | `#1B1B1F` |
| `--foreground` | `#18181B` | `#EDEDEF` |
| `--muted-foreground` | `#71717A` | `#8D8D95` |
| `--faint-foreground` | `#A1A1AA` | `#6B6B74` |
| `--border` | `#E4E4E7` | `#26262B` |
| `--primary` | `#4F46E5` (indigo-600) | `#6366F1` (indigo-500) |
| `--primary-hover` | `#4338CA` | `#747BF2` |
| `--primary-soft` (active nav bg, selected) | `#EEF2FF` | `rgba(99,102,241,0.12)` |
| `--danger` | `#DC2626` | `#EF4444` |
| `--ring` | `#4F46E5` | `#818CF8` |

- Dark mode is a first-class theme (class `.dark` on `<html>`, no-flash inline script). Never pure `#000`.
- Never use raw hex in components — Tailwind token classes only (`bg-surface`, `text-muted-foreground`, …).

## 3. Typography

- **Font:** Inter Variable (self-hosted via `@fontsource-variable/inter`), single family for everything. `tabular-nums` on all numeric/data cells, amounts, dates.
- **Scale:** 12 (meta/labels) · 13 (secondary) · 14 (body/base UI) · 16 (panel titles) · 18 (section) · 24 (page titles) · 30 (dashboard hero numbers).
- **Weights:** 400 body · 500 labels/buttons/nav · 600 headings/titles. Tracking `-0.01em` on headings ≥18.
- Line-height 1.5 body; page titles `tracking-tight`.

## 4. Status Convention (single source: `src/lib/status.ts`)

One semantic tone system for ALL entities — a color always means the same thing:

| Tone | Meaning | Used by |
|---|---|---|
| `neutral` (zinc) | not yet / inactive | not_started, todo, unpaid (not due), not_needed, archived, cancelled, low priority |
| `accent` (indigo) | in motion | in_progress, requested, active client, medium priority |
| `amber` | waiting / needs attention | waiting_for_client, review, partial, paused, needed (access), high priority |
| `red` | problem / overdue | blocked, overdue, urgent priority |
| `green` (emerald) | done / positive | completed, done, paid, received |
| `violet` | exceptional | refunded |

Rendered ONLY by `<StatusPill>`: tinted bg + colored dot + label, both modes. Never color-only — dot + text always.

## 5. Shape, Depth, Spacing

- **Radius:** 6px small controls (`rounded-md`), 8px buttons/inputs (`rounded-lg`), 12px cards/modals/panels (`rounded-xl`).
- **Shadows:** near-flat. Cards: `shadow-sm` + 1px border. Modals/slide-overs: `shadow-xl`. No colored/glow shadows except a soft primary glow behind the main CTA on empty states.
- **Spacing:** 4px scale. Page gutter 24 (mobile 16), card padding 20, section gap 24–32, control gap 8–12. Max content width `max-w-6xl` for lists, full-bleed for dashboard grid.
- **Density:** compact-comfortable — table rows 44–48px tall (touch-safe), 14px text.

## 6. Motion (single source: `src/lib/motion.ts`)

- **Easing:** entrances `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out); exits `ease-in` and ~65% of enter duration; panels/modals use springs (`stiffness ~380, damping ~32`).
- **Page transitions:** fade + 6px rise, ~200ms; exit 120ms fade. No overlay wipes.
- **Slide-over panel:** spring from right + overlay fade (`bg-black/40 backdrop-blur-[2px]`); swipe/Escape/overlay dismiss.
- **Lists:** stagger children 30ms, `layout` animation on reorder/removal.
- **Micro:** buttons `whileTap scale 0.98`; rows hover lift `bg-surface-hover` 150ms; task check-off = SVG path draw + scale pop, row settles with layout animation; payment→paid = confetti burst from the trigger + pill morph.
- **Respect `prefers-reduced-motion`** globally (MotionConfig reducedMotion="user").

## 7. Components (build once in `src/components/ui`, reuse everywhere)

Button (primary/secondary/ghost/danger + loading state) · Input/Textarea/Select/Checkbox with `<Field>` wrapper (visible label, error below field, helper text) · StatusPill · Avatar (deterministic pastel initials — THE client identity mark, use wherever a client appears) · CheckboxRow (pick-lists) · Modal (centered, forms) · SlideOverPanel (right, detail views — THE detail pattern for projects/payments) · Table primitives · Skeleton (shimmer) · Card/StatCard · EmptyState (icon + message + CTA) · DropdownMenu · PageHeader (optional `leading` identity slot).

**Entity iconography:** projects get a status-toned rounded icon tile (`FolderKanban` in `tonePill` colors); tasks show a priority `Flag` in `toneText` colors (filled when urgent); clients always get `<Avatar>`. Brand: white fire glyph on indigo tile (`public/mydesk-fire.png`), wordmark "MyDesk".

**Hard rules:** no emoji icons (Lucide only, 16px in controls, `strokeWidth 1.75`); every icon-only button has `aria-label`; focus rings visible (`ring-2 ring-ring ring-offset-2`); touch targets ≥44px; `cursor-pointer` on clickables; labels never placeholder-only; destructive actions confirm first and sit visually separated.

## 8. Anti-patterns (never do)

Spinners for content areas (skeletons only; spinners allowed inside buttons) · layout shift on data load (reserve space) · mixed radii/shadows per page · raw hex in components · color-only status · hover-only affordances · animating width/height/top/left (transform/opacity only) · one-off modal/panel layouts · gray-on-gray text below 4.5:1.
