import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronRight,
  Clock,
  Copy,
  FolderKanban,
  Globe,
  Mail,
  MapPin,
  MessageSquareText,
  Pencil,
  Phone,
  Plus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusPill } from '@/components/ui/status-pill'
import { useData } from '@/data/store'
import { useIsAdmin } from '@/hooks/usePermissions'
import { clientDisplayName, clientSecondaryName, isOpenPayment, sumByCurrency } from '@/lib/derive'
import { formatDate, formatMoney } from '@/lib/format'
import { EASE_OUT_EXPO, listContainer, listItem } from '@/lib/motion'
import { clientStatus, projectStatus } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { Project } from '@/types'
import { ClientFormModal } from '@/features/clients/ClientFormModal'
import { ProjectDetail } from '@/features/projects/ProjectDetail'
import { ProjectFormModal } from '@/features/projects/ProjectFormModal'

/** "1. Title — $30" lines plus a per-currency total, ready to paste into a chat. */
function buildChatSummary(clientName: string, selected: Project[]) {
  const lines = selected.map((p, i) => `${i + 1}. ${p.title} — ${formatMoney(p.amount, p.currency)}`)
  return [
    `${clientName} — ${selected.length} project${selected.length === 1 ? '' : 's'}`,
    '',
    ...lines,
    '',
    `Total: ${sumByCurrency(selected)}`,
  ].join('\n')
}

interface ProjectCardProps {
  project: Project
  isAdmin: boolean
  isSelected: boolean
  selectMode: boolean
  checked: boolean
  onOpen: () => void
  onToggle: () => void
}

