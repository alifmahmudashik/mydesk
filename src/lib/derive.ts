import type { Client, ClientMember, Payment, PaymentStatus, Profile } from '@/types'
import { formatMoney, isOverdue } from '@/lib/format'

/** The one way to name a client anywhere in the UI — respects the per-client display preference. */
export function clientDisplayName(c?: Client | null) {
  if (!c) return '—'
  return c.use_company_name && c.company_name ? c.company_name : c.name
}

/** Secondary line under the display name (the other of contact/company), if any. */
export function clientSecondaryName(c?: Client | null) {
  if (!c) return null
  return c.use_company_name && c.company_name ? c.name : (c.company_name ?? null)
}

export function profileDisplayName(p: Profile) {
  return p.display_name || p.email.split('@')[0] || 'User'
}

/**
 * Who can be assigned a task on this client's projects: admins/owner always
 * (they see everything), plus members explicitly granted this client.
 */
export function eligibleAssignees(
  clientId: string | undefined,
  profiles: Profile[],
  clientMembers: ClientMember[],
) {
  if (!clientId) return profiles
  const granted = new Set(
    clientMembers.filter((m) => m.client_id === clientId).map((m) => m.user_id),
  )
  return profiles.filter((p) => p.role !== 'member' || granted.has(p.id))
}

/** A payment past its due date that isn't settled reads as overdue even if not manually flagged. */
export function effectivePaymentStatus(p: Payment): PaymentStatus {
  if ((p.status === 'unpaid' || p.status === 'partial') && isOverdue(p.due_date)) return 'overdue'
  return p.status
}

export function isOpenPayment(p: Payment) {
  const s = effectivePaymentStatus(p)
  return s === 'unpaid' || s === 'partial' || s === 'overdue'
}

/** "$1,600 · €3,600" — totals grouped per currency, order stable. */
export function sumByCurrency(payments: Payment[]) {
  const sums = new Map<string, number>()
  for (const p of payments) sums.set(p.currency, (sums.get(p.currency) ?? 0) + p.amount)
  return (
    [...sums.entries()].map(([currency, amount]) => formatMoney(amount, currency)).join(' · ') ||
    formatMoney(0)
  )
}
