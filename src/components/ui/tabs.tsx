import { useId } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface TabDef<T extends string> {
  key: T
  label: string
  count?: number
}

interface TabsProps<T extends string> {
  tabs: TabDef<T>[]
  active: T
  onChange: (key: T) => void
}

/** Underline tab bar with a sliding active indicator — section switching inside a detail view. */
export function Tabs<T extends string>({ tabs, active, onChange }: TabsProps<T>) {
  const id = useId()
  return (
    <div role="tablist" className="flex gap-1 border-b">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'relative cursor-pointer px-3 py-2.5 text-[13px] font-medium transition-colors duration-150',
            active === tab.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span className="tnum ml-1.5 rounded-full bg-surface-hover px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {tab.count}
            </span>
          )}
          {active === tab.key && (
            <motion.span
              layoutId={`tab-indicator-${id}`}
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
              aria-hidden
            />
          )}
        </button>
      ))}
    </div>
  )
}
