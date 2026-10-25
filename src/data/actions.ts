import { addMonths, format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { clientDisplayName, profileDisplayName, taskAssigneeIds, taskRef } from '@/lib/derive'
import { formatMoney, todayISO } from '@/lib/format'
import { projectStatus, taskStatus } from '@/lib/status'
import type { Payment, Project, ProjectStatus, Subtask, Task, TaskComment, TaskStatus } from '@/types'

const S = () => useData.getState()
const isAdmin = () => S().me?.role !== 'member'

// ---------------------------------------------------------------- tasks

export function createTask(data: Partial<Task> & { project_id: string; title: string }) {
  if ('assignee_ids' in data || data.assignee_id) {
    const ids = taskAssigneeIds(data as Task)
    const patch = assigneePatch(ids)
    delete (data as Partial<Task>).assignee_ids
    Object.assign(data, patch)
  }
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
  const others = taskAssigneeIds(task).filter((id) => id !== S().me?.id)
  if (others.length) {
    const who = others.map((id) => S().profiles.find((p) => p.id === id))
    S().logActivity({ entity: 'task', entityId: task.id, action: 'assigned', message: `assigned ${who.map((p) => profileDisplayName(p)).join(', ')}`, projectId: project?.id, meta: { emailed: who.some((p) => p?.notification_prefs?.assigned !== false) } })
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

/** The database has the multi-assignee column once task-assignees.sql has run (demo always does). */
function multiAssignee() {
  return S().demoMode || S().tasks.some((t) => 'assignee_ids' in t)
}

/** What to write for a set of assignees (falls back to a single person before the SQL is run). */
export function assigneePatch(ids: string[]) {
  const clean = [...new Set(ids.filter(Boolean))]
  return multiAssignee() ? { assignee_ids: clean, assignee_id: clean[0] ?? null } : { assignee_id: clean[0] ?? null }
}

export function setTaskAssignees(task: Task, ids: string[]) {
  const before = taskAssigneeIds(task)
  const next = [...new Set(ids)]
  if (before.length === next.length && before.every((id, i) => id === next[i])) return
  const added = next.filter((id) => !before.includes(id))
  const removed = before.filter((id) => !next.includes(id))
  const name = (id: string) => profileDisplayName(S().profiles.find((p) => p.id === id))
  const parts = [added.length ? `assigned ${added.map(name).join(', ')}` : '', removed.length ? `removed ${removed.map(name).join(', ')}` : ''].filter(Boolean)
  S().updateRow('tasks', task.id, assigneePatch(next), {
    entity: 'task',
    entityId: task.id,
    action: 'assigned',
    message: parts.join(' · ') || 'changed the assignees',
    projectId: task.project_id,
    meta: { emailed: added.some((id) => id !== S().me?.id && S().profiles.find((p) => p.id === id)?.notification_prefs?.assigned !== false) },
  })
}

/** Single-person shortcut (kept for older callers). */
export function assignTask(task: Task, assigneeId: string | null) {
  setTaskAssignees(task, assigneeId ? [assigneeId] : [])
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
    ...(project.work_month ? { work_month: shift(project.work_month) } : {}),
  })
  for (const t of S().tasks.filter((t) => t.project_id === project.id && t.status !== 'cancelled')) {
    S().createRow<Task>('tasks', {
      project_id: copy.id, title: t.title, description: t.description, priority: t.priority, status: 'todo',
      ...assigneePatch(taskAssigneeIds(t)), labels: t.labels ?? [], estimate_minutes: t.estimate_minutes, due_date: shift(t.due_date),
    } as Task)
  }
  toast.success(`Created “${title}”`)
  return copy
}

// ---------------------------------------------------------------- payments

export interface PaidUndo {
  payment: Pick<Payment, 'id' | 'status' | 'payment_date'>
  projects: Pick<Project, 'id' | 'status' | 'completed_at' | 'payment_status'>[]
}

/**
 * Marks a payment paid. A project whose payments are now all paid is set to Finished too
 * (Finished = paid), so the project and its payment never disagree.
 */
export function markPaymentPaid(payment: Payment, opts: { silent?: boolean; method?: string } = {}): PaidUndo {
  const client = S().clients.find((c) => c.id === payment.client_id)
  const undo: PaidUndo = { payment: { id: payment.id, status: payment.status, payment_date: payment.payment_date ?? null }, projects: [] }
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
  for (const pid of payment.project_ids ?? []) {
    const project = S().projects.find((p) => p.id === pid)
    if (!project || project.status === 'finished' || project.status === 'cancelled') continue
    const allPaid = S().payments.filter((p) => (p.project_ids ?? []).includes(pid) && p.status !== 'refunded').every((p) => p.status === 'paid')
    if (!allPaid) continue
    undo.projects.push({ id: project.id, status: project.status, completed_at: project.completed_at ?? null, payment_status: project.payment_status })
    setProjectStatus(project, 'finished')
  }
  if (!opts.silent) {
    const finished = undo.projects.length ? ` ${undo.projects.length === 1 ? 'Project' : `${undo.projects.length} projects`} set to Finished.` : ''
    toast.success(`${formatMoney(payment.amount, payment.currency)} received`, {
      description: `${clientDisplayName(client)}, marked as paid.${finished}`,
      action: { label: 'Undo', onClick: () => undoPaymentPaid(undo) },
    })
  }
  return undo
}

/** Reverses markPaymentPaid: the payment and any project it finished go back to how they were. */
export function undoPaymentPaid(undo: PaidUndo) {
  S().updateRow('payments', undo.payment.id, { status: undo.payment.status, payment_date: undo.payment.payment_date ?? null })
  for (const p of undo.projects) {
    S().updateRow('projects', p.id, { status: p.status, completed_at: p.completed_at ?? null, payment_status: p.payment_status })
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

