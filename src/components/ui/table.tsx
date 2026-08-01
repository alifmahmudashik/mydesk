import { motion, type HTMLMotionProps } from 'framer-motion'
import { listItem } from '@/lib/motion'
import { cn } from '@/lib/utils'

/** Table primitives with the standard density (44-48px rows, 14px text) and hover treatment. */

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border bg-surface shadow-sm', className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  )
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {children}
      </tr>
    </thead>
  )
}

export function TH({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <th className={cn('px-4 py-2.5 font-medium', className)}>{children}</th>
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y">{children}</tbody>
}

interface RowProps extends HTMLMotionProps<'tr'> {
  clickable?: boolean
}

/** Animated row: staggered entrance, layout animation on reorder, hover lift. */
export function Row({ clickable, className, ...props }: RowProps) {
  return (
    <motion.tr
      layout="position"
      variants={listItem}
      className={cn(
        'transition-colors duration-150',
        clickable && 'cursor-pointer hover:bg-surface-hover',
        className,
      )}
      {...props}
    />
  )
}

export function TD({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <td className={cn('h-12 px-4 align-middle', className)}>{children}</td>
}
