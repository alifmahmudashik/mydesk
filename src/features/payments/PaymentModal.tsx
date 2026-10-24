import { useEffect, useMemo, useState } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { markPaymentPaid, paymentTitle } from '@/data/actions'
import { Modal, ConfirmDialog } from '@/components/ui/modal'
import { Field, MoneyInput, Select } from '@/components/ui/field'
import { ClientMark } from '@/components/ui/avatar'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { celebrateFrom } from '@/lib/confetti'
import { clientDisplayName, effectivePaymentStatus } from '@/lib/derive'
import { formatDate, formatMoney, lateLabel, todayISO } from '@/lib/format'
import type { Payment, PaymentStatus } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  payment?: Payment
  defaults?: { client_id?: string; project_ids?: string[] }
  onRemind?: (p: Payment) => void
}

const METHODS = ['Wise', 'Payoneer', 'Bank transfer', 'PayPal', 'Stripe', 'Cash', 'Other']

export function PaymentModal({ open, onClose, payment, defaults = {}, onRemind }: Props) {
  const { clients, projects, invoiceSettings, reminders, createRow, updateRow, deleteRow } = useData()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const activeClients = clients.filter((c) => c.status !== 'archived' || c.id === payment?.client_id)
  const methods = useMemo(() => [...new Set([...(invoiceSettings?.payment_profiles ?? []).map((p) => p.name).filter(Boolean), ...METHODS])], [invoiceSettings])

  const blank = () => {
    const client = clients.find((c) => c.id === (payment?.client_id ?? defaults.client_id)) ?? activeClients[0]
    return {
      client_id: payment?.client_id ?? client?.id ?? '',
      project_ids: payment?.project_ids ?? defaults.project_ids ?? [],
      amount: payment ? String(payment.amount) : '',
      currency: payment?.currency ?? client?.default_currency ?? invoiceSettings?.default_currency ?? 'USD',
      status: (payment?.status ?? 'unpaid') as PaymentStatus,
      due_date: payment?.due_date ?? '',
      payment_date: payment?.payment_date ?? '',
      payment_method: payment?.payment_method ?? '',
      notes: payment?.notes ?? '',
    }
  }
  const [f, setF] = useState(blank)
  useEffect(() => {
    if (open) setF(blank())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payment?.id])

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))
  const clientProjects = projects.filter((p) => p.client_id === f.client_id)
  const client = clients.find((c) => c.id === f.client_id)

  const pickClient = (id: string) => {
    const c = clients.find((x) => x.id === id)
    setF((s) => ({ ...s, client_id: id, project_ids: [], currency: c?.default_currency ?? s.currency }))
  }

  const toggleProject = (id: string) => {
    setF((s) => {
      const has = s.project_ids.includes(id)
      const project_ids = has ? s.project_ids.filter((x) => x !== id) : [...s.project_ids, id]
      // Suggest the amount from selected project budgets while creating.
      const sum = projects.filter((p) => project_ids.includes(p.id)).reduce((t, p) => t + Number(p.amount || 0), 0)
      return { ...s, project_ids, amount: !payment && sum ? String(sum) : s.amount }
    })
  }

  const data = () => ({
    client_id: f.client_id,
    project_ids: f.project_ids,
    amount: Number(f.amount) || 0,
    currency: f.currency,
    status: f.status,
    due_date: f.due_date || null,
    payment_date: f.status === 'paid' ? f.payment_date || todayISO() : f.payment_date || null,
    payment_method: f.payment_method || null,
    notes: f.notes.trim() || null,
  })

  const save = () => {
    if (!f.client_id) return toast.error('Pick a client')
    if (!(Number(f.amount) > 0)) return toast.error('Enter an amount')
    const d = data()
    if (payment) {
      const becamePaid = payment.status !== 'paid' && d.status === 'paid'
      updateRow('payments', payment.id, d, {
        entity: 'payment', entityId: payment.id, action: becamePaid ? 'paid' : 'updated',
        message: becamePaid ? `received ${formatMoney(d.amount, d.currency)} from ${clientDisplayName(client)}` : `updated a payment from ${clientDisplayName(client)}`,
      })
      toast.success('Payment saved')
    } else {
      createRow<Payment>('payments', d, { entity: 'payment', action: d.status === 'paid' ? 'paid' : 'created', message: `recorded ${formatMoney(d.amount, d.currency)} from ${clientDisplayName(client)}` })
      toast.success('Payment recorded')
    }
    onClose()
  }

  const markPaid = (el: HTMLElement) => {
    if (!payment) return
    updateRow('payments', payment.id, { ...data(), status: payment.status })
    markPaymentPaid({ ...payment, ...data() }, { method: f.payment_method || undefined })
    celebrateFrom(el)
    onClose()
  }

  const eff = payment ? effectivePaymentStatus(payment) : null
  const late = payment && eff === 'overdue' ? lateLabel(payment.due_date) : null
  const lastReminder = payment ? reminders.filter((r) => r.payment_id === payment.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] : null
  const reminderText = payment?.last_reminded_at || lastReminder ? `last reminder ${formatDate((payment?.last_reminded_at ?? lastReminder!.created_at).slice(0, 10))}` : 'last reminder never sent'

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={payment ? paymentTitle(payment) : 'Record payment'}
        footer={
          payment ? (
            <>
              <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => setConfirmDelete(true)}>
                <Trash2 className="i i-sm" />Delete
              </button>
              <button type="button" className="btn" onClick={save}>Save</button>
              {payment.status !== 'paid' ? (
                <button type="button" className="btn btn-pri" onClick={(e) => markPaid(e.currentTarget)}>Mark as paid</button>
              ) : (
                <button type="button" className="btn btn-pri" onClick={onClose}>Done</button>
              )}
            </>
          ) : (
            <>
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-pri" onClick={save}>Save payment</button>
            </>
          )
        }
      >
        <form className="dlg-b" onSubmit={(e) => { e.preventDefault(); save() }}>
          {payment && (
            <div className="row" style={{ padding: 12, borderRadius: 10, background: 'var(--soft2)' }}>
              <ClientMark client={client} size="md" />
              <div className="grow">
                <div className="m">{clientDisplayName(client)} · {formatMoney(payment.amount, payment.currency)}</div>
                <div className={`small ${late ? 't-bad' : 'muted'}`}>
                  {late ? `${late.replace(' late', '')} overdue · ${reminderText}` : payment.status === 'paid' ? `Paid ${formatDate(payment.payment_date)}${payment.payment_method ? ` via ${payment.payment_method}` : ''}` : reminderText}
                </div>
              </div>
              {payment.status !== 'paid' && onRemind && (
                <button type="button" className="btn btn-sm" onClick={() => onRemind(payment)}>
                  <Send className="i i-sm" />Send reminder
                </button>
              )}
            </div>
          )}
          {!payment && (
            <Field label="Client">
              <Select value={f.client_id} onChange={(e) => pickClient(e.target.value)} options={activeClients.length ? activeClients.map((c) => ({ value: c.id, label: clientDisplayName(c) })) : [{ value: '', label: 'No clients yet' }]} />
            </Field>
          )}
          <div className="field">
            <span className="lbl">{payment ? 'Linked projects' : 'Projects'}</span>
            {clientProjects.length === 0 ? (
              <span className="hint">This client has no projects. You can still record a standalone payment.</span>
            ) : (
              <div className="row wrap" style={{ maxHeight: 120, overflowY: 'auto' }}>
                {clientProjects.map((p) => (
                  <label key={p.id} className={`chip${f.project_ids.includes(p.id) ? ' on' : ''}`}>
                    <input type="checkbox" className="cb" checked={f.project_ids.includes(p.id)} onChange={() => toggleProject(p.id)} />
                    <span className="trunc" style={{ maxWidth: 260 }}>{p.title}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="f2">
            <Field label="Amount">
              <MoneyInput amount={f.amount} currency={f.currency} onAmount={(v) => set('amount', v)} onCurrency={(v) => set('currency', v)} currencies={[...SUPPORTED_CURRENCIES]} />
            </Field>
            <Field label="Status">
              <Select value={f.status} onChange={(e) => set('status', e.target.value as PaymentStatus)} options={[{ value: 'unpaid', label: 'Unpaid' }, { value: 'partial', label: 'Partial' }, { value: 'paid', label: 'Paid' }, { value: 'overdue', label: 'Overdue' }, { value: 'refunded', label: 'Refunded' }]} />
            </Field>
            <Field label="Due date" hint={!f.due_date && f.status !== 'paid' ? 'Without a due date it never turns overdue.' : undefined}>
              <input className="inp" type="date" value={f.due_date} onChange={(e) => set('due_date', e.target.value)} />
            </Field>
            {f.status === 'paid' || payment ? (
              <Field label="Paid on">
                <input className="inp" type="date" value={f.payment_date} onChange={(e) => set('payment_date', e.target.value)} />
              </Field>
            ) : null}
            <Field label="Method">
              <select className="inp" value={f.payment_method} onChange={(e) => set('payment_method', e.target.value)}>
                <option value="">—</option>
                {methods.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="inp" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
          <button type="submit" hidden />
        </form>
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this payment?"
        description="It's removed from payments and analytics. Linked projects stay."
        onConfirm={() => {
          if (!payment) return
          deleteRow('payments', payment.id, { entity: 'payment', entityId: payment.id, action: 'deleted', message: `deleted a payment from ${clientDisplayName(client)}` })
          onClose()
        }}
      />
    </>
  )
}
