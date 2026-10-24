import type { Client, ClientMember, Payment, PaymentStatus, Profile, Project, Task } from '@/types'
import { formatMoney, isOverdue } from '@/lib/format'

/** The one way to name a client anywhere in the UI. Respects the per-client display preference. */
export function clientDisplayName(c?: Client | null) {
  if (!c) return '—'
  return c.use_company_name && c.company_name ? c.company_name : c.name
}

/** Secondary line under the display name (the other of contact/company), if any. */
export function clientSecondaryName(c?: Client | null) {
  if (!c) return null
  return c.use_company_name && c.company_name ? c.name : (c.company_name ?? null)
}

export function profileDisplayName(p?: Profile | null) {
  if (!p) return 'Unassigned'
  return p.display_name || p.full_name || p.email.split('@')[0] || 'User'
}

export function profileFullName(p?: Profile | null) {
  if (!p) return '—'
  return p.full_name || p.display_name || p.email.split('@')[0]
}

export function initials(name: string) {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Stable avatar colour class (av-c1..av-c8) for a person. */
export function avatarTone(id: string) {
  return `av-c${(hash(id) % 8) + 1}`
}

const CLIENT_COLORS = ['#DB2777', '#DC2626', '#C026D3', '#7C3AED', '#D97706', '#E11D48', '#16A34A', '#0284C7', '#0D9488', '#334155', '#65A30D', '#4F46E5']

/** A client's accent colour (brand colour if set, otherwise stable from its id). */
export function clientColor(c?: Client | null) {
  if (!c) return '#6B6B78'
  return c.brand_color || CLIENT_COLORS[hash(c.id) % CLIENT_COLORS.length]
}

/** "CPS" from "Oct: CPC Vending — Google Ads". Mirrors derive_project_key() in the database. */
export function deriveProjectKey(title: string) {
  const cleaned = title.replace(/^[A-Za-z]{3,9}:\s*/, '')
  const letters = cleaned
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .map((w) => w[0])
    .join('')
    .replace(/[^A-Za-z]/g, '')
  return letters.slice(0, 3).toUpperCase() || 'TSK'
}

export function taskRef(task: Task, project?: Project | null) {
  if (!task.number) return ''
  return `${project?.key || 'TSK'}-${task.number}`
}

/** Short project name for crumbs: "Oct: CPC Vending" from "Oct: CPC Vending — Google Ads Management". */
export function shortProjectTitle(title: string) {
  return title.split(/\s+[—–-]\s+/)[0]
}

/** Who can be assigned a task on this client's projects: admins/owner always, plus members granted this client. */
export function eligibleAssignees(clientId: string | undefined, profiles: Profile[], clientMembers: ClientMember[]) {
  if (!clientId) return profiles
  const granted = new Set(clientMembers.filter((m) => m.client_id === clientId).map((m) => m.user_id))
  return profiles.filter((p) => p.role !== 'member' || granted.has(p.id))
}

/** A payment past its due date that isn't settled reads as overdue even if not flagged. */
export function effectivePaymentStatus(p: Payment): PaymentStatus {
  if ((p.status === 'unpaid' || p.status === 'partial') && isOverdue(p.due_date)) return 'overdue'
  return p.status
}

export function isOpenPayment(p: Payment) {
  const s = effectivePaymentStatus(p)
  return s === 'unpaid' || s === 'partial' || s === 'overdue'
}

/** "$1,600 · €3,600": totals grouped per currency. */
export function sumByCurrency(items: { amount: number; currency: string }[]) {
  const sums = new Map<string, number>()
  for (const p of items) sums.set(p.currency, (sums.get(p.currency) ?? 0) + Number(p.amount))
  return [...sums.entries()].map(([currency, amount]) => formatMoney(amount, currency)).join(' · ') || formatMoney(0)
}

export const OPEN_PROJECT = (p: Project) => !['completed', 'finished', 'cancelled'].includes(p.status) && !p.archived_at
export const OPEN_TASK = (t: Task) => t.status !== 'done' && t.status !== 'cancelled'

// ---------- @mentions ----------
// Comments store mentions as @[Name](user-id) tokens so names render even if someone is renamed.

const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g

export function mentionIds(body: string) {
  return [...new Set([...body.matchAll(MENTION_RE)].map((m) => m[2]))]
}

export type BodyPart = { kind: 'text'; text: string } | { kind: 'mention'; name: string; id: string }

export function splitMentions(body: string): BodyPart[] {
  const parts: BodyPart[] = []
  let last = 0
  for (const m of body.matchAll(MENTION_RE)) {
    if (m.index! > last) parts.push({ kind: 'text', text: body.slice(last, m.index) })
    parts.push({ kind: 'mention', name: m[1], id: m[2] })
    last = m.index! + m[0].length
  }
  if (last < body.length) parts.push({ kind: 'text', text: body.slice(last) })
  return parts
}

export function plainMentions(body: string) {
  return body.replace(MENTION_RE, '@$1')
}
