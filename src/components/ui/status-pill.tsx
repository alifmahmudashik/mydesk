import { motion } from 'framer-motion'
import { toneDot, tonePill, type StatusMeta } from '@/lib/status'
import { cn } from '@/lib/utils'

interface StatusPillProps {
  meta: StatusMeta
  className?: string
  /** Animate a small pop when the status changes (keyed on label). */
  animate?: boolean
}

/** The ONLY way status is rendered app-wide: tinted pill + colored dot + label (never color-only). */
export function StatusPill({ meta, className, animate = true }: StatusPillProps) {
  const Comp = animate ? motion.span : 'span'
  return (
    <Comp
      key={meta.label}
      {...(animate
        ? {
            initial: { scale: 0.85, opacity: 0 },
            animate: { scale: 1, opacity: 1 },
            transition: { type: 'spring', stiffness: 500, damping: 30 },
          }
        : {})}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        tonePill[meta.tone],
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', toneDot[meta.tone])} aria-hidden />
      {meta.label}
    </Comp>
  )
}
