import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TabDef<T extends string> {
  id: T
  label: ReactNode
  count?: number | string
}

interface TabsProps<T extends string> {
  tabs: TabDef<T>[]
  value: T
  onChange: (v: T) => void
  variant?: 'line' | 'seg' | 'sm'
  /** Extra content inside the tab bar (title before, actions after). */
  before?: ReactNode
  after?: ReactNode
  pad?: boolean
  className?: string
}

export function Tabs<T extends string>({ tabs, value, onChange, variant = 'line', before, after, pad, className }: TabsProps<T>) {
  const list = (
    <div className={cn('tablist', variant === 'seg' && 'seg', variant === 'sm' && 'sm', pad && 'pad', after && 'in-bar', className)} role="tablist">
      {before}
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          className={cn('tab', t.id === value && 'on')}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count !== undefined && <span className="n">{t.count}</span>}
        </button>
      ))}
    </div>
  )
  if (!after) return list
  // Actions (search, filters) live next to the tab list, not inside it: the tab list
  // scrolls sideways on small screens and would clip their borders.
  return (
    <div className={cn('tabs-bar', pad && 'pad')}>
      {list}
      <div className="tabs-after">{after}</div>
    </div>
  )
}
