import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  MapPin,
  Save,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { CheckboxRow } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusPill } from '@/components/ui/status-pill'
import { useData } from '@/data/store'
import { useIsAdmin } from '@/hooks/usePermissions'
import { clientDisplayName, clientSecondaryName } from '@/lib/derive'
import { allTimezones, COUNTRIES, timezoneForCountry } from '@/lib/geo'
import { clientStatus, options } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { ClientStatus, InvoiceField } from '@/types'
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

export function ClientSettingsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const { ready, clients, updateRow, deleteRow } = useData()

  const client = useMemo(() => clients.find((c) => c.id === id), [clients, id])

  const [form, setForm] = useState(() => ({
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
  }))

  const [nameError, setNameError] = useState<string>()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  // Sync initial state when client loads
  const [initializedId, setInitializedId] = useState<string | null>(null)
  if (client && initializedId !== client.id) {
    setForm({
      name: client.name ?? '',
      company_name: client.company_name ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      website: client.website ?? '',
      country: client.country ?? '',
      timezone: client.timezone ?? '',
      status: client.status ?? ('active' as ClientStatus),
      notes: client.notes ?? '',
      use_company_name: client.use_company_name ?? false,
      company_address: client.company_address ?? '',
      brand_color: client.brand_color ?? '#6366f1',
      invoice_fields: client.invoice_fields ?? ([] as InvoiceField[]),
    })
    setInitializedId(client.id)
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  if (!ready) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!client) {
    return (
      <EmptyState
        icon={MapPin}
        title="Client not found"
        description="The requested client may have been deleted or archived."
        action={
          <Button variant="secondary" onClick={() => navigate('/clients')}>
            <ArrowLeft strokeWidth={1.75} />
            Back to clients
          </Button>
        }
      />
    )
  }

  const displayName =
    form.use_company_name && form.company_name.trim()
      ? form.company_name.trim()
      : form.name.trim() || clientDisplayName(client)

  function saveChanges() {
    if (!client) return
    if (!form.name.trim()) {
      setNameError('Client name is required.')
      toast.error('Client name is required.')
      return
    }

    setSaving(true)
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

    updateRow('clients', client.id, data, {
      entity: 'client',
      entityId: client.id,
      action: 'updated',
      message: `Updated settings for "${data.name}"`,
    })

    setTimeout(() => {
      setSaving(false)
      toast.success(`Settings saved for "${displayName}"`)
    }, 200)
  }

  function toggleArchive() {
    if (!client) return
    const nextStatus = client.status === 'archived' ? 'active' : 'archived'
    updateRow(
      'clients',
      client.id,
      { status: nextStatus },
      {
        entity: 'client',
        entityId: client.id,
        action: 'status_changed',
        message: `${nextStatus === 'archived' ? 'Archived' : 'Reactivated'} client "${clientDisplayName(client)}"`,
      },
    )
    set('status', nextStatus)
    toast.success(
      nextStatus === 'archived'
        ? `Archived "${clientDisplayName(client)}"`
        : `Reactivated "${clientDisplayName(client)}"`,
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to={`/clients/${client.id}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
          Back to {clientDisplayName(client)}
        </Link>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="secondary" size="sm" onClick={toggleArchive}>
              {client.status === 'archived' ? (
                <>
                  <ArchiveRestore className="size-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                  Reactivate client
                </>
              ) : (
                <>
                  <Archive className="size-3.5" strokeWidth={1.75} />
                  Archive client
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Header Profile Banner */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={displayName} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground">{displayName}</h1>
              <StatusPill meta={clientStatus[form.status]} />
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {clientSecondaryName(client) ? `${clientSecondaryName(client)} · ` : ''}
              Client settings & configuration
            </p>
          </div>
        </div>
      </div>

      {/* 1. Identity & General Info */}
      <Card>
        <CardHeader title="General & Identity" />
        <div className="space-y-4 p-5 pt-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Contact Name" required error={nameError}>
              <Input
                value={form.name}
                onChange={(e) => {
                  set('name', e.target.value)
                  if (nameError) setNameError(undefined)
                }}
                placeholder="e.g. Sarah Chen"
              />
            </Field>

            <Field label="Company Name">
              <Input
                value={form.company_name}
                onChange={(e) => set('company_name', e.target.value)}
                placeholder="e.g. Northwind Outfitters"
              />
            </Field>

            <div className="sm:col-span-2">
              <div className="rounded-xl border bg-surface-hover/30 p-3.5">
                <CheckboxRow
                  checked={form.use_company_name && Boolean(form.company_name.trim())}
                  onChange={(on) => set('use_company_name', on)}
                  label="Display as Company across workspace"
                  sublabel={
                    form.company_name.trim()
                      ? `Show "${form.company_name.trim()}" instead of "${form.name.trim() || 'contact'}" across the app, projects, and invoices.`
                      : 'Enter a company name above to enable company display mode.'
                  }
                  className={!form.company_name.trim() ? 'pointer-events-none opacity-50' : undefined}
                />
              </div>
            </div>

            <Field label="Client Status">
              <Select value={form.status} onChange={(v) => set('status', v)} options={statusOptions} />
            </Field>
          </div>
        </div>
      </Card>

      {/* 2. Contact Information & Location */}
      <Card>
        <CardHeader title="Contact & Location" />
        <div className="space-y-4 p-5 pt-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email Address">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="client@company.com"
              />
            </Field>

            <Field label="Phone Number">
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

            <Field label="Timezone" hint="Auto-filled from country — customize if needed." className="sm:col-span-2">
              <Combobox
                value={form.timezone}
                onChange={(v) => set('timezone', v)}
                options={timezoneNames}
                placeholder="Select a timezone"
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* 3. Invoicing & Brand Customization */}
      <Card>
        <CardHeader title="Invoicing & Branding" />
        <div className="space-y-5 p-5 pt-3">
          <Field
            label="Legal Invoicing Company & Address"
            hint="Printed as the “Invoice to” block on this client's PDF invoices. The first line is used as the legal company name."
          >
            <Textarea
              value={form.company_address}
              onChange={(e) => set('company_address', e.target.value)}
              placeholder={'Segments Digital Pty Ltd\n123 Commercial Road\nCity, Postcode\nCountry'}
              rows={3}
            />
          </Field>

          {/* Brand Accent Color */}
          <Field label="Brand Accent Color" hint="Used for PDF invoice branding and custom styling.">
            <div className="space-y-3 rounded-xl border bg-surface-hover/30 p-4">
              <div className="flex flex-wrap items-center gap-2.5">
                {PRESET_BRAND_COLORS.map((preset) => {
                  const isSelected = form.brand_color?.toLowerCase() === preset.hex.toLowerCase()
                  return (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => set('brand_color', preset.hex)}
                      title={preset.name}
                      className={cn(
                        'relative flex size-8 items-center justify-center rounded-lg border transition-transform hover:scale-105',
                        isSelected && 'ring-2 ring-primary ring-offset-2',
                      )}
                      style={{ backgroundColor: preset.hex }}
                    >
                      {isSelected && <Check className="size-4 text-white drop-shadow-xs" strokeWidth={3} />}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="color"
                  value={form.brand_color || '#6366f1'}
                  onChange={(e) => set('brand_color', e.target.value)}
                  className="size-9 shrink-0 cursor-pointer rounded-lg border bg-transparent p-0.5"
                  aria-label="Custom brand color"
                />
                <Input
                  value={form.brand_color}
                  onChange={(e) => set('brand_color', e.target.value)}
                  placeholder="#6366f1"
                  className="w-32 uppercase font-mono text-xs"
                />
                <span className="text-xs text-muted-foreground">Custom Hex Color</span>
              </div>
            </div>
          </Field>

          {/* Additional Invoice Fields */}
          <Field
            label="Additional Custom Invoice Fields"
            hint="e.g. VAT Number, Tax ID, PO Number — automatically included on invoices generated for this client."
          >
            <InvoiceFieldsEditor
              value={form.invoice_fields}
              onChange={(fields) => set('invoice_fields', fields)}
            />
          </Field>
        </div>
      </Card>

      {/* 4. Notes & Preferences */}
      <Card>
        <CardHeader title="Notes & Preferences" />
        <div className="p-5 pt-3">
          <Field label="Internal Notes" hint="Preferences, context, communication style, and anything worth remembering.">
            <Textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="e.g. Prefers email updates over calls, invoice sent on the 1st of each month…"
              rows={4}
            />
          </Field>
        </div>
      </Card>

      {/* 5. Danger Zone */}
      {isAdmin && (
        <Card className="border-danger/30 bg-danger/5">
          <CardHeader title="Danger Zone" className="text-danger" />
          <div className="flex flex-col items-start justify-between gap-4 p-5 pt-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-foreground">Delete this client</p>
              <p className="text-xs text-muted-foreground">
                Permanently removes this client along with all their projects, tasks, payments, and notes. This cannot be undone.
              </p>
            </div>
            <Button
              variant="ghost"
              className="shrink-0 text-danger hover:bg-danger/15 hover:text-danger"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 strokeWidth={1.75} />
              Delete client
            </Button>
          </div>
        </Card>
      )}

      {/* Bottom Action Bar (Static, non-floating) */}
      <div className="flex items-center justify-between rounded-xl border bg-surface p-4 shadow-sm">
        <Link
          to={`/clients/${client.id}`}
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </Link>
        <Button onClick={saveChanges} disabled={saving}>
          <Save className="size-4" strokeWidth={1.75} />
          {saving ? 'Saving changes…' : 'Save changes'}
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
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
          toast.success(`Deleted client "${client.name}"`)
          navigate('/clients')
        }}
        title={`Delete ${client.name}?`}
        description="This permanently removes the client and everything under them — projects, tasks, payments, and notes. This cannot be undone."
      />
    </div>
  )
}
