import { useRef, useState } from 'react'
import { Calendar, UserPlus } from 'lucide-react'
import { useData } from '@/data/store'
import { setTaskAssignees, setTaskStatus, updateTask } from '@/data/actions'
import { Menu, MenuItem, MenuSep } from '@/components/ui/menu'
import { DateChip, PrioBars } from '@/components/ui/pill'
import { CalendarPopover } from '@/components/ui/date-picker'
import { AssigneePicker, Assignees } from '@/components/domain/AssigneePicker'
import { eligibleAssignees, taskAssigneeIds } from '@/lib/derive'
import { formatDate } from '@/lib/format'
import { priorityMeta, taskRing, taskStatus } from '@/lib/status'
import type { Priority, Task, TaskStatus } from '@/types'
import { cn } from '@/lib/utils'

// Edit a task's priority, status, due date and people straight from a list row,
// without opening the task. Same actions as the task page, so activity and
// notifications behave the same.

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'waiting_for_client', 'blocked', 'review', 'done']

export function InlinePriority({ task }: { task: Task }) {
  return (
    <Menu
      align="right"
      trigger={({ toggle, open }) => (
        <button type="button" className={cn('inline-edit above', open && 'open')} onClick={toggle} aria-label={`Priority: ${priorityMeta[task.priority].label}. Change`} title="Change priority">
          <PrioBars priority={task.priority} />
        </button>
      )}
    >
      {(Object.keys(priorityMeta) as Priority[]).map((p) => (
        <MenuItem key={p} on={p === task.priority} icon={<PrioBars priority={p} />} onSelect={() => updateTask(task, { priority: p }, `set priority to ${priorityMeta[p].label}`)}>
          {priorityMeta[p].label}
        </MenuItem>
      ))}
    </Menu>
  )
}

export function InlineStatus({ task, className }: { task: Task; className?: string }) {
  return (
    <Menu
      align="right"
      className={className}
      trigger={({ toggle, open }) => (
        <button type="button" className={cn('inline-edit above', open && 'open')} onClick={toggle} title="Change status">
          <span className={cn('pill', taskStatus[task.status].tone)}>
            <span className={cn('st', taskRing[task.status])} style={{ width: 11, height: 11 }} />
            {taskStatus[task.status].label}
          </span>
        </button>
      )}
    >
      {STATUSES.map((s) => (
        <MenuItem key={s} on={s === task.status} icon={<span className={`st ${taskRing[s]}`} />} onSelect={() => setTaskStatus(task, s)}>
          {taskStatus[s].label}
        </MenuItem>
      ))}
      <MenuSep />
      <MenuItem on={task.status === 'cancelled'} onSelect={() => setTaskStatus(task, 'cancelled')}>Cancelled</MenuItem>
    </Menu>
  )
}

export function InlineDate({ task }: { task: Task }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const done = task.status === 'done'
  return (
    <>
      <button
        ref={btn}
        type="button"
        className={cn('inline-edit above', open && 'open', !task.due_date && 'inline-empty')}
        onClick={() => setOpen((o) => !o)}
        aria-label={task.due_date ? `Due ${formatDate(task.due_date)}. Change` : 'Add a due date'}
        title={task.due_date ? 'Change due date' : 'Add a due date'}
      >
        {task.due_date ? <DateChip date={task.due_date} done={done} /> : <span className="date"><Calendar className="i i-xs" aria-hidden />Date</span>}
      </button>
      {open && (
        <CalendarPopover
          anchor={btn.current}
          value={task.due_date}
          clearable
          onClose={() => setOpen(false)}
          onChange={(v) => updateTask(task, { due_date: v }, v ? `set due date to ${formatDate(v)}` : 'removed the due date')}
        />
      )}
    </>
  )
}

export function InlineAssignees({ task }: { task: Task }) {
  const { projects, profiles, clientMembers, me } = useData()
  const project = projects.find((p) => p.id === task.project_id)
  const ids = taskAssigneeIds(task)
  // People with access to this project's client, plus anyone already on the task.
  const eligible = eligibleAssignees(project?.client_id, profiles, clientMembers)
  const people = [...eligible, ...profiles.filter((p) => ids.includes(p.id) && !eligible.includes(p))]
  return (
    <AssigneePicker
      people={people}
      value={ids}
      onChange={(next) => setTaskAssignees(task, next)}
      meId={me?.id}
      align="right"
      trigger={({ toggle, open }) => (
        <button type="button" className={cn('inline-edit above', open && 'open', !ids.length && 'inline-empty')} onClick={toggle} aria-haspopup="menu" aria-expanded={open} title={ids.length ? 'Change people' : 'Assign someone'}>
          {ids.length ? <Assignees ids={ids} profiles={profiles} /> : <span className="inline-avatar-add"><UserPlus className="i i-xs" /></span>}
        </button>
      )}
    />
  )
}
