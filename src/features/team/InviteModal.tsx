import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { Modal } from '@/components/ui/modal'
import { Field, RadioCard } from '@/components/ui/field'
import { ClientMark } from '@/components/ui/avatar'
import { clientDisplayName, OPEN_PROJECT, shortProjectTitle } from '@/lib/derive'
import type { Invite } from '@/types'

export function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { clients, projects, profiles, invites, accessV2Ready, createRow } = useData()
  const [emails, setEmails] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [access, setAccess] = useState<Set<string>>(new Set())
  const [single, setSingle] = useState<Set<string>>(new Set())
  const active = clients.filter((c) => c.status !== 'archived')

  useEffect(() => {
    if (open) {
      setEmails('')
      setRole('member')
      setAccess(new Set())
      setSingle(new Set())
    }
  }, [open])

  const send = () => {
    const list = [...new Set(emails.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))]
    if (list.length === 0) return toast.error('Add at least one email address')
    const bad = list.filter((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    if (bad.length) return toast.error(`Check ${bad.join(', ')}`)
    const existing = list.filter((e) => profiles.some((p) => p.email.toLowerCase() === e))
    if (existing.length) return toast.error(`${existing.join(', ')} already ${existing.length > 1 ? 'have' : 'has'} an account`)
    for (const email of list) {
      const pending = invites.find((i) => i.email.toLowerCase() === email && !i.accepted_at && !i.revoked_at)
      if (pending) continue
      const projectIds = role === 'member' ? [...single].filter((id) => !access.has(projects.find((p) => p.id === id)?.client_id ?? '')) : []
      createRow<Invite>('invites', { email, role, client_ids: role === 'member' ? [...access] : [], ...(projectIds.length ? { project_ids: projectIds } : {}), token: crypto.randomUUID().replace(/-/g, '') }, {
        entity: 'member', action: 'invited', message: `invited ${email} as ${role}`,
      })
    }
    toast.success(list.length === 1 ? `Invite sent to ${list[0]}` : `${list.length} invites sent`)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite to MyDesk"
      note={<><Mail className="i i-sm" />They'll get one invite email</>}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-pri" onClick={send}>Send invite</button>
        </>
      }
    >
      <div className="dlg-b">
        <Field label="Email addresses" hint="Separate several with commas.">
          <input data-autofocus className="inp" placeholder="name@company.com" value={emails} onChange={(e) => setEmails(e.target.value)} />
        </Field>
        <div className="field">
          <span className="lbl">Role</span>
          <div className="f2">
            <RadioCard name="inv-role" checked={role === 'member'} onChange={() => setRole('member')} title="Member" desc="Sees only the clients you pick below." />
            <RadioCard name="inv-role" checked={role === 'admin'} onChange={() => setRole('admin')} title="Admin" desc="Sees every client, payment and invoice." />
          </div>
        </div>
        {role === 'member' && (
          <div className="field">
            <span className="lbl">Client access</span>
            <div className="card" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {active.length === 0 && <div className="empty sm"><p>No clients yet.</p></div>}
              {active.map((c) => (
                <label key={c.id} className="check-row">
                  <input
                    type="checkbox"
                    className="cb"
                    checked={access.has(c.id)}
                    onChange={(e) =>
                      setAccess((s) => {
                        const n = new Set(s)
                        if (e.target.checked) n.add(c.id)
                        else n.delete(c.id)
                        return n
                      })
                    }
                  />
                  <ClientMark client={c} size="sm" />
                  <span className="txt">{clientDisplayName(c)}</span>
                </label>
              ))}
            </div>
            <span className="hint">Every project for a checked client, and they can create new ones.</span>
          </div>
        )}
        {role === 'member' && accessV2Ready && (
          <div className="field">
            <span className="lbl">Or single projects</span>
            <div className="card" style={{ maxHeight: 200, overflowY: 'auto' }}>
              {projects.filter((p) => OPEN_PROJECT(p) && !access.has(p.client_id)).length === 0 && <div className="empty sm"><p>No other open projects.</p></div>}
              {projects
                .filter((p) => OPEN_PROJECT(p) && !access.has(p.client_id))
                .map((p) => {
                  const c = clients.find((x) => x.id === p.client_id)
                  return (
                    <label key={p.id} className="check-row">
                      <input
                        type="checkbox"
                        className="cb"
                        checked={single.has(p.id)}
                        onChange={(e) =>
                          setSingle((s) => {
                            const n = new Set(s)
                            if (e.target.checked) n.add(p.id)
                            else n.delete(p.id)
                            return n
                          })
                        }
                      />
                      {c && <ClientMark client={c} size="sm" />}
                      <span className="txt trunc">{shortProjectTitle(p.title)}</span>
                      <span className="xs muted trunc">{c ? clientDisplayName(c) : ''}</span>
                    </label>
                  )
                })}
            </div>
            <span className="hint">Only that project and its tasks.</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
