import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  FolderKanban,
  KeyRound,
  ListTodo,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  Users,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { CardSkeleton, ListSkeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/ui/stat-card'
import { useData } from '@/data/store'
import { useIsAdmin } from '@/hooks/usePermissions'
import { effectivePaymentStatus, sumByCurrency } from '@/lib/derive'
import { daysUntil, formatAgo } from '@/lib/format'
import { listContainer, listItem } from '@/lib/motion'
import { toneDot, type Tone } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { ActivityEvent } from '@/types'
import { TaskItem } from '@/features/tasks/TaskItem'
import { TaskFormModal } from '@/features/tasks/TaskFormModal'
import { ProjectFormModal } from '@/features/projects/ProjectFormModal'
import { ClientFormModal } from '@/features/clients/ClientFormModal'

function getDynamicGreeting(displayName?: string | null) {
  const h = new Date().getHours()
  const firstName = displayName && displayName !== 'You' ? displayName.trim().split(' ')[0] : null
  const greetingName = firstName ? `, ${firstName}` : ''

  const sparkle = '✨'
  if (h < 5) {
    return {
      title: `Working late${greetingName} ${sparkle}`,
      sub: 'Night owl session — stay focused and take breaks when needed.',
    }
  }
  if (h < 12) {
    return {
      title: `Good morning${greetingName} ${sparkle}`,
      sub: 'Here is your daily snapshot and priorities for today.',
    }
  }
  if (h < 18) {
    return {
      title: `Good afternoon${greetingName} ${sparkle}`,
      sub: 'Keep up the steady momentum on your ongoing work.',
    }
  }
  return {
    title: `Good evening${greetingName} ${sparkle}`,
    sub: 'Review today’s updates and progress across your projects.',
  }
}

const ENTITY_ICON: Record<ActivityEvent['entity'], LucideIcon> = {
  client: Users,
  project: FolderKanban,
  task: ListTodo,
  access_item: KeyRound,
  payment: CircleDollarSign,
  note: StickyNote,
}

const ACTION_META: Record<ActivityEvent['action'], { tone: Tone; icon?: LucideIcon }> = {
  created: { tone: 'neutral', icon: Plus },
  updated: { tone: 'neutral', icon: Pencil },
  status_changed: { tone: 'accent' },
  completed: { tone: 'green', icon: CheckCircle2 },
  paid: { tone: 'green', icon: CircleDollarSign },
  deleted: { tone: 'red', icon: Trash2 },
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { ready, projects, tasks, accessItems, payments, activity, me } = useData()
  const isAdmin = useIsAdmin()

  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [clientModalOpen, setClientModalOpen] = useState(false)

  const greetingInfo = useMemo(() => getDynamicGreeting(me?.display_name), [me?.display_name])

  const overduePayments = useMemo(
    () => payments.filter((p) => effectivePaymentStatus(p) === 'overdue'),
    [payments],
  )
  const attentionProjects = useMemo(
    () =>
      projects.filter(
        (p) =>
          p.status === 'blocked' ||
          (p.priority === 'urgent' && !['completed', 'finished', 'cancelled'].includes(p.status)),
      ),
    [projects],
  )
  const dueThisWeek = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.status === 'done' || t.status === 'cancelled') return false
        const d = daysUntil(t.due_date)
        return d !== null && d <= 7
      }),
    [tasks],
  )
  const pendingAccess = useMemo(
    () => accessItems.filter((a) => a.status === 'needed' || a.status === 'requested'),
    [accessItems],
  )
  const upNext = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'done' && t.status !== 'cancelled')
        .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
        .slice(0, 6),
    [tasks],
  )

  const dateDescription = useMemo(() => {
    const formattedDate = format(new Date(), 'EEEE, MMMM d, yyyy')
    return formattedDate
  }, [])

  return (
    <>
      <PageHeader
        title={greetingInfo.title}
        description={dateDescription}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              onClick={() => setTaskModalOpen(true)}
              className="bg-surface hover:bg-surface-hover border shadow-2xs transition-all duration-150 active:scale-95 text-foreground"
            >
              <Plus strokeWidth={1.75} className="size-4" />
              <span>New Task</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => setProjectModalOpen(true)}
              className="bg-surface hover:bg-surface-hover border shadow-2xs transition-all duration-150 active:scale-95 text-foreground"
            >
              <FolderKanban strokeWidth={1.75} className="size-4" />
              <span>New Project</span>
            </Button>
            <Button
              variant="primary"
              onClick={() => setClientModalOpen(true)}
              className="shadow-sm transition-all duration-150 active:scale-95"
            >
              <Plus strokeWidth={2} className="size-4" />
              <span>Add Client</span>
            </Button>
          </div>
        }
      />

      {!ready ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
          <div className="mt-6">
            <ListSkeleton rows={5} />
          </div>
        </>
      ) : (
        <>
          {/* Quick Actions toolbar banner for small screens or extra accessibility */}
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border bg-surface/60 p-3.5 backdrop-blur-sm sm:hidden">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Zap className="size-3.5 text-primary" strokeWidth={2} />
              <span>Quick actions</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setTaskModalOpen(true)}>
                <Plus strokeWidth={2} className="size-3.5" />
                <span>Task</span>
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setProjectModalOpen(true)}>
                <Plus strokeWidth={2} className="size-3.5" />
                <span>Project</span>
              </Button>
            </div>
          </div>

          {/* At-a-glance: each card answers one question and jumps to the list behind it */}
          <motion.div
            variants={listContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {isAdmin && (
              <StatCard
                icon={AlertTriangle}
                label="Overdue payments"
                value={String(overduePayments.length)}
                hint={overduePayments.length ? `${sumByCurrency(overduePayments)} to chase` : 'All caught up'}
                tone={overduePayments.length ? 'red' : 'green'}
                onClick={() => navigate('/payments')}
              />
            )}
            <StatCard
              icon={FolderKanban}
              label="Needs attention"
              value={String(attentionProjects.length)}
              hint={attentionProjects.length ? 'Blocked or urgent projects' : 'No fires burning'}
              tone={attentionProjects.length ? 'amber' : 'green'}
              onClick={() => navigate('/projects')}
            />
            <StatCard
              icon={ListTodo}
              label="Tasks due this week"
              value={String(dueThisWeek.length)}
              hint={
                dueThisWeek.filter((t) => (daysUntil(t.due_date) ?? 1) < 0).length
                  ? `${dueThisWeek.filter((t) => (daysUntil(t.due_date) ?? 1) < 0).length} already overdue`
                  : 'On schedule'
              }
              tone={dueThisWeek.some((t) => (daysUntil(t.due_date) ?? 1) < 0) ? 'red' : 'accent'}
              onClick={() => navigate('/tasks')}
            />
            <StatCard
              icon={KeyRound}
              label="Pending access"
              value={String(pendingAccess.length)}
              hint={pendingAccess.length ? 'Needed or requested items' : 'Everything received'}
              tone={pendingAccess.length ? 'amber' : 'green'}
              onClick={() => navigate('/projects')}
            />
          </motion.div>

          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Up next */}
            <Card className="transition-all duration-200 hover:shadow-sm">
              <CardHeader title="Up next" />
              {upNext.length > 0 ? (
                <motion.div
                  variants={listContainer}
                  initial="initial"
                  animate="animate"
                  className="mt-3 divide-y border-t"
                >
                  <AnimatePresence initial={false}>
                    {upNext.map((task) => (
                      <TaskItem key={task.id} task={task} showProject />
                    ))}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <div className="px-5 py-4">
                  <EmptyState
                    icon={CheckCircle2}
                    title="Nothing queued"
                    description="No open tasks — enjoy it while it lasts."
                  />
                </div>
              )}
            </Card>

            {/* Activity feed */}
            <Card className="transition-all duration-200 hover:shadow-sm">
              <CardHeader title="Recent activity" />
              {activity.length > 0 ? (
                <motion.ul
                  variants={listContainer}
                  initial="initial"
                  animate="animate"
                  className="mt-3 border-t px-5 py-3"
                >
                  {activity.slice(0, 12).map((event) => {
                    const Icon = ACTION_META[event.action].icon ?? ENTITY_ICON[event.entity]
                    return (
                      <motion.li key={event.id} variants={listItem} className="relative flex gap-3 pb-4 last:pb-1">
                        <div className="flex flex-col items-center">
                          <span className="grid size-6 shrink-0 place-items-center rounded-full border bg-background shadow-2xs">
                            <Icon className="size-3 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                          </span>
                          <span className="mt-1 w-px flex-1 bg-border" aria-hidden />
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <p className="text-[13px] leading-snug">{event.message}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span
                              className={cn('size-1.5 rounded-full', toneDot[ACTION_META[event.action].tone])}
                              aria-hidden
                            />
                            {formatAgo(event.created_at)}
                          </p>
                        </div>
                      </motion.li>
                    )
                  })}
                </motion.ul>
              ) : (
                <p className="mt-3 border-t px-5 py-6 text-[13px] text-muted-foreground">
                  Activity across clients, projects, tasks, and payments shows up here.
                </p>
              )}
            </Card>
          </div>
        </>
      )}

      {/* Creation modals triggered from Quick Action buttons */}
      <TaskFormModal
        key={taskModalOpen ? 'task-open' : 'task-closed'}
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
      />
      <ProjectFormModal
        key={projectModalOpen ? 'project-open' : 'project-closed'}
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
      />
      <ClientFormModal
        key={clientModalOpen ? 'client-open' : 'client-closed'}
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
      />
    </>
  )
}

