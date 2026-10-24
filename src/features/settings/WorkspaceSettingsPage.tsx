import { useEffect, useMemo, useState } from 'react'
import { Briefcase, CreditCard, Edit3, FileText, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { Topbar, Content, PageHead, Section, SaveBar } from '@/components/ui/layout'
import { SettingsLayout, useUnsavedGuard } from '@/components/ui/settings-layout'
import { Field } from '@/components/ui/field'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { uid } from '@/lib/utils'
import type { PaymentProfile } from '@/types'

const COLORS = ['#4F46E5', '#0284C7', '#0D9488', '#0F0F14']

export function WorkspaceSettingsPage() {
  const { invoiceSettings, saveInvoiceSettings } = useData()
  const initial = useMemo(
    () => ({
      workspace_name: invoiceSettings?.workspace_name ?? '',
      business_name: invoiceSettings?.business_name ?? '',
      email: invoiceSettings?.email ?? '',
      business_address: invoiceSettings?.business_address ?? '',
      brand_color: invoiceSettings?.brand_color ?? '#4F46E5',
      payment_profiles: invoiceSettings?.payment_profiles ?? [],
      default_currency: invoiceSettings?.default_currency ?? 'USD',
      default_due_days: invoiceSettings?.default_due_days ?? 7,
      default_tax: String(invoiceSettings?.default_tax ?? 0),
      default_note: invoiceSettings?.default_note ?? '',
    }),
    [invoiceSettings],
  )
  const [f, setF] = useState(initial)
  const [editing, setEditing] = useState<string | null>(null)
  useEffect(() => setF(initial), [initial])
  const dirty = JSON.stringify(f) !== JSON.stringify(initial)
  useUnsavedGuard(dirty)

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))
  const setProfile = (id: string, patch: Partial<PaymentProfile>) => set('payment_profiles', f.payment_profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  const save = () => {
    saveInvoiceSettings({
      workspace_name: f.workspace_name.trim() || null,
      business_name: f.business_name.trim() || null,
      email: f.email.trim() || null,
      business_address: f.business_address.trim() || null,
      brand_color: /^#[0-9a-f]{6}$/i.test(f.brand_color) ? f.brand_color : '#4F46E5',
      payment_profiles: f.payment_profiles.map((p) => ({ ...p, fields: p.fields.filter((x) => x.label.trim() || x.value.trim()) })),
      default_currency: f.default_currency,
      default_due_days: Number(f.default_due_days) || 7,
      default_tax: Number(f.default_tax) || 0,
      default_note: f.default_note.trim() || null,
    })
    setEditing(null)
    toast.success('Workspace settings saved')
  }

  const addProfile = () => {
    const p: PaymentProfile = { id: uid(), name: '', fields: [{ label: 'Account name', value: '' }, { label: 'Email', value: '' }] }
    set('payment_profiles', [...f.payment_profiles, p])
    setEditing(p.id)
  }

  const makeDefault = (id: string) => {
    const p = f.payment_profiles.find((x) => x.id === id)
    if (p) set('payment_profiles', [p, ...f.payment_profiles.filter((x) => x.id !== id)])
  }

  return (
    <>
      <Topbar crumbs={[{ label: 'Workspace settings' }]}>
        <button type="button" className="btn btn-pri" disabled={!dirty} onClick={save}>Save changes</button>
      </Topbar>
      <Content>
        <PageHead title="Workspace settings" sub="Your business details, used as the sender on every invoice." />
        <SettingsLayout
          nav={[
            { id: 'business', label: 'Business', icon: <Briefcase className="i i-sm" /> },
            { id: 'payment', label: 'Payment methods', icon: <CreditCard className="i i-sm" /> },
            { id: 'invoice', label: 'Invoice defaults', icon: <FileText className="i i-sm" /> },
          ]}
        >
          <Section id="business" title="Business details">
            <div className="f2">
              <Field label="Business name" hint="Printed at the top of every invoice."><input className="inp" value={f.business_name} onChange={(e) => set('business_name', e.target.value)} /></Field>
              <Field label="Billing email"><input className="inp" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
            </div>
            <Field label="Address"><textarea className="inp" rows={3} value={f.business_address} onChange={(e) => set('business_address', e.target.value)} /></Field>
            <div className="f2">
              <Field label="Workspace name" hint="Shown under the MyDesk logo in the sidebar."><input className="inp" placeholder="e.g. analyticsbyte" value={f.workspace_name} onChange={(e) => set('workspace_name', e.target.value)} /></Field>
              <div className="field">
                <span className="lbl">Brand color</span>
                <div className="row wrap" style={{ gap: 14 }}>
                  <div className="swatches">
                    {COLORS.map((c) => <input key={c} className="swatch" type="radio" name="stc" style={{ ['--c' as string]: c }} checked={f.brand_color.toLowerCase() === c.toLowerCase()} onChange={() => set('brand_color', c)} aria-label={c} />)}
                  </div>
                  <span className="prefix" style={{ width: 150 }}><span>#</span><input className="inp mono" value={f.brand_color.replace('#', '')} maxLength={6} aria-label="Hex" onChange={(e) => set('brand_color', `#${e.target.value.replace(/[^0-9a-f]/gi, '')}`)} /></span>
                </div>
              </div>
            </div>
          </Section>

          <Section id="payment" title="Payment methods" desc="Pick one per invoice instead of retyping bank details.">
            {f.payment_profiles.length === 0 && <span className="small muted">No payment methods yet. Add your Wise, Payoneer or bank details once.</span>}
            {f.payment_profiles.map((p, idx) => (
              <div className="card" key={p.id}>
                <div className="card-h">
                  {editing === p.id ? (
                    <input className="inp sm" style={{ maxWidth: 240 }} autoFocus placeholder="Name, e.g. Wise" value={p.name} onChange={(e) => setProfile(p.id, { name: e.target.value })} />
                  ) : (
                    <span className="row-sm"><b className="m">{p.name || 'Untitled'}</b>{idx === 0 && <span className="pill pri">Default</span>}</span>
                  )}
                  <span className="row-sm">
                    {idx > 0 && editing !== p.id && <button className="btn btn-ghost btn-sm" type="button" onClick={() => makeDefault(p.id)}>Make default</button>}
                    {editing === p.id ? (
                      <button className="btn btn-sm" type="button" onClick={() => setEditing(null)}>Done</button>
                    ) : (
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditing(p.id)}><Edit3 className="i i-sm" />Edit</button>
                    )}
                    <button className="btn btn-ghost btn-sm btn-icon" type="button" aria-label="Delete payment method" onClick={() => set('payment_profiles', f.payment_profiles.filter((x) => x.id !== p.id))}><Trash2 className="i i-sm" /></button>
                  </span>
                </div>
                {editing === p.id ? (
                  <div className="card-b stack-sm">
                    {p.fields.map((x, i) => (
                      <div className="invfield" key={i}>
                        <input className="inp sm" value={x.label} placeholder="Label" aria-label="Label" onChange={(e) => setProfile(p.id, { fields: p.fields.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) })} />
                        <input className="inp sm" value={x.value} placeholder="Value" aria-label="Value" onChange={(e) => setProfile(p.id, { fields: p.fields.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)) })} />
                        <button className="btn btn-ghost btn-sm btn-icon" type="button" aria-label="Remove" onClick={() => setProfile(p.id, { fields: p.fields.filter((_, j) => j !== i) })}><X className="i" /></button>
                      </div>
                    ))}
                    <button className="btn btn-sm" type="button" style={{ alignSelf: 'flex-start' }} onClick={() => setProfile(p.id, { fields: [...p.fields, { label: '', value: '' }] })}><Plus className="i i-sm" />Add field</button>
                  </div>
                ) : (
                  <div className="card-b kv">
                    {p.fields.filter((x) => x.label || x.value).map((x, i) => (
                      <span key={i} style={{ display: 'contents' }}><span>{x.label}</span><span>{x.value || '—'}</span></span>
                    ))}
                    {p.fields.length === 0 && <span className="muted">No details</span>}
                  </div>
                )}
              </div>
            ))}
            <button className="btn" type="button" style={{ alignSelf: 'flex-start' }} onClick={addProfile}><Plus className="i i-sm" />Add payment method</button>
          </Section>

          <Section id="invoice" title="Invoice defaults">
            <div className="f3">
              <Field label="Default currency">
                <select className="inp" value={f.default_currency} onChange={(e) => set('default_currency', e.target.value)}>
                  {SUPPORTED_CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Default due in">
                <select className="inp" value={f.default_due_days} onChange={(e) => set('default_due_days', Number(e.target.value))}>
                  {[0, 7, 14, 30].map((d) => <option key={d} value={d}>{d === 0 ? 'On receipt' : `${d} days`}</option>)}
                </select>
              </Field>
              <Field label="Default tax">
                <span className="prefix"><span>%</span><input className="inp" inputMode="decimal" value={f.default_tax} onChange={(e) => set('default_tax', e.target.value.replace(/[^\d.]/g, ''))} /></span>
              </Field>
            </div>
            <Field label="Default note"><textarea className="inp" rows={2} value={f.default_note} onChange={(e) => set('default_note', e.target.value)} /></Field>
          </Section>
        </SettingsLayout>
      </Content>
      {dirty && <SaveBar note="Applies to new invoices" onCancel={() => setF(initial)} onSave={save} />}
    </>
  )
}
