import type { AccessStatus, ClientStatus, PaymentStatus, Priority, ProjectStatus, TaskStatus } from '@/types'

/**
 * One status-colour convention for the whole app, mapped to the design's pill classes:
 * gray = not yet / inactive · pri = in motion · warn = waiting · bad = problem/overdue ·
 * ok = done/positive · teal = exceptional (finished/refunded)
 */
export type Tone = 'gray' | 'pri' | 'warn' | 'bad' | 'ok' | 'teal'

export interface StatusMeta {
  label: string
  tone: Tone
}

export const clientStatus: Record<ClientStatus, StatusMeta> = {
  active: { label: 'Active', tone: 'ok' },
  paused: { label: 'Paused', tone: 'warn' },
  completed: { label: 'Completed', tone: 'gray' },
  archived: { label: 'Archived', tone: 'gray' },
}

export const projectStatus: Record<ProjectStatus, StatusMeta> = {
  not_started: { label: 'Not started', tone: 'gray' },
  in_progress: { label: 'In progress', tone: 'pri' },
  waiting_for_client: { label: 'Waiting for client', tone: 'warn' },
  blocked: { label: 'Blocked', tone: 'bad' },
  completed: { label: 'Completed', tone: 'ok' },
  finished: { label: 'Finished', tone: 'teal' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
}

export const taskStatus: Record<TaskStatus, StatusMeta> = {
  todo: { label: 'To do', tone: 'gray' },
  in_progress: { label: 'In progress', tone: 'pri' },
  review: { label: 'In review', tone: 'warn' },
  done: { label: 'Done', tone: 'ok' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
}

/** Ring style for the round status control (design's .st variants). */
export const taskRing: Record<TaskStatus, string> = {
  todo: '',
  in_progress: 'prog',
  review: 'rev',
  done: 'done',
  cancelled: 'cancel',
}

export const accessStatus: Record<AccessStatus, StatusMeta> = {
  needed: { label: 'Needed', tone: 'warn' },
  requested: { label: 'Requested', tone: 'pri' },
  received: { label: 'Received', tone: 'ok' },
  not_needed: { label: 'Not needed', tone: 'gray' },
}

export const paymentStatus: Record<PaymentStatus, StatusMeta> = {
  unpaid: { label: 'Unpaid', tone: 'gray' },
  partial: { label: 'Partial', tone: 'warn' },
  paid: { label: 'Paid', tone: 'ok' },
  refunded: { label: 'Refunded', tone: 'teal' },
  overdue: { label: 'Overdue', tone: 'bad' },
}

export const priorityMeta: Record<Priority, StatusMeta & { bars: string }> = {
  low: { label: 'Low', tone: 'gray', bars: 'low' },
  medium: { label: 'Medium', tone: 'pri', bars: 'med' },
  high: { label: 'High', tone: 'warn', bars: 'high' },
  urgent: { label: 'Urgent', tone: 'bad', bars: 'high' },
}

export const billingLabel: Record<string, string> = {
  retainer: 'Monthly retainer',
  fixed: 'One-time project',
  hourly: 'Hourly',
}

export const paymentTerms: { value: string; label: string; days: number }[] = [
  { value: 'net_7', label: 'Net 7', days: 7 },
  { value: 'net_14', label: 'Net 14', days: 14 },
  { value: 'net_30', label: 'Net 30', days: 30 },
  { value: 'receipt', label: 'Due on receipt', days: 0 },
]

export function options<T extends string>(map: Record<T, StatusMeta>) {
  return (Object.keys(map) as T[]).map((value) => ({ value, label: map[value].label }))
}
