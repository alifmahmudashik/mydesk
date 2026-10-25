import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckSquare, ChevronDown, ChevronRight, Copy, Folder, MessageSquare, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { useUI } from '@/data/ui'
import { useIsAdmin } from '@/hooks/usePermissions'
import { Empty } from '@/components/ui/layout'
import { AvatarStack } from '@/components/ui/avatar'
import { StatusPill } from '@/components/ui/pill'
import { Modal } from '@/components/ui/modal'
import { sumByCurrency, isAssignedTo } from '@/lib/derive'
import { formatDate, formatMoney } from '@/lib/format'
import { projectStatus } from '@/lib/status'
import { copyText } from '@/lib/utils'
import type { Client, Project, ProjectStatus } from '@/types'

const RING: Record<ProjectStatus, string> = { not_started: '', in_progress: 'prog', waiting_for_client: 'rev', blocked: 'rev', completed: 'done', finished: 'done', cancelled: 'cancel' }

/** "1. Title — $30" lines plus a per-currency total, ready to paste to the client. */
function buildChatSummary(firstName: string, selected: Project[]) {
  return [
    `Hi ${firstName},`,
    '',
    'Here is the summary of projects worked on:',
    '',
    ...selected.map((p, i) => `${i + 1}. ${p.title} — ${formatMoney(p.amount, p.currency)}`),
    '',
    `Total: ${sumByCurrency(selected)}`,
    '',
    'Thank you!',
  ].join('\n')
}

/**
 * A client's projects: running and completed first; Finished (already paid) ones are tucked
 * into a collapsible section. Select projects to export a ready-to-send summary message.
 */
