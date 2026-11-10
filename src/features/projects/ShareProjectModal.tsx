import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { useUI } from '@/data/ui'
import { Modal } from '@/components/ui/modal'
import { Avatar } from '@/components/ui/avatar'
import { clientDisplayName, profileFullName, shortProjectTitle } from '@/lib/derive'
import type { ClientMember, Project, ProjectMember } from '@/types'

type Scope = 'none' | 'project' | 'client'

/**
 * Who can open this project. "This project only" shares just this project (and its tasks);
 * "Whole client" opens every project under the client, and lets them create projects there.
 */
export function ShareProjectModal({ project, open, onClose }: { project: Project; open: boolean; onClose: () => void }) {
  const { profiles, clients, clientMembers, projectMembers, accessV2Ready, createRow, deleteRow } = useData()
  const { openCreate } = useUI()
  const client = clients.find((c) => c.id === project.client_id)
  const members = profiles.filter((p) => p.role === 'member')

  const current = (userId: string): Scope =>
    clientMembers.some((m) => m.client_id === project.client_id && m.user_id === userId)
      ? 'client'
      : projectMembers.some((m) => m.project_id === project.id && m.user_id === userId)
        ? 'project'
        : 'none'

  const [draft, setDraft] = useState<Record<string, Scope>>({})
  useEffect(() => {
    if (open) setDraft(Object.fromEntries(members.map((p) => [p.id, current(p.id)])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const changed = members.filter((p) => draft[p.id] && draft[p.id] !== current(p.id))
  const otherProjects = useData((s) => s.projects.filter((p) => p.client_id === project.client_id && p.id !== project.id).length)

  const save = () => {
    for (const p of changed) {
      const next = draft[p.id]
      const cm = clientMembers.find((m) => m.client_id === project.client_id && m.user_id === p.id)
      const pm = projectMembers.find((m) => m.project_id === project.id && m.user_id === p.id)
      if (next === 'client') {
        if (!cm) createRow<ClientMember>('client_members', { client_id: project.client_id, user_id: p.id })
        if (pm) deleteRow('project_members', pm.id)
      } else if (next === 'project') {
        if (!pm) createRow<ProjectMember>('project_members', { project_id: project.id, user_id: p.id })
        if (cm) deleteRow('client_members', cm.id)
      } else {
        if (cm) deleteRow('client_members', cm.id)
        if (pm) deleteRow('project_members', pm.id)
      }
    }
    if (changed.length) toast.success('Access saved')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Share “${shortProjectTitle(project.title)}”`}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-pri" disabled={changed.length === 0} onClick={save}>Save access{changed.length ? ` (${changed.length})` : ''}</button>
        </>
      }
    >
      <div className="dlg-b">
        {!accessV2Ready && <p className="small t-warn">Run <b>supabase/schema.sql</b> in Supabase first. Until then only whole-client access works.</p>}
        <div className="small muted">
          <b>This project only</b>: they see this project and its tasks, and can add and assign tasks here.{' '}
          <b>Whole client</b>: every project for {client ? clientDisplayName(client) : 'this client'}{otherProjects ? ` (${otherProjects} more)` : ''}, and they can create new projects for it.
          Owners and admins always see everything.
        </div>
        {members.length === 0 ? (
          <div className="empty sm">
            <p>No members yet.</p>
            <button type="button" className="btn btn-sm mt-8" onClick={() => { onClose(); openCreate('invite') }}>Invite member</button>
          </div>
        ) : (
          <div className="card">
            {members.map((p) => (
              <div key={p.id} className="check-row" style={{ cursor: 'default' }}>
                <Avatar profile={p} size="md" />
                <span className="txt" style={{ minWidth: 0 }}>
                  <span className="m trunc" style={{ display: 'block' }}>{profileFullName(p)}</span>
                  <span className="xs muted trunc" style={{ display: 'block' }}>{p.email}</span>
                </span>
                <div className="pick" role="radiogroup" aria-label={`Access for ${profileFullName(p)}`}>
                  {([['none', 'No access'], ['project', 'This project'], ['client', 'Whole client']] as [Scope, string][]).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={(draft[p.id] ?? 'none') === v}
                      className={(draft[p.id] ?? 'none') === v ? 'on' : undefined}
                      disabled={v === 'project' && !accessV2Ready}
                      onClick={() => setDraft((d) => ({ ...d, [p.id]: v }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <Link className="link small" to={`/team?tab=access&client=${project.client_id}`} onClick={onClose}>All client access →</Link>
      </div>
    </Modal>
  )
}
