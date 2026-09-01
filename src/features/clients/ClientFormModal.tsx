import { useState } from 'react'
import { Check, FileText, Trash2, User } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { CheckboxRow } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { ConfirmDialog, Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { StatusPill } from '@/components/ui/status-pill'
import { useData } from '@/data/store'
import { allTimezones, COUNTRIES, timezoneForCountry } from '@/lib/geo'
import { clientStatus, options } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { Client, ClientStatus, InvoiceField } from '@/types'
import { InvoiceFieldsEditor } from '@/features/invoices/InvoiceFieldsEditor'

const statusOptions = options(clientStatus)
const countryNames = COUNTRIES.map((c) => c.name)
const timezoneNames = allTimezones()

const PRESET_BRAND_COLORS = [
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Sky', hex: '#0284c7' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Slate', hex: '#475569' },
]

interface ClientFormModalProps {
  open: boolean
  onClose: () => void
  /** When set, the modal edits this client instead of creating one. */
  client?: Client
  /** Called after the client is deleted, e.g. to navigate away from its now-gone workspace. */
  onDeleted?: () => void
}

/** Mount with key={client?.id ?? 'new'} so fields re-initialize per client. */
export function ClientFormModal({ open, onClose, client, onDeleted }: ClientFormModalProps) {
  const createRow = useData((s) => s.createRow)
  const updateRow = useData((s) => s.updateRow)
  const deleteRow = useData((s) => s.deleteRow)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'invoicing'>('general')
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

  const displayName =
    form.use_company_name && form.company_name.trim()
      ? form.company_name.trim()
      : form.name.trim() || (client?.name ?? 'New Client')

  function submit() {
    if (!form.name.trim()) {
      setNameError('Client name is required.')
      setActiveTab('general')
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
          {client && (
            <Button
              variant="ghost"
              className="mr-auto text-danger hover:bg-danger/10 hover:text-danger"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 strokeWidth={1.75} />
              Delete client
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{client ? 'Save changes' : 'Create client'}</Button>
        </>
      }
    >
      {/* Client Preview Header Card */}
      <div className="mb-4 flex items-center justify-between rounded-xl border bg-surface-hover/50 p-3">
        <div className="flex items-center gap-3">
          <Avatar name={displayName} size="md" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{displayName}</h3>
            <p className="truncate text-xs text-muted-foreground">
              {form.company_name.trim() && form.name.trim()
                ? form.use_company_name
                  ? `Contact: ${form.name.trim()}`
                  : `Company: ${form.company_name.trim()}`
                : client?.country || form.country || 'Client details'}
            </p>
          </div>
        </div>
        <StatusPill meta={clientStatus[form.status]} animate={false} />
      </div>

      {/* Navigation Tabs */}
      <div className="mb-4 flex border-b">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={cn(
            '-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
            activeTab === 'general'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <User className="size-3.5" strokeWidth={1.75} />
          General & Contact
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('invoicing')}
          className={cn(
            '-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
            activeTab === 'invoicing'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <FileText className="size-3.5" strokeWidth={1.75} />
          Invoicing & Branding
          {form.brand_color && (
            <span
              className="size-2.5 rounded-full border"
              style={{ backgroundColor: form.brand_color }}
              aria-hidden
            />
          )}
        </button>
      </div>

      {activeTab === 'general' ? (
        <div className="space-y-4">
          {/* Identity Fields */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Contact name" required error={nameError}>
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

            <Field label="Company name">
              <Input
                value={form.company_name}
                onChange={(e) => set('company_name', e.target.value)}
                placeholder="e.g. Northwind Outfitters"
              />
            </Field>

            <div className="sm:col-span-2">
              <div className="rounded-lg border bg-surface p-2.5 shadow-xs">
                <CheckboxRow
                  checked={form.use_company_name && Boolean(form.company_name.trim())}
                  onChange={(on) => set('use_company_name', on)}
                  label="Display as company"
                  sublabel={
                    form.company_name.trim()
                      ? `Show "${form.company_name.trim()}" instead of "${form.name.trim() || 'contact'}" across the app.`
                      : 'Add a company name above to enable company display mode.'
                  }
                  className={!form.company_name.trim() ? 'pointer-events-none opacity-50' : undefined}
                />
              </div>
            </div>

            <Field label="Status">
              <Select value={form.status} onChange={(v) => set('status', v)} options={statusOptions} />
            </Field>

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
                placeholder="+1 555 0199"
              />
            </Field>

            <Field label="Website">
              <Input
                value={form.website}
                onChange={(e) => set('website', e.target.value)}
                placeholder="company.com"
              />
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

            <Field label="Timezone" hint="Auto-detected from country — customize if needed.">
              <Combobox
                value={form.timezone}
                onChange={(v) => set('timezone', v)}
                options={timezoneNames}
                placeholder="Select a timezone"
              />
            </Field>

            <Field label="Notes & preferences" className="sm:col-span-2">
              <Textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Preferences, work history, context, communication style…"
                rows={3}
              />
            </Field>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Field
            label="Legal company address"
            hint="Shown as the “Invoice to” block on this client's PDF invoices. First line is used as the legal invoicing entity name."
          >
            <Textarea
              value={form.company_address}
              onChange={(e) => set('company_address', e.target.value)}
              placeholder={'Segments Digital Pty Ltd\n123 Commercial Road\nCity, Postcode\nCountry'}
              rows={3}
            />
          </Field>

          {/* Brand Color Picker with Swatches */}
          <Field label="Brand accent color" hint="Theme and header color on PDF invoices generated for this client.">
            <div className="space-y-2.5 rounded-lg border bg-surface p-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_BRAND_COLORS.map((preset) => {
                  const isSelected = form.brand_color?.toLowerCase() === preset.hex.toLowerCase()
                  return (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => set('brand_color', preset.hex)}
                      title={preset.name}
                      className={cn(
                        'relative flex size-7 items-center justify-center rounded-md border transition-transform hover:scale-105',
                        isSelected && 'ring-2 ring-primary ring-offset-2',
                      )}
                      style={{ backgroundColor: preset.hex }}
                    >
                      {isSelected && <Check className="size-3.5 text-white drop-shadow-xs" strokeWidth={3} />}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="color"
                  value={form.brand_color || '#6366f1'}
                  onChange={(e) => set('brand_color', e.target.value)}
                  className="size-8 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
                  aria-label="Custom brand color"
                />
                <Input
                  value={form.brand_color}
                  onChange={(e) => set('brand_color', e.target.value)}
                  placeholder="#6366f1"
                  className="w-32 uppercase font-mono text-xs"
                />
                <span className="text-xs text-muted-foreground">Custom hex color</span>
              </div>
            </div>
          </Field>

          <Field
            label="Additional invoice fields"
            hint="e.g. VAT Number, Tax ID, Account Manager — added to each invoice for this client."
          >
            <InvoiceFieldsEditor
              value={form.invoice_fields}
              onChange={(fields) => set('invoice_fields', fields)}
            />
          </Field>
        </div>
      )}

      {client && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            deleteRow('clients', client.id, {
              entity: 'client',
              entityId: client.id,
              action: 'deleted',
              message: `Deleted client "${client.name}"`,
            })
            onClose()
            onDeleted?.()
          }}
          title={`Delete ${client.name}?`}
          description="This removes the client and everything under them — projects, tasks, payments, and notes. This can’t be undone."
        />
      )}
    </Modal>
  )
}
