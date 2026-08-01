import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ListTodo, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/dropdown'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/ui/modal'
import { RichTextEditor } from '@/components/ui/rich-text'
import { Select } from '@/components/ui/select'
import { StatusPill } from '@/components/ui/status-pill'
import { Tabs } from '@/components/ui/tabs'
import { useData } from '@/data/store'
import { useIsAdmin } from '@/hooks/usePermissions'
import { dueLabel, formatDate, formatMoney, isOverdue } from '@/lib/format'
import { EASE_OUT_EXPO, listContainer } from '@/lib/motion'
import { options, paymentStatus, priorityMeta, projectStatus } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { Priority, ProjectStatus } from '@/types'
import { AccessList } from '@/features/projects/AccessList'
import { NotesThread } from '@/features/projects/NotesThread'
import { ProjectFormModal } from '@/features/projects/ProjectFormModal'
import { QuickAddTask } from '@/features/tasks/QuickAddTask'
import { TaskItem } from '@/features/tasks/TaskItem'
import { ClientAccessEditor } from '@/features/team/ClientAccessEditor'

const statusOptions = options(projectStatus)
const priorityOptions = options(priorityMeta)

type TabKey = 'overview' | 'tasks' | 'checklist' | 'notes'

/** Compact label/value row for the properties rail (Linear-style, no boxes). */
function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-6 py-1.5">
      <dt className="shrink-0 text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm">{children}</dd>
    </div>
  )
}

interface ProjectDetailProps {
  projectId: string
  /** Called after the project is deleted so the parent can clear its selection. */
  onDeleted?: () => void
}

