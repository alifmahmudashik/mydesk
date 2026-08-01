import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/dropdown'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/page-header'
import { Select, type SelectOption } from '@/components/ui/select'
import { ListSkeleton } from '@/components/ui/skeleton'
import { StatusPill } from '@/components/ui/status-pill'
import { Row, Table, TD, TH, THead } from '@/components/ui/table'
import { SearchInput, Toolbar } from '@/components/ui/toolbar'
import { useData } from '@/data/store'
import { useIsAdmin } from '@/hooks/usePermissions'
import { clientDisplayName, clientSecondaryName, isOpenPayment, sumByCurrency } from '@/lib/derive'
import { listContainer } from '@/lib/motion'
import { clientStatus, options } from '@/lib/status'
import type { Client, ClientStatus } from '@/types'
import { ClientFormModal } from '@/features/clients/ClientFormModal'

// Active first and default — archived clients stay out of the way unless asked for.
const statusFilterOptions: SelectOption<'all' | ClientStatus>[] = [
  ...options(clientStatus),
  { value: 'all', label: 'All statuses' },
]

export function ClientsPage() {
  const navigate = useNavigate()
  const { ready, clients, projects, payments, deleteRow } = useData()
  const isAdmin = useIsAdmin()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | ClientStatus>('active')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Client>()
  const [deleting, setDeleting] = useState<Client>()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clients.filter(
      (c) =>
        (status === 'all' || c.status === status) &&
        (!q || `${c.name} ${c.company_name ?? ''} ${c.email ?? ''}`.toLowerCase().includes(q)),
    )
  }, [clients, search, status])

  return (
    <>
      <PageHeader
        title="Clients"
        description="Everyone you work with, and where each engagement stands."
        actions={
          isAdmin && (
            <Button onClick={() => { setEditing(undefined); setFormOpen(true) }}>
              <Plus strokeWidth={1.75} />
              New client
            </Button>
          )
        }
      />
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search clients…" />
        <Select
          value={status}
          onChange={setStatus}
          options={statusFilterOptions}
          aria-label="Filter by status"
          className="w-40"
        />
      </Toolbar>

      {!ready ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={clients.length === 0 ? 'No clients yet' : 'No clients match'}
          description={
            clients.length === 0
              ? 'Add your first client to start tracking projects and payments.'
              : 'Try a different search or status filter.'
          }
          action={
            clients.length === 0 && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus strokeWidth={1.75} />
                New client
              </Button>
            )
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>Client</TH>
            <TH>Status</TH>
            <TH className="text-right">Projects</TH>
            {isAdmin && <TH className="text-right">Open balance</TH>}
            {isAdmin && <TH className="hidden md:table-cell">Country</TH>}
            {isAdmin && <TH className="w-12" />}
          </THead>
          <motion.tbody variants={listContainer} initial="initial" animate="animate" className="divide-y">
            <AnimatePresence initial={false}>
              {filtered.map((client) => {
                const clientProjects = projects.filter((p) => p.client_id === client.id)
                const open = payments.filter((p) => p.client_id === client.id && isOpenPayment(p))
                return (
                  <Row
                    key={client.id}
                    clickable
                    onClick={() => navigate(`/clients/${client.id}`)}
                    exit="exit"
                  >
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={clientDisplayName(client)} />
                        <div>
                          <p className="font-medium">{clientDisplayName(client)}</p>
                          {clientSecondaryName(client) && (
                            <p className="text-xs text-muted-foreground">{clientSecondaryName(client)}</p>
                          )}
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <StatusPill meta={clientStatus[client.status]} animate={false} />
                    </TD>
                    <TD className="tnum text-right text-muted-foreground">{clientProjects.length}</TD>
                    {isAdmin && (
                      <TD className="tnum text-right">
                        {open.length > 0 ? (
                          <span className="font-medium">{sumByCurrency(open)}</span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </TD>
                    )}
                    {isAdmin && (
                      <TD className="hidden text-muted-foreground md:table-cell">
                        {client.country ?? '—'}
                      </TD>
                    )}
                    {isAdmin && (
                    <TD>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                          trigger={
                            <Button
                              variant="ghost"
                              size="iconSm"
                              aria-label={`Actions for ${client.name}`}
                            >
                              <MoreHorizontal strokeWidth={1.75} />
                            </Button>
                          }
                          items={[
                            {
                              label: 'Edit',
                              icon: Pencil,
                              onSelect: () => { setEditing(client); setFormOpen(true) },
                            },
                            {
                              label: 'Delete',
                              icon: Trash2,
                              danger: true,
                              onSelect: () => setDeleting(client),
                            },
                          ]}
                        />
                      </div>
                    </TD>
                    )}
                  </Row>
                )
              })}
            </AnimatePresence>
          </motion.tbody>
        </Table>
      )}

      <ClientFormModal
        key={editing?.id ?? 'new'}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        client={editing}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(undefined)}
        onConfirm={() => {
          if (!deleting) return
          deleteRow('clients', deleting.id, {
            entity: 'client',
            entityId: deleting.id,
            action: 'deleted',
            message: `Deleted client "${deleting.name}"`,
          })
        }}
        title={`Delete ${deleting?.name}?`}
        description="This removes the client and everything under them — projects, tasks, payments, and notes. This can’t be undone."
      />
    </>
  )
}
