import { addMonths, format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { clientDisplayName, profileDisplayName, taskRef } from '@/lib/derive'
import { formatMoney, todayISO } from '@/lib/format'
import { projectStatus, taskStatus } from '@/lib/status'
import type { Invoice, Payment, Project, ProjectStatus, Subtask, Task, TaskComment, TaskStatus } from '@/types'

const S = () => useData.getState()
const isAdmin = () => S().me?.role !== 'member'

// ---------------------------------------------------------------- tasks

export function createTask(data: Partial<Task> & { project_id: string; title: string }) {
  const project = S().projects.find((p) => p.id === data.project_id)
  const task = S().createRow<Task>(
    'tasks',
    {
      status: 'todo',
      priority: 'medium',
      labels: [],
      ...data,
      title: data.title.trim(),
    } as Task,
    { entity: 'task', action: 'created', message: `created “${data.title.trim()}”`, projectId: data.project_id },
  )
  if (task.assignee_id && task.assignee_id !== S().me?.id) {
    const who = S().profiles.find((p) => p.id === task.assignee_id)
    S().logActivity({ entity: 'task', entityId: task.id, action: 'assigned', message: `assigned ${profileDisplayName(who)}`, projectId: project?.id, meta: { emailed: who?.notification_prefs?.assigned !== false } })
  }
  return task
}

export function setTaskStatus(task: Task, status: TaskStatus) {
  if (task.status === status) return
  S().updateRow('tasks', task.id, { status, completed_at: status === 'done' ? new Date().toISOString() : null }, {
    entity: 'task',
    entityId: task.id,
    action: status === 'done' ? 'completed' : 'status_changed',
    message: status === 'done' ? `completed “${task.title}”` : `changed status ${taskStatus[task.status].label} → ${taskStatus[status].label}`,
    projectId: task.project_id,
  })
}

export function toggleTaskDone(task: Task) {
  setTaskStatus(task, task.status === 'done' ? 'todo' : 'done')
}

export function assignTask(task: Task, assigneeId: string | null) {
  if ((task.assignee_id ?? null) === assigneeId) return
  const who = S().profiles.find((p) => p.id === assigneeId)
  S().updateRow('tasks', task.id, { assignee_id: assigneeId }, {
    entity: 'task',
    entityId: task.id,
    action: 'assigned',
    message: assigneeId ? `assigned ${profileDisplayName(who)}` : 'removed the assignee',
    projectId: task.project_id,
    meta: { emailed: Boolean(assigneeId && assigneeId !== S().me?.id && who?.notification_prefs?.assigned !== false) },
  })
}

export function updateTask(task: Task, patch: Partial<Task>, message?: string) {
  S().updateRow('tasks', task.id, patch, message ? { entity: 'task', entityId: task.id, action: 'updated', message, projectId: task.project_id } : undefined)
}

export function deleteTask(task: Task) {
  S().deleteRow('tasks', task.id, { entity: 'task', entityId: task.id, action: 'deleted', message: `deleted “${task.title}”`, projectId: task.project_id })
  useData.setState((s) => ({
    subtasks: s.subtasks.filter((x) => x.task_id !== task.id),
    comments: s.comments.filter((x) => x.task_id !== task.id),
    attachments: s.attachments.filter((x) => x.task_id !== task.id),
    timeEntries: s.timeEntries.filter((x) => x.task_id !== task.id),
  }))
}

export function duplicateTask(task: Task) {
  const { id: _id, created_at: _c, number: _n, completed_at: _d, ...rest } = task
  void _id; void _c; void _n; void _d
  const copy = createTask({ ...rest, title: `${task.title} (copy)`, status: 'todo' })
  for (const s of S().subtasks.filter((s) => s.task_id === task.id)) {
    S().createRow<Subtask>('subtasks', { task_id: copy.id, title: s.title, done: false, assignee_id: s.assignee_id, position: s.position })
  }
  return copy
}

export function addComment(task: Task, body: string, mentions: string[]) {
  const comment = S().createRow<TaskComment>('task_comments', { task_id: task.id, body, mentions })
  S().logActivity({ entity: 'comment', entityId: task.id, action: 'commented', message: `commented on “${task.title}”`, projectId: task.project_id, meta: { comment_id: comment.id } })
  return comment
}

export function toggleSubtask(sub: Subtask, task: Task) {
  S().updateRow('subtasks', sub.id, { done: !sub.done })
  if (!sub.done) {
    S().logActivity({ entity: 'subtask', entityId: task.id, action: 'completed', message: `checked “${sub.title}”`, projectId: task.project_id })
  }
}

// ---------------------------------------------------------------- projects

/** A project with a budget gets its payment automatically (same rule as before). */
export function createProject(data: Omit<Project, 'id' | 'created_at'>) {
  const client = S().clients.find((c) => c.id === data.client_id)
  const project = S().createRow<Project>('projects', data, {
    entity: 'project',
    action: 'created',
    message: `created project “${data.title}”${client ? ` for ${clientDisplayName(client)}` : ''}`,
  })
  if (data.amount > 0 && isAdmin()) {
    S().createRow<Payment>('payments', {
      client_id: data.client_id,
      project_ids: [project.id],
      amount: data.amount,
      currency: data.currency,
      status: data.payment_status === 'paid' ? 'paid' : 'unpaid',
      payment_date: data.payment_status === 'paid' ? data.due_date ?? todayISO() : null,
      due_date: data.due_date ?? null,
      notes: `Invoice for "${data.title}"`,
    }, { entity: 'payment', action: 'created', message: `created a payment for “${data.title}” (${formatMoney(data.amount, data.currency)})` })
  }
  return project
}

/** Keeps the project's single open payment in sync with its budget. */
export function updateProject(project: Project, patch: Partial<Project>) {
  S().updateRow('projects', project.id, patch, { entity: 'project', entityId: project.id, action: 'updated', message: `updated project “${patch.title ?? project.title}”`, projectId: project.id })
  if (!isAdmin()) return
  const next = { ...project, ...patch }
  if (next.amount !== project.amount || next.currency !== project.currency) {
    const linked = S().payments.filter((p) => (p.project_ids ?? []).includes(project.id))
    if (linked.length === 0 && next.amount > 0) {
      S().createRow<Payment>('payments', {
        client_id: next.client_id, project_ids: [project.id], amount: next.amount, currency: next.currency,
        status: 'unpaid', due_date: next.due_date ?? null, notes: `Invoice for "${next.title}"`,
      }, { entity: 'payment', action: 'created', message: `created a payment for “${next.title}”` })
    } else if (linked.length === 1 && linked[0].project_ids.length === 1 && !['paid', 'refunded'].includes(linked[0].status)) {
      S().updateRow('payments', linked[0].id, { amount: next.amount, currency: next.currency })
    }
  }
}

export function setProjectStatus(project: Project, status: ProjectStatus) {
  if (status === project.status) return
  const done = status === 'completed' || status === 'finished'
  S().updateRow('projects', project.id, {
    status,
    completed_at: done ? project.completed_at ?? new Date().toISOString() : null,
    ...(status === 'finished' && isAdmin() ? { payment_status: 'paid' } : {}),
  }, {
    entity: 'project',
    entityId: project.id,
    action: status === 'completed' ? 'completed' : 'status_changed',
    message: `moved “${project.title}” to ${projectStatus[status].label}`,
    projectId: project.id,
  })
  // Finishing a project settles its payments (admins only: members can't touch money).
  if (status === 'finished' && isAdmin()) {
    for (const p of S().payments.filter((p) => (p.project_ids ?? []).includes(project.id) && p.status !== 'paid')) {
      markPaymentPaid(p, { silent: true })
    }
  }
}

export function archiveProject(project: Project, archived = true) {
  S().updateRow('projects', project.id, { archived_at: archived ? new Date().toISOString() : null }, {
    entity: 'project', entityId: project.id, action: 'updated', message: `${archived ? 'archived' : 'restored'} “${project.title}”`, projectId: project.id,
  })
}

/** Deletes a project. Payments that only covered it go too; shared ones just drop it. */
export function deleteProject(project: Project) {
  if (isAdmin()) {
    for (const p of S().payments.filter((p) => (p.project_ids ?? []).includes(project.id))) {
      const rest = p.project_ids.filter((id) => id !== project.id)
      if (rest.length === 0) S().deleteRow('payments', p.id)
      else S().updateRow('payments', p.id, { project_ids: rest })
    }
  }
  S().deleteRow('projects', project.id, { entity: 'project', entityId: project.id, action: 'deleted', message: `deleted project “${project.title}”` })
  // The database cascades to tasks, notes and checklist items; mirror that locally.
  useData.setState((s) => {
    const taskIds = new Set(s.tasks.filter((t) => t.project_id === project.id).map((t) => t.id))
    return {
      tasks: s.tasks.filter((t) => !taskIds.has(t.id)),
      notes: s.notes.filter((n) => n.project_id !== project.id),
      accessItems: s.accessItems.filter((a) => a.project_id !== project.id),
      subtasks: s.subtasks.filter((x) => !taskIds.has(x.task_id)),
      comments: s.comments.filter((x) => !taskIds.has(x.task_id)),
    }
  })
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "Oct: CPC Vending" → "Nov: CPC Vending", dates +1 month, open tasks copied as to-do. */
export function duplicateForNextMonth(project: Project) {
  let title = project.title
  for (const list of [LONG, MONTHS]) {
    const idx = list.findIndex((m) => new RegExp(`\\b${m}\\b`).test(title))
    if (idx >= 0) {
      title = title.replace(new RegExp(`\\b${list[idx]}\\b`), list[(idx + 1) % 12])
      break
    }
  }
  if (title === project.title) title = `${title} (${format(addMonths(new Date(), 1), 'MMM')})`
  const shift = (d?: string | null) => (d ? format(addMonths(parseISO(d), 1), 'yyyy-MM-dd') : null)
  const { id: _id, created_at: _c, completed_at: _d, archived_at: _a, ...rest } = project
  void _id; void _c; void _d; void _a
  const copy = createProject({
    ...rest,
    title,
    status: 'not_started',
    payment_status: 'unpaid',
    start_date: shift(project.start_date),
    due_date: shift(project.due_date),
  })
  for (const t of S().tasks.filter((t) => t.project_id === project.id && t.status !== 'cancelled')) {
    S().createRow<Task>('tasks', {
      project_id: copy.id, title: t.title, description: t.description, priority: t.priority, status: 'todo',
      assignee_id: t.assignee_id, labels: t.labels ?? [], estimate_minutes: t.estimate_minutes, due_date: shift(t.due_date),
    } as Task)
  }
  toast.success(`Created “${title}”`)
  return copy
}

// ---------------------------------------------------------------- payments

export function markPaymentPaid(payment: Payment, opts: { silent?: boolean; method?: string } = {}) {
  const client = S().clients.find((c) => c.id === payment.client_id)
  S().updateRow('payments', payment.id, {
    status: 'paid',
    payment_date: payment.payment_date ?? todayISO(),
    ...(opts.method ? { payment_method: opts.method } : {}),
  }, {
    entity: 'payment',
    entityId: payment.id,
    action: 'paid',
    message: `received ${formatMoney(payment.amount, payment.currency)} from ${clientDisplayName(client)}`,
  })
  if (!opts.silent) {
    toast.success(`${formatMoney(payment.amount, payment.currency)} received`, { description: `${clientDisplayName(client)}, marked as paid.` })
  }
}

export function paymentTitle(payment: Payment) {
  const projects = S().projects.filter((p) => payment.project_ids?.includes(p.id))
  if (projects.length === 1) return projects[0].title
  if (projects.length > 1) return `${projects[0].title} +${projects.length - 1}`
  return payment.notes?.replace(/^Invoice for "(.*)"$/, '$1') || 'Payment'
}

export function taskLink(task: Task) {
  return `/tasks/${task.id}`
}

export function taskLabel(task: Task) {
  const project = S().projects.find((p) => p.id === task.project_id)
  return taskRef(task, project)
}

// ---------------------------------------------------------------- invoices

/**
 * Marks an invoice as paid. Uses the payments linked to it; if there are none, links the
 * payments of the projects on the invoice; if still none (e.g. an older invoice that was
 * never tracked), records one paid payment for the invoice total.
 */
export function markInvoicePaid(invoice: Invoice) {
  const s = S()
  let linked = s.payments.filter((p) => p.invoice_id === invoice.id)
  if (linked.length === 0) {
    const projectIds = s.projects
      .filter((p) => p.client_id === invoice.client_id && invoice.line_items.some((li) => li.description.trim() === p.title.trim()))
      .map((p) => p.id)
    linked = s.payments.filter((p) => p.client_id === invoice.client_id && !p.invoice_id && p.project_ids?.some((id) => projectIds.includes(id)))
    for (const p of linked) s.updateRow('payments', p.id, { invoice_id: invoice.id })
  }
  if (linked.length === 0) {
    const total = invoice.line_items.reduce((t, li) => t + Number(li.price) * Number(li.qty), 0) * (1 + Number(invoice.tax_rate) / 100)
    s.createRow<Payment>('payments', {
      client_id: invoice.client_id, project_ids: [], amount: Math.round(total * 100) / 100, currency: invoice.currency,
      status: 'paid', payment_date: todayISO(), due_date: invoice.due_date ?? null, invoice_id: invoice.id, notes: `Invoice ${invoice.number}`,
    }, { entity: 'payment', action: 'paid', message: `marked invoice ${invoice.number} as paid` })
    toast.success(`Invoice ${invoice.number} marked as paid`)
    return
  }
  for (const p of linked) if (p.status !== 'paid') markPaymentPaid({ ...p, invoice_id: invoice.id }, { silent: true })
  toast.success(`Invoice ${invoice.number} marked as paid`)
}
