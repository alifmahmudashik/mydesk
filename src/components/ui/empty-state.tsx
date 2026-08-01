import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { EASE_OUT_EXPO } from '@/lib/motion'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
      className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center"
    >
      <div className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </div>
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  )
}
