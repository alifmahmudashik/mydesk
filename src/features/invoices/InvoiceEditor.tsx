import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { addDays, format, parseISO } from 'date-fns'
import { Check, Download, Folder, Loader2, Plus, Settings, X } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { markInvoicePaid } from '@/data/actions'
import { celebrateFrom } from '@/lib/confetti'
import { Topbar, Empty, Section } from '@/components/ui/layout'
import { Field } from '@/components/ui/field'
import { StatusPill } from '@/components/ui/pill'
import { Modal } from '@/components/ui/modal'
import { A4_WIDTH, InvoicePaper, ScaledInvoice } from '@/features/invoices/InvoicePaper'
import { invoiceTotal } from '@/features/invoices/InvoicesPage'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { exportElementToPdf, invoiceFilename } from '@/lib/pdf'
import { clientColor, clientDisplayName, effectivePaymentStatus, invoicePaymentStatus, isInvoiceable } from '@/lib/derive'
import { formatDate, formatMoney, todayISO } from '@/lib/format'
import { paymentStatus, paymentTerms } from '@/lib/status'
import type { Client, Invoice, InvoiceLineItem, Payment } from '@/types'

const COLORS = ['#4F46E5', '#DB2777', '#0284C7', '#0D9488', '#0F0F14']

function suggestNumber(client: Client | undefined, invoices: Invoice[]) {
  if (!client) return ''
  const letters = clientDisplayName(client).replace(/[^a-zA-Z]/g, '')
  const prefix = (letters.slice(0, 2) || 'IN').toUpperCase()
  const used = invoices.filter((i) => i.number.startsWith(`${prefix}-`)).map((i) => Number(i.number.split('-')[1]) || 0)
  return `${prefix}-${String((used.length ? Math.max(...used) : 0) + 1).padStart(2, '0')}`
}


