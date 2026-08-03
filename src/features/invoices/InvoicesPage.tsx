import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FileText, Loader2, Plus, Receipt, Settings, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CheckboxRow } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import { EmptyState } from '@/components/ui/empty-state'
import { Field, FormSection } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { ConfirmDialog, Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { ListSkeleton } from '@/components/ui/skeleton'
import { useData } from '@/data/store'
import { useIsAdmin } from '@/hooks/usePermissions'
import { clientDisplayName } from '@/lib/derive'
import { formatDate, formatMoney } from '@/lib/format'
import type { Client, Invoice, InvoiceField, InvoiceLineItem } from '@/types'
import { InvoicePreview } from '@/features/invoices/InvoicePreview'
import { InvoiceSettingsModal } from '@/features/invoices/InvoiceSettingsModal'
import { exportElementToPdf } from '@/features/invoices/pdf'

const currencyOptions = ['USD', 'EUR', 'GBP', 'BDT'].map((c) => ({ value: c, label: c }))
const today = () => new Date().toISOString().slice(0, 10)
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

function suggestNumber(client: Client | undefined, invoices: Invoice[]) {
  if (!client) return ''
  const letters = clientDisplayName(client).replace(/[^a-zA-Z]/g, '')
  const prefix = (letters.slice(0, 2) || 'IN').toUpperCase()
  const count = invoices.filter((i) => i.client_id === client.id).length + 1
  return `${prefix}-${String(count).padStart(2, '0')}`
}

function emptyForm(client?: Client) {
  return {
    id: undefined as string | undefined,
    client_id: client?.id ?? '',
    number: '',
    issue_date: today(),
    due_date: plusDays(7),
    currency: 'USD',
    line_items: [] as InvoiceLineItem[],
    tax_rate: 0,
    notes: '',
    brand_color: client?.brand_color ?? '#6366f1',
    payment_profile_id: 'none',
    payment_fields: [] as InvoiceField[],
  }
}

export function InvoicesPage() {
  const isAdmin = useIsAdmin()
  const {
    ready, clients, projects, invoices, invoiceSettings, createRow, updateRow, deleteRow,
  } = useData()

  const [form, setForm] = useState(emptyForm())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loadProjectsOpen, setLoadProjectsOpen] = useState(false)
  const [deleting, setDeleting] = useState<Invoice>()
  const [exporting, setExporting] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const client = clients.find((c) => c.id === form.client_id)
  const clientProjects = useMemo(() => projects.filter((p) => p.client_id === form.client_id), [projects, form.client_id])

  const clientOptions = clients.map((c) => ({ value: c.id, label: clientDisplayName(c) }))

  const selectClient = (clientId: string) => {
    const c = clients.find((cl) => cl.id === clientId)
    setForm((f) => ({
      ...f,
      client_id: clientId,
      brand_color: c?.brand_color || f.brand_color,
      number: f.number || suggestNumber(c, invoices),
    }))
  }

  const paymentProfiles = invoiceSettings?.payment_profiles ?? []
  const paymentMethodOptions = [
    { value: 'none', label: 'None' },
    ...paymentProfiles.map((p) => ({ value: p.id, label: p.name || 'Untitled' })),
  ]

  const selectPaymentMethod = (profileId: string) => {
    const profile = paymentProfiles.find((p) => p.id === profileId)
    setForm((f) => ({ ...f, payment_profile_id: profileId, payment_fields: profile ? profile.fields : [] }))
  }

  const setLineItem = (i: number, patch: Partial<InvoiceLineItem>) =>
    set(
      'line_items',
      form.line_items.map((li, idx) => (idx === i ? { ...li, ...patch } : li)),
    )
  const removeLineItem = (i: number) => set('line_items', form.line_items.filter((_, idx) => idx !== i))
  const addLineItem = () => set('line_items', [...form.line_items, { description: '', price: 0, qty: 1 }])

  const loadFromInvoice = (inv: Invoice) => {
    setForm({
      id: inv.id,
      client_id: inv.client_id,
      number: inv.number,
      issue_date: inv.issue_date ?? today(),
      due_date: inv.due_date ?? today(),
      currency: inv.currency,
      line_items: inv.line_items,
      tax_rate: inv.tax_rate,
      notes: inv.notes ?? '',
      brand_color: inv.brand_color ?? '#6366f1',
      // The profile itself may have since been renamed or deleted — the invoice keeps its
      // own snapshot of the fields, so re-picking a profile here is optional, not required.
      payment_profile_id: 'none',
      payment_fields: inv.payment_fields ?? [],
    })
  }

  function save() {
    if (!form.client_id) {
      toast.error('Pick a client first')
      return
    }
    if (!form.number.trim()) {
      toast.error('Give the invoice a number')
      return
    }
    const data = {
      client_id: form.client_id,
      number: form.number.trim(),
      issue_date: form.issue_date || null,
      due_date: form.due_date || null,
      currency: form.currency,
      line_items: form.line_items.filter((li) => li.description.trim()),
      tax_rate: form.tax_rate,
      notes: form.notes.trim() || null,
      brand_color: form.brand_color || null,
      payment_fields: form.payment_fields,
    }
    if (form.id) {
      updateRow('invoices', form.id, data)
      toast.success('Invoice updated')
    } else {
      const created = createRow<Invoice>('invoices', data)
      setForm((f) => ({ ...f, id: created.id }))
      toast.success('Invoice saved')
    }
  }

  async function exportPdf() {
    if (!previewRef.current) return
    setExporting(true)
    try {
      await exportElementToPdf(previewRef.current, `Invoice-${form.number || 'draft'}.pdf`)
    } catch {
      toast.error('Could not export PDF', { description: 'Try again in a moment.' })
    } finally {
      setExporting(false)
    }
  }

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Invoices" description="Generate branded, exportable invoices." />
        <EmptyState icon={Receipt} title="Admins only" description="Invoice generation isn't available on your account." />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Invoice maker"
        description="Build a branded invoice and export it to PDF."
        actions={
          <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
            <Settings strokeWidth={1.75} />
            Business settings
          </Button>
        }
      />

      {!ready ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          {/* ---- Left: builder form ---- */}
          <div className="min-w-0 space-y-4">
            <div className="rounded-xl border bg-surface p-4 shadow-sm">
              <div className="divide-y">
                <FormSection title="Client & details">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Client" className="sm:col-span-2">
                      <Select
                        value={form.client_id || undefined}
                        onChange={selectClient}
                        options={clientOptions}
                        placeholder="Select a client"
                      />
                    </Field>
                    <Field label="Invoice number">
                      <Input value={form.number} onChange={(e) => set('number', e.target.value)} placeholder="e.g. NW-01" />
                    </Field>
                    <Field label="Currency">
                      <Select value={form.currency} onChange={(v) => set('currency', v)} options={currencyOptions} />
                    </Field>
                    <Field label="Issue date">
                      <DatePicker value={form.issue_date} onChange={(v) => set('issue_date', v)} />
                    </Field>
                    <Field label="Due date">
                      <DatePicker value={form.due_date} onChange={(v) => set('due_date', v)} />
                    </Field>
                  </div>
                </FormSection>

                <FormSection title="Line items">
                  <div className="space-y-2">
                    {form.line_items.map((li, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Input
                          value={li.description}
                          onChange={(e) => setLineItem(i, { description: e.target.value })}
                          placeholder="Description"
                          className="flex-1"
                        />
                        <Input
                          inputMode="decimal"
                          value={li.price || ''}
                          onChange={(e) => setLineItem(i, { price: Number(e.target.value) || 0 })}
                          placeholder="Price"
                          className="tnum w-20"
                        />
                        <Input
                          inputMode="numeric"
                          value={li.qty || ''}
                          onChange={(e) => setLineItem(i, { qty: Number(e.target.value) || 1 })}
                          placeholder="Qty"
                          className="tnum w-14"
                        />
                        <Button variant="ghost" size="iconSm" aria-label="Remove line" onClick={() => removeLineItem(i)}>
                          <X strokeWidth={1.75} />
                        </Button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={addLineItem}>
                        <Plus strokeWidth={1.75} />
                        Add line
                      </Button>
                      {clientProjects.length > 0 && (
                        <Button type="button" variant="secondary" size="sm" onClick={() => setLoadProjectsOpen(true)}>
                          <FileText strokeWidth={1.75} />
                          Load from projects
                        </Button>
                      )}
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Totals & notes">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Payment method" hint={paymentProfiles.length === 0 ? 'Add one in Business settings.' : undefined}>
                      <Select
                        value={form.payment_profile_id}
                        onChange={selectPaymentMethod}
                        options={paymentMethodOptions}
                        disabled={paymentProfiles.length === 0}
                      />
                    </Field>
                    <Field label="Tax rate (%)">
                      <Input
                        inputMode="decimal"
                        value={form.tax_rate || ''}
                        onChange={(e) => set('tax_rate', Number(e.target.value) || 0)}
                        className="tnum"
                      />
                    </Field>
                    <Field label="Brand color">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={form.brand_color}
                          onChange={(e) => set('brand_color', e.target.value)}
                          className="size-9 shrink-0 cursor-pointer rounded-lg border bg-surface p-1"
                          aria-label="Brand color"
                        />
                        <Input value={form.brand_color} onChange={(e) => set('brand_color', e.target.value)} className="w-full uppercase" />
                      </div>
                    </Field>
                    <Field label="Note" className="sm:col-span-2">
                      <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
                    </Field>
                  </div>
                </FormSection>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" variant="secondary" onClick={save}>
                {form.id ? 'Save changes' : 'Save invoice'}
              </Button>
              <Button className="flex-1" onClick={exportPdf} disabled={exporting}>
                {exporting ? <Loader2 className="animate-spin" strokeWidth={1.75} /> : <FileText strokeWidth={1.75} />}
                Export PDF
              </Button>
            </div>

            {invoices.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent invoices
                </h3>
                <ul className="divide-y rounded-xl border bg-surface shadow-sm">
                  {invoices.slice(0, 8).map((inv) => {
                    const c = clients.find((cl) => cl.id === inv.client_id)
                    const total = inv.line_items.reduce((s, li) => s + li.price * li.qty, 0) * (1 + inv.tax_rate / 100)
                    return (
                      <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <button type="button" onClick={() => loadFromInvoice(inv)} className="min-w-0 flex-1 cursor-pointer text-left">
                          <p className="truncate text-sm font-medium">
                            {inv.number} · {c ? clientDisplayName(c) : 'Unknown client'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(inv.issue_date)} · {formatMoney(total, inv.currency)}
                          </p>
                        </button>
                        <Button variant="ghost" size="iconSm" aria-label="Delete invoice" onClick={() => setDeleting(inv)}>
                          <Trash2 strokeWidth={1.75} />
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* ---- Right: live preview ---- */}
          <div className="min-w-0 overflow-x-auto rounded-xl border bg-surface-hover p-6 shadow-sm sm:p-10">
            {/* The shadow lives on this wrapper, not the page itself, so html2canvas never
                bakes it into the exported PDF. */}
            <div className="mx-auto w-fit rounded-sm shadow-xl">
              <InvoicePreview
                ref={previewRef}
                number={form.number}
                issueDate={form.issue_date}
                dueDate={form.due_date}
                currency={form.currency}
                lineItems={form.line_items}
                taxRate={form.tax_rate}
                notes={form.notes}
                brandColor={form.brand_color}
                client={client}
                settings={invoiceSettings}
                paymentFields={form.payment_fields}
              />
            </div>
          </div>
        </div>
      )}

      <InvoiceSettingsModal
        key={settingsOpen ? 'open' : 'closed'}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <Modal
        open={loadProjectsOpen}
        onClose={() => setLoadProjectsOpen(false)}
        title="Load from projects"
        description="Adds each picked project as a line item."
        footer={<Button onClick={() => setLoadProjectsOpen(false)}>Done</Button>}
      >
        <div className="space-y-1.5">
          {clientProjects.map((p) => {
            const already = form.line_items.some((li) => li.description === p.title)
            return (
              <CheckboxRow
                key={p.id}
                checked={already}
                onChange={(on) => {
                  if (on && !already) {
                    set('line_items', [...form.line_items, { description: p.title, price: p.amount, qty: 1 }])
                  } else if (!on) {
                    set('line_items', form.line_items.filter((li) => li.description !== p.title))
                  }
                }}
                label={p.title}
                sublabel={formatMoney(p.amount, p.currency)}
              />
            )
          })}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(undefined)}
        onConfirm={() => {
          if (!deleting) return
          deleteRow('invoices', deleting.id)
          if (form.id === deleting.id) setForm(emptyForm())
        }}
        title={`Delete invoice ${deleting?.number}?`}
        description="This removes the saved invoice record. The client isn't notified."
      />
    </>
  )
}
