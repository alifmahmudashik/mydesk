import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Copy, Folder, MessageSquare, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { useUI } from '@/data/ui'
import { useIsAdmin } from '@/hooks/usePermissions'
import { Empty } from '@/components/ui/layout'
import { AvatarStack } from '@/components/ui/avatar'
import { StatusPill } from '@/components/ui/pill'
import { Modal } from '@/components/ui/modal'
import { sumByCurrency, isAssignedTo, projectTaskWork } from '@/lib/derive'
import { formatDate, formatMinutes, formatMoney, isOverdue } from '@/lib/format'
import { projectStatus } from '@/lib/status'
import { copyText } from '@/lib/utils'
import { ProjectBulkBar, SelectBox, SelectButton, SelectionProvider, useSelection } from '@/components/domain/BulkSelect'
import type { Client, Project, ProjectStatus, Task, TimeEntry } from '@/types'

const projectMinutesFrom = (p: Project, timeEntries: TimeEntry[]) => timeEntries.filter((e) => e.project_id === p.id).reduce((s, e) => s + (Number(e.minutes) || 0), 0)

const RING: Record<ProjectStatus, string> = { not_started: '', in_progress: 'prog', waiting_for_client: 'wait', blocked: 'block', completed: 'done', finished: 'done', cancelled: 'cancel' }

/** Task lines under a project: hourly ones show time and its cost, others just the task. */
function taskLines(p: Project, tasks: Task[], timeEntries: TimeEntry[]) {
  const rate = p.billing_type === 'hourly' && p.hourly_rate != null ? Number(p.hourly_rate) : null
  return projectTaskWork(p, tasks, timeEntries).map((w) =>
    p.billing_type === 'hourly'
      ? `   • ${w.title} — ${formatMinutes(w.minutes)}${rate != null ? ` (${formatMoney(Math.round(((w.minutes * rate) / 60) * 100) / 100, p.currency, { cents: true })})` : ''}`
      : `   • ${w.title}`,
  )
}

/** "1. Title — $30" lines plus a per-currency total, ready to paste to the client.
 *  With tasks on, each project lists its tasks underneath (hours and cost for hourly ones). */
