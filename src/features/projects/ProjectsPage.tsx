import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FolderKanban, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Select, type SelectOption } from '@/components/ui/select'
import { ListSkeleton } from '@/components/ui/skeleton'
import { StatusPill } from '@/components/ui/status-pill'
import { Row, Table, TD, TH, THead } from '@/components/ui/table'
import { SearchInput, Toolbar } from '@/components/ui/toolbar'
import { useData } from '@/data/store'
import { useIsAdmin } from '@/hooks/usePermissions'
import { clientDisplayName } from '@/lib/derive'
import { formatDate, formatMoney, isOverdue } from '@/lib/format'
import { listContainer } from '@/lib/motion'
import { options, paymentStatus, priorityMeta, projectStatus, tonePill } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { Priority, ProjectStatus } from '@/types'
import { ProjectFormModal } from '@/features/projects/ProjectFormModal'

const statusFilter: SelectOption<'all' | ProjectStatus>[] = [
  { value: 'all', label: 'All statuses' },
  ...options(projectStatus),
]
const priorityFilter: SelectOption<'all' | Priority>[] = [
  { value: 'all', label: 'All priorities' },
  ...options(priorityMeta),
]

export function ProjectsPage() {
  const { ready, projects, clients } = useData()
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | ProjectStatus>('all')
  const [priority, setPriority] = useState<'all' | Priority>('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)

  /** Project details live in the client workspace (master-detail). */
  const openProject = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    if (project) navigate(`/clients/${project.client_id}?project=${project.id}`)
  }

  // Legacy deep links (?p=<id>) forward to the workspace.
  const legacyId = searchParams.get('p')
  useEffect(() => {
    if (ready && legacyId) openProject(legacyId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, legacyId])

  const clientOptions = [
    { value: 'all', label: 'All clients' },
    ...clients.map((c) => ({ value: c.id, label: clientDisplayName(c) })),
  ]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter((p) => {
      const client = clients.find((c) => c.id === p.client_id)
      return (
        // Finished projects are done and paid — keep them out of the way, like archived
        // clients, unless someone explicitly filters to "Finished".
        (status === 'all' ? p.status !== 'finished' : p.status === status) &&
        (priority === 'all' || p.priority === priority) &&
        (clientFilter === 'all' || p.client_id === clientFilter) &&
        (!q ||
          `${p.title} ${p.project_type ?? ''} ${p.tags.join(' ')} ${client?.company_name ?? ''} ${client?.name ?? ''}`
            .toLowerCase()
            .includes(q))
      )
    })
  }, [projects, clients, search, status, priority, clientFilter])

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every engagement, its status, and what it's worth."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus strokeWidth={1.75} />
            New project
          </Button>
        }
      />
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search projects, tags…" />
        <Select value={status} onChange={setStatus} options={statusFilter} aria-label="Filter by status" className="w-44" />
        <Select value={priority} onChange={setPriority} options={priorityFilter} aria-label="Filter by priority" className="w-36" />
        <Select value={clientFilter} onChange={setClientFilter} options={clientOptions} aria-label="Filter by client" className="w-44" />
      </Toolbar>

      {!ready ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={projects.length === 0 ? 'No projects yet' : 'No projects match'}
          description={
            projects.length === 0
              ? 'Create your first project and start tracking work, access, and payments.'
              : 'Try different filters or clear the search.'
          }
          action={
            projects.length === 0 && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus strokeWidth={1.75} />
                New project
              </Button>
            )
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>Project</TH>
            <TH>Status</TH>
            <TH className="hidden md:table-cell">Priority</TH>
            {isAdmin && <TH>Payment</TH>}
            {isAdmin && <TH className="text-right">Amount</TH>}
            <TH className="hidden text-right lg:table-cell">Due</TH>
          </THead>
          <motion.tbody variants={listContainer} initial="initial" animate="animate" className="divide-y">
            <AnimatePresence initial={false}>
              {filtered.map((project) => {
                const client = clients.find((c) => c.id === project.client_id)
                const overdue = isOverdue(project.due_date) && !['completed', 'finished', 'cancelled'].includes(project.status)
                return (
                  <Row
                    key={project.id}
                    clickable
                    exit="exit"
                    onClick={() => openProject(project.id)}
                  >
                    <TD>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'grid size-9 shrink-0 place-items-center rounded-lg',
                            tonePill[projectStatus[project.status].tone],
                          )}
                          aria-hidden
                        >
                          <FolderKanban className="size-4" strokeWidth={1.75} />
                        </span>
                        <div>
                          <p className="font-medium">{project.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {clientDisplayName(client)}
                            {project.tags.length > 0 && <> · {project.tags.join(', ')}</>}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <StatusPill meta={projectStatus[project.status]} animate={false} />
                    </TD>
                    <TD className="hidden md:table-cell">
                      <StatusPill meta={priorityMeta[project.priority]} animate={false} />
                    </TD>
                    {isAdmin && (
                      <TD>
                        <StatusPill meta={paymentStatus[project.payment_status]} animate={false} />
                      </TD>
                    )}
                    {isAdmin && (
                      <TD className="tnum text-right font-medium">
                        {formatMoney(project.amount, project.currency)}
                      </TD>
                    )}
                    <TD className={cn('tnum hidden text-right lg:table-cell', overdue ? 'font-medium text-danger' : 'text-muted-foreground')}>
                      {formatDate(project.due_date)}
                    </TD>
                  </Row>
                )
              })}
            </AnimatePresence>
          </motion.tbody>
        </Table>
      )}

      <ProjectFormModal key={formOpen ? 'open' : 'closed'} open={formOpen} onClose={() => setFormOpen(false)} />
    </>
  )
}
