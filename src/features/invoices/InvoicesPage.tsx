import { invoiceTotal } from '@/lib/invoice-math'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, Edit3, FileText, Plus, Trash2 } from 'lucide-react'
import { useData } from '@/data/store'
import { Empty } from '@/components/ui/layout'
import { ClientGroup, groupByClient } from '@/components/domain/ClientGroup'
import { StatusPill } from '@/components/ui/pill'
import { ConfirmDialog } from '@/components/ui/modal'
import { clientDisplayName, invoiceStatus, isInvoiceable, sumByCurrency } from '@/lib/derive'
import { formatDate, formatMoney } from '@/lib/format'
import { paymentStatus } from '@/lib/status'
import type { Invoice } from '@/types'

export { invoiceTotal } from '@/lib/invoice-math'

/** The Invoices tab of the Billing page: every invoice, grouped by client. */
export function InvoicesList({ q }: { q: string }) {
  const { invoices, clients, payments, projects, deleteRow } = useData()
  const navigate = useNavigate()
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

  // Completed projects with a budget that aren't on any invoice yet.
  const notInvoiced = projects.filter((p) => p.amount > 0 && isInvoiceable(p, invoices, payments))
  const notInvoicedClients = [...new Set(notInvoiced.map((p) => clientDisplayName(clients.find((c) => c.id === p.client_id))))]

  return (
    <>
      {notInvoiced.length > 0 && (
        <div className="card card-f" style={{ marginBottom: 12 }}>
          <span className="muted">
            {notInvoiced.length} completed project{notInvoiced.length === 1 ? ' isn’t' : 's aren’t'} on an invoice yet ({notInvoicedClients.slice(0, 2).join(' and ')}{notInvoicedClients.length > 2 ? ` +${notInvoicedClients.length - 2}` : ''}).
          </span>
          <Link className="btn btn-sm" to="/invoices/new"><Plus className="i i-sm" />New invoice</Link>
        </div>
      )}
      {sorted.length === 0 ? (
        <div className="card">
          <Empty icon={<FileText className="i" />} title={invoices.length ? 'No matches' : 'No invoices yet'} action={!invoices.length ? <Link className="btn btn-pri btn-sm" to="/invoices/new"><Plus className="i i-sm" />New invoice</Link> : undefined}>
            {invoices.length ? 'Try another search.' : 'Use “Create invoice” on a payment, or start one here.'}
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
                meta={`${g.rows.length} invoice${g.rows.length === 1 ? '' : 's'} · last ${formatDate(g.rows[0].issue_date)}${unpaid ? ` · ${unpaid} unpaid` : ''}`}
                right={
                  <>
                    <span className="group-total">{sumByCurrency(g.rows.map((i) => ({ amount: invoiceTotal(i), currency: i.currency })))}</span>
                    <Link className="btn btn-sm btn-ghost" to={`/invoices/new?client=${g.id}`} title="New invoice for this client"><Plus className="i i-sm" /></Link>
                  </>
                }
              >
                <div className="tbl-wrap">
                  <table className="tbl" style={{ minWidth: 680 }}>
                    <thead><tr><th>Invoice</th><th style={{ width: 130 }}>Issued</th><th style={{ width: 150 }}>Status</th><th className="r" style={{ width: 130 }}>Amount</th><th className="r" style={{ width: 140 }} /></tr></thead>
                    <tbody>
                      {g.rows.map((inv) => {
                        const st = statusOf(inv)
                        const linked = payments.filter((p) => p.invoice_id === inv.id).length
                        return (
                          <tr key={inv.id} className="hov">
                            <td>
                              <Link className="mono m cover" to={`/invoices/${inv.id}`}>{inv.number}</Link>
                              <div className="xs faint">{linked ? `${linked} payment${linked === 1 ? '' : 's'} linked` : 'No payment linked'}</div>
                            </td>
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
