import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { listItem } from '@/lib/motion'
import { toneDot, tonePill, type Tone } from '@/lib/status'
import { cn } from '@/lib/utils'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  tone?: Tone
  onClick?: () => void
}

/** Dashboard at-a-glance card. Clickable cards navigate to the filtered list behind the number. */
export function StatCard({ icon: Icon, label, value, hint, tone = 'neutral', onClick }: StatCardProps) {
  const Comp = onClick ? motion.button : motion.div
  return (
    <Comp
      variants={listItem}
      onClick={onClick}
      className={cn(
        'group rounded-xl border bg-surface p-5 text-left shadow-sm transition-all duration-150',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        <span className={cn('grid size-7 place-items-center rounded-lg', tonePill[tone])}>
          <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
      </div>
      <div className="tnum mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && (
        <div className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <span className={cn('size-1.5 rounded-full', toneDot[tone])} aria-hidden />
          {hint}
        </div>
      )}
    </Comp>
  )
}
