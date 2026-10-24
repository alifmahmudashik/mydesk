import { useEffect, useMemo, useRef, useState } from 'react'
import { CurrencySelect } from '@/components/ui/currency-picker'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Archive, Edit3, FileText, Image, Mail, Plus, Trash2, User, X } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { supabase } from '@/lib/supabase'
import { Topbar, Content, Empty, Section, SaveBar } from '@/components/ui/layout'
import { SettingsLayout, useUnsavedGuard } from '@/components/ui/settings-layout'
import { Field, ToggleRow } from '@/components/ui/field'
import { ClientMark } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/ui/modal'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { COUNTRIES } from '@/lib/geo'
import { clientColor, clientDisplayName } from '@/lib/derive'
import { paymentTerms } from '@/lib/status'
import type { ClientStatus, InvoiceField } from '@/types'

const COLORS = ['#4F46E5', '#8B5CF6', '#0284C7', '#0D9488', '#16A34A', '#D97706', '#E11D48', '#475569']
const ALL_TZ: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')
  } catch {
    return [...new Set(COUNTRIES.map((c) => c.timezone))].sort()
  }
})()

export function ClientSettingsPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { clients, projects, invoices, updateRow, deleteRow } = useData()
  const client = clients.find((c) => c.id === id)

  const initial = useMemo(
    () =>
      client && {
        name: client.name,
        company_name: client.company_name ?? '',
        use_company_name: Boolean(client.use_company_name),
        status: client.status,
        pinned: Boolean(client.pinned),
        email: client.email ?? '',
        phone: client.phone ?? '',
        website: client.website ?? '',
        country: client.country ?? '',
        timezone: client.timezone ?? '',
        company_address: client.company_address ?? '',
        default_currency: client.default_currency ?? 'USD',
        payment_terms: client.payment_terms ?? 'net_7',
        brand_color: clientColor(client),
        logo_url: client.logo_url ?? null,
        invoice_fields: client.invoice_fields ?? [],
        notes: client.notes ?? '',
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client?.id],
  )
  const [f, setF] = useState(initial)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [uploading, setUploading] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)
  useEffect(() => setF(initial), [initial])

  const dirty = JSON.stringify(f) !== JSON.stringify(initial)
  useUnsavedGuard(dirty)

  if (!client || !f) {
    return (
      <>
        <Topbar crumbs={[{ label: 'Clients', to: '/clients' }, { label: 'Not found' }]} />
        <Content><div className="card"><Empty title="Client not found" /></div></Content>
      </>
    )
  }

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => (s ? { ...s, [k]: v } : s))
  const setField = (i: number, patch: Partial<InvoiceField>) => set('invoice_fields', f.invoice_fields.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))

  const save = () => {
    if (!f.name.trim()) return toast.error('Contact name is required')
    updateRow(
      'clients',
      client.id,
      {
        name: f.name.trim(),
        company_name: f.company_name.trim() || null,
        use_company_name: f.use_company_name && Boolean(f.company_name.trim()),
        status: f.status,
        pinned: f.pinned,
        email: f.email.trim() || null,
        phone: f.phone.trim() || null,
        website: f.website.trim() || null,
        country: f.country || null,
        timezone: f.timezone || null,
        company_address: f.company_address.trim() || null,
        default_currency: f.default_currency,
        payment_terms: f.payment_terms,
        brand_color: /^#[0-9a-f]{6}$/i.test(f.brand_color) ? f.brand_color : client.brand_color,
        invoice_fields: f.invoice_fields.filter((x) => x.label.trim() || x.value.trim()),
        notes: f.notes.trim() || null,
        // Only send the logo when it changed, so saving still works before the logo_url column exists.
        ...(f.logo_url !== (client.logo_url ?? null) ? { logo_url: f.logo_url } : {}),
      },
      { entity: 'client', entityId: client.id, action: 'updated', message: `updated client ${f.name.trim()}` },
    )
    toast.success('Client saved')
    navigate(`/clients/${client.id}`)
  }

  const uploadLogo = async (file: File) => {
    if (!file.type.startsWith('image/')) return toast.error('Pick a PNG, JPG, WebP or SVG image')
    if (file.size > 2 * 1024 * 1024) return toast.error('Logos must be under 2 MB')
    if (!supabase) {
      // Demo mode: keep it in memory.
      const reader = new FileReader()
      reader.onload = () => set('logo_url', String(reader.result))
      reader.readAsDataURL(file)
      return
    }
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `clients/${client.id}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, cacheControl: '31536000' })
    setUploading(false)
    if (error) return toast.error('Upload failed', { description: error.message })
    set('logo_url', supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl)
  }

  const archive = () => {
    updateRow('clients', client.id, { status: 'archived', pinned: false }, { entity: 'client', entityId: client.id, action: 'updated', message: `archived client ${clientDisplayName(client)}` })
    toast.success(`${clientDisplayName(client)} archived`)
    navigate('/clients')
  }

  const nProjects = projects.filter((p) => p.client_id === client.id).length
  const nInvoices = invoices.filter((i) => i.client_id === client.id).length
  const hex = f.brand_color.replace('#', '')

  return (
    <>
      <Topbar crumbs={[{ label: 'Clients', to: '/clients' }, { label: clientDisplayName(client), to: `/clients/${client.id}` }, { label: 'Settings' }]}>
        <button type="button" className="btn" onClick={() => navigate(`/clients/${client.id}`)}>Cancel</button>
        <button type="button" className="btn btn-pri" onClick={save} disabled={!dirty}>Save changes</button>
      </Topbar>
      <Content>
        <div className="row" style={{ gap: 14 }}>
          <ClientMark client={{ ...client, brand_color: f.brand_color, name: f.name || client.name, logo_url: f.logo_url }} size="lg" />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.02em' }}>Client settings</h1>
            <div className="small muted">{clientDisplayName(client)} · changes apply across projects and invoices</div>
            <div className="row-sm" style={{ marginTop: 6 }}>
              <button type="button" className="btn btn-sm" disabled={uploading} onClick={() => logoRef.current?.click()}>
                <Image className="i i-sm" />{uploading ? 'Uploading…' : f.logo_url ? 'Replace logo' : 'Upload logo'}
              </button>
              <input ref={logoRef} type="file" className="sr" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadLogo(file); e.target.value = '' }} />
              {f.logo_url && <button className="btn btn-ghost btn-sm" type="button" onClick={() => set('logo_url', null)}>Remove</button>}
            </div>
          </div>
        </div>
        <SettingsLayout
          nav={[
            { id: 'general', label: 'General', icon: <User className="i i-sm" /> },
            { id: 'contact', label: 'Contact & location', icon: <Mail className="i i-sm" /> },
            { id: 'invoicing', label: 'Invoicing & branding', icon: <FileText className="i i-sm" /> },
            { id: 'notes', label: 'Notes', icon: <Edit3 className="i i-sm" /> },
            { id: 'danger', label: 'Danger zone', icon: <AlertTriangle className="i i-sm" />, danger: true },
          ]}
        >
          <Section id="general" title="General & identity" desc="How this client appears across MyDesk.">
            <div className="f2">
              <Field label="Contact name" required><input className="inp" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="Company name"><input className="inp" placeholder="e.g. Ananas Digital" value={f.company_name} onChange={(e) => set('company_name', e.target.value)} /></Field>
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
              <ToggleRow
                title="Display as company across workspace"
                desc={`Show the company name instead of “${f.name || client.name}” in lists, projects and invoices.`}
                checked={f.use_company_name}
                disabled={!f.company_name.trim()}
                onChange={(v) => set('use_company_name', v)}
              />
            </div>
            <div className="f2">
              <Field label="Status">
                <select className="inp" value={f.status} onChange={(e) => set('status', e.target.value as ClientStatus)}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </Field>
              <div className="field">
                <span className="lbl">Sidebar</span>
                <label className="row small" style={{ height: 38, cursor: 'pointer' }}>
                  <input className="cb" type="checkbox" checked={f.pinned} onChange={(e) => set('pinned', e.target.checked)} />Pin to sidebar
                </label>
              </div>
            </div>
          </Section>

          <Section id="contact" title="Contact & location" desc="Used for reminders and to show the client's local time.">
            <div className="f2">
              <Field label="Email" hint="Payment reminders are sent here."><input className="inp" type="email" placeholder="name@company.com" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label="Phone"><input className="inp" type="tel" placeholder="+1 555 000 0000" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
              <Field label="Website"><input className="inp" placeholder="https://" value={f.website} onChange={(e) => set('website', e.target.value)} /></Field>
              <Field label="Country">
                <select
                  className="inp"
                  value={f.country}
                  onChange={(e) => {
                    const c = COUNTRIES.find((x) => x.name === e.target.value)
                    setF((s) => (s ? { ...s, country: e.target.value, timezone: c?.timezone ?? s.timezone } : s))
                  }}
                >
                  <option value="">Select…</option>
                  {COUNTRIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Timezone" hint="Auto-filled from country. Change it if needed.">
              <select className="inp" value={f.timezone} onChange={(e) => set('timezone', e.target.value)}>
                <option value="">Select…</option>
                {ALL_TZ.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </Field>
          </Section>

          <Section id="invoicing" title="Invoicing & branding" desc="Defaults for every invoice you make for this client.">
            <Field label="Legal invoicing name & address" hint="Printed in the “Invoice to” block. The first line is used as the legal company name.">
              <textarea className="inp" rows={4} placeholder={'Company Pty Ltd\n123 Commercial Road\nCity, Postcode\nCountry'} value={f.company_address} onChange={(e) => set('company_address', e.target.value)} />
            </Field>
            <div className="f2">
              <Field label="Default currency">
                <CurrencySelect value={f.default_currency} onChange={(v) => set('default_currency', v)} currencies={[...SUPPORTED_CURRENCIES]} />
              </Field>
              <Field label="Payment terms">
                <select className="inp" value={f.payment_terms} onChange={(e) => set('payment_terms', e.target.value)}>
                  {paymentTerms.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
            </div>
            <div className="field">
              <span className="lbl">Brand accent color</span>
              <div className="row wrap" style={{ gap: 14 }}>
                <div className="swatches">
                  {COLORS.map((c) => (
                    <input key={c} className="swatch" type="radio" name="cec" style={{ ['--c' as string]: c }} checked={f.brand_color.toLowerCase() === c.toLowerCase()} onChange={() => set('brand_color', c)} aria-label={c} />
                  ))}
                </div>
                <span className="prefix" style={{ width: 150 }}>
                  <span>#</span>
                  <input className="inp mono" value={hex} maxLength={6} aria-label="Custom hex" onChange={(e) => set('brand_color', `#${e.target.value.replace(/[^0-9a-f]/gi, '')}`)} />
                </span>
              </div>
            </div>
            <div className="field">
              <span className="lbl">Custom invoice fields</span>
              {f.invoice_fields.map((x, i) => (
                <div className="invfield" key={i}>
                  <input className="inp" value={x.label} placeholder="Label" aria-label="Label" onChange={(e) => setField(i, { label: e.target.value })} />
                  <input className="inp" value={x.value} placeholder="Value" aria-label="Value" onChange={(e) => setField(i, { value: e.target.value })} />
                  <button className="btn btn-ghost btn-icon" type="button" aria-label="Remove" onClick={() => set('invoice_fields', f.invoice_fields.filter((_, idx) => idx !== i))}><X className="i" /></button>
                </div>
              ))}
              <button className="btn btn-sm" type="button" style={{ alignSelf: 'flex-start' }} onClick={() => set('invoice_fields', [...f.invoice_fields, { label: '', value: '' }])}><Plus className="i i-sm" />Add field</button>
              <span className="hint">e.g. VAT number, Tax ID. Added automatically to invoices for this client.</span>
            </div>
          </Section>

          <Section id="notes" title="Notes & preferences" desc="Only owners and admins see these.">
            <textarea className="inp" rows={4} aria-label="Internal notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          </Section>

          <Section id="danger" title="Danger zone" danger>
            <div className="danger-row">
              <div><b>Archive client</b><small>Hides from lists and the sidebar. Projects and payments are kept.</small></div>
              <button type="button" className="btn" onClick={archive} disabled={client.status === 'archived'}><Archive className="i i-sm" />Archive</button>
            </div>
            <div className="danger-row">
              <div><b>Delete client</b><small>Permanently removes the client with all projects, tasks, payments and notes.</small></div>
              <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}><Trash2 className="i i-sm" />Delete client</button>
            </div>
          </Section>
        </SettingsLayout>
      </Content>
      {dirty && <SaveBar note={<><span className="live" style={{ background: 'var(--warn-dot)', animation: 'none' }} />Unsaved changes</>} onCancel={() => setF(initial)} onSave={save} />}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${clientDisplayName(client)}?`}
        description={`This removes ${nProjects} project${nProjects === 1 ? '' : 's'}, their tasks, ${nInvoices} invoice${nInvoices === 1 ? '' : 's'} and all notes. This can't be undone.`}
        typeToConfirm={client.name}
        confirmLabel="Delete forever"
        onConfirm={() => {
          deleteRow('clients', client.id, { entity: 'client', entityId: client.id, action: 'deleted', message: `deleted client ${clientDisplayName(client)}` })
          // Children cascade in the database; drop them locally too.
          useData.setState((s) => {
            const pids = new Set(s.projects.filter((p) => p.client_id === client.id).map((p) => p.id))
            return {
              projects: s.projects.filter((p) => !pids.has(p.id)),
              tasks: s.tasks.filter((t) => !pids.has(t.project_id)),
              payments: s.payments.filter((p) => p.client_id !== client.id),
              invoices: s.invoices.filter((i) => i.client_id !== client.id),
              clientMembers: s.clientMembers.filter((m) => m.client_id !== client.id),
            }
          })
          toast.success('Client deleted')
          navigate('/clients')
        }}
      />
    </>
  )
}
