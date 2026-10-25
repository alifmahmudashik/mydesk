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

/**
 * An invoice's status, from the payment(s) linked to it. An invoice built from several
 * projects links to each project's own payment: paid once all are paid, overdue if any is.
 */
export function invoicePaymentStatus(invoiceId: string, payments: Payment[]): PaymentStatus | null {
  const linked = payments.filter((p) => p.invoice_id === invoiceId)
  if (linked.length === 0) return null
  const st = linked.map(effectivePaymentStatus)
  if (st.every((s) => s === 'paid')) return 'paid'
  if (st.every((s) => s === 'refunded' || s === 'paid')) return 'refunded'
  if (st.includes('overdue')) return 'overdue'
  if (st.some((s) => s === 'paid' || s === 'partial')) return 'partial'
  return 'unpaid'
}

/** Projects ready to invoice: marked Completed (Finished means it's already settled) and not on an invoice yet. */
export function isInvoiceable(project: Project, invoices: { client_id: string; line_items: { description: string }[] }[], payments: Payment[]) {
  if (project.status !== 'completed') return false
  const onInvoice = invoices.some((i) => i.client_id === project.client_id && i.line_items.some((li) => li.description.trim() === project.title.trim()))
  const paymentInvoiced = payments.some((p) => p.project_ids?.includes(project.id) && p.invoice_id)
  return !onInvoice && !paymentInvoiced
}

/** The month a project's work was done, as yyyy-MM-dd: the chosen work month, else the
 *  start date, else the day it was created. */
export function projectWorkDate(pr: Project): string {
  return pr.work_month || pr.start_date || pr.created_at.slice(0, 10)
}

/** When the work behind a payment happened (yyyy-MM-dd): the earliest work month of the
 *  projects it covers (see projectWorkDate). A payment with no linked project falls back to
 *  the day it was created. Money is counted in this month, not the month it was received. */
export function workDate(p: Payment, projects: Project[]): string {
  let best = ''
  for (const id of p.project_ids ?? []) {
    const pr = projects.find((x) => x.id === id)
    if (!pr) continue
    const d = projectWorkDate(pr)
    if (!best || d < best) best = d
  }
  return best || p.created_at.slice(0, 10)
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthName = (d: string) => `${MONTH_NAMES[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`

/** Client-facing invoice note saying when the work was done, e.g.
 *  "This invoice covers services provided in October 2026." (no internal terms like "retainer"). */
export function workMonthNote(list: Project[]): string[] {
  if (list.length === 0) return []
  const keys = [...new Set(list.map((p) => projectWorkDate(p).slice(0, 7)))].sort()
  const years = new Set(keys.map((k) => k.slice(0, 4)))
  const parts = keys.map((k) => (years.size === 1 ? MONTH_NAMES[Number(k.slice(5, 7)) - 1] : monthName(`${k}-01`)))
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  const period = years.size === 1 ? `${joined} ${[...years][0]}` : joined
  return [`This invoice covers services provided in ${period}.`]
}

/** Adds work-month lines to an invoice note, skipping any already there. */
export function withWorkMonthNote(note: string, list: Project[]): string {
  const add = workMonthNote(list).filter((l) => !note.includes(l))
  if (!add.length) return note
  return [add.join('\n'), note.trim()].filter(Boolean).join('\n\n')
}

/** True once the projects.work_month column exists (select * returns it on every row). */
export function hasWorkMonthColumn(projects: Project[]) {
  return projects.length === 0 || projects.some((p) => 'work_month' in p)
}

/** Everyone assigned to a task (older rows only have assignee_id). */
export function taskAssigneeIds(t: { assignee_id?: string | null; assignee_ids?: string[] | null }): string[] {
  if (t.assignee_ids && t.assignee_ids.length) return t.assignee_ids
  return t.assignee_id ? [t.assignee_id] : []
}

export function isAssignedTo(t: { assignee_id?: string | null; assignee_ids?: string[] | null }, userId?: string | null) {
  return Boolean(userId) && taskAssigneeIds(t).includes(userId!)
}
