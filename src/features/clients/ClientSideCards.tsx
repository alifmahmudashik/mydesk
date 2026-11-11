import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { setMemberAccess } from '@/data/actions'
import { Modal } from '@/components/ui/modal'
import { Avatar } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/field'
import { ColorPicker } from '@/components/ui/color-picker'
import { clientColor, clientDisplayName, profileDisplayName, profileFullName } from '@/lib/derive'
import type { Client } from '@/types'

/** Who can see this client, with a "Manage" window to give or take away access right here. */
export function TeamAccessCard({ client, canManage }: { client: Client; canManage: boolean }) {
  const { profiles, clientMembers, projectMembers, projects } = useData()
  const [open, setOpen] = useState(false)
  const cProjects = projects.filter((p) => p.client_id === client.id)
  const hasWhole = (uid: string) => clientMembers.some((m) => m.client_id === client.id && m.user_id === uid)
  const projectCount = (uid: string) => projectMembers.filter((m) => m.user_id === uid && cProjects.some((p) => p.id === m.project_id)).length
  const team = profiles.filter((u) => hasWhole(u.id))
  const projectOnly = profiles.filter((u) => !hasWhole(u.id) && projectCount(u.id) > 0)

  return (
    <section className="card card-b stack">
      <div className="row between">
        <span className="label-caps">Team with access</span>
        {canManage && <button type="button" className="link-btn small" onClick={() => setOpen(true)}>Manage</button>}
      </div>
      {team.length === 0 && projectOnly.length === 0 && <span className="small muted">Only owners and admins.</span>}
      {team.map((u) => (
        <Link key={u.id} className="row" to={`/team/${u.id}`}>
          <Avatar profile={u} size="md" />
          <div className="grow small m">{profileDisplayName(u)}</div>
          <span className="pill" title="Every project for this client">Whole client</span>
        </Link>
      ))}
      {projectOnly.map((u) => {
        const n = projectCount(u.id)
        return (
          <Link key={u.id} className="row" to={`/team/${u.id}`}>
            <Avatar profile={u} size="md" />
            <div className="grow small m">{profileDisplayName(u)}</div>
            <span className="pill" title="Only the projects shared with them">{n} project{n === 1 ? '' : 's'}</span>
          </Link>
        )
      })}
      {canManage && <TeamAccessModal open={open} onClose={() => setOpen(false)} client={client} />}
    </section>
  )
}

function TeamAccessModal({ open, onClose, client }: { open: boolean; onClose: () => void; client: Client }) {
  const { profiles, clientMembers, projectMembers, projects } = useData()
  const members = profiles.filter((p) => p.role === 'member').sort((a, b) => profileFullName(a).localeCompare(profileFullName(b)))
  const cProjects = projects.filter((p) => p.client_id === client.id)
  const name = clientDisplayName(client)

  const toggle = (uid: string, on: boolean) => {
    const clientIds = new Set(clientMembers.filter((m) => m.user_id === uid).map((m) => m.client_id))
    const projectIds = new Set(projectMembers.filter((m) => m.user_id === uid).map((m) => m.project_id))
    if (on) clientIds.add(client.id)
    else clientIds.delete(client.id)
    setMemberAccess(uid, clientIds, projectIds)
    const who = profileDisplayName(profiles.find((p) => p.id === uid))
    toast.success(on ? `${who} can now see ${name}` : `${who} no longer sees ${name}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Team access · ${name}`}
      note="Owners and admins always see every client."
      footer={<button type="button" className="btn btn-pri" onClick={onClose}>Done</button>}
    >
      <div className="dlg-b stack" style={{ gap: 4 }}>
        {members.length === 0 && (
          <div className="empty sm">
            <b>No team members yet</b>
            <p>Invite someone from the <Link className="link" to="/team">Team</Link> page, then give them access here.</p>
          </div>
        )}
        {members.map((u) => {
          const whole = clientMembers.some((m) => m.client_id === client.id && m.user_id === u.id)
          const n = projectMembers.filter((m) => m.user_id === u.id && cProjects.some((p) => p.id === m.project_id)).length
          return (
            <div key={u.id} className="row" style={{ padding: '8px 0', gap: 12 }}>
              <Avatar profile={u} size="md" />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="small m trunc">{profileFullName(u)}</div>
                <div className="xs muted">
                  {whole ? 'Every project for this client' : n > 0 ? <>Only {n} project{n === 1 ? '' : 's'} · <Link className="link" to={`/team/${u.id}`} onClick={onClose}>Choose projects</Link></> : 'No access'}
                </div>
              </div>
              <Switch checked={whole} onChange={(v) => toggle(u.id, v)} label={`Give ${profileDisplayName(u)} access to ${name}`} />
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

/** The client's invoice colour, changed right here and saved as you pick. */
export function BrandingCard({ client }: { client: Client }) {
  const { updateRow } = useData()
  const saved = clientColor(client).toUpperCase()
  const [color, setColor] = useState(saved)
  useEffect(() => setColor(saved), [saved])

  // The system colour picker fires on every drag; save once it settles.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const pick = (c: string) => {
    setColor(c)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (c === saved) return
      updateRow('clients', client.id, { brand_color: c }, { entity: 'client', entityId: client.id, action: 'updated', message: `changed the invoice colour for ${clientDisplayName(client)}` })
    }, 400)
  }

  return (
    <section className="card card-b stack">
      <span className="label-caps">Invoice branding</span>
      <ColorPicker value={color} onChange={pick} extra={[saved]} />
      <span className="xs muted">Used on every PDF invoice for this client.</span>
    </section>
  )
}
