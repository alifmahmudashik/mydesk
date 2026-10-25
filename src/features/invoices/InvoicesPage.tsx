import { invoiceTotal } from '@/lib/invoice-math'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format, startOfMonth } from 'date-fns'
import { Download, Edit3, FileText, Plus, Search, Settings, Trash2 } from 'lucide-react'
import { useData } from '@/data/store'
import { Topbar, Content, Empty, PageHead } from '@/components/ui/layout'
import { ClientGroup, groupByClient } from '@/components/domain/ClientGroup'
import { StatusPill } from '@/components/ui/pill'
import { ConfirmDialog } from '@/components/ui/modal'
import { sumUSD, useUsdRates } from '@/lib/currency'
import { clientDisplayName, invoiceStatus, isInvoiceable, sumByCurrency } from '@/lib/derive'
import { formatDate, formatMoney } from '@/lib/format'
import { paymentStatus } from '@/lib/status'
import type { Invoice } from '@/types'

export { invoiceTotal } from '@/lib/invoice-math'

export function InvoicesPage() {
  const { invoices, clients, payments, projects, deleteRow } = useData()
  const navigate = useNavigate()
  const rates = useUsdRates()
  const [q, setQ] = useState('')
  const [deleting, setDeleting] = useState<Invoice>()

  const sorted = useMemo(
    () =>
      [...invoices]
        .filter((i) => {
          const c = clients.find((x) => x.id === i.client_id)
          return !q.trim() || `${i.number} ${clientDisplayName(c)}`.toLowerCase().includes(q.trim().toLowerCase())
        })
        .sort((a, b) => (b.issue_date ?? b.created_at).localeCompare(a.issue_date ?? a.created_at)),
    [invoices, clients, q],
  )

  const statusOf = (inv: Invoice) => invoiceStatus(inv, projects, payments)

  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const thisMonth = invoices.filter((i) => (i.issue_date ?? '') >= monthStart)
  const tracked = invoices.filter((i) => statusOf(i))
  const paidCount = tracked.filter((i) => statusOf(i) === 'paid').length
  const mixed = new Set(thisMonth.map((i) => i.currency)).size > 1

  // Completed projects with a budget whose title isn't on any invoice for that client yet.
  const notInvoiced = projects.filter((p) => p.amount > 0 && isInvoiceable(p, invoices, payments))
  const notInvoicedClients = [...new Set(notInvoiced.map((p) => clientDisplayName(clients.find((c) => c.id === p.client_id))))]

  return (
    <>
      <Topbar crumbs={[{ label: 'Invoices' }]}>
        <Link className="btn hide-sm" to="/settings"><Settings className="i" />Business settings</Link>
        <Link className="btn btn-pri" to="/invoices/new"><Plus className="i" />New invoice</Link>
      </Topbar>
      <Content>
        <PageHead title="Invoices" sub="Branded invoices you can edit, export to PDF and send." />
        <div className="kpis">
          <div className="kpi">
            <span className="lbl">Invoiced in {format(new Date(), 'MMMM')}</span>
            <span className="val">{formatMoney(Math.round(sumUSD(thisMonth.map((i) => ({ amount: invoiceTotal(i), currency: i.currency })), rates)))}</span>
            <span className="sub">{thisMonth.length} invoice{thisMonth.length === 1 ? '' : 's'}{mixed ? ' · mixed currencies in USD' : ''}</span>
          </div>
          <div className="kpi">
            <span className="lbl">Paid</span>
            <span className="val">{paidCount} of {tracked.length}</span>
            <span className="sub">{tracked.length === 0 ? 'Add projects to invoices to see paid status' : paidCount === tracked.length ? 'Every invoice is settled' : `${tracked.length - paidCount} waiting on payment`}</span>
          </div>
          <div className="kpi">
            <span className="lbl">Projects not invoiced</span>
            <span className="val">{notInvoiced.length}</span>
            <span className="sub">{notInvoiced.length ? <span className="trunc">{notInvoicedClients.slice(0, 2).join(' and ')}{notInvoicedClients.length > 2 ? ` +${notInvoicedClients.length - 2}` : ''}</span> : 'All caught up'}</span>
          </div>
        </div>
        <div className="row">
          <label className="inp-wrap" style={{ width: 260, maxWidth: '100%' }}>
            <Search className="i i-sm" />
            <input placeholder="Search number or client…" aria-label="Search invoices" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        {sorted.length === 0 ? (
          <div className="card">
            <Empty icon={<FileText className="i" />} title={invoices.length ? 'No matches' : 'No invoices yet'} action={!invoices.length ? <Link className="btn btn-pri btn-sm" to="/invoices/new"><Plus className="i i-sm" />New invoice</Link> : undefined}>
              {invoices.length ? 'Try another search.' : 'Set your business details once in Business settings, then make a branded invoice in a minute.'}
            </Empty>
          </div>
        ) : (
          <div className="client-groups">
            {groupByClient(sorted, (i) => i.client_id, clients).map((g, gi) => {
              const unpaid = g.rows.filter((i) => { const st = statusOf(i); return st && st !== 'paid' && st !== 'refunded' }).length
              return (
                <ClientGroup
                  key={g.id}
                  client={g.client}
                  defaultOpen={gi < 8 || Boolean(q.trim())}
                  meta={`${g.rows.length} invoice${g.rows.length === 1 ? '' : 's'} \u00b7 last ${formatDate(g.rows[0].issue_date)}${unpaid ? ` \u00b7 ${unpaid} unpaid` : ''}`}
                  right={
                    <>
                      <span className="group-total">{sumByCurrency(g.rows.map((i) => ({ amount: invoiceTotal(i), currency: i.currency })))}</span>
                      <Link className="btn btn-sm btn-ghost" to={`/invoices/new?client=${g.id}`} title="New invoice for this client"><Plus className="i i-sm" /></Link>
                    </>
                  }
                >
                  <div className="tbl-wrap">
                    <table className="tbl" style={{ minWidth: 680 }}>
                      <thead><tr><th>Invoice</th><th>Issued</th><th>Status</th><th className="r">Amount</th><th className="r" /></tr></thead>
                      <tbody>
                        {g.rows.map((inv) => {
                          const st = statusOf(inv)
                          return (
                            <tr key={inv.id} className="hov">
                              <td><Link className="mono m cover" to={`/invoices/${inv.id}`}>{inv.number}</Link></td>
                              <td>{formatDate(inv.issue_date)}</td>
                              <td>{st ? <StatusPill meta={paymentStatus[st]} /> : <span className="pill gray" title="No line item matches one of this client’s projects">No project</span>}</td>
                              <td className="r num b">{formatMoney(invoiceTotal(inv), inv.currency, { cents: true })}</td>
                              <td className="r">
                                <span className="row-sm above" style={{ justifyContent: 'flex-end' }}>
                                  <button className="btn btn-sm btn-icon" type="button" aria-label="Download PDF" title="Download PDF" onClick={() => navigate(`/invoices/${inv.id}?export=1`)}><Download className="i i-sm" /></button>
                                  <Link className="btn btn-sm btn-icon" to={`/invoices/${inv.id}`} aria-label="Edit" title="Edit"><Edit3 className="i i-sm" /></Link>
                                  <button className="btn btn-sm btn-icon" type="button" aria-label="Delete" title="Delete" onClick={() => setDeleting(inv)}><Trash2 className="i i-sm" /></button>
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </ClientGroup>
              )
            })}
          </div>
        )}
      </Content>
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(undefined)}
        title={`Delete invoice ${deleting?.number ?? ''}?`}
        description="The invoice is removed. Any linked payment stays, just without the invoice."
        onConfirm={() => {
          if (!deleting) return
          deleteRow('invoices', deleting.id, { entity: 'invoice', entityId: deleting.id, action: 'deleted', message: `deleted invoice ${deleting.number}` })
          useData.setState((s) => ({ payments: s.payments.map((p) => (p.invoice_id === deleting.id ? { ...p, invoice_id: null } : p)) }))
        }}
      />
    </>
  )
}
