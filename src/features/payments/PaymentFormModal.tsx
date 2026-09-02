import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckboxRow } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import { Field, FormSection } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { useData } from '@/data/store'
import { clientDisplayName } from '@/lib/derive'
import { formatMoney } from '@/lib/format'
import { options, paymentStatus } from '@/lib/status'
import { getCurrencyOptions } from '@/lib/currency'
import type { Payment, PaymentStatus } from '@/types'

const statusOptions = options(paymentStatus)

interface PaymentFormModalProps {
  open: boolean
  onClose: () => void
  payment?: Payment
}

/** Mount with key={payment?.id ?? 'new'} so fields re-initialize. */
export function PaymentFormModal({ open, onClose, payment }: PaymentFormModalProps) {
  const { clients, projects, createRow, updateRow } = useData()
  const [form, setForm] = useState({
    client_id: payment?.client_id ?? '',
    project_ids: payment?.project_ids ?? ([] as string[]),
    amount: payment ? String(payment.amount) : '',
    currency: payment?.currency ?? 'USD',
    status: payment?.status ?? ('unpaid' as PaymentStatus),
    payment_method: payment?.payment_method ?? '',
    invoice_url: payment?.invoice_url ?? '',
    due_date: payment?.due_date ?? '',
    payment_date: payment?.payment_date ?? '',
    notes: payment?.notes ?? '',
  })
  const [errors, setErrors] = useState<{ client?: string; amount?: string }>({})

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const clientOptions = clients.map((c) => ({ value: c.id, label: clientDisplayName(c) }))
  const clientProjects = projects.filter((p) => p.client_id === form.client_id)
  const currencyOptions = getCurrencyOptions(form.currency)

  const toggleProject = (id: string, on: boolean) => {
    const proj = projects.find((p) => p.id === id)
    setForm((f) => {
      const nextIds = on ? [...f.project_ids, id] : f.project_ids.filter((p) => p !== id)
      const nextCurrency =
        on && proj?.currency && (!f.currency || f.currency === 'USD') ? proj.currency : f.currency
      return {
        ...f,
        project_ids: nextIds,
        currency: nextCurrency,
      }
    })
  }

  function submit() {
    const next: typeof errors = {}
    if (!form.client_id) next.client = 'Pick the client this payment is from.'
    const amount = Number(form.amount)
    if (!form.amount || Number.isNaN(amount) || amount <= 0) next.amount = 'Enter an amount greater than 0.'
    setErrors(next)
    if (Object.keys(next).length) return

    const data = {
      client_id: form.client_id,
      project_ids: form.project_ids,
      amount,
      currency: form.currency,
      status: form.status,
      payment_method: form.payment_method.trim() || null,
      invoice_url: form.invoice_url.trim() || null,
      due_date: form.due_date || null,
      payment_date: form.payment_date || null,
      notes: form.notes.trim() || null,
    }
    const client = clients.find((c) => c.id === data.client_id)

    if (payment) {
      updateRow('payments', payment.id, data, {
        entity: 'payment',
        entityId: payment.id,
        action: 'updated',
        message: `Updated ${formatMoney(amount, data.currency)} payment for ${clientDisplayName(client)}`,
      })
    } else {
      createRow<Payment>('payments', data, {
        entity: 'payment',
        action: 'created',
        message: `Logged ${formatMoney(amount, data.currency)} payment for ${clientDisplayName(client)}`,
      })
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={payment ? 'Edit payment' : 'New payment'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{payment ? 'Save changes' : 'Log payment'}</Button>
        </>
      }
    >
      <div className="divide-y">
        <FormSection title="Who it's from">
          <div className="grid grid-cols-1 gap-3">
            <Field label="Client" required error={errors.client}>
              <Select
                value={form.client_id || undefined}
                onChange={(v) => setForm((f) => ({ ...f, client_id: v, project_ids: [] }))}
                options={clientOptions}
                placeholder="Select a client"
              />
            </Field>
            {form.client_id && (
              <Field label="Projects covered" hint="One invoice can cover several projects.">
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {clientProjects.map((p) => (
                    <CheckboxRow
                      key={p.id}
                      checked={form.project_ids.includes(p.id)}
                      onChange={(on) => toggleProject(p.id, on)}
                      label={p.title}
                      sublabel={p.project_type ?? undefined}
                    />
                  ))}
                  {clientProjects.length === 0 && (
                    <p className="text-[13px] text-muted-foreground">This client has no projects yet.</p>
                  )}
                </div>
              </Field>
            )}
          </div>
        </FormSection>

        <FormSection title="Amount & status">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Amount" required error={errors.amount}>
              <div className="flex gap-2">
                <Input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                  placeholder="0"
                  className="tnum"
                  aria-label="Payment amount"
                />
                <Select
                  value={form.currency}
                  onChange={(v) => set('currency', v)}
                  options={currencyOptions}
                  className="w-22 shrink-0"
                  aria-label="Currency"
                />
              </div>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(v) => set('status', v)} options={statusOptions} />
            </Field>
            <Field label="Due date">
              <DatePicker value={form.due_date} onChange={(v) => set('due_date', v)} />
            </Field>
            <Field label="Paid date">
              <DatePicker value={form.payment_date} onChange={(v) => set('payment_date', v)} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Details">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Method">
              <Input
                value={form.payment_method}
                onChange={(e) => set('payment_method', e.target.value)}
                placeholder="e.g. Wise, Stripe, bank transfer"
              />
            </Field>
            <Field label="Invoice URL">
              <Input
                type="url"
                value={form.invoice_url}
                onChange={(e) => set('invoice_url', e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="e.g. 50% upfront"
                className="min-h-16"
              />
            </Field>
          </div>
        </FormSection>
      </div>
    </Modal>
  )
}
