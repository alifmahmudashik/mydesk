import { useMemo, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ComboboxProps {
  value?: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  className?: string
  id?: string
  'aria-label'?: string
  disabled?: boolean
}

/** Searchable single-select — the app's Select doesn't filter, needed for long lists like countries/timezones. */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className,
  disabled,
  ...aria
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.toLowerCase().includes(q))
  }, [options, query])

  return (
    <Popover.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setQuery('')
      }}
    >
      <div className={cn('relative', className)}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            {...aria}
            className={cn(
              'flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-surface px-3 text-sm transition-colors duration-150 hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25 disabled:opacity-50',
              value ? 'pr-8' : undefined,
            )}
          >
            <span className={cn('truncate text-left', !value && 'text-faint')}>{value || placeholder}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </Popover.Trigger>
        {value && !disabled && (
          <button
            type="button"
            aria-label="Clear"
            onClick={(e) => {
              e.stopPropagation()
              onChange('')
            }}
            className="absolute right-7 top-1/2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-faint transition-colors duration-150 hover:bg-surface-hover hover:text-foreground"
          >
            <X className="size-3.5" strokeWidth={1.75} aria-hidden />
          </button>
        )}
      </div>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="pop-in z-[70] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-lg border bg-surface shadow-lg"
        >
          <div className="flex items-center gap-2 border-b px-2.5 py-2">
            <Search className="size-4 shrink-0 text-faint" strokeWidth={1.75} aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="px-2.5 py-2 text-[13px] text-muted-foreground">No matches.</p>
            )}
            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt)
                  setOpen(false)
                  setQuery('')
                }}
                className="flex w-full cursor-pointer select-none items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm outline-none transition-colors hover:bg-surface-hover"
              >
                <span className="truncate">{opt}</span>
                {opt === value && <Check className="size-3.5 shrink-0 text-primary" aria-hidden />}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
