import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addMonths, differenceInCalendarDays, differenceInCalendarMonths, format, parseISO, startOfMonth, startOfYear } from 'date-fns'
import { Briefcase, Calendar, ChevronDown, CreditCard, Download } from 'lucide-react'
import { useData } from '@/data/store'
import { paymentTitle } from '@/data/actions'
import { Topbar, Content, PageHead } from '@/components/ui/layout'
import { Tabs } from '@/components/ui/tabs'
import { Menu, MenuItem } from '@/components/ui/menu'
import { ClientMark } from '@/components/ui/avatar'
import { RevenueChart, monthlyBuckets } from '@/components/domain/RevenueChart'
import { sumUSD, toUSD, useUsdRates } from '@/lib/currency'
import { clientDisplayName, effectivePaymentStatus, isOpenPayment, OPEN_PROJECT, projectWorkDate, workDate } from '@/lib/derive'
import { daysUntil, formatMoney } from '@/lib/format'

type Range = 'month' | '3m' | '6m' | 'year' | 'all'
const rangeLabel: Record<Range, string> = { month: 'This month', '3m': 'Last 3 months', '6m': 'Last 6 months', year: 'This year', all: 'All time' }

export function AnalyticsPage() {
  const { payments, clients, projects, invoices } = useData()
  const rates = useUsdRates()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as 'payments' | 'clients') || 'payments'
  const [range, setRange] = useState<Range>('6m')

  const first = payments.reduce((m, p) => (p.created_at < m ? p.created_at : m), new Date().toISOString())
  const months = range === 'month' ? 1 : range === '3m' ? 3 : range === '6m' ? 6 : range === 'year' ? new Date().getMonth() + 1 : Math.min(24, differenceInCalendarMonths(new Date(), parseISO(first)) + 1)
  const start = range === 'year' ? startOfYear(new Date()) : startOfMonth(addMonths(new Date(), -(months - 1)))
  const since = format(start, 'yyyy-MM-dd')
  const label = range === 'all' || range === 'month' ? rangeLabel[range] : `${format(start, 'MMM')} – ${format(new Date(), 'MMM yyyy')}`

  const usd = (p: { amount: number; currency: string }) => toUSD(Number(p.amount), p.currency, rates)
  // Everything is counted in the month the work was done (project start), not when the money arrived.
  const wd = (p: (typeof payments)[number]) => workDate(p, projects)
  const monthKey = format(new Date(), 'yyyy-MM')
  const paidIn = payments.filter((p) => p.status === 'paid' && wd(p) >= since)
  const collected = sumUSD(paidIn, rates)
  const thisMonth = sumUSD(payments.filter((p) => p.status === 'paid' && wd(p).slice(0, 7) === monthKey), rates)
  const billedIn = payments.filter((p) => p.status !== 'refunded' && wd(p) >= since)
  const invoiced = sumUSD(billedIn, rates)
  const open = payments.filter(isOpenPayment)
  const overdue = open.filter((p) => effectivePaymentStatus(p) === 'overdue')
  const paidWithDue = paidIn.filter((p) => p.due_date && p.payment_date)
  const avgDays = paidWithDue.length ? Math.round(paidWithDue.reduce((s, p) => s + differenceInCalendarDays(parseISO(p.payment_date!), parseISO(p.due_date!)), 0) / paidWithDue.length) : null

  // Month-by-month: projects worked, value earned, how much of it is in, newest first.
  const monthRows = Array.from({ length: Math.max(1, months) }, (_, i) => {
    const d = addMonths(startOfMonth(new Date()), -i)
    const key = format(d, 'yyyy-MM')
    const rows = payments.filter((p) => p.status !== 'refunded' && wd(p).slice(0, 7) === key)
    const paid = rows.filter((p) => p.status === 'paid')
    return {
      key,
      label: format(d, 'MMMM yyyy'),
      projects: projects.filter((pr) => projectWorkDate(pr).slice(0, 7) === key).length,
      earned: sumUSD(rows, rates),
      received: sumUSD(paid, rates),
      owed: sumUSD(rows.filter(isOpenPayment), rates),
    }
  })

  const buckets = useMemo(() => monthlyBuckets(payments, rates, Math.max(3, months), projects), [payments, rates, months, projects])

  // Revenue by client (in range).
  const byClient = useMemo(() => {
    return clients
      .map((c) => {
        const paid = paidIn.filter((p) => p.client_id === c.id)
        return {
          client: c,
          revenue: sumUSD(paid, rates),
          paid,
          projects: projects.filter((p) => p.client_id === c.id).length,
          open: open.filter((p) => p.client_id === c.id),
        }
      })
      .filter((r) => r.revenue > 0 || r.projects > 0 || r.open.length > 0)
      .sort((a, b) => b.revenue - a.revenue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, paidIn, projects, open, rates])
  const topRevenue = Math.max(...byClient.map((r) => r.revenue), 1)
  const topProjects = Math.max(...byClient.map((r) => r.projects), 1)

  const ages = { notDue: 0, late: 0, veryLate: 0 }
  for (const p of open) {
    const d = daysUntil(p.due_date)
    if (d === null || d >= 0) ages.notDue += usd(p)
    else if (d >= -60) ages.late += usd(p)
    else ages.veryLate += usd(p)
  }
  const statusCounts = {
    paid: payments.filter((p) => p.status === 'paid').length,
    unpaid: open.length - overdue.length,
    overdue: overdue.length,
  }
  const totalCount = statusCounts.paid + statusCounts.unpaid + statusCounts.overdue
  const pct = (n: number) => (totalCount ? (n / totalCount) * 100 : 0)

  // Clients tab
  const activeClients = clients.filter((c) => c.status !== 'archived').length
  const delivered = projects.filter((p) => p.status === 'completed' || p.status === 'finished').length
  const inProgress = projects.filter(OPEN_PROJECT).length
  const values = projects.filter((p) => p.amount > 0).map((p) => usd(p)).sort((a, b) => a - b)
  const avgValue = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
  const median = values.length ? values[Math.floor(values.length / 2)] : 0
  const repeat = clients.filter((c) => projects.filter((p) => p.client_id === c.id).length + invoices.filter((i) => i.client_id === c.id).length > 1).length
  const newPerMonth = Array.from({ length: 6 }, (_, i) => {
    const d = addMonths(startOfMonth(new Date()), i - 5)
    const key = format(d, 'yyyy-MM')
    return { label: format(d, 'MMM'), n: clients.filter((c) => c.created_at.slice(0, 7) === key).length }
  })
  const maxNew = Math.max(...newPerMonth.map((m) => m.n), 1)
  const totalRev = byClient.reduce((s, r) => s + r.revenue, 0)
  const top3 = byClient.slice(0, 3)
  const top3Share = totalRev ? Math.round((top3.reduce((s, r) => s + r.revenue, 0) / totalRev) * 100) : 0

  const exportCsv = () => {
    const rows = [['Client', 'Item', 'Amount', 'Currency', 'Amount (USD)', 'Status', 'Due date', 'Paid on', 'Method', 'Invoice']]
    for (const p of payments.filter((x) => x.created_at.slice(0, 10) >= since || (x.payment_date ?? '') >= since || isOpenPayment(x))) {
      const c = clients.find((x) => x.id === p.client_id)
      const inv = invoices.find((i) => i.id === p.invoice_id)
      rows.push([clientDisplayName(c), paymentTitle(p), String(p.amount), p.currency, usd(p).toFixed(2), effectivePaymentStatus(p), p.due_date ?? '', p.payment_date ?? '', p.payment_method ?? '', inv?.number ?? ''])
    }
    const csv = rows.map((r) => r.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `mydesk-payments-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Topbar crumbs={[{ label: 'Analytics' }]}>
        <Menu trigger={({ toggle }) => <button type="button" className="btn" onClick={toggle}><Calendar className="i" />{label}<ChevronDown className="i i-sm" /></button>}>
          {(Object.keys(rangeLabel) as Range[]).map((r) => <MenuItem key={r} on={r === range} onSelect={() => setRange(r)}>{rangeLabel[r]}</MenuItem>)}
        </Menu>
        <button type="button" className="btn" onClick={exportCsv}><Download className="i" />Export CSV</button>
      </Topbar>
      <Content>
        <PageHead title="Analytics" sub={<>What you earned, counted in the month the work was done (project start date). Amounts in USD{rates ? '' : ' (rates loading)'}.</>} />
        <div className="tabs" style={{ gap: 22 }}>
          <Tabs
            variant="seg"
            value={tab}
            onChange={(t) => setParams(t === 'payments' ? {} : { tab: t }, { replace: true })}
            tabs={[
              { id: 'payments', label: <><CreditCard className="i i-sm" />Payments</> },
              { id: 'clients', label: <><Briefcase className="i i-sm" />Clients</> },
            ]}
          />
          {tab === 'payments' ? (
            <div className="stack-lg panel-in">
              <div className="kpis">
                <div className="kpi"><span className="lbl">Earned &amp; paid</span><span className="val">{formatMoney(Math.round(collected))}</span><span className="sub t-ok">{formatMoney(Math.round(thisMonth))} for work in {format(new Date(), 'MMMM')}</span></div>
                <div className="kpi"><span className="lbl">Total earned</span><span className="val">{formatMoney(Math.round(invoiced))}</span><span className="sub">paid + unpaid · {invoiced ? Math.round((collected / invoiced) * 100) : 0}% paid</span></div>
                <div className="kpi"><span className="lbl">Avg. days to get paid</span><span className="val">{avgDays ?? '—'}</span><span className="sub">due date → paid{avgDays !== null && avgDays < 0 ? ' (early)' : ''}</span></div>
                <div className={`kpi${overdue.length ? ' alert' : ''}`}><span className="lbl">Overdue</span><span className="val">{formatMoney(Math.round(sumUSD(overdue, rates)))}</span><span className="sub">{overdue.length} payment{overdue.length === 1 ? '' : 's'} · {new Set(overdue.map((p) => p.client_id)).size} client{new Set(overdue.map((p) => p.client_id)).size === 1 ? '' : 's'}</span></div>
              </div>
              <section className="card card-b">
                <div className="row between wrap">
                  <div>
                    <h2 className="h2">Earned per month</h2>
                    <span className="xs muted">By the month the work was done</span>
                  </div>
                  <div className="legend"><span><i className="c-col" />Paid</span><span><i className="c-open" />Unpaid</span><span><i className="c-late" />Overdue</span></div>
                </div>
                <RevenueChart buckets={buckets} showOverdue />
              </section>
              <section className="card">
                <div className="card-h">
                  <div>
                    <h2 className="h2">Month by month</h2>
                    <span className="xs muted">What each month’s work earned, and how much of it you’ve received</span>
                  </div>
                  <Link className="link" to="/payments">Open payments →</Link>
                </div>
                <div className="tbl-wrap">
                  <table className="tbl" style={{ minWidth: 560 }}>
                    <thead><tr><th>Work month</th><th className="r">Projects</th><th className="r">Earned</th><th className="r">Received</th><th className="r">Still owed</th></tr></thead>
                    <tbody>
                      {monthRows.map((m) => (
                        <tr key={m.key} className="hov">
                          <td><Link className="m cover" to={`/payments?m=${m.key}`}>{m.label}</Link></td>
                          <td className="r num">{m.projects}</td>
                          <td className="r num b">{formatMoney(Math.round(m.earned))}</td>
                          <td className="r num t-ok">{formatMoney(Math.round(m.received))}</td>
                          <td className={`r num ${m.owed ? 't-warn' : 'faint'}`}>{m.owed ? formatMoney(Math.round(m.owed)) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <div className="grid-3">
                <section className="card card-b stack">
                  <h2 className="h2">Top clients by earnings</h2>
                  {byClient.filter((r) => r.revenue > 0).length === 0 && <span className="small muted">No paid work in this range.</span>}
                  {byClient.filter((r) => r.revenue > 0).slice(0, 5).map((r) => (
                    <div className="stack-sm" key={r.client.id}>
                      <div className="row between small"><Link className="m" to={`/clients/${r.client.id}`}>{clientDisplayName(r.client)}</Link><span className="num">{formatMoney(Math.round(r.revenue))}</span></div>
                      <div className="bar lg"><i style={{ width: `${(r.revenue / topRevenue) * 100}%` }} /></div>
                    </div>
                  ))}
                </section>
                <section className="card card-b stack">
                  <h2 className="h2">Open payments by age</h2>
                  <div className="seg-bar">
                    <i style={{ flex: ages.notDue || 0.0001, background: 'var(--pri-mid)' }} />
                    <i style={{ flex: ages.late || 0.0001, background: 'var(--warn-dot)' }} />
                    <i style={{ flex: ages.veryLate || 0.0001, background: 'var(--bad-dot)' }} />
                  </div>
                  <div className="stack small" style={{ gap: 10 }}>
                    <div className="row"><span className="sq" style={{ background: 'var(--pri-mid)' }} /><span className="grow">Not due yet</span><b className="m num">{formatMoney(Math.round(ages.notDue))}</b></div>
                    <div className="row"><span className="sq" style={{ background: 'var(--warn-dot)' }} /><span className="grow">1–60 days late</span><b className="m num">{formatMoney(Math.round(ages.late))}</b></div>
                    <div className="row"><span className="sq" style={{ background: 'var(--bad-dot)' }} /><span className="grow">60+ days late</span><b className="m num">{formatMoney(Math.round(ages.veryLate))}</b></div>
                  </div>
                </section>
                <section className="card card-b stack">
                  <h2 className="h2">Payment status</h2>
                  <div className="row" style={{ gap: 20 }}>
                    <div className="donut" style={{ background: totalCount ? `conic-gradient(#16A34A 0 ${pct(statusCounts.paid)}%, var(--pri-mid) ${pct(statusCounts.paid)}% ${pct(statusCounts.paid + statusCounts.unpaid)}%, #E5484D ${pct(statusCounts.paid + statusCounts.unpaid)}% 100%)` : 'var(--line2)' }}>
                      <div><b style={{ fontSize: 20 }}>{totalCount}</b><span className="xs muted">payments</span></div>
                    </div>
                    <div className="stack small grow" style={{ gap: 10 }}>
                      <div className="row"><span className="sq" style={{ background: '#16A34A' }} /><span className="grow">Paid</span><b>{statusCounts.paid}</b></div>
                      <div className="row"><span className="sq" style={{ background: 'var(--pri-mid)' }} /><span className="grow">Unpaid</span><b>{statusCounts.unpaid}</b></div>
                      <div className="row"><span className="sq" style={{ background: '#E5484D' }} /><span className="grow">Overdue</span><b>{statusCounts.overdue}</b></div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className="stack-lg panel-in">
              <div className="kpis">
                <div className="kpi"><span className="lbl">Active clients</span><span className="val">{activeClients}</span><span className="sub">{clients.length} total · {clients.length - activeClients} archived</span></div>
                <div className="kpi"><span className="lbl">Projects delivered</span><span className="val">{delivered}</span><span className="sub">+ {inProgress} in progress</span></div>
                <div className="kpi"><span className="lbl">Avg. project value</span><span className="val">{formatMoney(Math.round(avgValue))}</span><span className="sub">median {formatMoney(Math.round(median))}</span></div>
                <div className="kpi"><span className="lbl">Repeat clients</span><span className="val">{clients.length ? Math.round((repeat / clients.length) * 100) : 0}%</span><span className="sub">{repeat} of {clients.length} came back</span></div>
              </div>
              <section className="card">
                <div className="card-h">
                  <h2 className="h2">Work and revenue by client</h2>
                  <div className="legend"><span><i style={{ background: '#0EA5E9' }} />Projects</span><span><i className="c-col" />Revenue</span></div>
                </div>
                <div className="tbl-wrap">
                  <table className="tbl" style={{ minWidth: 760 }}>
                    <thead><tr><th>Client</th><th style={{ width: '30%' }}>Projects</th><th style={{ width: '30%' }}>Revenue · {rangeLabel[range].toLowerCase()}</th><th className="r">Outstanding</th></tr></thead>
                    <tbody>
                      {byClient.map((r) => {
                        const late = r.open.some((p) => effectivePaymentStatus(p) === 'overdue')
                        return (
                          <tr key={r.client.id} className="hov">
                            <td><Link className="row-sm m cover" to={`/clients/${r.client.id}`}><ClientMark client={r.client} size="sm" />{clientDisplayName(r.client)}</Link></td>
                            <td><div className="row"><div className="bar lg grow"><i className="sky" style={{ width: `${Math.max(3, (r.projects / topProjects) * 100)}%` }} /></div><span className="num small" style={{ width: 22 }}>{r.projects}</span></div></td>
                            <td><div className="row"><div className="bar lg grow"><i style={{ width: `${Math.max(r.revenue ? 3 : 0, (r.revenue / topRevenue) * 100)}%` }} /></div><span className="num small" style={{ width: 60 }}>{formatMoney(Math.round(r.revenue))}</span></div></td>
                            <td className={`r ${r.open.length ? (late ? 't-bad m' : 't-warn m') : 'muted'}`}>{r.open.length ? formatMoney(Math.round(sumUSD(r.open, rates))) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
              <div className="grid-2">
                <section className="card card-b">
                  <h2 className="h2">New clients per month</h2>
                  <div className="chart" style={{ height: 160 }}>
                    <div className="grid"><i /><i /><i /></div>
                    <div className="yax"><span>{maxNew}</span><span>{maxNew / 2 % 1 ? (maxNew / 2).toFixed(1) : maxNew / 2}</span><span>0</span></div>
                    <div className="bars">
                      {newPerMonth.map((m, i) => (
                        <div key={m.label}>
                          <span className="tip">{m.n ? `${m.n} new client${m.n === 1 ? '' : 's'}` : 'No new clients'}</span>
                          <div className="sb"><i style={{ height: m.n ? Math.round((m.n / maxNew) * 126) : 3, background: m.n ? (i === 5 || m.n === maxNew ? 'var(--pri)' : '#A5B4FC') : 'var(--line2)' }} /></div>
                          <span>{m.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
                <section className="card card-b stack">
                  <h2 className="h2">Revenue concentration</h2>
                  <p className="small muted">Share of revenue from your top 3 clients</p>
                  <div className="seg-bar" style={{ height: 28, borderRadius: 8 }}>
                    {top3.map((r, i) => <i key={r.client.id} style={{ flex: r.revenue || 0.0001, background: ['#4F46E5', '#6366F1', '#818CF8'][i] }} title={clientDisplayName(r.client)} />)}
                    <i style={{ flex: Math.max(totalRev - top3.reduce((s, r) => s + r.revenue, 0), 0.0001), background: 'var(--line2)' }} />
                  </div>
                  <div className="row between small wrap">
                    <span><b>{top3Share}%</b> from {top3.map((r) => clientDisplayName(r.client)).join(', ') || '—'}</span>
                    <span className="muted">{100 - top3Share}% from {Math.max(byClient.filter((r) => r.revenue > 0).length - 3, 0)} others</span>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </Content>
    </>
  )
}
