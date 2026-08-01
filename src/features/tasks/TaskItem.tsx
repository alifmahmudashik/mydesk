import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Flag, MoreHorizontal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/dropdown'
import { Select, type SelectOption } from '@/components/ui/select'
import { TaskCheck } from '@/components/ui/task-check'
import { useData } from '@/data/store'
import { eligibleAssignees, profileDisplayName } from '@/lib/derive'
import { dueLabel, isOverdue } from '@/lib/format'
import { listItem } from '@/lib/motion'
import { options, priorityMeta, taskStatus, toneText } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { Task, TaskStatus } from '@/types'

const statusOptions = options(taskStatus)
const UNASSIGNED = 'unassigned'

interface TaskItemProps {
  task: Task
  /** Show the parent project name (global lists). */
  showProject?: boolean
}

/** THE task row, used everywhere tasks appear: check-off, title, due, priority, status select. */
export function TaskItem({ task, showProject }: TaskItemProps) {
  const updateRow = useData((s) => s.updateRow)
  const deleteRow = useData((s) => s.deleteRow)
  const project = useData((s) => s.projects.find((p) => p.id === task.project_id))
  const profiles = useData((s) => s.profiles)
  const clientMembers = useData((s) => s.clientMembers)
  const navigate = useNavigate()

  const done = task.status === 'done'
  const due = dueLabel(task.due_date)

  const assignable = eligibleAssignees(project?.client_id, profiles, clientMembers)
  const assigneeOptions: SelectOption<string>[] = [
    { value: UNASSIGNED, label: 'Unassigned' },
    ...assignable.map((p) => ({ value: p.id, label: profileDisplayName(p) })),
  ]

  const setAssignee = (value: string) => {
    const assignee_id = value === UNASSIGNED ? null : value
    if (assignee_id === (task.assignee_id ?? null)) return
    const assignee = assignable.find((p) => p.id === assignee_id)
    updateRow(
      'tasks',
      task.id,
      { assignee_id },
      {
        entity: 'task',
        entityId: task.id,
        action: 'updated',
        message: assignee
          ? `Assigned "${task.title}" to ${profileDisplayName(assignee)}`
          : `Unassigned "${task.title}"`,
      },
    )
  }

  const setStatus = (status: TaskStatus) => {
    if (status === task.status) return
    updateRow(
      'tasks',
      task.id,
      { status },
      {
        entity: 'task',
        entityId: task.id,
        action: status === 'done' ? 'completed' : 'status_changed',
        message:
          status === 'done'
            ? `Completed task "${task.title}"`
            : `Moved "${task.title}" to ${taskStatus[status].label}`,
      },
    )
  }

  return (
    <motion.div
      layout="position"
      variants={listItem}
      initial="initial"
      animate="animate"
      exit="exit"
      className="group flex min-h-12 items-center gap-3 px-4 py-2 transition-colors duration-150 hover:bg-surface-hover"
    >
      <TaskCheck
        checked={done}
        onToggle={() => setStatus(done ? 'todo' : 'done')}
        label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm transition-all duration-200',
            done && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </p>
        {(showProject || due) && (
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            {showProject && project && (
              <button
                type="button"
                onClick={() => navigate(`/clients/${project.client_id}?project=${project.id}`)}
                className="cursor-pointer truncate hover:text-primary hover:underline"
              >
                {project.title}
              </button>
            )}
            {due && !done && (
              <span className={cn('tnum shrink-0', isOverdue(task.due_date) && 'font-medium text-danger')}>
                {due}
              </span>
            )}
          </p>
        )}
      </div>
      {task.priority !== 'medium' && (
        <Flag
          role="img"
          aria-label={`${priorityMeta[task.priority].label} priority`}
          className={cn('size-4 shrink-0', toneText[priorityMeta[task.priority].tone])}
          strokeWidth={1.75}
          fill={task.priority === 'urgent' ? 'currentColor' : 'none'}
        />
      )}
      <Select
        value={task.assignee_id ?? UNASSIGNED}
        onChange={setAssignee}
        options={assigneeOptions}
        aria-label={`Assignee for "${task.title}"`}
        className="hidden h-8 w-28 shrink-0 text-[13px] sm:flex"
      />
      <Select
        value={task.status}
        onChange={setStatus}
        options={statusOptions}
        aria-label={`Status for "${task.title}"`}
        className="h-8 w-32 shrink-0 text-[13px]"
      />
      <Dropdown
        trigger={
          <Button variant="ghost" size="iconSm" aria-label={`More actions for "${task.title}"`}>
            <MoreHorizontal strokeWidth={1.75} />
          </Button>
        }
        items={[
          {
            label: 'Delete task',
            icon: Trash2,
            danger: true,
            onSelect: () =>
              deleteRow('tasks', task.id, {
                entity: 'task',
                entityId: task.id,
                action: 'deleted',
                message: `Deleted task "${task.title}"`,
              }),
          },
        ]}
      />
    </motion.div>
  )
}
