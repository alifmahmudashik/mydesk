import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatISO } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Check,
  CircleDollarSign,
  CreditCard,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/dropdown'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/page-header'
import { Select, type SelectOption } from '@/components/ui/select'
import { CardSkeleton, ListSkeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/ui/stat-card'
import { StatusPill } from '@/components/ui/status-pill'
import { PanelSection, SlideOverPanel } from '@/components/ui/slide-over'
import { Row, Table, TD, TH, THead } from '@/components/ui/table'
import { SearchInput, Toolbar } from '@/components/ui/toolbar'
import { useData } from '@/data/store'
import { useIsAdmin } from '@/hooks/usePermissions'
import { celebrateFrom } from '@/lib/confetti'
import { clientDisplayName, effectivePaymentStatus, isOpenPayment, sumByCurrency } from '@/lib/derive'
import { formatDate, formatMoney } from '@/lib/format'
import { listContainer } from '@/lib/motion'
import { options, paymentStatus } from '@/lib/status'
import type { Payment, PaymentStatus } from '@/types'
import { PaymentFormModal } from '@/features/payments/PaymentFormModal'

type PaymentFilter = 'open' | 'all' | PaymentStatus
const statusFilter: SelectOption<PaymentFilter>[] = [
  { value: 'open', label: 'Open (unpaid)' },
  { value: 'all', label: 'All statuses' },
  ...options(paymentStatus),
]

export function PaymentsPage() {
  const { ready, payments, clients, projects, updateRow, deleteRow } = useData()
  const isAdmin = useIsAdmin()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  // "What am I owed" is the default question — open payments first.
  const [status, setStatus] = useState<PaymentFilter>('open')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Payment>()
  const [deleting, setDeleting] = useState<Payment>()

  const openId = searchParams.get('p')
  const openPayment = payments.find((p) => p.id === openId)

  const clientName = (id: string) => clientDisplayName(clients.find((c) => c.id === id))
  const projectTitles = (p: Payment) =>
    (p.project_ids ?? [])
      .map((id) => projects.find((pr) => pr.id === id)?.title)
      .filter(Boolean)
      .join(', ')

  const matchesStatus = (p: Payment) =>
    status === 'all' ? true : status === 'open' ? isOpenPayment(p) : effectivePaymentStatus(p) === status

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return payments.filter(
      (p) =>
        matchesStatus(p) &&
        (!q || `${clientName(p.client_id)} ${projectTitles(p)}`.toLowerCase().includes(q)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, clients, projects, search, status])

  if (!isAdmin) {
    return (
      <EmptyState
        icon={CreditCard}
        title="Admins only"
        description="Payments are only visible to the workspace owner and admins."
      />
    )
  }

  const open = payments.filter(isOpenPayment)
  const overdue = payments.filter((p) => effectivePaymentStatus(p) === 'overdue')
  const thisMonth = formatISO(new Date(), { representation: 'date' }).slice(0, 7)
  const paidThisMonth = payments.filter((p) => p.status === 'paid' && p.payment_date?.startsWith(thisMonth))

  /** The "marked paid" moment: optimistic flip + confetti from the trigger + toast. */
  function markPaid(payment: Payment, trigger: HTMLElement | null) {
    updateRow(
      'payments',
      payment.id,
      { status: 'paid', payment_date: formatISO(new Date(), { representation: 'date' }) },
      {
        entity: 'payment',
        entityId: payment.id,
        action: 'paid',
        message: `Received ${formatMoney(payment.amount, payment.currency)} from ${clientName(payment.client_id)}`,
      },
    )
    celebrateFrom(trigger)
    toast.success(`${formatMoney(payment.amount, payment.currency)} received`, {
      description: `${clientName(payment.client_id)} — marked as paid.`,
    })
  }

  return (
    <>
      <PageHeader
        title="Payments"
        description="What you're owed, what's late, and what came in."
        actions={
          <Button onClick={() => { setEditing(undefined); setFormOpen(true) }}>
            <Plus strokeWidth={1.75} />
            New payment
          </Button>
        }
      />

      {/* Totals */}
      {!ready ? (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <motion.div
          variants={listContainer}
          initial="initial"
          animate="animate"
          className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <StatCard
            icon={Wallet}
            label="Outstanding"
            value={sumByCurrency(open)}
            hint={`${open.length} open payment${open.length === 1 ? '' : 's'}`}
            tone="amber"
          />
          <StatCard
            icon={AlertTriangle}
            label="Overdue"
            value={sumByCurrency(overdue)}
            hint={overdue.length ? `${overdue.length} need chasing` : 'Nothing late'}
            tone={overdue.length ? 'red' : 'green'}
          />
          <StatCard
            icon={CircleDollarSign}
            label="Paid this month"
            value={sumByCurrency(paidThisMonth)}
            hint={`${paidThisMonth.length} payment${paidThisMonth.length === 1 ? '' : 's'}`}
            tone="green"
          />
        </motion.div>
      )}

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by client or project…" />
        <Select value={status} onChange={setStatus} options={statusFilter} aria-label="Filter by status" className="w-40" />
      </Toolbar>

      {!ready ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={payments.length === 0 ? 'No payments yet' : 'No payments match'}
          description={
            payments.length === 0
              ? 'Log a payment against a client or project to track what you’re owed.'
              : 'Try different filters or clear the search.'
          }
          action={
            payments.length === 0 && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus strokeWidth={1.75} />
                New payment
              </Button>
            )
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>Client</TH>
            <TH className="hidden md:table-cell">Project</TH>
            <TH className="text-right">Amount</TH>
            <TH>Status</TH>
            <TH className="hidden text-right lg:table-cell">Due</TH>
            <TH className="w-32" />
          </THead>
          <motion.tbody variants={listContainer} initial="initial" animate="animate" className="divide-y">
            <AnimatePresence initial={false}>
              {filtered.map((payment) => {
                const eff = effectivePaymentStatus(payment)
                return (
                  <Row
                    key={payment.id}
                    clickable
                    exit="exit"
                    onClick={() => setSearchParams({ p: payment.id })}
                  >
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={clientName(payment.client_id)} size="sm" />
                        <p className="font-medium">{clientName(payment.client_id)}</p>
                      </div>
                    </TD>
                    <TD className="hidden max-w-56 truncate text-muted-foreground md:table-cell">
                      {projectTitles(payment) || '—'}
                    </TD>
                    <TD className="tnum text-right font-medium">
                      {formatMoney(payment.amount, payment.currency)}
                    </TD>
                    <TD>
                      <StatusPill meta={paymentStatus[eff]} animate={false} />
                    </TD>
                    <TD className="tnum hidden text-right text-muted-foreground lg:table-cell">
                      {payment.status === 'paid' ? formatDate(payment.payment_date) : formatDate(payment.due_date)}
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {isOpenPayment(payment) && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => markPaid(payment, e.currentTarget)}
                          >
                            <Check strokeWidth={1.75} />
                            Mark paid
                          </Button>
                        )}
                        <Dropdown
                          trigger={
                            <Button variant="ghost" size="iconSm" aria-label="Payment actions">
                              <MoreHorizontal strokeWidth={1.75} />
                            </Button>
                          }
                          items={[
                            { label: 'Edit', icon: Pencil, onSelect: () => { setEditing(payment); setFormOpen(true) } },
                            { label: 'Delete', icon: Trash2, danger: true, onSelect: () => setDeleting(payment) },
                          ]}
                        />
                      </div>
                    </TD>
                  </Row>
                )
              })}
            </AnimatePresence>
          </motion.tbody>
        </Table>
      )}

      {/* Detail panel (?p=<id> — deep-linkable) */}
      <SlideOverPanel
        open={Boolean(openPayment)}
        onClose={() => setSearchParams({})}
        title={openPayment ? formatMoney(openPayment.amount, openPayment.currency) : ''}
        subtitle={openPayment && clientName(openPayment.client_id)}
        headerActions={
          openPayment && (
            <Button variant="ghost" size="iconSm" aria-label="Edit payment" onClick={() => { setEditing(openPayment); setFormOpen(true) }}>
              <Pencil strokeWidth={1.75} />
            </Button>
          )
        }
      >
        {openPayment && (
          <>
            <PanelSection title="Details">
              <dl className="grid grid-cols-2 gap-4 rounded-lg border bg-background p-4">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Status</dt>
                  <dd className="mt-1"><StatusPill meta={paymentStatus[effectivePaymentStatus(openPayment)]} /></dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    {(openPayment.project_ids ?? []).length > 1 ? 'Projects' : 'Project'}
                  </dt>
                  <dd className="mt-1 text-sm">{projectTitles(openPayment) || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Due</dt>
                  <dd className="tnum mt-1 text-sm">{formatDate(openPayment.due_date)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Paid</dt>
                  <dd className="tnum mt-1 text-sm">{formatDate(openPayment.payment_date)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Method</dt>
                  <dd className="mt-1 text-sm">{openPayment.payment_method ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Invoice</dt>
                  <dd className="mt-1 text-sm">
                    {openPayment.invoice_url ? (
                      <a
                        href={openPayment.invoice_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Open invoice
                        <ExternalLink className="size-3.5" strokeWidth={1.75} aria-hidden />
                      </a>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              </dl>
              {openPayment.notes && (
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{openPayment.notes}</p>
              )}
            </PanelSection>
            {isOpenPayment(openPayment) && (
              <Button className="w-full" onClick={(e) => markPaid(openPayment, e.currentTarget)}>
                <Check strokeWidth={1.75} />
                Mark as paid
              </Button>
            )}
          </>
        )}
      </SlideOverPanel>

      <PaymentFormModal
        key={editing?.id ?? 'new'}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        payment={editing}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(undefined)}
        onConfirm={() => {
          if (!deleting) return
          deleteRow('payments', deleting.id, {
            entity: 'payment',
            entityId: deleting.id,
            action: 'deleted',
            message: `Deleted ${formatMoney(deleting.amount, deleting.currency)} payment for ${clientName(deleting.client_id)}`,
          })
        }}
        title="Delete this payment?"
        description="The payment record will be removed permanently. This can't be undone."
      />
    </>
  )
}
