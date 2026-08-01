import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--surface-hover)_25%,var(--border)_37%,var(--surface-hover)_63%)] bg-[length:200%_100%]',
        className,
      )}
    />
  )
}

/** Reserve-space list skeleton — same row height as real rows to avoid layout shift. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y rounded-xl border bg-surface shadow-sm">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex h-12 items-center gap-4 px-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-surface p-5 shadow-sm">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-8 w-32" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  )
}