function ProjectCard({ project, isAdmin, isSelected, selectMode, checked, onOpen, onToggle }: ProjectCardProps) {
  return (
    <motion.button
      type="button"
      layout="position"
      variants={listItem}
      exit="exit"
      aria-current={!selectMode && isSelected ? true : undefined}
      aria-pressed={selectMode ? checked : undefined}
      onClick={selectMode ? onToggle : onOpen}
      className={cn(
        'w-full cursor-pointer rounded-xl border p-3.5 text-left shadow-sm transition-all duration-150',
        isSelected && !selectMode
          ? 'border-primary/50 bg-primary-soft'
          : checked
            ? 'border-primary/50 bg-primary-soft'
            : 'bg-surface hover:-translate-y-0.5 hover:bg-surface-hover hover:shadow-md',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {selectMode && (
            <span
              className={cn(
                'grid size-4.5 shrink-0 place-items-center rounded border transition-colors duration-150',
                checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong bg-surface',
              )}
              aria-hidden
            >
              {checked && <Check className="size-3" strokeWidth={3} />}
            </span>
          )}
          <p className="min-w-0 truncate text-sm font-medium">{project.title}</p>
        </div>
        <StatusPill meta={projectStatus[project.status]} animate={false} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        {isAdmin ? (
          <span className="tnum font-medium text-foreground">{formatMoney(project.amount, project.currency)}</span>
        ) : (
          <span />
        )}
        {project.due_date && (
          <span className="tnum flex items-center gap-1">
            <CalendarDays className="size-3.5" strokeWidth={1.75} aria-hidden />
            {formatDate(project.due_date)}
          </span>
        )}
      </div>
    </motion.button>
  )
}

function ContactRow({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[13px]">
      <Icon className="size-4 shrink-0 text-faint" strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 truncate">{children}</span>
    </div>
  )
}

/**
 * Client workspace, master-detail: client identity + selectable project cards on the left,
 * the selected project's tabbed detail (Overview / Tasks / Checklist / Notes) on the right.
 * Deep-linkable: /clients/:id?project=<projectId> — the Projects page routes here.
 */
export function ClientWorkspace() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { ready, clients, projects, payments, updateRow } = useData()
  const isAdmin = useIsAdmin()
  const [editOpen, setEditOpen] = useState(false)
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [finishedOpen, setFinishedOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exportText, setExportText] = useState<string | null>(null)

  const client = clients.find((c) => c.id === id)
  const clientProjects = useMemo(() => projects.filter((p) => p.client_id === id), [projects, id])
  // Finished projects are settled and paid — tuck them away like archived clients.
  const activeProjects = useMemo(() => clientProjects.filter((p) => p.status !== 'finished'), [clientProjects])
  const finishedProjects = useMemo(() => clientProjects.filter((p) => p.status === 'finished'), [clientProjects])
  const openBalance = payments.filter((p) => p.client_id === id && isOpenPayment(p))

  const selectedId = searchParams.get('project') ?? activeProjects[0]?.id ?? clientProjects[0]?.id ?? null
  const selected = clientProjects.find((p) => p.id === selectedId) ?? clientProjects[0]

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const toggleSelected = (projectId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  if (!ready) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (!client) {
    return (
      <EmptyState
        icon={MapPin}
        title="Client not found"
        description="It may have been deleted."
        action={
          <Button variant="secondary" onClick={() => navigate('/clients')}>
            <ArrowLeft strokeWidth={1.75} />
            Back to clients
          </Button>
        }
      />
    )
  }

  return (
    <>
      <Link
        to="/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
        Clients
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8">
        {/* ---- Left rail: client identity + projects ---- */}
        <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={clientDisplayName(client)} size="lg" />
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight">{clientDisplayName(client)}</h1>
                {clientSecondaryName(client) && (
                  <p className="truncate text-[13px] text-muted-foreground">{clientSecondaryName(client)}</p>
                )}
              </div>
            </div>
            {isAdmin && (
              <Button variant="ghost" size="iconSm" aria-label="Edit client" onClick={() => setEditOpen(true)}>
                <Pencil strokeWidth={1.75} />
              </Button>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <StatusPill meta={clientStatus[client.status]} />
            {isAdmin && client.status !== 'active' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  updateRow(
                    'clients',
                    client.id,
                    { status: 'active' },
                    {
                      entity: 'client',
                      entityId: client.id,
                      action: 'status_changed',
                      message: `Reactivated client "${clientDisplayName(client)}"`,
                    },
                  )
                }
              >
                Reactivate
              </Button>
            )}
          </div>

          {/* Members see the client's name only — contact details, balance and notes are admin-facing */}
          {isAdmin && (
          <>
          <div className="mt-4 space-y-2">
            {client.email && (
              <ContactRow icon={Mail}>
                <a href={`mailto:${client.email}`} className="hover:text-primary hover:underline">
                  {client.email}
                </a>
              </ContactRow>
            )}
            {client.phone && <ContactRow icon={Phone}>{client.phone}</ContactRow>}
            {client.website && (
              <ContactRow icon={Globe}>
                <a
                  href={`https://${client.website.replace(/^https?:\/\//, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-primary hover:underline"
                >
                  {client.website}
                </a>
              </ContactRow>
            )}
            {client.country && <ContactRow icon={MapPin}>{client.country}</ContactRow>}
            {client.timezone && <ContactRow icon={Clock}>{client.timezone}</ContactRow>}
          </div>

          {openBalance.length > 0 && (
            <p className="tnum mt-4 rounded-lg border border-dashed px-3 py-2 text-[13px]">
              <span className="font-semibold">{sumByCurrency(openBalance)}</span>{' '}
              <span className="text-muted-foreground">outstanding</span>
            </p>
          )}

          {client.notes && (
            <p className="mt-4 rounded-lg bg-surface-hover px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
              {client.notes}
            </p>
          )}
          </>
          )}

          <div className="mt-6 mb-2.5 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Projects · {clientProjects.length}
            </h2>
            <div className="flex items-center gap-0.5">
              {isAdmin && clientProjects.length > 0 && (
                <Button
                  variant="ghost"
                  size="iconSm"
                  aria-label={selectMode ? 'Cancel selection' : 'Select projects to export'}
                  aria-pressed={selectMode}
                  onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                >
                  {selectMode ? <X strokeWidth={1.75} /> : <CheckSquare strokeWidth={1.75} />}
                </Button>
              )}
              <Button variant="ghost" size="iconSm" aria-label="New project" onClick={() => setProjectFormOpen(true)}>
                <Plus strokeWidth={1.75} />
              </Button>
            </div>
          </div>

          <motion.div variants={listContainer} initial="initial" animate="animate" className="space-y-2">
            <AnimatePresence initial={false}>
              {activeProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isAdmin={isAdmin}
                  isSelected={selected?.id === project.id}
                  selectMode={selectMode}
                  checked={selectedIds.has(project.id)}
                  onOpen={() => setSearchParams({ project: project.id }, { replace: true })}
                  onToggle={() => toggleSelected(project.id)}
                />
              ))}
            </AnimatePresence>
          </motion.div>

          {clientProjects.length === 0 && (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-[13px] text-muted-foreground">
              No projects yet for this client.
            </p>
          )}

          {finishedProjects.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setFinishedOpen((v) => !v)}
                aria-expanded={finishedOpen}
                className="flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-faint transition-colors duration-150 hover:bg-surface-hover hover:text-muted-foreground"
              >
                <ChevronRight
                  className={cn('size-3.5 transition-transform duration-200', finishedOpen && 'rotate-90')}
                  strokeWidth={1.75}
                  aria-hidden
                />
                {finishedProjects.length} finished
              </button>
              <AnimatePresence initial={false}>
                {finishedOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1, transition: { duration: 0.2, ease: EASE_OUT_EXPO } }}
                    exit={{ height: 0, opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } }}
                    className="space-y-2 overflow-hidden pt-2"
                  >
                    {finishedProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        isAdmin={isAdmin}
                        isSelected={selected?.id === project.id}
                        selectMode={selectMode}
                        checked={selectedIds.has(project.id)}
                        onOpen={() => setSearchParams({ project: project.id }, { replace: true })}
                        onToggle={() => toggleSelected(project.id)}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {selectMode && (
            <div className="sticky bottom-4 mt-4 flex items-center justify-between gap-2 rounded-xl border bg-surface px-3.5 py-2.5 shadow-lg">
              <span className="text-[13px] font-medium">{selectedIds.size} selected</span>
              <Button
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={() => {
                  const selectedProjects = clientProjects.filter((p) => selectedIds.has(p.id))
                  setExportText(buildChatSummary(clientDisplayName(client), selectedProjects))
                }}
              >
                <MessageSquareText strokeWidth={1.75} />
                Export as chat
              </Button>
            </div>
          )}
        </aside>

        {/* ---- Right: selected project detail ---- */}
        <main className="min-w-0 lg:border-l lg:pl-8">
          {selected ? (
            <ProjectDetail
              key={selected.id}
              projectId={selected.id}
              onDeleted={() => setSearchParams({}, { replace: true })}
            />
          ) : (
            <EmptyState
              icon={FolderKanban}
              title="No project selected"
              description="Create a project for this client to start tracking tasks, access, and payments."
              action={
                <Button onClick={() => setProjectFormOpen(true)}>
                  <Plus strokeWidth={1.75} />
                  New project
                </Button>
              }
            />
          )}
        </main>
      </div>

      <ClientFormModal
        key={client.id}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        client={client}
        onDeleted={() => navigate('/clients')}
      />
      <ProjectFormModal
        key={projectFormOpen ? 'open' : 'closed'}
        open={projectFormOpen}
        onClose={() => setProjectFormOpen(false)}
        clientId={client.id}
      />

      <Modal
        open={exportText !== null}
        onClose={() => setExportText(null)}
        title="Export as chat"
        description="Copy this and paste it straight into email, WhatsApp, or Slack."
        footer={
          <Button
            onClick={() => {
              if (exportText) void navigator.clipboard.writeText(exportText).then(() => toast.success('Copied to clipboard'))
              setExportText(null)
              exitSelectMode()
            }}
          >
            <Copy strokeWidth={1.75} />
            Copy & close
          </Button>
        }
      >
        <pre className="whitespace-pre-wrap rounded-lg bg-surface-hover px-3.5 py-3 text-[13px] leading-relaxed">
          {exportText}
        </pre>
      </Modal>
    </>
  )
}
