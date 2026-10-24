import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addDays, format, startOfMonth } from 'date-fns'
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
import { clientDisplayName, effectivePaymentStatus, isOpenPayment, sumByCurrency } from '@/lib/derive'
import { daysUntil, formatDate, formatMoney, lateLabel } from '@/lib/format'
import { paymentStatus, paymentTerms } from '@/lib/status'
import type { Payment } from '@/types'

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

  const open = payments.filter(isOpenPayment)
  const overdue = open.filter((p) => effectivePaymentStatus(p) === 'overdue').sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const paid = payments.filter((p) => p.status === 'paid').sort((a, b) => (b.payment_date ?? '').localeCompare(a.payment_date ?? ''))
  const paidThisMonth = paid.filter((p) => (p.payment_date ?? '') >= monthStart)
  const noDate = open.filter((p) => !p.due_date)
  const openClients = new Set(open.map((p) => p.client_id)).size

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
        <PageHead title="Payments" sub="What you're owed, what's late, and what came in." />
        <div className="kstrip">
          <div>
            <div className="row-sm small muted m"><span className="sq" style={{ background: 'var(--warn-dot)', borderRadius: 99 }} />Outstanding</div>
            <div className="val">{formatMoney(Math.round(sumUSD(open, rates)))}</div>
            <div className="xs muted">{open.length} open · {openClients} client{openClients === 1 ? '' : 's'}</div>
          </div>
          <div style={overdue.length ? { background: 'var(--bad-soft)' } : undefined}>
            <div className={`row-sm small m ${overdue.length ? 't-bad' : 'muted'}`}><span className="sq" style={{ background: 'var(--bad-dot)', borderRadius: 99 }} />Overdue</div>
            <div className="val">{formatMoney(Math.round(sumUSD(overdue, rates)))}</div>
            <div className={`xs ${overdue.length ? 't-bad' : 'muted'}`}>{overdue.length ? `Oldest is ${lateLabel(overdue[0].due_date)}` : 'Nothing late'}</div>
          </div>
          <div>
            <div className="row-sm small muted m"><span className="sq" style={{ background: 'var(--ok-dot)', borderRadius: 99 }} />Paid this month</div>
            <div className="val">{formatMoney(sumUSD(paidThisMonth, rates), 'USD', { cents: true })}</div>
            <div className="xs muted">{paidThisMonth.length} payment{paidThisMonth.length === 1 ? '' : 's'}</div>
          </div>
        </div>
        {(rates === null && payments.some((p) => p.currency !== 'USD')) && <span className="xs faint" style={{ marginTop: -16 }}>Totals in USD. Exchange rates are loading.</span>}

        <div className="tabs">
          <Tabs
            value={tab}
            onChange={(t) => setParams(t === 'open' ? {} : { tab: t }, { replace: true })}
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
            {tab === 'open' &&
              (groups.length === 0 ? (
                <div className="card">
                  <Empty icon={<CreditCard className="i" />} title={payments.length ? 'Nothing open' : 'No payments yet'} action={<button type="button" className="btn btn-sm" onClick={() => openCreate('payment')}><Plus className="i i-sm" />Record payment</button>}>
                    {payments.length ? 'Every payment is settled. Nice.' : 'Payments are created automatically when a project has a budget, or record one here.'}
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
                            <thead><tr><th>Project</th><th className="r">Amount</th><th>Status</th><th>Due</th><th className="r" /></tr></thead>
                            <tbody>
                              {g.rows.map((p) => {
                                const st = effectivePaymentStatus(p)
                                return (
                                  <tr key={p.id} className="hov">
                                    <td><button type="button" className="m cover" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit' }} onClick={() => setEdit(p)}>{paymentTitle(p)}</button></td>
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
                          <thead><tr><th>Project</th><th className="r">Amount</th><th>Due</th><th>Last reminder</th><th className="r" /></tr></thead>
                          <tbody>
                            {g.rows.map((p) => (
                              <tr key={p.id} className="hov">
                                <td><button type="button" className="m cover" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit' }} onClick={() => setEdit(p)}>{paymentTitle(p)}</button></td>
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
                <div className="card"><Empty title="No paid payments yet" /></div>
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
                          <thead><tr><th>Invoice / project</th><th className="r">Amount</th><th>Paid on</th><th>Method</th></tr></thead>
                          <tbody>
                            {g.rows.map((p) => {
                              const inv = invoices.find((i) => i.id === p.invoice_id)
                              return (
                                <tr key={p.id} className="hov">
                                  <td>
                                    {inv ? <Link className="mono m cover" to={`/invoices/${inv.id}`}>{inv.number}</Link> : <button type="button" className="m cover trunc" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit', maxWidth: 360 }} onClick={() => setEdit(p)}>{paymentTitle(p)}</button>}
                                  </td>
                                  <td className="r num b">{formatMoney(p.amount, p.currency, { cents: true })}</td>
                                  <td>{formatDate(p.payment_date)}</td>
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
              <input className="inp sm" type="date" style={{ width: 160 }} value={dates[p.id] ?? ''} onChange={(e) => setDates((d) => ({ ...d, [p.id]: e.target.value }))} />
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
