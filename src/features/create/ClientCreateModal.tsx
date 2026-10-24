import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { Modal } from '@/components/ui/modal'
import { Field } from '@/components/ui/field'
import { COUNTRIES } from '@/lib/geo'
import type { Client } from '@/types'

export const SWATCHES = ['#4F46E5', '#DB2777', '#0284C7', '#0D9488', '#D97706', '#475569', '#DC2626', '#7C3AED', '#16A34A']

export function ClientCreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createRow } = useData()
  const navigate = useNavigate()
  const blank = { name: '', company_name: '', email: '', country: '', color: SWATCHES[0] }
  const [f, setF] = useState(blank)

  useEffect(() => {
    if (open) setF(blank)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const save = (more: boolean) => {
    if (!f.name.trim()) return toast.error('Add a contact name')
    const country = COUNTRIES.find((c) => c.name === f.country)
    const client = createRow<Client>(
      'clients',
      {
        name: f.name.trim(),
        company_name: f.company_name.trim() || null,
        email: f.email.trim() || null,
        country: f.country || null,
        timezone: country?.timezone ?? null,
        brand_color: f.color,
        status: 'active',
        invoice_fields: [],
        use_company_name: false,
        pinned: false,
      },
      { entity: 'client', action: 'created', message: `added client ${f.name.trim()}` },
    )
    toast.success('Client added')
    onClose()
    navigate(more ? `/clients/${client.id}/settings` : `/clients/${client.id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add client"
      note={<button type="button" className="link-btn" onClick={() => save(true)}>More options</button>}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-pri" onClick={() => save(false)}>Add client</button>
        </>
      }
    >
      <form className="dlg-b" onSubmit={(e) => { e.preventDefault(); save(false) }}>
        <div className="f2">
          <Field label="Contact name" required>
            <input data-autofocus className="inp" placeholder="Jane Cooper" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Company">
            <input className="inp" placeholder="Acme Inc." value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className="inp" type="email" placeholder="jane@acme.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Country">
            <select className="inp" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>
              <option value="">Select…</option>
              {COUNTRIES.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="field">
          <span className="lbl">Color</span>
          <div className="swatches">
            {SWATCHES.map((c) => (
              <input key={c} className="swatch" type="radio" name="ncc" style={{ ['--c' as string]: c }} checked={f.color === c} onChange={() => setF({ ...f, color: c })} aria-label={c} />
            ))}
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