export function ClientProjects({ client }: { client: Client }) {
  const isAdmin = useIsAdmin()
  const { openCreate } = useUI()
  const { projects, tasks, profiles, payments } = useData()
  const [finishedOpen, setFinishedOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [exportText, setExportText] = useState<string | null>(null)

  const all = useMemo(() => projects.filter((p) => p.client_id === client.id), [projects, client.id])
  const rank = (p: Project) => (p.status === 'completed' ? 1 : p.status === 'cancelled' ? 2 : 0)
  const current = all
    .filter((p) => p.status !== 'finished')
    .sort((a, b) => rank(a) - rank(b) || (b.completed_at ?? b.due_date ?? b.created_at).localeCompare(a.completed_at ?? a.due_date ?? a.created_at))
  const finished = all.filter((p) => p.status === 'finished').sort((a, b) => (b.completed_at ?? b.due_date ?? b.created_at).localeCompare(a.completed_at ?? a.due_date ?? a.created_at))
  const selected = all.filter((p) => sel.has(p.id))
  const firstName = client.name.split(' ')[0]

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const row = (p: Project) => {
    const pt = tasks.filter((t) => t.project_id === p.id && t.status !== 'cancelled')
    const d = pt.filter((t) => t.status === 'done').length
    const open = p.status !== 'completed' && p.status !== 'finished' && p.status !== 'cancelled'
    const paid = payments.filter((x) => x.project_ids?.includes(p.id) && x.status === 'paid')
    const team = profiles.filter((u) => pt.some((t) => isAssignedTo(t, u.id)))
    const sub = open
      ? `${p.due_date ? `Due ${formatDate(p.due_date)}` : 'No due date'} · ${d}/${pt.length} tasks`
      : `${p.status === 'cancelled' ? 'Cancelled' : 'Completed'} ${formatDate((p.completed_at ?? p.due_date ?? p.created_at).slice(0, 10))}${isAdmin && paid.length ? ` · ${sumByCurrency(paid)} paid` : ''}`
    const body = (
      <>
        {selecting ? (
          <input type="checkbox" className="cb" checked={sel.has(p.id)} onChange={() => toggle(p.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${p.title}`} />
        ) : (
          <span className={`st ${RING[p.status]}`} />
        )}
        <div className="grow" style={{ minWidth: 0 }}>
          <div className={`t trunc ${p.status === 'finished' ? 'muted' : ''}`}>{p.title}</div>
          <div className="s">{sub}</div>
        </div>
        {isAdmin && p.amount > 0 && <span className="num small m">{formatMoney(p.amount, p.currency)}</span>}
        <StatusPill meta={projectStatus[p.status]} />
        {open && team.length > 0 && <AvatarStack profiles={team} />}
        {!selecting && <ChevronRight className="i faint" />}
      </>
    )
    return selecting ? (
      <label key={p.id} className="li hover" style={{ cursor: 'pointer', background: sel.has(p.id) ? 'var(--sel-bg)' : undefined }}>{body}</label>
    ) : (
      <Link key={p.id} className="li" to={`/projects/${p.id}`}>{body}</Link>
    )
  }

  if (all.length === 0) {
    return (
      <div className="card">
        <Empty small icon={<Folder className="i" />} title="No projects yet" action={<button type="button" className="btn btn-sm" onClick={() => openCreate('project', { client_id: client.id })}><Plus className="i i-sm" />New project</button>} />
      </div>
    )
  }

  return (
    <div className="stack">
      {isAdmin && (
        <div className="row wrap">
          {selecting ? (
            <>
              <button type="button" className="chip" onClick={() => { setSel(new Set(all.filter((p) => p.status === 'completed' || p.status === 'finished').map((p) => p.id))); if (finished.length) setFinishedOpen(true) }}>Select completed</button>
              <button type="button" className="chip" onClick={() => { setSel(sel.size === all.length ? new Set() : new Set(all.map((p) => p.id))); if (finished.length) setFinishedOpen(true) }}>{sel.size === all.length ? 'Clear' : 'Select all'}</button>
              <span className="spacer" />
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setSelecting(false); setSel(new Set()) }}><X className="i i-sm" />Cancel</button>
            </>
          ) : (
            <>
              <span className="small muted">{current.length} project{current.length === 1 ? '' : 's'}{finished.length ? ` · ${finished.length} finished` : ''}</span>
              <span className="spacer" />
              <button type="button" className="btn btn-sm" onClick={() => setSelecting(true)}><CheckSquare className="i i-sm" />Select to export</button>
              <button type="button" className="btn btn-sm" onClick={() => openCreate('project', { client_id: client.id })}><Plus className="i i-sm" />New project</button>
            </>
          )}
        </div>
      )}

      <div className="card list select-list">
        {current.length === 0 && <div className="empty sm"><p>No running projects. Everything is finished.</p></div>}
        {current.map(row)}
      </div>

      {finished.length > 0 && (
        <div>
          <button type="button" className="grp-h" style={{ background: 'none', border: 0, cursor: 'pointer', width: '100%' }} onClick={() => setFinishedOpen((o) => !o)} aria-expanded={finishedOpen}>
            {finishedOpen ? <ChevronDown className="i i-sm faint" /> : <ChevronRight className="i i-sm faint" />}
            <span className="st done" />
            Finished <span className="n">{finished.length}</span>
            <span className="xs muted m" style={{ marginLeft: 6 }}>{finishedOpen ? 'Hide' : 'Paid and closed · Show'}</span>
          </button>
          {finishedOpen && <div className="card list select-list">{finished.map(row)}</div>}
        </div>
      )}

      {selecting && (
        <div className="card card-b row" style={{ position: 'sticky', bottom: 16, boxShadow: 'var(--shadow-pop)', zIndex: 5 }}>
          <div className="grow">
            <b className="m">{sel.size} selected</b>
            <div className="xs muted">Total: {selected.length ? sumByCurrency(selected) : formatMoney(0)}</div>
          </div>
          <button type="button" className="btn btn-pri" disabled={!sel.size} onClick={() => setExportText(buildChatSummary(firstName, selected))}>
            <MessageSquare className="i i-sm" />Export message
          </button>
        </div>
      )}

      <Modal
        open={exportText !== null}
        onClose={() => setExportText(null)}
        title="Export as chat"
        footer={
          <button
            type="button"
            className="btn btn-pri"
            onClick={() => {
              if (exportText) void copyText(exportText).then(() => toast.success('Copied to clipboard'))
              setExportText(null)
              setSelecting(false)
              setSel(new Set())
            }}
          >
            <Copy className="i i-sm" />Copy &amp; close
          </button>
        }
      >
        <div className="dlg-b">
          <p className="small muted">Copy this and paste it straight into email, WhatsApp or Slack.</p>
          <textarea className="inp mono" rows={14} value={exportText ?? ''} onChange={(e) => setExportText(e.target.value)} style={{ fontSize: 13, background: 'var(--soft)' }} />
        </div>
      </Modal>
    </div>
  )
}
