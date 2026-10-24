import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { api, useData } from '@/data/store'
import { paymentTitle } from '@/data/actions'
import { Modal } from '@/components/ui/modal'
import { Field } from '@/components/ui/field'
import { InvoicePaper } from '@/features/invoices/InvoicePaper'
import { elementToPdfBase64, invoiceFilename } from '@/lib/pdf'
import { clientDisplayName, profileDisplayName } from '@/lib/derive'
import { formatDate, formatMoney } from '@/lib/format'
import type { Payment, PaymentReminder } from '@/types'

/** "Send payment reminder": emails the client from MyDesk with the invoice attached. */
export function RemindModal({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const { clients, invoices, invoiceSettings, me, demoMode, updateRow, createRow, logActivity } = useData()
  const client = clients.find((c) => c.id === payment?.client_id)
  const invoice = invoices.find((i) => i.id === payment?.invoice_id)
  const paperRef = useRef<HTMLDivElement>(null)
  const [sending, setSending] = useState(false)
  const [f, setF] = useState({ to: '', subject: '', message: '', attach: true })

  useEffect(() => {
    if (!payment) return
    const title = paymentTitle(payment)
    const amount = formatMoney(payment.amount, payment.currency)
    const due = payment.due_date ? ` was due on ${formatDate(payment.due_date)}` : ' is still open'
    const firstName = client?.name.split(' ')[0] ?? ''
    setF({
      to: client?.email ?? '',
      subject: `Payment reminder: ${title}${invoice ? ` (${invoice.number})` : ''}`,
      message: `Hi${firstName ? ` ${firstName}` : ''},\n\nJust a quick reminder that the ${amount} payment for ${title}${due}. Could you let me know when I can expect it?\n\nThanks,\n${me ? profileDisplayName(me) : invoiceSettings?.business_name ?? ''}`,
      attach: Boolean(invoice),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.id])

  if (!payment) return null

  const send = async () => {
    if (!f.to.includes('@')) return toast.error('Add the client’s email address')
    setSending(true)
    try {
      if (demoMode) {
        // Demo: record it locally so the flow can be tried end to end.
        await new Promise((r) => setTimeout(r, 600))
        createRow<PaymentReminder>('payment_reminders', { payment_id: payment.id, to_email: f.to, subject: f.subject })
        updateRow('payments', payment.id, { last_reminded_at: new Date().toISOString() })
        logActivity({ entity: 'payment', entityId: payment.id, action: 'reminded', message: `sent a payment reminder to ${f.to}` })
        toast.success('Reminder sent (demo mode, no real email)')
      } else {
        let pdf_base64: string | undefined
        let pdf_filename: string | undefined
        if (f.attach && invoice && paperRef.current) {
          pdf_base64 = await elementToPdfBase64(paperRef.current)
          pdf_filename = invoiceFilename([invoiceSettings?.business_name, clientDisplayName(client), 'invoice', invoice.number], `Invoice-${invoice.number}`)
        }
        const res = await api<{ sent_at: string }>('payments/remind', { payment_id: payment.id, to: f.to, subject: f.subject, message: f.message, pdf_base64, pdf_filename })
        useData.setState((s) => ({
          payments: s.payments.map((p) => (p.id === payment.id ? { ...p, last_reminded_at: res.sent_at } : p)),
          reminders: [{ id: crypto.randomUUID(), payment_id: payment.id, to_email: f.to, subject: f.subject, sent_by: me?.id, created_at: res.sent_at }, ...s.reminders],
        }))
        toast.success(`Reminder sent to ${f.to}`)
      }
      onClose()
    } catch (err) {
      toast.error('Couldn’t send the reminder', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Send payment reminder"
      note={client?.email ? undefined : 'Tip: save the client’s email in Client settings'}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-pri" onClick={send} disabled={sending}>
            {sending ? <Loader2 className="i i-sm" style={{ animation: 'spin 1s linear infinite' }} /> : <Send className="i i-sm" />}
            Send reminder
          </button>
        </>
      }
    >
      <div className="dlg-b">
        <Field label="To">
          <input className="inp" type="email" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} placeholder="client@company.com" />
        </Field>
        <Field label="Subject">
          <input className="inp" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
        </Field>
        <Field label="Message">
          <textarea className="inp" rows={7} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
        </Field>
        <label className="row-sm" style={{ cursor: invoice ? 'pointer' : 'not-allowed', opacity: invoice ? 1 : 0.6 }}>
          <input type="checkbox" className="cb" checked={f.attach && Boolean(invoice)} disabled={!invoice} onChange={(e) => setF({ ...f, attach: e.target.checked })} />
          <span className="small">Attach invoice PDF{invoice ? ` (${invoice.number})` : ' (no invoice linked to this payment)'}</span>
        </label>
        <span className="hint">Replies go straight to your email ({me?.email ?? 'your address'}).</span>
      </div>
      {/* Off-screen copy of the invoice used to render the PDF attachment. */}
      {invoice &&
        createPortal(
          <div style={{ position: 'fixed', left: -10000, top: 0, width: 794, animation: 'none' }} aria-hidden>
            <InvoicePaper
              ref={paperRef}
              number={invoice.number}
              issueDate={invoice.issue_date}
              dueDate={invoice.due_date}
              currency={invoice.currency}
              lineItems={invoice.line_items}
              taxRate={invoice.tax_rate}
              notes={invoice.notes}
              brandColor={invoice.brand_color}
              client={client}
              settings={invoiceSettings}
              paymentFields={invoice.payment_fields ?? []}
              paymentName={invoiceSettings?.payment_profiles.find((p) => p.id === invoice.payment_profile_id)?.name}
            />
          </div>,
          document.body,
        )}
    </Modal>
  )
}