export function InvoiceEditor() {
  const { id = 'new' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { invoices, clients, projects, payments, invoiceSettings, createRow, updateRow } = useData()
  const existing = invoices.find((i) => i.id === id)
  const isNew = id === 'new'
  const exportRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [pickOpen, setPickOpen] = useState(false)

  const initial = useMemo(() => {
    const profiles = invoiceSettings?.payment_profiles ?? []
    if (existing) {
      return {
        client_id: existing.client_id,
        number: existing.number,
        currency: existing.currency,
        issue_date: existing.issue_date ?? todayISO(),
        due_date: existing.due_date ?? '',
        line_items: existing.line_items,
        tax_rate: String(existing.tax_rate ?? 0),
        notes: existing.notes ?? '',
        brand_color: existing.brand_color ?? '#4F46E5',
        payment_profile_id: existing.payment_profile_id ?? 'none',
        payment_fields: existing.payment_fields ?? [],
      }
    }
    const client = clients.find((c) => c.id === params.get('client')) ?? clients.find((c) => c.status !== 'archived')
    const terms = paymentTerms.find((t) => t.value === client?.payment_terms)?.days ?? invoiceSettings?.default_due_days ?? 7
    const fromProjects = (params.get('projects') ?? '').split(',').filter(Boolean)
    const items: InvoiceLineItem[] = projects.filter((p) => fromProjects.includes(p.id)).map((p) => ({ description: p.title, price: Number(p.amount) || 0, qty: 1 }))
    const defaultProfile = profiles[0]
    return {
      client_id: client?.id ?? '',
      number: suggestNumber(client, invoices),
      currency: (fromProjects.length && projects.find((p) => p.id === fromProjects[0])?.currency) || client?.default_currency || invoiceSettings?.default_currency || 'USD',
      issue_date: todayISO(),
      due_date: format(addDays(new Date(), terms), 'yyyy-MM-dd'),
      line_items: items.length ? items : [{ description: '', price: 0, qty: 1 }],
      tax_rate: String(invoiceSettings?.default_tax ?? 0),
      notes: invoiceSettings?.default_note ?? '',
      brand_color: client ? clientColor(client) : invoiceSettings?.brand_color ?? '#4F46E5',
      payment_profile_id: defaultProfile?.id ?? 'none',
      payment_fields: defaultProfile?.fields ?? [],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, isNew])

  const [f, setF] = useState(initial)
  useEffect(() => setF(initial), [initial])

  // Payment tracking. Projects already have their own payment (created with the project),
  // so an invoice made from projects links to those payments instead of creating new ones.
  const linkedPayments = existing ? payments.filter((p) => p.invoice_id === existing.id) : []
  const projectIdsOnInvoice = projects
    .filter((p) => p.client_id === f.client_id && f.line_items.some((li) => li.description.trim() && li.description.trim() === p.title.trim()))
    .map((p) => p.id)
  const projectPayments = payments.filter(
    (p) =>
      p.client_id === f.client_id &&
      p.project_ids?.some((id) => projectIdsOnInvoice.includes(id)) &&
      // Never take over a payment that already belongs to a different invoice.
      (!p.invoice_id || p.invoice_id === existing?.id),
  )
  const [track, setTrack] = useState(true)
  useEffect(() => {
    setTrack(existing ? linkedPayments.length > 0 : true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id])

  const client = clients.find((c) => c.id === f.client_id)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))
  const setLine = (i: number, patch: Partial<InvoiceLineItem>) => set('line_items', f.line_items.map((li, idx) => (idx === i ? { ...li, ...patch } : li)))
  const profiles = invoiceSettings?.payment_profiles ?? []
  const total = invoiceTotal({ line_items: f.line_items, tax_rate: Number(f.tax_rate) || 0 })
  const paperProps = {
    number: f.number,
    issueDate: f.issue_date,
    dueDate: f.due_date,
    currency: f.currency,
    lineItems: f.line_items.filter((li) => li.description.trim() || li.price),
    taxRate: Number(f.tax_rate) || 0,
    notes: f.notes,
    brandColor: f.brand_color,
    client,
    settings: invoiceSettings,
    paymentFields: f.payment_fields,
    paymentName: profiles.find((p) => p.id === f.payment_profile_id)?.name,
  }

  const pickClient = (cid: string) => {
    const c = clients.find((x) => x.id === cid)
    const terms = paymentTerms.find((t) => t.value === c?.payment_terms)?.days
    setF((s) => ({
      ...s,
      client_id: cid,
      brand_color: c ? clientColor(c) : s.brand_color,
      currency: isNew ? c?.default_currency ?? s.currency : s.currency,
      number: isNew ? suggestNumber(c, invoices) : s.number,
      due_date: isNew && terms !== undefined ? format(addDays(parseISO(s.issue_date || todayISO()), terms), 'yyyy-MM-dd') : s.due_date,
    }))
  }

  const pickProfile = (pid: string) => {
    const p = profiles.find((x) => x.id === pid)
    setF((s) => ({ ...s, payment_profile_id: pid, payment_fields: p ? p.fields : [] }))
  }

  const save = () => {
    if (!f.client_id) return toast.error('Pick a client first')
    if (!f.number.trim()) return toast.error('Give the invoice a number')
    // Only check for a clash when the number is new or was changed. Older data can hold
    // duplicate numbers, and that must not block saving an existing invoice.
    const numberChanged = !existing || existing.number.trim() !== f.number.trim()
    if (numberChanged && invoices.some((i) => i.number.trim() === f.number.trim() && i.id !== existing?.id)) return toast.error(`Invoice ${f.number} already exists`)
    const items = f.line_items.filter((li) => li.description.trim() || Number(li.price)).map((li) => ({ description: li.description.trim(), price: Number(li.price) || 0, qty: Number(li.qty) || 1 }))
    const data = {
      client_id: f.client_id,
      number: f.number.trim(),
      issue_date: f.issue_date || null,
      due_date: f.due_date || null,
      currency: f.currency,
      line_items: items,
      tax_rate: Number(f.tax_rate) || 0,
      notes: f.notes.trim() || null,
      brand_color: f.brand_color || null,
      payment_fields: f.payment_fields,
      payment_profile_id: f.payment_profile_id === 'none' ? null : f.payment_profile_id,
    }
    let invId = existing?.id
    if (existing) {
      updateRow('invoices', existing.id, data, { entity: 'invoice', entityId: existing.id, action: 'updated', message: `updated invoice ${data.number}` })
    } else {
      invId = createRow<Invoice>('invoices', data, { entity: 'invoice', action: 'created', message: `created invoice ${data.number} for ${clientDisplayName(client)}` }).id
    }

    // Payment tracking.
    const amount = Math.round(invoiceTotal(data) * 100) / 100
    if (!track) {
      for (const p of linkedPayments) updateRow('payments', p.id, { invoice_id: null })
    } else if (projectPayments.length > 0) {
      // Link the projects' own payments; unlink anything else that was linked before.
      for (const p of linkedPayments) if (!projectPayments.includes(p)) updateRow('payments', p.id, { invoice_id: null })
      for (const p of projectPayments) {
        const patch: Record<string, unknown> = {}
        if (p.invoice_id !== invId) patch.invoice_id = invId
        // Open payments follow the invoice's due date, so "overdue" matches what the client was sent.
        if (p.status !== 'paid' && p.status !== 'refunded' && data.due_date && p.due_date !== data.due_date) patch.due_date = data.due_date
        if (Object.keys(patch).length) updateRow('payments', p.id, patch)
      }
    } else if (linkedPayments.length === 1 && linkedPayments[0].status !== 'paid') {
      // A payment this invoice created earlier: keep it in step with the invoice.
      updateRow('payments', linkedPayments[0].id, { amount, currency: f.currency, due_date: data.due_date })
    } else if (linkedPayments.length === 0 && amount > 0) {
      // Not based on projects (e.g. hourly work): create a payment for the invoice total.
      createRow<Payment>('payments', { client_id: f.client_id, project_ids: [], amount, currency: f.currency, status: 'unpaid', due_date: data.due_date, invoice_id: invId, notes: `Invoice ${data.number}` }, {
        entity: 'payment', action: 'created', message: `created a payment for invoice ${data.number}`,
      })
    }
    toast.success(existing ? 'Invoice saved' : 'Invoice created')
    if (!existing && invId) navigate(`/invoices/${invId}`, { replace: true })
  }

  const exportPdf = async () => {
    if (!exportRef.current) return
    setExporting(true)
    try {
      await exportElementToPdf(exportRef.current, invoiceFilename([invoiceSettings?.business_name, client ? clientDisplayName(client) : null, 'invoice', f.issue_date ? formatDate(f.issue_date) : null], `Invoice-${f.number || 'draft'}`))
    } catch (err) {
      toast.error('Export failed', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setExporting(false)
    }
  }

  // ?export=1 (from the list's download button) exports right away.
  useEffect(() => {
    if (params.get('export') && existing) {
      const t = setTimeout(() => {
        void exportPdf().then(() => {
          params.delete('export')
          setParams(params, { replace: true })
        })
      }, 400)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id])

  function trackHint() {
    if (!track) return 'Not linked to a payment, so its status won’t show as paid or unpaid.'
    if (projectPayments.length > 0) {
      const sum = projectPayments.reduce((t, p) => t + Number(p.amount), 0)
      const paid = projectPayments.filter((p) => p.status === 'paid').length
      const mismatch = Math.abs(sum - total) > 0.009 && projectPayments.every((p) => p.currency === f.currency)
      const which = projectPayments.length === 1 ? 'the project’s payment' : `the ${projectPayments.length} projects’ payments`
      return `Linked to ${which} (${formatMoney(sum, projectPayments[0].currency)}${paid ? `, ${paid} paid` : ''}). No new payment is created.${mismatch ? ` Note: the invoice total is ${formatMoney(total, f.currency)}.` : ''}`
    }
    if (linkedPayments.length > 0) return `Linked payment: ${formatMoney(linkedPayments[0].amount, linkedPayments[0].currency)} · ${paymentStatus[effectivePaymentStatus(linkedPayments[0])].label}`
    return total > 0 ? `A payment of ${formatMoney(total, f.currency)} is created when you save, so you can track when it’s paid.` : 'Add amounts to the line items. A payment is created when you save.'
  }

  if (!isNew && !existing) {
    return (
      <>
        <Topbar crumbs={[{ label: 'Invoices', to: '/invoices' }, { label: 'Not found' }]} />
        <div className="content"><div className="card"><Empty title="Invoice not found" /></div></div>
      </>
    )
  }

  const linkedStatus = existing ? invoicePaymentStatus(existing.id, payments) : null

  return (
    <>
      <Topbar
        crumbs={[
          { label: 'Invoices', to: '/invoices' },
          { label: <span className="row-sm"><span className="mono" style={{ fontSize: 12.5 }}>{f.number || 'New invoice'}</span>{linkedStatus && <StatusPill meta={paymentStatus[linkedStatus]} />}</span> },
        ]}
      >
        <Link className="btn hide-sm" to="/settings"><Settings className="i" />Business settings</Link>
        <button type="button" className="btn" onClick={() => void exportPdf()} disabled={exporting}>
          {exporting ? <Loader2 className="i" style={{ animation: 'spin 1s linear infinite' }} /> : <Download className="i" />}Export PDF
        </button>
        {existing && linkedStatus !== 'paid' && (
          <button type="button" className="btn" onClick={(e) => { markInvoicePaid(existing); celebrateFrom(e.currentTarget) }}>
            <Check className="i" />Mark as paid
          </button>
        )}
        <button type="button" className="btn btn-pri" onClick={save}>Save invoice</button>
      </Topbar>
      <div className="content full" style={{ maxWidth: 1320 }}>
        {!invoiceSettings?.business_name && (
          <div className="card card-b row" style={{ background: 'var(--warn-bg)', borderColor: 'transparent' }}>
            <span className="small grow" style={{ color: 'var(--warn)' }}>Add your business name, address and payment details once, and every invoice uses them.</span>
            <Link className="btn btn-sm" to="/settings">Open business settings</Link>
          </div>
        )}
        <div className="cols">
          <form className="col-side" style={{ flex: '1 1 380px', maxWidth: 460, gap: 16 }} onSubmit={(e) => { e.preventDefault(); save() }}>
            <Section title="Client & details">
              <Field label="Client">
                <select className="inp" value={f.client_id} onChange={(e) => pickClient(e.target.value)}>
                  <option value="">Select a client…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{clientDisplayName(c)}{c.status === 'archived' ? ' (archived)' : ''}</option>)}
                </select>
              </Field>
              <div className="f2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <Field label="Invoice number"><input className="inp mono" value={f.number} onChange={(e) => set('number', e.target.value)} /></Field>
                <Field label="Currency">
                  <select className="inp" value={f.currency} onChange={(e) => set('currency', e.target.value)}>
                    {SUPPORTED_CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Issue date"><input className="inp" type="date" value={f.issue_date} onChange={(e) => set('issue_date', e.target.value)} /></Field>
                <Field label="Due date"><input className="inp" type="date" value={f.due_date} onChange={(e) => set('due_date', e.target.value)} /></Field>
              </div>
            </Section>

            <Section title="Line items">
              <div className="line-item xs muted m"><span>Description</span><span>Price</span><span>Qty</span><span className="r">Total</span><span /></div>
              {f.line_items.map((li, i) => (
                <div className="line-item" key={i} style={{ marginTop: -8 }}>
                  <input className="inp sm" value={li.description} aria-label="Description" placeholder="What you did" onChange={(e) => setLine(i, { description: e.target.value })} />
                  <input className="inp sm num" value={li.price || ''} placeholder="0.00" aria-label="Price" inputMode="decimal" onChange={(e) => setLine(i, { price: e.target.value as unknown as number })} />
                  <input className="inp sm num" value={li.qty} aria-label="Qty" inputMode="decimal" onChange={(e) => setLine(i, { qty: e.target.value as unknown as number })} />
                  <span className="r num m small">{formatMoney((Number(li.price) || 0) * (Number(li.qty) || 0), f.currency, { cents: true })}</span>
                  <button className="btn btn-ghost btn-sm btn-icon" type="button" aria-label="Remove line" onClick={() => set('line_items', f.line_items.filter((_, idx) => idx !== i))}><X className="i" /></button>
                </div>
              ))}
              <div className="row-sm" style={{ marginTop: -4 }}>
                <button className="btn btn-sm" type="button" onClick={() => set('line_items', [...f.line_items, { description: '', price: 0, qty: 1 }])}><Plus className="i i-sm" />Add line</button>
                <button className="btn btn-sm btn-ghost" type="button" disabled={!f.client_id} onClick={() => setPickOpen(true)}><Folder className="i i-sm" />Add from projects</button>
              </div>
            </Section>

            <Section title="Totals & notes">
              <div className="f2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <Field label="Payment method">
                  <select className="inp" value={f.payment_profile_id} onChange={(e) => pickProfile(e.target.value)}>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.name || 'Untitled'}</option>)}
                    <option value="none">None</option>
                  </select>
                </Field>
                <Field label="Tax rate">
                  <span className="prefix"><span>%</span><input className="inp" inputMode="decimal" value={f.tax_rate} onChange={(e) => set('tax_rate', e.target.value.replace(/[^\d.]/g, ''))} /></span>
                </Field>
              </div>
              <div className="field">
                <span className="lbl">Brand color</span>
                <div className="row wrap">
                  <div className="swatches">
                    {[...new Set([client ? clientColor(client) : null, ...COLORS].filter(Boolean) as string[])].map((c) => (
                      <input key={c} className="swatch" type="radio" name="ivc" style={{ ['--c' as string]: c }} checked={f.brand_color.toLowerCase() === c.toLowerCase()} onChange={() => set('brand_color', c)} aria-label={c} />
                    ))}
                  </div>
                  <input type="color" className="swatch-input" value={/^#[0-9a-f]{6}$/i.test(f.brand_color) ? f.brand_color : '#4F46E5'} onChange={(e) => set('brand_color', e.target.value)} aria-label="Custom color" />
                </div>
              </div>
              <Field label="Note"><textarea className="inp" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
              <div className="field">
                <label className="row-sm" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" className="cb" checked={track} onChange={(e) => setTrack(e.target.checked)} />
                  <span className="lbl">Track payment for this invoice</span>
                </label>
                <span className="hint">{trackHint()}</span>
              </div>
            </Section>
          </form>
          <div className="col-main" style={{ flex: '2 1 520px' }}>
            <div className="paper-wrap">
              <ScaledInvoice {...paperProps} />
            </div>
          </div>
        </div>
      </div>
      {/* Fixed-width copy for a crisp A4 PDF regardless of screen size. */}
      {createPortal(
        <div style={{ position: 'fixed', left: -10000, top: 0, width: A4_WIDTH }} aria-hidden>
          <InvoicePaper ref={exportRef} {...paperProps} />
        </div>,
        document.body,
      )}
      <ProjectPicker
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        clientId={f.client_id}
        exclude={f.line_items.map((li) => li.description.trim()).filter(Boolean)}
        onAdd={(items, currency) => {
          setF((s) => ({ ...s, currency: s.line_items.some((li) => li.description.trim()) ? s.currency : currency ?? s.currency, line_items: [...s.line_items.filter((li) => li.description.trim() || Number(li.price)), ...items] }))
        }}
      />
    </>
  )
}

