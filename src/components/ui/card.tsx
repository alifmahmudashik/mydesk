import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-xl border bg-surface shadow-sm', className)}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

export function CardHeader({
  title,
  action,
  className,
}: {
  title: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 px-5 pb-0 pt-4', className)}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {action}
    </div>
  )
}
