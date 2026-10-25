import { Assignees } from '@/components/domain/AssigneePicker'
import { Link } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { useData } from '@/data/store'
import { toggleTaskDone } from '@/data/actions'
import { ClientChip } from '@/components/domain/ClientGroup'
import { DateChip, PrioBars, StatusRing } from '@/components/ui/pill'
import { isOpenPayment, shortProjectTitle, taskRef, taskAssigneeIds } from '@/lib/derive'
import { isOverdue } from '@/lib/format'
import type { Task } from '@/types'
import { cn } from '@/lib/utils'

const TAG_TONES = ['pri', 'teal', 'warn', 'ok', 'gray']
export function labelTone(label: string) {
  let h = 0
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) | 0
  return TAG_TONES[Math.abs(h) % TAG_TONES.length]
}

interface Props {
  task: Task
  /** Show the project · client line under the title. */
  context?: boolean
  /** Use the round status ring instead of a checkbox. */
  ring?: boolean
  showRef?: boolean
  showPrio?: boolean
}

export function TaskRow({ task, context = true, ring, showRef, showPrio }: Props) {
  const { projects, clients, profiles, comments, subtasks } = useData()
  const project = projects.find((p) => p.id === task.project_id)
  const client = clients.find((c) => c.id === project?.client_id)
  const nComments = comments.filter((c) => c.task_id === task.id).length
  const subs = subtasks.filter((s) => s.task_id === task.id)
  const done = task.status === 'done'
  const projectLate = !task.due_date && project?.due_date && isOverdue(project.due_date) && !done

  return (
    <div className="li hover">
      {ring ? (
        <span className="above"><StatusRing status={task.status} onToggle={() => toggleTaskDone(task)} /></span>
      ) : (
        <input className="cb round above" type="checkbox" checked={done} aria-label={done ? 'Mark as not done' : 'Mark complete'} onChange={() => toggleTaskDone(task)} />
      )}
      {showRef && <span className="mono xs faint above" style={{ minWidth: 52 }}>{taskRef(task, project)}</span>}
      <Link className="grow cover" to={`/tasks/${task.id}`} style={{ minWidth: 0 }}>
        <div className={cn('t trunc', done && 'faint')} style={done ? { textDecoration: 'line-through' } : undefined}>{task.title}</div>
        {(context || subs.length > 0 || (task.labels?.length ?? 0) > 0) && (
          <div className="s">
            {context && <ClientChip client={client} to={false} />}
            {context && project && <span className="trunc" style={{ maxWidth: 260 }}>{shortProjectTitle(project.title)}</span>}
            {subs.length > 0 && <span className="mono xs">{subs.filter((s) => s.done).length}/{subs.length}</span>}
            {task.labels?.slice(0, 2).map((l) => (
              <span key={l} className={`tag ${labelTone(l)}`}>{l}</span>
            ))}
          </div>
        )}
      </Link>
      {showPrio && <PrioBars priority={task.priority} />}
      {nComments > 0 && (
        <span className="row-sm small muted hide-sm">
          <MessageSquare className="i i-sm" />
          {nComments}
        </span>
      )}
      {projectLate ? <span className="date bad hide-sm">Project overdue</span> : <DateChip date={task.due_date} done={done} empty="" />}
      <Assignees ids={taskAssigneeIds(task)} profiles={profiles} />
    </div>
  )
}

/** Unpaid project money for a client, used on cards. */
export function useClientOpenMoney(clientId: string) {
  const payments = useData((s) => s.payments)
  return payments.filter((p) => p.client_id === clientId && isOpenPayment(p))
}