function ProjectPicker({ open, onClose, clientId, onAdd, exclude }: { open: boolean; onClose: () => void; clientId: string; onAdd: (items: InvoiceLineItem[], currency?: string) => void; exclude: string[] }) {
  const { projects, invoices, payments } = useData()
  const [sel, setSel] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (open) setSel(new Set())
  }, [open])
  // Only projects marked Completed that aren't invoiced yet. In progress isn't done; Finished is already paid.
  const list = projects
    .filter((p) => p.client_id === clientId && isInvoiceable(p, invoices, payments) && !exclude.includes(p.title.trim()))
    .sort((a, b) => (b.completed_at ?? b.due_date ?? '').localeCompare(a.completed_at ?? a.due_date ?? ''))
  const add = () => {
    const chosen = list.filter((p) => sel.has(p.id))
    onAdd(chosen.map((p) => ({ description: p.title, price: Number(p.amount) || 0, qty: 1 })), chosen[0]?.currency)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Add from projects" note="Completed projects that aren’t invoiced yet" footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn btn-pri" disabled={!sel.size} onClick={add}>Add {sel.size || ''} line{sel.size === 1 ? '' : 's'}</button></>}>
      <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
        {list.length === 0 && (
          <div className="empty sm">
            <b>Nothing to invoice</b>
            <p>Mark a project as Completed when the work is done and it shows up here.</p>
          </div>
        )}
        {list.map((p) => (
          <label key={p.id} className="check-row">
            <input
              type="checkbox"
              className="cb"
              checked={sel.has(p.id)}
              onChange={(e) =>
                setSel((s) => {
                  const n = new Set(s)
                  if (e.target.checked) n.add(p.id)
                  else n.delete(p.id)
                  return n
                })
              }
            />
            <span className="txt">
              <span className="m" style={{ display: 'block' }}>{p.title}</span>
              <span className="xs muted">Completed{p.completed_at ? ` ${formatDate(p.completed_at.slice(0, 10))}` : p.due_date ? ` · due ${formatDate(p.due_date)}` : ''}</span>
            </span>
            <span className="num small m">{p.amount ? formatMoney(p.amount, p.currency) : '—'}</span>
          </label>
        ))}
      </div>
    </Modal>
  )
}
