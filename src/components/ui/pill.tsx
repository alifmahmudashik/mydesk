import { Calendar } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Priority, TaskStatus } from '@/types'
import type { StatusMeta } from '@/lib/status'
import { priorityMeta, taskRing, taskStatus } from '@/lib/status'
import { daysUntil, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

export function StatusPill({ meta, dot = true, className }: { meta: StatusMeta; dot?: boolean; className?: string }) {
  return <span className={cn('pill', dot && 'dot', meta.tone, className)}>{meta.label}</span>
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('tag', className)}>{children}</span>
}

/** Due-date chip: red when late, amber when due within 2 days. */
export function DateChip({ date, done, empty = 'No date' }: { date?: string | null; done?: boolean; empty?: string }) {
  if (!date) return <span className="faint xs">{empty}</span>
  const d = daysUntil(date)!
  const tone = done ? '' : d < 0 ? 'bad' : d <= 2 ? 'warn' : ''
  return (
    <span className={cn('date', tone)}>
      <Calendar className="i i-xs" aria-hidden />
      {formatDate(date)}
    </span>
  )
}

export function PrioBars({ priority }: { priority: Priority }) {
  const m = priorityMeta[priority]
  return (
    <span className={cn('prio', m.bars)} title={`${m.label} priority`} aria-label={`${m.label} priority`}>
      <i />
      <i />
      <i />
    </span>
  )
}

/** The round task-status control. Click cycles to done/back to to-do. */
export function StatusRing({ status, onToggle, size }: { status: TaskStatus; onToggle?: () => void; size?: number }) {
  const label = status === 'done' ? 'Mark as not done' : 'Mark as done'
  const style = size ? { width: size, height: size } : undefined
  if (!onToggle) return <span className={cn('st', taskRing[status])} style={style} title={taskStatus[status].label} />
  return (
    <button
      type="button"
      className={cn('st', taskRing[status])}
      style={{ ...style, padding: 0 }}
      title={`${taskStatus[status].label} · ${label}`}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
    />
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>
}
