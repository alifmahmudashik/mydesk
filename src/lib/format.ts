import {
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  formatDistanceToNowStrict,
  isThisYear,
  parseISO,
} from 'date-fns'

export function formatMoney(amount: number, currency = 'USD', opts: { cents?: boolean } = {}) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: opts.cents ? 2 : 0,
      maximumFractionDigits: opts.cents || amount % 1 !== 0 ? 2 : 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}

/** "$1.5k" for chart axes. */
export function formatMoneyShort(amount: number, currency = 'USD') {
  if (Math.abs(amount) >= 1000) {
    const k = amount / 1000
    const sym = formatMoney(0, currency).replace(/[\d.,\s]/g, '')
    return `${sym}${k % 1 === 0 ? k : k.toFixed(1)}k`
  }
  return formatMoney(Math.round(amount), currency)
}

export function formatDate(iso?: string | null) {
  if (!iso) return '—'
  const d = parseISO(iso)
  return isThisYear(d) ? format(d, 'MMM d') : format(d, 'MMM d, yyyy')
}

export function formatDateLong(iso?: string | null) {
  if (!iso) return '—'
  return format(parseISO(iso), 'MMM d, yyyy')
}

export function formatDateTime(iso: string) {
  const d = parseISO(iso)
  return format(d, isThisYear(d) ? 'MMM d, H:mm' : 'MMM d yyyy, H:mm')
}

export function formatAgo(iso: string) {
  return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true })
}

/** Inbox-style: "now", "12m", "2h", "4d", "Oct 12". */
export function formatShortAgo(iso: string) {
  const mins = differenceInMinutes(new Date(), parseISO(iso))
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`
  if (mins < 60 * 24 * 7) return `${Math.floor(mins / 1440)}d`
  return formatDate(iso.slice(0, 10))
}

/** Feed-style: "12 min ago", "2 h ago", "Oct 20". */
export function formatFeedAgo(iso: string) {
  const mins = differenceInMinutes(new Date(), parseISO(iso))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 60 * 24) return `${Math.floor(mins / 60)} h ago`
  if (mins < 60 * 48) return 'yesterday'
  return formatDate(iso.slice(0, 10))
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

export function dueLabel(iso?: string | null) {
  const d = daysUntil(iso)
  if (d === null) return null
  if (d < 0) return `Overdue ${Math.abs(d)}d`
  if (d === 0) return 'Due today'
  if (d === 1) return 'Due tomorrow'
  return `Due in ${d}d`
}

/** "75 days late" */
export function lateLabel(iso?: string | null) {
  const d = daysUntil(iso)
  if (d === null || d >= 0) return null
  const n = Math.abs(d)
  return `${n} day${n === 1 ? '' : 's'} late`
}

/** 100 → "1 h 40 m" */
export function formatMinutes(mins?: number | null) {
  if (!mins) return '0 m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (!h) return `${m} m`
  return m ? `${h} h ${m} m` : `${h} h`
}

/** "1h 30m", "90m", "1.5h", "2" (hours) → minutes. */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase()
  if (!s) return null
  const hm = s.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/)
  if (hm && (hm[1] || hm[2])) return Math.round(Number(hm[1] ?? 0) * 60 + Number(hm[2] ?? 0)) || null
  const n = Number(s)
  if (!Number.isNaN(n) && n > 0) return Math.round(n * 60)
  return null
}

export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function formatBytes(n?: number | null) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
