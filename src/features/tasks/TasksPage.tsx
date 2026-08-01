import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ListTodo, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Select, type SelectOption } from '@/components/ui/select'
import { ListSkeleton } from '@/components/ui/skeleton'
import { SearchInput, Toolbar } from '@/components/ui/toolbar'
import { useData } from '@/data/store'
import { clientDisplayName } from '@/lib/derive'
import { daysUntil } from '@/lib/format'
import { listContainer } from '@/lib/motion'
import { options, taskStatus } from '@/lib/status'
import type { Task, TaskStatus } from '@/types'
import { TaskFormModal } from '@/features/tasks/TaskFormModal'
import { TaskItem } from '@/features/tasks/TaskItem'

const statusFilter: SelectOption<'all' | TaskStatus>[] = [
  { value: 'all', label: 'All statuses' },
  ...options(taskStatus),
]
const groupOptions: SelectOption<'status' | 'due'>[] = [
  { value: 'status', label: 'Group by status' },
  { value: 'due', label: 'Group by due date' },
]

const STATUS_ORDER: TaskStatus[] = ['in_progress', 'review', 'todo', 'done', 'cancelled']

function dueGroup(task: Task): string {
  if (task.status === 'done' || task.status === 'cancelled') return 'Wrapped up'
  const d = daysUntil(task.due_date)
  if (d === null) return 'No due date'
  if (d < 0) return 'Overdue'
  if (d === 0) return 'Today'
  if (d <= 7) return 'This week'
  return 'Later'
}

const DUE_ORDER = ['Overdue', 'Today', 'This week', 'Later', 'No due date', 'Wrapped up']

/** Global task list — "what do I need to do today" without opening every project. */
export function TasksPage() {
  const { ready, tasks, projects, clients } = useData()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | TaskStatus>('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [grouping, setGrouping] = useState<'status' | 'due'>('due')
  const [formOpen, setFormOpen] = useState(false)

  const projectOptions = [
    { value: 'all', label: 'All projects' },
    ...projects.map((p) => {
      const client = clients.find((c) => c.id === p.client_id)
      return { value: p.id, label: `${p.title}${client ? ` — ${clientDisplayName(client)}` : ''}` }
    }),
  ]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter(
      (t) =>
        (status === 'all' || t.status === status) &&
        (projectFilter === 'all' || t.project_id === projectFilter) &&
        (!q || t.title.toLowerCase().includes(q)),
    )
  }, [tasks, search, status, projectFilter])

  const groups = useMemo(() => {
    const byDue = (a: Task, b: Task) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
    if (grouping === 'status') {
      return STATUS_ORDER.map((s) => ({
        key: s,
        label: taskStatus[s].label,
        tasks: filtered.filter((t) => t.status === s).sort(byDue),
      })).filter((g) => g.tasks.length > 0)
    }
    return DUE_ORDER.map((label) => ({
      key: label,
      label,
      tasks: filtered.filter((t) => dueGroup(t) === label).sort(byDue),
    })).filter((g) => g.tasks.length > 0)
  }, [filtered, grouping])

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Everything on your plate, across all projects."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus strokeWidth={1.75} />
            New task
          </Button>
        }
      />
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search tasks…" />
        <Select value={status} onChange={setStatus} options={statusFilter} aria-label="Filter by status" className="w-36" />
        <Select value={projectFilter} onChange={setProjectFilter} options={projectOptions} aria-label="Filter by project" className="w-56" />
        <Select value={grouping} onChange={setGrouping} options={groupOptions} aria-label="Grouping" className="ml-auto w-44" />
      </Toolbar>

      {!ready ? (
        <ListSkeleton rows={7} />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title={tasks.length === 0 ? 'No tasks yet' : 'No tasks match'}
          description={
            tasks.length === 0
              ? 'Add a task to a project and it shows up here.'
              : 'Try different filters or clear the search.'
          }
          action={
            tasks.length === 0 && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus strokeWidth={1.75} />
                New task
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
                {group.label}
                <span className="tnum text-xs font-medium text-muted-foreground">{group.tasks.length}</span>
              </h2>
              <motion.div
                variants={listContainer}
                initial="initial"
                animate="animate"
                className="divide-y rounded-xl border bg-surface shadow-sm"
              >
                <AnimatePresence initial={false}>
                  {group.tasks.map((task) => (
                    <TaskItem key={task.id} task={task} showProject />
                  ))}
                </AnimatePresence>
              </motion.div>
            </section>
          ))}
        </div>
      )}

      <TaskFormModal key={formOpen ? 'open' : 'closed'} open={formOpen} onClose={() => setFormOpen(false)} />
    </>
  )
}
