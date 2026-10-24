import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { addDays, format, parseISO } from 'date-fns'
import { Download, Folder, Loader2, Plus, Settings, X } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { Topbar, Empty, Section } from '@/components/ui/layout'
import { Field } from '@/components/ui/field'
import { StatusPill } from '@/components/ui/pill'
import { Modal } from '@/components/ui/modal'
import { InvoicePaper } from '@/features/invoices/InvoicePaper'
import { invoiceTotal } from '@/features/invoices/InvoicesPage'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { exportElementToPdf, invoiceFilename } from '@/lib/pdf'
import { clientColor, clientDisplayName, effectivePaymentStatus, isOpenPayment } from '@/lib/derive'
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

type Track = 'none' | 'new' | string

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

  const linked = existing ? payments.find((p) => p.invoice_id === existing.id) : undefined
  const clientOpen = payments.filter((p) => p.client_id === f.client_id && isOpenPayment(p) && !p.invoice_id)
  const [track, setTrack] = useState<Track>('new')
  useEffect(() => {
    if (linked) setTrack(linked.id)
    else if (isNew) {
      // Prefer an open payment that covers the projects being invoiced.
      const fromProjects = (params.get('projects') ?? '').split(',').filter(Boolean)
      const match = clientOpen.find((p) => fromProjects.length && fromProjects.every((pid) => p.project_ids.includes(pid)))
      setTrack(match?.id ?? 'new')
    } else setTrack('none')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, f.client_id])

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
    if (invoices.some((i) => i.number.trim() === f.number.trim() && i.id !== existing?.id)) return toast.error(`Invoice ${f.number} already exists`)
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

    // Payment tracking: link an existing open payment, create a new one, or unlink.
    const invTotal = invoiceTotal(data)
    const projectIds = projects.filter((p) => p.client_id === f.client_id && items.some((li) => li.description === p.title.trim())).map((p) => p.id)
    const amount = Math.round(invTotal * 100) / 100
    if (linked && track !== linked.id) updateRow('payments', linked.id, { invoice_id: null })
    if (track === 'new' && amount > 0) {
      const created = createRow<Payment>('payments', { client_id: f.client_id, project_ids: projectIds, amount, currency: f.currency, status: 'unpaid', due_date: data.due_date, invoice_id: invId, notes: `Invoice ${data.number}` }, {
        entity: 'payment', action: 'created', message: `created a payment for invoice ${data.number}`,
      })
      setTrack(created.id)
    } else if (track !== 'none' && track !== 'new' && track !== linked?.id) {
      updateRow('payments', track, { invoice_id: invId, due_date: data.due_date })
    } else if (linked && track === linked.id && linked.status !== 'paid') {
      // Keep the open payment in step with the invoice amount and due date.
      updateRow('payments', linked.id, { amount, currency: f.currency, due_date: data.due_date })
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

  if (!isNew && !existing) {
    return (
      <>
        <Topbar crumbs={[{ label: 'Invoices', to: '/invoices' }, { label: 'Not found' }]} />
        <div className="content"><div className="card"><Empty title="Invoice not found" /></div></div>
      </>
    )
  }

  const linkedStatus = linked ? effectivePaymentStatus(linked) : null

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
              <Field label="Track payment" hint={linked ? `Linked payment: ${paymentStatus[linkedStatus!].label}${linked.payment_date ? ` · paid ${formatDate(linked.payment_date)}` : ''}` : 'Links this invoice to a payment so its status shows as paid/unpaid.'}>
                <select className="inp" value={track} onChange={(e) => setTrack(e.target.value)}>
                  {linked && <option value={linked.id}>Linked payment · {formatMoney(linked.amount, linked.currency)}</option>}
                  {!linked && <option value="new">Create a payment for {formatMoney(total, f.currency)}</option>}
                  {clientOpen.map((p) => <option key={p.id} value={p.id}>Open payment · {formatMoney(p.amount, p.currency)}{p.due_date ? ` · due ${formatDate(p.due_date)}` : ''}</option>)}
                  <option value="none">Don’t track</option>
                </select>
              </Field>
            </Section>
          </form>
          <div className="col-main" style={{ flex: '2 1 520px' }}>
            <div className="paper-wrap">
              <InvoicePaper {...paperProps} />
            </div>
          </div>
        </div>
      </div>
      {/* Fixed-width copy for a crisp A4 PDF regardless of screen size. */}
      {createPortal(
        <div style={{ position: 'fixed', left: -10000, top: 0, width: 794 }} aria-hidden>
          <InvoicePaper ref={exportRef} {...paperProps} />
        </div>,
        document.body,
      )}
      <ProjectPicker
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        clientId={f.client_id}
        onAdd={(items, currency) => {
          setF((s) => ({ ...s, currency: s.line_items.some((li) => li.description.trim()) ? s.currency : currency ?? s.currency, line_items: [...s.line_items.filter((li) => li.description.trim() || Number(li.price)), ...items] }))
        }}
      />
    </>
  )
}

function ProjectPicker({ open, onClose, clientId, onAdd }: { open: boolean; onClose: () => void; clientId: string; onAdd: (items: InvoiceLineItem[], currency?: string) => void }) {
  const { projects, invoices } = useData()
  const [sel, setSel] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (open) setSel(new Set())
  }, [open])
  const list = projects
    .filter((p) => p.client_id === clientId)
    .sort((a, b) => Number(b.status === 'completed') - Number(a.status === 'completed') || (b.due_date ?? '').localeCompare(a.due_date ?? ''))
  const invoiced = (title: string) => invoices.some((i) => i.client_id === clientId && i.line_items.some((li) => li.description.trim() === title.trim()))
  const add = () => {
    const chosen = list.filter((p) => sel.has(p.id))
    onAdd(chosen.map((p) => ({ description: p.title, price: Number(p.amount) || 0, qty: 1 })), chosen[0]?.currency)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Add from projects" footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn btn-pri" disabled={!sel.size} onClick={add}>Add {sel.size || ''} line{sel.size === 1 ? '' : 's'}</button></>}>
      <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
        {list.length === 0 && <div className="empty sm"><p>This client has no projects.</p></div>}
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
              <span className="xs muted">{p.status === 'completed' || p.status === 'finished' ? 'Completed' : 'In progress'}{invoiced(p.title) ? ' · already invoiced' : ''}</span>
            </span>
            <span className="num small m">{p.amount ? formatMoney(p.amount, p.currency) : '—'}</span>
          </label>
        ))}
      </div>
    </Modal>
  )
}