function buildChatSummary(firstName: string, selected: Project[], withTasks = false, tasks: Task[] = [], timeEntries: TimeEntry[] = []) {
  return [
    `Hi ${firstName},`,
    '',
    'Here is the summary of projects worked on:',
    '',
    ...selected.flatMap((p, i) => [
      `${i + 1}. ${p.title} — ${formatMoney(p.amount, p.currency)}${p.billing_type === 'hourly' && p.hourly_rate != null ? ` (${formatMinutes(projectMinutesFrom(p, timeEntries))} × ${formatMoney(Number(p.hourly_rate), p.currency)}/h)` : ''}`,
      ...(withTasks ? taskLines(p, tasks, timeEntries) : []),
    ]),
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
  const { projects, tasks, profiles, payments, timeEntries } = useData()
  const [finishedOpen, setFinishedOpen] = useState(false)
  const [exportText, setExportText] = useState<string | null>(null)
  const [withTasks, setWithTasks] = useState(false)

  const all = useMemo(() => projects.filter((p) => p.client_id === client.id), [projects, client.id])
  const selection = useSelection(all.map((p) => p.id))
  const sel = selection.ids
  const rank = (p: Project) => (p.status === 'completed' ? 1 : p.status === 'cancelled' ? 2 : 0)
  const current = all
    .filter((p) => p.status !== 'finished')
    .sort((a, b) => rank(a) - rank(b) || (b.completed_at ?? b.due_date ?? b.created_at).localeCompare(a.completed_at ?? a.due_date ?? a.created_at))
  const isRunning = (p: Project) => p.status !== 'completed' && p.status !== 'finished' && p.status !== 'cancelled'
  const running = current.filter(isRunning)
  const wrapped = current.filter((p) => !isRunning(p))
  const finished = all.filter((p) => p.status === 'finished').sort((a, b) => (b.completed_at ?? b.due_date ?? b.created_at).localeCompare(a.completed_at ?? a.due_date ?? a.created_at))
  const selected = all.filter((p) => sel.has(p.id))
  const firstName = client.name.split(' ')[0]

  const row = (p: Project) => {
    const pt = tasks.filter((t) => t.project_id === p.id && t.status !== 'cancelled')
    const d = pt.filter((t) => t.status === 'done').length
    const open = isRunning(p)
    const paid = payments.filter((x) => x.project_ids?.includes(p.id) && x.status === 'paid')
    const team = profiles.filter((u) => pt.some((t) => isAssignedTo(t, u.id)))
    const late = open && isOverdue(p.due_date)
    const sub = open ? (
      <span className={late ? 't-bad' : undefined}>{p.due_date ? `${late ? 'Was due' : 'Due'} ${formatDate(p.due_date)}` : 'No due date'}</span>
    ) : (
      <span>
        {p.status === 'cancelled' ? 'Cancelled' : 'Completed'} {formatDate((p.completed_at ?? p.due_date ?? p.created_at).slice(0, 10))}
        {isAdmin && paid.length > 0 && <> · <span className="priv">{sumByCurrency(paid)}</span> paid</>}
      </span>
    )
    const body = (
      <>
        <SelectBox id={p.id} label={p.title} />
        <span className={`st ${RING[p.status]}`} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className={`t trunc ${p.status === 'finished' ? 'muted' : ''}`}>{p.title}</div>
          <div className="s">{sub}</div>
        </div>
        {open && (
          <div className="cp-prog" title={`${d} of ${pt.length} tasks done`}>
            <div className="bar"><i className={pt.length && d === pt.length ? 'ok' : undefined} style={{ width: `${pt.length ? (d / pt.length) * 100 : 0}%` }} /></div>
            <span className="xs muted num">{d}/{pt.length}</span>
          </div>
        )}
        {isAdmin && p.amount > 0 && <span className="num small m priv">{formatMoney(p.amount, p.currency)}</span>}
        <StatusPill meta={projectStatus[p.status]} />
        {open && team.length > 0 && <AvatarStack profiles={team} />}
        <ChevronRight className="i faint" />
      </>
    )
    return (
      <Link
        key={p.id}
        className={`li${sel.has(p.id) ? ' selected' : ''}`}
        to={`/projects/${p.id}`}
        onClick={(e) => {
          if (selection.isSelecting) {
            const target = e.target as HTMLElement
            if (target.closest('.above, button, input')) return
            e.preventDefault()
            selection.toggle(p.id)
          }
        }}
      >
        {body}
      </Link>
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
      <div className="row wrap">
        <span className="small muted">{current.length} project{current.length === 1 ? '' : 's'}{finished.length ? ` · ${finished.length} finished` : ''}</span>
        <span className="spacer" />
        <SelectButton sel={selection} />
        {isAdmin && (
          <button type="button" className="chip" onClick={() => { selection.set(all.filter((p) => p.status === 'completed' || p.status === 'finished').map((p) => p.id)); if (finished.length) setFinishedOpen(true) }}>Select completed</button>
        )}
        {isAdmin && (
          <button type="button" className="btn btn-sm" onClick={() => openCreate('project', { client_id: client.id })}><Plus className="i i-sm" />New project</button>
        )}
      </div>

      <SelectionProvider value={selection}>
      {current.length === 0 && <div className="card"><div className="empty sm"><p>No running projects. Everything is finished.</p></div></div>}
      {running.length > 0 && (
        <div>
          <div className="grp-h"><span className="st prog" />Active <span className="n">{running.length}</span></div>
          <div className="card list select-list">{running.map(row)}</div>
        </div>
      )}
      {wrapped.length > 0 && (
        <div>
          <div className="grp-h"><span className="st done" />Completed <span className="n">{wrapped.length}</span></div>
          <div className="card list select-list">{wrapped.map(row)}</div>
        </div>
      )}

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

      </SelectionProvider>
      {selection.isSelecting && (
        <ProjectBulkBar
          sel={selection}
          allIds={all.map((p) => p.id)}
          extra={isAdmin ? (
            <button type="button" className="btn btn-sm" disabled={selected.length === 0} title={`Total: ${sumByCurrency(selected)}`} onClick={() => setExportText(buildChatSummary(firstName, selected, withTasks, tasks, timeEntries))}>
              <MessageSquare className="i i-sm" />Export message
            </button>
          ) : undefined}
        />
      )}

      <Modal
        open={exportText !== null}
        onClose={() => setExportText(null)}
        title="Export as chat"
        note={
          <label className="row-sm" style={{ cursor: 'pointer' }} title="List each project's tasks. Hourly projects show the time and cost of each task.">
            <input
              type="checkbox"
              className="cb"
              checked={withTasks}
              onChange={(e) => {
                setWithTasks(e.target.checked)
                // Rebuilds the message (replaces any edits made in the box).
                setExportText(buildChatSummary(firstName, selected, e.target.checked, tasks, timeEntries))
              }}
            />{' '}
            Include tasks
          </label>
        }
        footer={
          <button
            type="button"
            className="btn btn-pri"
            onClick={() => {
              if (exportText) void copyText(exportText).then(() => toast.success('Copied to clipboard'))
              setExportText(null)
              selection.clear()
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
