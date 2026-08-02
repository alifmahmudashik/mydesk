import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FormSection } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useData } from '@/data/store'
import type { InvoiceField } from '@/types'
import { InvoiceFieldsEditor } from '@/features/invoices/InvoiceFieldsEditor'

interface InvoiceSettingsModalProps {
  open: boolean
  onClose: () => void
}

/** Your own business + payment details — the default sender info on every invoice you generate. */
export function InvoiceSettingsModal({ open, onClose }: InvoiceSettingsModalProps) {
  const settings = useData((s) => s.invoiceSettings)
  const saveInvoiceSettings = useData((s) => s.saveInvoiceSettings)

  const [form, setForm] = useState({
    business_name: settings?.business_name ?? '',
    business_address: settings?.business_address ?? '',
    email: settings?.email ?? '',
    default_note: settings?.default_note ?? '',
    payment_fields: settings?.payment_fields ?? ([] as InvoiceField[]),
  })

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  function submit() {
    saveInvoiceSettings({
      business_name: form.business_name.trim() || null,
      business_address: form.business_address.trim() || null,
      email: form.email.trim() || null,
      default_note: form.default_note.trim() || null,
      payment_fields: form.payment_fields.filter((f) => f.label.trim() || f.value.trim()),
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Business settings"
      description="Your own details — reused as the default sender on every invoice."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Save</Button>
        </>
      }
    >
      <div className="divide-y">
        <FormSection title="Sender">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Business / your name">
              <Input
                value={form.business_name}
                onChange={(e) => set('business_name', e.target.value)}
                placeholder="e.g. Alif Mahmud"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Textarea
                value={form.business_address}
                onChange={(e) => set('business_address', e.target.value)}
                placeholder={'Street, City\nPostcode, Country'}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Payment details">
          <p className="mb-3 text-[13px] text-muted-foreground">
            Bank name, account number, SWIFT/BIC, payment links — whatever you want shown on
            every invoice.
          </p>
          <InvoiceFieldsEditor value={form.payment_fields} onChange={(v) => set('payment_fields', v)} />
        </FormSection>

        <FormSection title="Default note">
          <Field label="Note" hint="Shown at the bottom of every new invoice — editable per invoice.">
            <Textarea
              value={form.default_note}
              onChange={(e) => set('default_note', e.target.value)}
              placeholder="It was great doing business with you…"
            />
          </Field>
        </FormSection>
      </div>
    </Modal>
  )
}
