import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, ListChecks, MessageSquare, Plus } from 'lucide-react'
import { useData } from '@/data/store'
import { useUI } from '@/data/ui'
import { setTaskStatus, toggleTaskDone } from '@/data/actions'
import { Avatar } from '@/components/ui/avatar'
import { DateChip, PrioBars, StatusRing } from '@/components/ui/pill'
import { labelTone } from '@/components/domain/TaskRow'
import { clientDisplayName, shortProjectTitle, taskRef } from '@/lib/derive'
import { formatDate } from '@/lib/format'
import { taskRing, taskStatus } from '@/lib/status'
import type { Task, TaskStatus } from '@/types'
import { cn } from '@/lib/utils'

/** Full task row (My tasks / project Tasks tab): ref, title, meta, status pill, date, assignee. */
export function TaskListRow({ task, showProject = true }: { task: Task; showProject?: boolean }) {
  const { projects, clients, profiles, comments, subtasks } = useData()
  const project = projects.find((p) => p.id === task.project_id)
  const client = clients.find((c) => c.id === project?.client_id)
  const assignee = profiles.find((p) => p.id === task.assignee_id)
  const nComments = comments.filter((c) => c.task_id === task.id).length
  const subs = subtasks.filter((s) => s.task_id === task.id)
  const done = task.status === 'done'

  return (
    <div className="li hover">
      <input className="cb round above" type="checkbox" checked={done} aria-label="Mark complete" onChange={() => toggleTaskDone(task)} />
      <span className="mono xs faint hide-sm" style={{ width: 52, flex: 'none' }}>{taskRef(task, project)}</span>
      <Link className="grow cover" to={`/tasks/${task.id}`} style={{ minWidth: 0 }}>
        <div className="t trunc" style={done ? { textDecoration: 'line-through', color: 'var(--faint)' } : undefined}>{task.title}</div>
        <div className="s">
          {showProject && project && (
            <>
              <span className="trunc" style={{ maxWidth: 240 }}>{shortProjectTitle(project.title)}</span>
              {client && <><span className="dot-sep">·</span>{clientDisplayName(client)}</>}
            </>
          )}
          {subs.length > 0 && <span className="row-sm"><ListChecks className="i i-xs" />{subs.filter((s) => s.done).length}/{subs.length}</span>}
          {nComments > 0 && <span className="row-sm"><MessageSquare className="i i-xs" />{nComments}</span>}
          {task.labels?.slice(0, 3).map((l) => <span key={l} className={`tag ${labelTone(l)}`}>{l}</span>)}
        </div>
      </Link>
      <PrioBars priority={task.priority} />
      <span className={cn('pill hide-sm', taskStatus[task.status].tone)}>
        <span className={cn('st', taskRing[task.status])} style={{ width: 11, height: 11 }} />
        {taskStatus[task.status].label}
      </span>
      <DateChip date={task.due_date} done={done} empty="" />
      <Avatar profile={assignee} />
    </div>
  )
}

/** Compact row for finished tasks inside the "Wrapped up" group. */
export function DoneRow({ task }: { task: Task }) {
  const { projects, profiles } = useData()
  const project = projects.find((p) => p.id === task.project_id)
  const assignee = profiles.find((p) => p.id === task.assignee_id)
  return (
    <div className="li hover">
      <span className="above"><StatusRing status={task.status} onToggle={() => toggleTaskDone(task)} /></span>
      <span className="mono xs faint" style={{ width: 52, flex: 'none' }}>{taskRef(task, project)}</span>
      <Link className="grow cover" to={`/tasks/${task.id}`} style={{ minWidth: 0 }}>
        <div className="t muted trunc">{task.title}</div>
      </Link>
      <span className="xs muted">{formatDate((task.completed_at ?? task.created_at).slice(0, 10))}</span>
      <Avatar profile={assignee} />
    </div>
  )
}

export function TaskGroup({ icon, title, tasks, collapsible, defaultOpen = true, render }: { icon?: ReactNode; title: string; tasks: Task[]; collapsible?: boolean; defaultOpen?: boolean; render?: (t: Task) => ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  if (tasks.length === 0) return null
  return (
    <div>
      {collapsible ? (
        <button type="button" className="grp-h" style={{ background: 'none', border: 0, width: '100%', cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown className="i i-sm faint" /> : <ChevronRight className="i i-sm faint" />}
          {icon}
          {title} <span className="n">{tasks.length}</span>
          {!open && <span className="xs muted m" style={{ marginLeft: 6 }}>Show</span>}
        </button>
      ) : (
        <div className="grp-h">{icon}{title} <span className="n">{tasks.length}</span></div>
      )}
      {open && <div className="card list">{tasks.map((t) => (render ? render(t) : <TaskListRow key={t.id} task={t} />))}</div>}
    </div>
  )
}

const LANES: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']

/** Kanban board with drag-and-drop between status lanes. */
export function TaskBoard({ tasks, projectId }: { tasks: Task[]; projectId?: string }) {
  const { projects, clients, profiles } = useData()
  const { openCreate } = useUI()
  const navigate = useNavigate()
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<TaskStatus | null>(null)

  return (
    <div className="board">
      {LANES.map((status) => {
        const laneTasks = tasks.filter((t) => t.status === status)
        return (
          <div
            key={status}
            className={cn('lane', over === status && 'over')}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(status)
            }}
            onDragLeave={() => setOver((o) => (o === status ? null : o))}
            onDrop={(e) => {
              e.preventDefault()
              const t = tasks.find((x) => x.id === (dragId ?? e.dataTransfer.getData('text/plain')))
              if (t) setTaskStatus(t, status)
              setDragId(null)
              setOver(null)
            }}
          >
            <div className="lane-h">
              <span className={cn('st', taskRing[status])} />
              {taskStatus[status].label} <span className="n">{laneTasks.length}</span>
              {status !== 'done' && (
                <button type="button" className="btn btn-ghost btn-sm btn-icon ml-auto" aria-label="Add task" onClick={() => openCreate('task', { status, project_id: projectId })}>
                  <Plus className="i" />
                </button>
              )}
            </div>
            {laneTasks.map((t) => {
              const project = projects.find((p) => p.id === t.project_id)
              const client = clients.find((c) => c.id === project?.client_id)
              const assignee = profiles.find((p) => p.id === t.assignee_id)
              return (
                <div
                  key={t.id}
                  className={cn('tcard', dragId === t.id && 'dragging')}
                  draggable
                  role="link"
                  tabIndex={0}
                  onDragStart={(e) => {
                    setDragId(t.id)
                    e.dataTransfer.setData('text/plain', t.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => {
                    setDragId(null)
                    setOver(null)
                  }}
                  onClick={() => navigate(`/tasks/${t.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/tasks/${t.id}`)}
                >
                  <span className="mono xs faint">{taskRef(t, project)}</span>
                  <div className="t" style={status === 'done' ? { color: 'var(--mute)' } : undefined}>{t.title}</div>
                  <div className="meta">
                    {t.labels?.[0] ? <span className={`tag ${labelTone(t.labels[0])}`}>{t.labels[0]}</span> : !projectId && client ? <span className="trunc">{clientDisplayName(client)}</span> : null}
                    {t.due_date && <DateChip date={t.due_date} done={status === 'done'} />}
                    <span className="spacer" />
                    <Avatar profile={assignee} size="sm" />
                  </div>
                </div>
              )
            })}
            {laneTasks.length === 0 && <div className="drop">{status === 'review' ? 'Drop a task here when it’s ready for review' : 'Drop tasks here'}</div>}
          </div>
        )
      })}
    </div>
  )
}
