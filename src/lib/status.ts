import type {
  AccessStatus,
  ClientStatus,
  PaymentStatus,
  Priority,
  ProjectStatus,
  TaskStatus,
} from '@/types'

/**
 * Single status-color convention for the whole app (see design-system/mydesk/MASTER.md §4):
 * neutral = not yet / inactive · accent = in motion · amber = waiting/attention ·
 * red = problem/overdue · green = done/positive · violet = exceptional
 */
export type Tone = 'neutral' | 'accent' | 'amber' | 'red' | 'green' | 'violet'

export const tonePill: Record<Tone, string> = {
  neutral: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-400',
  accent: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  red: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
}

export const toneText: Record<Tone, string> = {
  neutral: 'text-zinc-400 dark:text-zinc-500',
  accent: 'text-indigo-500 dark:text-indigo-400',
  amber: 'text-amber-500 dark:text-amber-400',
  red: 'text-red-500 dark:text-red-400',
  green: 'text-emerald-500 dark:text-emerald-400',
  violet: 'text-violet-500 dark:text-violet-400',
}

export const toneDot: Record<Tone, string> = {
  neutral: 'bg-zinc-400 dark:bg-zinc-500',
  accent: 'bg-indigo-500 dark:bg-indigo-400',
  amber: 'bg-amber-500 dark:bg-amber-400',
  red: 'bg-red-500 dark:bg-red-400',
  green: 'bg-emerald-500 dark:bg-emerald-400',
  violet: 'bg-violet-500 dark:bg-violet-400',
}

export interface StatusMeta {
  label: string
  tone: Tone
}

export const clientStatus: Record<ClientStatus, StatusMeta> = {
  active: { label: 'Active', tone: 'accent' },
  paused: { label: 'Paused', tone: 'amber' },
  completed: { label: 'Completed', tone: 'green' },
  archived: { label: 'Archived', tone: 'neutral' },
}

export const projectStatus: Record<ProjectStatus, StatusMeta> = {
  not_started: { label: 'Not started', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'accent' },
  waiting_for_client: { label: 'Waiting for client', tone: 'amber' },
  blocked: { label: 'Blocked', tone: 'red' },
  completed: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

export const taskStatus: Record<TaskStatus, StatusMeta> = {
  todo: { label: 'To do', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'accent' },
  review: { label: 'In review', tone: 'amber' },
  done: { label: 'Done', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

export const accessStatus: Record<AccessStatus, StatusMeta> = {
  needed: { label: 'Needed', tone: 'amber' },
  requested: { label: 'Requested', tone: 'accent' },
  received: { label: 'Received', tone: 'green' },
  not_needed: { label: 'Not needed', tone: 'neutral' },
}

export const paymentStatus: Record<PaymentStatus, StatusMeta> = {
  unpaid: { label: 'Unpaid', tone: 'neutral' },
  partial: { label: 'Partial', tone: 'amber' },
  paid: { label: 'Paid', tone: 'green' },
  refunded: { label: 'Refunded', tone: 'violet' },
  overdue: { label: 'Overdue', tone: 'red' },
}

export const priorityMeta: Record<Priority, StatusMeta> = {
  low: { label: 'Low', tone: 'neutral' },
  medium: { label: 'Medium', tone: 'accent' },
  high: { label: 'High', tone: 'amber' },
  urgent: { label: 'Urgent', tone: 'red' },
}

export function options<T extends string>(map: Record<T, StatusMeta>) {
  return (Object.keys(map) as T[]).map((value) => ({ value, label: map[value].label }))
}
