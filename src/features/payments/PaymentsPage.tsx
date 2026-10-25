import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addDays, format, parseISO } from 'date-fns'
import { ChartColumn, Check, CreditCard, Plus, Search, Send } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { useUI } from '@/data/ui'
import { markPaymentPaid, paymentTitle } from '@/data/actions'
import { Topbar, Content, Empty, PageHead } from '@/components/ui/layout'
import { Tabs } from '@/components/ui/tabs'
import { ClientMark } from '@/components/ui/avatar'
import { ClientGroup, groupByClient } from '@/components/domain/ClientGroup'
import { StatusPill } from '@/components/ui/pill'
import { Modal } from '@/components/ui/modal'
import { PaymentModal } from '@/features/payments/PaymentModal'
import { RemindModal } from '@/features/payments/RemindModal'
import { celebrateFrom } from '@/lib/confetti'
import { sumUSD, useUsdRates } from '@/lib/currency'
import { clientDisplayName, effectivePaymentStatus, isOpenPayment, projectWorkDate, sumByCurrency, workDate } from '@/lib/derive'
import { daysUntil, formatDate, formatMoney, lateLabel } from '@/lib/format'
import { paymentStatus, paymentTerms } from '@/lib/status'
import type { Payment } from '@/types'
import { DateInput } from '@/components/ui/date-picker'
import { MonthFilter } from '@/components/ui/month-picker'

type Tab = 'open' | 'overdue' | 'paid'

