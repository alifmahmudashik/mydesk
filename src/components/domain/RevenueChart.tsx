import { useMemo, useState } from 'react'
import { addMonths, format, startOfMonth } from 'date-fns'
import type { Payment, Project } from '@/types'
import { effectivePaymentStatus, isOpenPayment, workDate } from '@/lib/derive'
import { toUSD } from '@/lib/currency'
import { formatMoney, formatMoneyShort } from '@/lib/format'

export interface MonthBucket {
  key: string
  label: string
  collected: number
  open: number
  overdue: number
}

/** Money earned per month, in USD, counted in the month the work was done (see workDate):
 *  paid vs. still unpaid vs. overdue. */
export function monthlyBuckets(payments: Payment[], rates: Record<string, number> | null, months = 6, projects: Project[] = []): MonthBucket[] {
  const start = startOfMonth(addMonths(new Date(), -(months - 1)))
  const buckets: MonthBucket[] = Array.from({ length: months }, (_, i) => {
    const d = addMonths(start, i)
    return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM'), collected: 0, open: 0, overdue: 0 }
  })
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  const currentKey = buckets[buckets.length - 1].key
  for (const p of payments) {
    const usd = toUSD(Number(p.amount), p.currency, rates)
    const k = workDate(p, projects).slice(0, 7)
    // Work dated in the future (start date ahead) shows in the current month.
    const b = byKey.get(k > currentKey ? currentKey : k)
    if (!b) continue
    if (p.status === 'paid') {
      b.collected += usd
    } else if (isOpenPayment(p)) {
      if (effectivePaymentStatus(p) === 'overdue') b.overdue += usd
      else b.open += usd
    }
  }
  return buckets
}

function niceMax(v: number) {
  if (v <= 0) return 500
  // Maxes that split into clean quarters ($500 → $375 would not).
  const steps = [400, 800, 1000, 2000, 4000, 8000, 10000, 20000, 40000, 80000, 100000, 200000, 400000, 800000, 1000000]
  return steps.find((s) => s >= v) ?? Math.ceil(v / 1000000) * 1000000
}

/** The design's stacked bar chart (.chart/.bars/.sb) with hover tips. */
export function RevenueChart({ buckets, showOverdue }: { buckets: MonthBucket[]; showOverdue?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = useMemo(() => niceMax(Math.max(...buckets.map((b) => b.collected + b.open + b.overdue))), [buckets])
  const H = 180
  const px = (v: number) => Math.max(v > 0 ? 3 : 0, Math.round((v / max) * H))
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => (f === 0 ? '0' : formatMoneyShort(max * f)))
  const last = buckets.length - 1

  return (
    <div className="chart">
      <div className="grid"><i /><i /><i /><i /><i /></div>
      <div className="yax">{ticks.map((t, i) => <span key={i}>{t}</span>)}</div>
      <div className="bars" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0,1fr))` }}>
        {buckets.map((b, i) => {
          const parts = [
            b.collected ? formatMoney(Math.round(b.collected)) + ' paid' : null,
            b.open ? formatMoney(Math.round(b.open)) + ' unpaid' : null,
            b.overdue ? formatMoney(Math.round(b.overdue)) + ' overdue' : null,
          ].filter(Boolean)
          const showTip = hover === i || (hover === null && i === last)
          return (
            <div key={b.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <span className={`tip${showTip ? ' show' : ''}`}>{b.label} · {parts.length ? parts.join(' · ') : 'nothing'}</span>
              <div className="sb">
                {b.overdue > 0 && <i className={showOverdue ? 'c-late' : 'c-open'} style={{ height: px(b.overdue) }} />}
                {b.open > 0 && <i className="c-open" style={{ height: px(b.open) }} />}
                {b.collected > 0 && <i className="c-col" style={{ height: px(b.collected) }} />}
              </div>
              <span className={i === last ? 'b' : undefined} style={i === last ? { color: 'var(--ink)' } : undefined}>{b.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Tiny trend line for KPI tiles. */
export function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 120},${26 - (v / max) * 22}`).join(' ')
  return (
    <svg className="spark" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} stroke={color} />
    </svg>
  )
}
