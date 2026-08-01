import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Field, FormSection } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { useData } from '@/data/store'
import { clientDisplayName, clientSecondaryName } from '@/lib/derive'
import { options, paymentStatus, priorityMeta, projectStatus } from '@/lib/status'
import type { Payment, PaymentStatus, Priority, Project, ProjectStatus } from '@/types'

const statusOptions = options(projectStatus)
const priorityOptions = options(priorityMeta)
const paymentOptions = options(paymentStatus)
const currencyOptions = ['USD', 'EUR', 'GBP', 'BDT'].map((c) => ({ value: c, label: c }))

interface ProjectFormModalProps {
  open: boolean
  onClose: () => void
  project?: Project
  /** Pre-selects the client (when opened from a client workspace). */
  clientId?: string
}

/** Mount with key={project?.id ?? 'new'} so fields re-initialize. */
export function ProjectFormModal({ open, onClose, project, clientId }: ProjectFormModalProps) {
  const clients = useData((s) => s.clients)
  const payments = useData((s) => s.payments)
  const createRow = useData((s) => s.createRow)
  const updateRow = useData((s) => s.updateRow)

  const [form, setForm] = useState({
    title: project?.title ?? '',
    client_id: project?.client_id ?? clientId ?? '',
    project_type: project?.project_type ?? '',
    amount: project ? String(project.amount) : '',
    currency: project?.currency ?? 'USD',
    start_date: project?.start_date ?? '',
    due_date: project?.due_date ?? '',
    status: project?.status ?? ('not_started' as ProjectStatus),
    priority: project?.priority ?? ('medium' as Priority),
    payment_status: project?.payment_status ?? ('unpaid' as PaymentStatus),
    tags: project?.tags.join(', ') ?? '',
  })
  const [errors, setErrors] = useState<{ title?: string; client?: string; amount?: string }>({})

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const clientOptions = clients
    .filter((c) => c.status !== 'archived' || c.id === form.client_id)
    .map((c) => {
      const secondary = clientSecondaryName(c)
      return { value: c.id, label: secondary ? `${clientDisplayName(c)} (${secondary})` : clientDisplayName(c) }
    })

  function submit() {
    const next: typeof errors = {}
    if (!form.title.trim()) next.title = 'Give the project a title.'
    if (!form.client_id) next.client = 'Pick the client this project belongs to.'
    if (form.amount && Number.isNaN(Number(form.amount))) next.amount = 'Enter a number, e.g. 2500.'
    setErrors(next)
    if (Object.keys(next).length) return

    const data = {
      title: form.title.trim(),
      client_id: form.client_id,
      project_type: form.project_type.trim() || null,
      // The description is rich text, edited inline on the project page.
      description: project?.description ?? null,
      amount: form.amount ? Number(form.amount) : 0,
      currency: form.currency,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      status: form.status,
      priority: form.priority,
      payment_status: form.payment_status,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    }

    if (project) {
      updateRow('projects', project.id, data, {
        entity: 'project',
        entityId: project.id,
        action: 'updated',
        message: `Updated project "${data.title}"`,
      })
      // Keep the project's invoice in sync with its budget:
      // no invoice yet + budget set -> create one; a single open invoice covering
      // only this project -> update its amount. Paid/refunded or shared invoices are left alone.
      if (data.amount !== project.amount || data.currency !== project.currency) {
        const linked = payments.filter((p) => (p.project_ids ?? []).includes(project.id))
        if (linked.length === 0 && data.amount > 0) {
          createRow<Payment>(
            'payments',
            {
              client_id: data.client_id,
              project_ids: [project.id],
              amount: data.amount,
              currency: data.currency,
              status: data.payment_status === 'paid' ? 'paid' : 'unpaid',
              payment_date: data.payment_status === 'paid' ? data.due_date : null,
              due_date: data.due_date,
              notes: `Invoice for "${data.title}"`,
            },
            {
              entity: 'payment',
              action: 'created',
              message: `Created invoice for "${data.title}" (${data.currency} ${data.amount})`,
            },
          )
        } else if (
          linked.length === 1 &&
          (linked[0].project_ids ?? []).length === 1 &&
          !['paid', 'refunded'].includes(linked[0].status)
        ) {
          updateRow(
            'payments',
            linked[0].id,
            { amount: data.amount, currency: data.currency },
            {
              entity: 'payment',
              entityId: linked[0].id,
              action: 'updated',
              message: `Updated invoice for "${data.title}" to ${data.currency} ${data.amount}`,
            },
          )
        }
      }
    } else {
      const client = clients.find((c) => c.id === data.client_id)
      const created = createRow<Project>('projects', data, {
        entity: 'project',
        action: 'created',
        message: `Created project "${data.title}"${client ? ` for ${clientDisplayName(client)}` : ''}`,
      })
      // A project with an amount gets its invoice automatically (deleted along with the project).
      if (data.amount > 0) {
        createRow<Payment>(
          'payments',
          {
            client_id: data.client_id,
            project_ids: [created.id],
            amount: data.amount,
            currency: data.currency,
            status: data.payment_status === 'paid' ? 'paid' : 'unpaid',
            payment_date: data.payment_status === 'paid' ? data.due_date : null,
            due_date: data.due_date,
            notes: `Invoice for "${data.title}"`,
          },
          {
            entity: 'payment',
            action: 'created',
            message: `Created invoice for "${data.title}" (${data.currency} ${data.amount})`,
          },
        )
      }
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? 'Edit project' : 'New project'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{project ? 'Save changes' : 'Create project'}</Button>
        </>
      }
    >
      <div className="divide-y">
        <FormSection title="Basics">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Title" required error={errors.title} className="sm:col-span-2">
              <Input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. Server-side GTM migration"
                autoFocus
              />
            </Field>
            <Field label="Client" required error={errors.client}>
              <Select
                value={form.client_id || undefined}
                onChange={(v) => set('client_id', v)}
                options={clientOptions}
                placeholder="Select a client"
              />
            </Field>
            <Field label="Type">
              <Input
                value={form.project_type}
                onChange={(e) => set('project_type', e.target.value)}
                placeholder="e.g. Tracking setup, Audit, CRO"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Budget & timeline">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Budget" error={errors.amount} hint={project ? undefined : 'Auto-creates an invoice.'}>
              <div className="flex gap-2">
                <Input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                  placeholder="0"
                  className="tnum"
                  aria-label="Project amount"
                />
                <Select
                  value={form.currency}
                  onChange={(v) => set('currency', v)}
                  options={currencyOptions}
                  className="w-22 shrink-0"
                  aria-label="Currency"
                />
              </div>
            </Field>
            <Field label="Start date">
              <DatePicker value={form.start_date} onChange={(v) => set('start_date', v)} />
            </Field>
            <Field label="Due date">
              <DatePicker value={form.due_date} onChange={(v) => set('due_date', v)} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Status">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Status">
              <Select value={form.status} onChange={(v) => set('status', v)} options={statusOptions} />
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onChange={(v) => set('priority', v)} options={priorityOptions} />
            </Field>
            <Field label="Payment">
              <Select
                value={form.payment_status}
                onChange={(v) => set('payment_status', v)}
                options={paymentOptions}
              />
            </Field>
          </div>
        </FormSection>

        {/* Tags and description stay out of the create flow — add them later from the project page. */}
        {project && (
          <FormSection title="Details">
            <Field label="Tags" hint="Comma-separated, e.g. GTM, sGTM, CRO">
              <Input value={form.tags} onChange={(e) => set('tags', e.target.value)} />
            </Field>
          </FormSection>
        )}
      </div>
    </Modal>
  )
}
