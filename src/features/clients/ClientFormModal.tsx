import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckboxRow } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import { Field, FormSection } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { useData } from '@/data/store'
import { allTimezones, COUNTRIES, timezoneForCountry } from '@/lib/geo'
import { clientStatus, options } from '@/lib/status'
import type { Client, ClientStatus, InvoiceField } from '@/types'
import { InvoiceFieldsEditor } from '@/features/invoices/InvoiceFieldsEditor'

const statusOptions = options(clientStatus)
const countryNames = COUNTRIES.map((c) => c.name)
const timezoneNames = allTimezones()

interface ClientFormModalProps {
  open: boolean
  onClose: () => void
  /** When set, the modal edits this client instead of creating one. */
  client?: Client
}

/** Mount with key={client?.id ?? 'new'} so fields re-initialize per client. */
export function ClientFormModal({ open, onClose, client }: ClientFormModalProps) {
  const createRow = useData((s) => s.createRow)
  const updateRow = useData((s) => s.updateRow)
  const [form, setForm] = useState({
    name: client?.name ?? '',
    company_name: client?.company_name ?? '',
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    website: client?.website ?? '',
    country: client?.country ?? '',
    timezone: client?.timezone ?? '',
    status: client?.status ?? ('active' as ClientStatus),
    notes: client?.notes ?? '',
    use_company_name: client?.use_company_name ?? false,
    company_address: client?.company_address ?? '',
    brand_color: client?.brand_color ?? '#6366f1',
    invoice_fields: client?.invoice_fields ?? ([] as InvoiceField[]),
  })
  const [nameError, setNameError] = useState<string>()

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  function submit() {
    if (!form.name.trim()) {
      setNameError('Client name is required.')
      return
    }
    const data = {
      ...form,
      name: form.name.trim(),
      company_name: form.company_name.trim() || null,
      use_company_name: form.use_company_name && Boolean(form.company_name.trim()),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      website: form.website.trim() || null,
      country: form.country.trim() || null,
      timezone: form.timezone.trim() || null,
      notes: form.notes.trim() || null,
      company_address: form.company_address.trim() || null,
      brand_color: form.brand_color || null,
      invoice_fields: form.invoice_fields.filter((f) => f.label.trim() || f.value.trim()),
    }
    if (client) {
      updateRow('clients', client.id, data, {
        entity: 'client',
        entityId: client.id,
        action: 'updated',
        message: `Updated client "${data.name}"`,
      })
    } else {
      createRow<Client>('clients', data, {
        entity: 'client',
        action: 'created',
        message: `Added client "${data.name}"`,
      })
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? 'Edit client' : 'New client'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{client ? 'Save changes' : 'Create client'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" required error={nameError}>
          <Input
            value={form.name}
            onChange={(e) => {
              set('name', e.target.value)
              if (nameError) setNameError(undefined)
            }}
            placeholder="e.g. Sarah Chen"
            autoFocus
          />
        </Field>
        <Field label="Company">
          <Input
            value={form.company_name}
            onChange={(e) => set('company_name', e.target.value)}
            placeholder="e.g. Northwind Outfitters"
          />
        </Field>
        <div className="sm:col-span-2">
          <CheckboxRow
            checked={form.use_company_name && Boolean(form.company_name.trim())}
            onChange={(on) => set('use_company_name', on)}
            label="Display as company"
            sublabel={
              form.company_name.trim()
                ? `Show "${form.company_name.trim()}" instead of the contact name across the app.`
                : 'Add a company name to enable this.'
            }
            className={!form.company_name.trim() ? 'pointer-events-none opacity-50' : undefined}
          />
        </div>
        <Field label="Email">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="name@company.com"
          />
        </Field>
        <Field label="Phone">
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+1 …"
          />
        </Field>
        <Field label="Website">
          <Input
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
            placeholder="company.com"
          />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(v) => set('status', v)} options={statusOptions} />
        </Field>
        <Field label="Country">
          <Combobox
            value={form.country}
            onChange={(v) => {
              set('country', v)
              const tz = timezoneForCountry(v)
              if (tz) set('timezone', tz)
            }}
            options={countryNames}
            placeholder="Select a country"
          />
        </Field>
        <Field label="Timezone" hint="Auto-filled from country — override if needed.">
          <Combobox
            value={form.timezone}
            onChange={(v) => set('timezone', v)}
            options={timezoneNames}
            placeholder="Select a timezone"
          />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Preferences, context, anything worth remembering…"
          />
        </Field>
      </div>

      <div className="mt-4 border-t pt-1">
        <FormSection title="Invoicing">
          <div className="space-y-4">
            <Field
              label="Company address"
              hint="Shown as the “Invoice to” block on this client's invoices — the first line is used as the company name there (their legal invoicing name is often different from the short name above), the rest as the address."
            >
              <Textarea
                value={form.company_address}
                onChange={(e) => set('company_address', e.target.value)}
                placeholder={'Segments Digital Pty Ltd\n123 Commercial Road\nCity, Postcode\nCountry'}
              />
            </Field>
            <Field label="Brand color" hint="Accent color used on this client's invoices.">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.brand_color}
                  onChange={(e) => set('brand_color', e.target.value)}
                  className="size-9 shrink-0 cursor-pointer rounded-lg border bg-surface p-1"
                  aria-label="Brand color"
                />
                <Input
                  value={form.brand_color}
                  onChange={(e) => set('brand_color', e.target.value)}
                  className="w-32 uppercase"
                />
              </div>
            </Field>
            <Field label="Additional invoice fields" hint="e.g. VAT Number, Account manager — shown on every invoice for this client.">
              <InvoiceFieldsEditor
                value={form.invoice_fields}
                onChange={(fields) => set('invoice_fields', fields)}
              />
            </Field>
          </div>
        </FormSection>
      </div>
    </Modal>
  )
}
