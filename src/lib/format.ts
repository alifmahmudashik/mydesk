import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isThisYear,
  parseISO,
} from 'date-fns'

export function formatMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}

export function formatDate(iso?: string | null) {
  if (!iso) return '—'
  const d = parseISO(iso)
  return isThisYear(d) ? format(d, 'MMM d') : format(d, 'MMM d, yyyy')
}

export function formatAgo(iso: string) {
  return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true })
}

/** Days from today (negative = past). */
export function daysUntil(iso?: string | null) {
  if (!iso) return null
  return differenceInCalendarDays(parseISO(iso), new Date())
}

export function isOverdue(iso?: string | null) {
  const d = daysUntil(iso)
  return d !== null && d < 0
}

/** Human due-date label: "Overdue 3d", "Due today", "Due in 5d". */
export function dueLabel(iso?: string | null) {
  const d = daysUntil(iso)
  if (d === null) return null
  if (d < 0) return `Overdue ${Math.abs(d)}d`
  if (d === 0) return 'Due today'
  if (d === 1) return 'Due tomorrow'
  return `Due in ${d}d`
}