/** The project detail pane: header + Overview / Tasks / Checklist / Notes tabs. */
export function ProjectDetail({ projectId, onDeleted }: ProjectDetailProps) {
  const { projects, tasks, accessItems, notes, payments, updateRow, deleteRow } = useData()
  const isAdmin = useIsAdmin()
  const [tab, setTab] = useState<TabKey>('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const project = projects.find((p) => p.id === projectId)
  if (!project) return null

  const projectTasks = tasks
    .filter((t) => t.project_id === project.id)
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'))
  const openTasks = projectTasks.filter((t) => !['done', 'cancelled'].includes(t.status))
  const projectAccess = accessItems.filter((a) => a.project_id === project.id)
  const pendingAccess = projectAccess.filter((a) => a.status === 'needed' || a.status === 'requested')
  const projectNotes = notes.filter((n) => n.project_id === project.id)
  const projectPayments = payments.filter((p) => (p.project_ids ?? []).includes(project.id))

  const setStatus = (status: ProjectStatus) => {
    if (status === project.status) return
    updateRow(
      'projects',
      project.id,
      { status },
      {
        entity: 'project',
        entityId: project.id,
        action: status === 'completed' ? 'completed' : 'status_changed',
        message:
          status === 'completed'
            ? `Completed project "${project.title}"`
            : status === 'blocked'
              ? `Project "${project.title}" is blocked`
              : `Moved "${project.title}" to ${projectStatus[status].label}`,
      },
    )
  }

  const setPriority = (priority: Priority) => {
    if (priority === project.priority) return
    updateRow(
      'projects',
      project.id,
      { priority },
      {
        entity: 'project',
        entityId: project.id,
        action: 'updated',
        message: `Set "${project.title}" priority to ${priorityMeta[priority].label}`,
      },
    )
  }

  const overdue = isOverdue(project.due_date) && !['completed', 'cancelled'].includes(project.status)

  return (
    // Capped width: on wide screens the description and properties stay adjacent instead of
    // drifting to opposite edges of the viewport.
    <div className="min-w-0 max-w-5xl">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight">{project.title}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusPill meta={projectStatus[project.status]} />
            <StatusPill meta={priorityMeta[project.priority]} />
            {project.tags.map((t) => (
              <span
                key={t}
                className="rounded-md bg-surface-hover px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil strokeWidth={1.75} />
            Edit
          </Button>
          <Dropdown
            trigger={
              <Button variant="ghost" size="iconSm" aria-label="More project actions">
                <MoreHorizontal strokeWidth={1.75} />
              </Button>
            }
            items={[
              { label: 'Delete project', icon: Trash2, danger: true, onSelect: () => setConfirmDelete(true) },
            ]}
          />
        </div>
      </div>

      <Tabs<TabKey>
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'tasks', label: 'Tasks', count: openTasks.length },
          { key: 'checklist', label: 'Checklist', count: pendingAccess.length },
          { key: 'notes', label: 'Notes', count: projectNotes.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE_OUT_EXPO } }}
          exit={{ opacity: 0, transition: { duration: 0.1, ease: 'easeIn' } }}
          className="pt-6"
        >
          {tab === 'overview' && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
              {/* Main column: description + invoices + open tasks preview */}
              <div className="min-w-0 space-y-8">
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Description
                  </h3>
                  <RichTextEditor
                    key={project.id}
                    defaultValue={project.description}
                    onSave={(html) => {
                      if ((html ?? null) !== (project.description ?? null)) {
                        updateRow('projects', project.id, { description: html })
                      }
                    }}
                    placeholder="What is this project about? Click to write — saves automatically."
                    ariaLabel="Project description"
                  />
                </section>

                {isAdmin && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Invoices
                  </h3>
                  {projectPayments.length > 0 ? (
                    <ul className="divide-y rounded-xl border bg-surface shadow-sm">
                      {projectPayments.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                          <div>
                            <p className="tnum text-sm font-medium">{formatMoney(p.amount, p.currency)}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.status === 'paid' ? `Paid ${formatDate(p.payment_date)}` : `Due ${formatDate(p.due_date)}`}
                              {p.notes && ` · ${p.notes}`}
                            </p>
                          </div>
                          <StatusPill meta={paymentStatus[p.status]} animate={false} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-xl border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
                      No invoices linked to this project yet — log one from the Payments page.
                    </p>
                  )}
                </section>
                )}

                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Team access
                  </h3>
                  <p className="mb-3 text-[13px] text-muted-foreground">
                    Checked teammates can see every project under this client, not just this one.
                  </p>
                  <ClientAccessEditor clientId={project.client_id} />
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Open tasks
                    </h3>
                    {projectTasks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTab('tasks')}
                        className="cursor-pointer text-xs font-medium text-primary hover:underline"
                      >
                        View all
                      </button>
                    )}
                  </div>
                  {openTasks.length > 0 && (
                    <motion.div
                      variants={listContainer}
                      initial="initial"
                      animate="animate"
                      className="mb-3 divide-y rounded-xl border bg-surface shadow-sm"
                    >
                      <AnimatePresence initial={false}>
                        {openTasks.slice(0, 4).map((task) => (
                          <TaskItem key={task.id} task={task} />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  )}
                  <QuickAddTask projectId={project.id} />
                </section>
              </div>

              {/* Properties rail */}
              <aside className="lg:border-l lg:pl-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Properties
                </h3>
                <dl className="divide-y">
                  <Prop label="Status">
                    <Select
                      value={project.status}
                      onChange={setStatus}
                      options={statusOptions}
                      aria-label="Project status"
                      className="h-8 w-40 text-[13px]"
                    />
                  </Prop>
                  <Prop label="Priority">
                    <Select
                      value={project.priority}
                      onChange={setPriority}
                      options={priorityOptions}
                      aria-label="Project priority"
                      className="h-8 w-40 text-[13px]"
                    />
                  </Prop>
                  {isAdmin && (
                    <Prop label="Budget">
                      <span className="tnum font-medium">{formatMoney(project.amount, project.currency)}</span>
                    </Prop>
                  )}
                  {isAdmin && (
                    <Prop label="Payment">
                      <StatusPill meta={paymentStatus[project.payment_status]} />
                    </Prop>
                  )}
                  <Prop label="Due">
                    <span className={cn('tnum', overdue && 'font-medium text-danger')}>
                      {formatDate(project.due_date)}
                    </span>
                    {!['completed', 'cancelled'].includes(project.status) && dueLabel(project.due_date) && (
                      <span className={cn('block text-xs', overdue ? 'text-danger' : 'text-muted-foreground')}>
                        {dueLabel(project.due_date)}
                      </span>
                    )}
                  </Prop>
                  <Prop label="Start">
                    <span className="tnum">{formatDate(project.start_date)}</span>
                  </Prop>
                  <Prop label="Type">{project.project_type ?? '—'}</Prop>
                  <Prop label="Created">
                    <span className="tnum">{formatDate(project.created_at)}</span>
                  </Prop>
                </dl>
              </aside>
            </div>
          )}

          {tab === 'tasks' && (
            <div className="max-w-3xl">
              {projectTasks.length > 0 ? (
                <motion.div
                  variants={listContainer}
                  initial="initial"
                  animate="animate"
                  className="mb-3 divide-y rounded-xl border bg-surface shadow-sm"
                >
                  <AnimatePresence initial={false}>
                    {projectTasks.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <div className="mb-4">
                  <EmptyState
                    icon={ListTodo}
                    title="No tasks yet"
                    description="Break the project into steps — add the first one below."
                  />
                </div>
              )}
              <QuickAddTask projectId={project.id} />
            </div>
          )}

          {tab === 'checklist' && (
            <div className="max-w-3xl">
              <AccessList projectId={project.id} />
            </div>
          )}

          {tab === 'notes' && (
            <div className="max-w-3xl">
              <NotesThread projectId={project.id} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <ProjectFormModal key={project.id} open={editOpen} onClose={() => setEditOpen(false)} project={project} />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          // Invoices covering only this project go with it; multi-project invoices just drop it.
          for (const p of projectPayments) {
            const rest = (p.project_ids ?? []).filter((id) => id !== project.id)
            if (rest.length === 0) {
              deleteRow('payments', p.id)
            } else {
              updateRow('payments', p.id, { project_ids: rest })
            }
          }
          deleteRow('projects', project.id, {
            entity: 'project',
            entityId: project.id,
            action: 'deleted',
            message: `Deleted project "${project.title}"`,
          })
          onDeleted?.()
        }}
        title={`Delete ${project.title}?`}
        description="This removes the project with its tasks, checklist, notes, and any invoice that only covers this project. This can’t be undone."
      />
    </div>
  )
}