export function PaymentsPage() {
  const { payments, clients, invoices, projects } = useData()
  const { openCreate } = useUI()
  const rates = useUsdRates()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'open'
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Payment | undefined>()
  const [remind, setRemind] = useState<Payment | null>(null)
  const [datesOpen, setDatesOpen] = useState(false)
  const [paidLimit, setPaidLimit] = useState(25)
  const thisMonth = format(new Date(), 'yyyy-MM')
  const month = params.get('m') || thisMonth
  const setMonth = (m: string) => {
    if (m === thisMonth) params.delete('m')
    else params.set('m', m)
    setParams(params, { replace: true })
  }

  // Deep link ?p=<id> opens that payment (from inbox, dashboard, emails).
  useEffect(() => {
    const pid = params.get('p')
    if (!pid) return
    const p = payments.find((x) => x.id === pid)
    if (p) setEdit(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('p')])

  const closeEdit = () => {
    setEdit(undefined)
    if (params.get('p')) {
      params.delete('p')
      setParams(params, { replace: true })
    }
  }

  const matchQ = (p: Payment) => {
    if (!q.trim()) return true
    const c = clients.find((x) => x.id === p.client_id)
    const inv = invoices.find((i) => i.id === p.invoice_id)
    return `${clientDisplayName(c)} ${paymentTitle(p)} ${inv?.number ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())
  }

  // Every payment belongs to the month its work was done (project work month), not the
  // month the money arrived. The month filter works on that.
  const wm = (p: Payment) => workDate(p, projects).slice(0, 7)
  const all = month === 'all'
  const inMonth = (p: Payment) => all || wm(p) === month
  const monthName = all ? 'all months' : format(parseISO(`${month}-01`), 'MMMM')
  const wmLabel = (p: Payment) => format(parseISO(`${wm(p)}-01`), 'MMM yyyy')

  const allOpen = payments.filter(isOpenPayment)
  const open = allOpen.filter(inMonth)
  const overdue = open.filter((p) => effectivePaymentStatus(p) === 'overdue').sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  const paid = payments.filter((p) => p.status === 'paid' && inMonth(p)).sort((a, b) => (b.payment_date ?? '').localeCompare(a.payment_date ?? ''))
  const noDate = open.filter((p) => !p.due_date)
  const otherOpen = all ? [] : allOpen.filter((p) => !inMonth(p))

  // Numbers for the selected work month.
  const earnedRows = payments.filter((p) => p.status !== 'refunded' && inMonth(p))
  const earned = sumUSD(earnedRows, rates)
  const received = sumUSD(paid, rates)
  const owed = sumUSD(open, rates)
  const late = sumUSD(overdue, rates)
  const projectCount = all ? projects.length : projects.filter((pr) => projectWorkDate(pr).slice(0, 7) === month).length
  // Cash that actually arrived in the selected month, whatever month the work was.
  const cashIn = payments.filter((p) => p.status === 'paid' && p.payment_date && (all || p.payment_date.slice(0, 7) === month))
  const cashForThis = cashIn.filter((p) => all || wm(p) === month)
  const cashForEarlier = cashIn.filter((p) => !all && wm(p) < month)
  const cashForLater = cashIn.filter((p) => !all && wm(p) > month)

  // Open tab groups by client, clients with overdue money first.
  const groups = useMemo(() => {
    const list = open.filter(matchQ)
    const ids = [...new Set(list.map((p) => p.client_id))]
    return ids
      .map((id) => {
        const rows = list.filter((p) => p.client_id === id).sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
        return { client: clients.find((c) => c.id === id), rows, late: rows.some((r) => effectivePaymentStatus(r) === 'overdue') }
      })
      .sort((a, b) => Number(b.late) - Number(a.late) || sumUSD(b.rows, rates) - sumUSD(a.rows, rates))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q, clients, rates])

  const markPaid = (p: Payment, el: HTMLElement) => {
    markPaymentPaid(p)
    celebrateFrom(el)
  }

  const actions = (p: Payment, withRemind: boolean) => (
    <span className="row-sm above" style={{ justifyContent: 'flex-end' }}>
      {withRemind && (
        <button type="button" className="btn btn-sm" onClick={() => setRemind(p)} title={p.last_reminded_at ? `Last reminded ${formatDate(p.last_reminded_at.slice(0, 10))}` : undefined}>
          <Send className="i i-sm" />Remind
        </button>
      )}
      <button type="button" className="btn btn-sm" onClick={(e) => markPaid(p, e.currentTarget)}><Check className="i i-sm" />Mark paid</button>
    </span>
  )

  const dueCell = (p: Payment) => {
    if (!p.due_date) return <td className="faint"><button type="button" className="link-btn above faint" style={{ color: 'var(--faint)', fontWeight: 400 }} onClick={() => setEdit(p)}>Add date</button></td>
    const late = lateLabel(p.due_date)
    return (
      <td>
        <div>{formatDate(p.due_date)}</div>
        {late ? <div className="xs t-bad">{late}</div> : (daysUntil(p.due_date) ?? 99) <= 3 ? <div className="xs t-warn">Due soon</div> : null}
      </td>
    )
  }

  return (
    <>
      <Topbar crumbs={[{ label: 'Payments' }]}>
        <Link className="btn hide-sm" to="/analytics"><ChartColumn className="i" />Analytics</Link>
        <button type="button" className="btn btn-pri" onClick={() => openCreate('payment')}><Plus className="i" />Record payment</button>
      </Topbar>
      <Content>
        <PageHead title="Payments" sub="Grouped by the month the work was done, so each month shows what that work earned.">
          <MonthFilter value={month} onChange={setMonth} />
        </PageHead>
        <div className="kstrip">
          <div>
            <div className="row-sm small muted m"><span className="sq" style={{ background: 'var(--pri)', borderRadius: 99 }} />Earned · {all ? 'all time' : monthName} work</div>
            <div className="val">{formatMoney(Math.round(earned))}</div>
            <div className="xs muted">{projectCount} project{projectCount === 1 ? '' : 's'} · {earned ? Math.round((received / earned) * 100) : 0}% received</div>
          </div>
          <div>
            <div className="row-sm small muted m"><span className="sq" style={{ background: 'var(--ok-dot)', borderRadius: 99 }} />Received</div>
            <div className="val">{formatMoney(Math.round(received))}</div>
            <div className="xs muted">{paid.length} paid</div>
          </div>
          <div style={overdue.length ? { background: 'var(--bad-soft)' } : undefined}>
            <div className={`row-sm small m ${overdue.length ? 't-bad' : 'muted'}`}><span className="sq" style={{ background: overdue.length ? 'var(--bad-dot)' : 'var(--warn-dot)', borderRadius: 99 }} />Still owed</div>
            <div className="val">{formatMoney(Math.round(owed))}</div>
            <div className={`xs ${overdue.length ? 't-bad' : 'muted'}`}>{open.length} unpaid{overdue.length ? ` · ${formatMoney(Math.round(late))} overdue` : ''}</div>
          </div>
          <div>
            <div className="row-sm small muted m"><span className="sq" style={{ background: 'var(--line3)', borderRadius: 99 }} />Cash in {all ? '· all time' : `during ${monthName}`}</div>
            <div className="val">{formatMoney(Math.round(sumUSD(cashIn, rates)))}</div>
            <div className="xs muted">
              {all
                ? `${cashIn.length} payment${cashIn.length === 1 ? '' : 's'} received`
                : cashIn.length === 0
                  ? 'Nothing received this month'
                  : [
                      `${formatMoney(Math.round(sumUSD(cashForThis, rates)))} for ${monthName} work`,
                      cashForEarlier.length ? `${formatMoney(Math.round(sumUSD(cashForEarlier, rates)))} for earlier work` : null,
                      cashForLater.length ? `${formatMoney(Math.round(sumUSD(cashForLater, rates)))} in advance` : null,
                    ].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
        {(rates === null && payments.some((p) => p.currency !== 'USD')) && <span className="xs faint" style={{ marginTop: -16 }}>Totals in USD. Exchange rates are loading.</span>}

        <div className="tabs">
          <Tabs
            value={tab}
            onChange={(t) => {
              if (t === 'open') params.delete('tab')
              else params.set('tab', t)
              setParams(params, { replace: true })
            }}
            tabs={[
              { id: 'open', label: 'Open', count: open.length },
              { id: 'overdue', label: <>Overdue {overdue.length > 0 && <span className="n" style={{ background: 'var(--bad-bg)', color: 'var(--bad)' }}>{overdue.length}</span>}</> },
              { id: 'paid', label: 'Paid', count: paid.length },
            ]}
            after={
              <label className="inp-wrap" style={{ width: 240, maxWidth: '45vw', height: 32, marginBottom: 6 }}>
                <Search className="i i-sm" />
                <input placeholder="Search client or project…" aria-label="Search payments" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
            }
          />
          <div className="panel-in" key={tab}>
            {tab !== 'paid' && otherOpen.length > 0 && (
              <div className="card card-f" style={{ marginBottom: 12 }}>
                <span className="muted">{formatMoney(Math.round(sumUSD(otherOpen, rates)))} is still open for work in other months ({otherOpen.length} payment{otherOpen.length === 1 ? '' : 's'}).</span>
                <button type="button" className="btn btn-sm" onClick={() => setMonth('all')}>Show all months</button>
              </div>
            )}
            {tab === 'open' &&
              (groups.length === 0 ? (
                <div className="card">
                  <Empty icon={<CreditCard className="i" />} title={payments.length ? (all ? 'Nothing open' : `Nothing open for ${monthName} work`) : 'No payments yet'} action={<button type="button" className="btn btn-sm" onClick={() => openCreate('payment')}><Plus className="i i-sm" />Record payment</button>}>
                    {payments.length ? (all ? 'Every payment is settled. Nice.' : 'Everything for this month’s work is paid.') : 'Payments are created automatically when a project has a budget, or record one here.'}
                  </Empty>
                </div>
              ) : (
                <div className="client-groups">
                  {groups.map((g) => {
                    const lateN = g.rows.filter((r) => effectivePaymentStatus(r) === 'overdue').length
                    return (
                      <ClientGroup
                        key={g.client?.id ?? 'x'}
                        client={g.client}
                        meta={`${g.rows.length} open payment${g.rows.length === 1 ? '' : 's'}${lateN ? ` \u00b7 ${lateN} overdue` : ''}`}
                        right={<span className={`group-total ${g.late ? 't-bad' : 't-warn'}`}>{sumByCurrency(g.rows)}</span>}
                      >
                        <div className="tbl-wrap">
                          <table className="tbl" style={{ minWidth: 760 }}>
                            <thead><tr><th>Project</th><th>Work month</th><th className="r">Amount</th><th>Status</th><th>Due</th><th className="r" /></tr></thead>
                            <tbody>
                              {g.rows.map((p) => {
                                const st = effectivePaymentStatus(p)
                                return (
                                  <tr key={p.id} className="hov">
                                    <td><button type="button" className="m cover" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit' }} onClick={() => setEdit(p)}>{paymentTitle(p)}</button></td>
                                    <td className="wm-cell">{wmLabel(p)}</td>
                                    <td className="r num b">{formatMoney(p.amount, p.currency)}</td>
                                    <td><StatusPill meta={st === 'unpaid' ? { ...paymentStatus.unpaid, tone: 'warn' } : paymentStatus[st]} /></td>
                                    {dueCell(p)}
                                    <td className="r">{actions(p, st === 'overdue' || Boolean(p.due_date && (daysUntil(p.due_date) ?? 99) <= 3))}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </ClientGroup>
                    )
                  })}
                  {noDate.length > 0 && (
                    <div className="card card-f" style={{ borderTop: 0 }}>
                      <span className="muted">{noDate.length} open payment{noDate.length === 1 ? ' has' : 's have'} no due date, so {noDate.length === 1 ? 'it never turns' : 'they never turn'} overdue.</span>
                      <button type="button" className="btn btn-sm" onClick={() => setDatesOpen(true)}>Set due dates</button>
                    </div>
                  )}
                </div>
              ))}

            {tab === 'overdue' &&
              (overdue.filter(matchQ).length === 0 ? (
                <div className="card">
                  <Empty icon={<Check className="i" />} title="Nothing overdue">When a payment passes its due date it shows up here, and owners and admins get one email about it.</Empty>
                </div>
              ) : (
                <div className="client-groups">
                  {groupByClient(overdue.filter(matchQ), (p) => p.client_id, clients).map((g) => (
                    <ClientGroup key={g.id} client={g.client} meta={`${g.rows.length} overdue \u00b7 oldest ${lateLabel(g.rows[0].due_date)}`} right={<span className="group-total t-bad">{sumByCurrency(g.rows)}</span>}>
                      <div className="tbl-wrap">
                        <table className="tbl" style={{ minWidth: 700 }}>
                          <thead><tr><th>Project</th><th>Work month</th><th className="r">Amount</th><th>Due</th><th>Last reminder</th><th className="r" /></tr></thead>
                          <tbody>
                            {g.rows.map((p) => (
                              <tr key={p.id} className="hov">
                                <td><button type="button" className="m cover" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit' }} onClick={() => setEdit(p)}>{paymentTitle(p)}</button></td>
                                <td className="wm-cell">{wmLabel(p)}</td>
                                <td className="r num b">{formatMoney(p.amount, p.currency)}</td>
                                <td><div>{formatDate(p.due_date)}</div><div className="xs t-bad">{lateLabel(p.due_date)}</div></td>
                                <td className="small muted">{p.last_reminded_at ? formatDate(p.last_reminded_at.slice(0, 10)) : 'Never'}</td>
                                <td className="r">{actions(p, true)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </ClientGroup>
                  ))}
                </div>
              ))}

            {tab === 'paid' &&
              (paid.filter(matchQ).length === 0 ? (
                <div className="card"><Empty title={all ? 'No paid payments yet' : `Nothing paid yet for ${monthName} work`} /></div>
              ) : (
                <div className="client-groups">
                  {groupByClient(paid.filter(matchQ), (p) => p.client_id, clients).slice(0, paidLimit).map((g, gi) => (
                    <ClientGroup
                      key={g.id}
                      client={g.client}
                      defaultOpen={gi < 6}
                      meta={`${g.rows.length} payment${g.rows.length === 1 ? '' : 's'} \u00b7 last paid ${formatDate(g.rows[0].payment_date)}`}
                      right={<span className="group-total t-ok">{sumByCurrency(g.rows)}</span>}
                    >
                      <div className="tbl-wrap">
                        <table className="tbl" style={{ minWidth: 640 }}>
                          <thead><tr><th>Project</th><th>Work month</th><th className="r">Amount</th><th>Paid on</th><th>Method</th></tr></thead>
                          <tbody>
                            {g.rows.map((p) => {
                              const inv = invoices.find((i) => i.id === p.invoice_id)
                              return (
                                <tr key={p.id} className="hov">
                                  <td>
                                    <button type="button" className="m cover trunc" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit', maxWidth: 360 }} onClick={() => setEdit(p)}>{paymentTitle(p)}</button>
                                    {inv && <div className="xs"><Link className="mono faint above" to={`/invoices/${inv.id}`}>Invoice {inv.number}</Link></div>}
                                  </td>
                                  <td className="wm-cell">{wmLabel(p)}</td>
                                  <td className="r num b">{formatMoney(p.amount, p.currency, { cents: true })}</td>
                                  <td>{formatDate(p.payment_date)}{p.payment_date && p.payment_date.slice(0, 7) !== wm(p) && <div className="xs faint">{p.payment_date.slice(0, 7) > wm(p) ? 'paid later' : 'paid in advance'}</div>}</td>
                                  <td className="muted">{p.payment_method ?? '\u2014'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </ClientGroup>
                  ))}
                  {groupByClient(paid.filter(matchQ), (p) => p.client_id, clients).length > paidLimit && (
                    <button type="button" className="btn" style={{ alignSelf: 'center' }} onClick={() => setPaidLimit((l) => l + 25)}>Show more clients</button>
                  )}
                </div>
              ))}
          </div>
        </div>
      </Content>
      <PaymentModal open={Boolean(edit)} payment={edit && payments.find((p) => p.id === edit.id)} onClose={closeEdit} onRemind={(p) => { closeEdit(); setRemind(p) }} />
      <RemindModal payment={remind} onClose={() => setRemind(null)} />
      <SetDueDatesModal open={datesOpen} onClose={() => setDatesOpen(false)} rows={noDate} projects={projects} />
    </>
  )
}

function SetDueDatesModal({ open, onClose, rows, projects }: { open: boolean; onClose: () => void; rows: Payment[]; projects: { id: string; due_date?: string | null }[] }) {
  const { clients, updateRow } = useData()
  const [dates, setDates] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    // Suggest: the project's due date, else today + the client's payment terms.
    const next: Record<string, string> = {}
    for (const p of rows) {
      const proj = projects.find((x) => p.project_ids?.includes(x.id) && x.due_date)
      const c = clients.find((x) => x.id === p.client_id)
      const days = paymentTerms.find((t) => t.value === c?.payment_terms)?.days ?? 7
      next[p.id] = proj?.due_date ?? format(addDays(new Date(), days), 'yyyy-MM-dd')
    }
    setDates(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const save = () => {
    let n = 0
    for (const p of rows) {
      if (dates[p.id]) {
        updateRow('payments', p.id, { due_date: dates[p.id] })
        n++
      }
    }
    toast.success(`Set ${n} due date${n === 1 ? '' : 's'}`)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Set due dates" size="wide" note="Suggested from project due dates or the client’s payment terms" footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn btn-pri" onClick={save}>Save dates</button></>}>
      <div className="list" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
        {rows.map((p) => {
          const c = clients.find((x) => x.id === p.client_id)
          return (
            <div key={p.id} className="li">
              <ClientMark client={c} size="sm" />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="t trunc" style={{ fontSize: 13.5 }}>{paymentTitle(p)}</div>
                <div className="s">{clientDisplayName(c)} · {formatMoney(p.amount, p.currency)}</div>
              </div>
              <DateInput sm style={{ width: 200 }} value={dates[p.id]} onChange={(v) => setDates((d) => ({ ...d, [p.id]: v ?? '' }))} />
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
