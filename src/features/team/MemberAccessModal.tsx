import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { setMemberAccess } from '@/data/actions'
import { Modal } from '@/components/ui/modal'
import { Avatar, ClientMark } from '@/components/ui/avatar'
import { clientDisplayName, OPEN_PROJECT, profileFullName, shortProjectTitle } from '@/lib/derive'
import type { Profile } from '@/types'

/**
 * One member's access: tick a client to give every project under it, or open the client
 * and tick single projects only.
 */
export function MemberAccessModal({ person, onClose }: { person: Profile | null; onClose: () => void }) {
  const { clients, projects, clientMembers, projectMembers, accessV2Ready } = useData()
  const [whole, setWhole] = useState<Set<string>>(new Set())
  const [single, setSingle] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')

  const nowClients = useMemo(() => new Set(clientMembers.filter((m) => m.user_id === person?.id).map((m) => m.client_id)), [clientMembers, person?.id])
  const nowProjects = useMemo(() => new Set(projectMembers.filter((m) => m.user_id === person?.id).map((m) => m.project_id)), [projectMembers, person?.id])

  useEffect(() => {
    if (!person) return
    setWhole(new Set(nowClients))
    setSingle(new Set(nowProjects))
    setQ('')
    // Clients where they have single projects start opened, so you see them.
    setOpen(new Set(projects.filter((p) => nowProjects.has(p.id)).map((p) => p.client_id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.id])

  if (!person) return null

  const toggle = (set: Set<string>, id: string, on: boolean) => {
    const n = new Set(set)
    if (on) n.add(id)
    else n.delete(id)
    return n
  }
  const term = q.trim().toLowerCase()
  const rows = clients
    .filter((c) => c.status !== 'archived' || nowClients.has(c.id))
    .map((c) => ({
      client: c,
      projects: projects
        .filter((p) => p.client_id === c.id && (OPEN_PROJECT(p) || single.has(p.id)))
        .sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .filter(({ client, projects: ps }) => !term || clientDisplayName(client).toLowerCase().includes(term) || ps.some((p) => p.title.toLowerCase().includes(term)))
    .sort((a, b) => clientDisplayName(a.client).localeCompare(clientDisplayName(b.client)))

  const singlesCounted = [...single].filter((pid) => !whole.has(projects.find((p) => p.id === pid)?.client_id ?? ''))
  const changed =
    [...whole].some((c) => !nowClients.has(c)) || [...nowClients].some((c) => !whole.has(c)) ||
    singlesCounted.some((p) => !nowProjects.has(p)) || [...nowProjects].some((p) => !singlesCounted.includes(p))

  const save = () => {
    setMemberAccess(person.id, whole, new Set(singlesCounted))
    toast.success(`Access saved for ${profileFullName(person)}`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={<span className="row-sm"><Avatar profile={person} size="sm" />Access for {profileFullName(person)}</span>}
      note={<>{whole.size} client{whole.size === 1 ? '' : 's'} · {singlesCounted.length} single project{singlesCounted.length === 1 ? '' : 's'}</>}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-pri" disabled={!changed} onClick={save}>Save access</button>
        </>
      }
    >
      <div className="dlg-b">
        <p className="small muted" style={{ margin: 0 }}>
          <b>Tick a client</b> for every project under it (they can also create projects there). <b>Open a client</b> to pick single projects: they’ll see only those.
        </p>
        {!accessV2Ready && <p className="small t-warn" style={{ margin: 0 }}>Run <b>supabase/schema.sql</b> in Supabase to share single projects.</p>}
        <label className="inp row-sm" style={{ display: 'flex', alignItems: 'center' }}>
          <Search className="i i-sm faint" />
          <input style={{ border: 0, outline: 0, background: 'transparent', flex: 1 }} placeholder="Find a client or project" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="card access-list">
          {rows.length === 0 && <div className="empty sm"><p>No clients match.</p></div>}
          {rows.map(({ client: c, projects: ps }) => {
            const isWhole = whole.has(c.id)
            const picked = ps.filter((p) => single.has(p.id)).length
            const expanded = open.has(c.id) || Boolean(term && ps.some((p) => p.title.toLowerCase().includes(term)))
            return (
              <div key={c.id} className="access-grp">
                <div className="check-row">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    style={{ width: 24, height: 24 }}
                    aria-label={expanded ? 'Hide projects' : 'Show projects'}
                    disabled={ps.length === 0}
                    onClick={() => setOpen((s) => toggle(s, c.id, !s.has(c.id)))}
                  >
                    {expanded ? <ChevronDown className="i i-sm" /> : <ChevronRight className="i i-sm" />}
                  </button>
                  <ClientMark client={c} size="sm" />
                  <button type="button" className="txt m trunc link-plain" style={{ textAlign: 'left' }} onClick={() => setOpen((s) => toggle(s, c.id, !s.has(c.id)))}>
                    {clientDisplayName(c)}
                  </button>
                  <span className="xs muted">{isWhole ? `All ${ps.length} project${ps.length === 1 ? '' : 's'}` : picked ? `${picked} of ${ps.length}` : `${ps.length} project${ps.length === 1 ? '' : 's'}`}</span>
                  <label className="row-sm small" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" className="cb" checked={isWhole} onChange={(e) => setWhole((s) => toggle(s, c.id, e.target.checked))} />
                    Whole client
                  </label>
                </div>
                {expanded &&
                  ps
                    .filter((p) => !term || clientDisplayName(c).toLowerCase().includes(term) || p.title.toLowerCase().includes(term))
                    .map((p) => (
                      <label key={p.id} className="check-row sub" title={isWhole ? 'Included with the whole client' : undefined}>
                        <input
                          type="checkbox"
                          className="cb"
                          disabled={isWhole || !accessV2Ready}
                          checked={isWhole || single.has(p.id)}
                          onChange={(e) => setSingle((s) => toggle(s, p.id, e.target.checked))}
                        />
                        <span className="txt trunc">{shortProjectTitle(p.title)}</span>
                        {!OPEN_PROJECT(p) && <span className="xs faint">closed</span>}
                      </label>
                    ))}
              </div>
            )
          })}
        </div>
        <Link className="link small" to={`/team/${person.id}`} onClick={onClose}>Edit profile and role →</Link>
      </div>
    </Modal>
  )
}
