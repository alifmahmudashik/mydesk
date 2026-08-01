import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { format, parseISO } from 'date-fns'
import { CalendarDays, X } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  /** ISO date (yyyy-MM-dd) or empty string. */
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
  'aria-label'?: string
  disabled?: boolean
  className?: string
}

/** The app-wide date field: input-styled trigger + styled calendar popover (react-day-picker). */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  className,
  ...aria
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = value ? parseISO(value) : undefined

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className={cn('relative', className)}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            {...aria}
            className={cn(
              'flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border bg-surface px-3 text-sm transition-colors duration-150 hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50',
              value && 'pr-8',
            )}
          >
            <CalendarDays className="size-4 shrink-0 text-faint" strokeWidth={1.75} aria-hidden />
            {selected ? (
              <span className="tnum truncate">{format(selected, 'MMM d, yyyy')}</span>
            ) : (
              <span className="truncate text-faint">{placeholder}</span>
            )}
          </button>
        </Popover.Trigger>
        {value && !disabled && (
          <button
            type="button"
            aria-label="Clear date"
            onClick={() => onChange('')}
            className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-faint transition-colors duration-150 hover:bg-surface-hover hover:text-foreground"
          >
            <X className="size-3.5" strokeWidth={1.75} aria-hidden />
          </button>
        )}
      </div>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="pop-in z-[70] rounded-xl border bg-surface p-3 shadow-lg"
        >
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            showOutsideDays
            onSelect={(day) => {
              onChange(day ? format(day, 'yyyy-MM-dd') : '')
              setOpen(false)
            }}
          />
          <div className="mt-1 flex items-center justify-between border-t pt-2">
            <button
              type="button"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
              className="cursor-pointer rounded-md px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-foreground"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(format(new Date(), 'yyyy-MM-dd'))
                setOpen(false)
              }}
              className="cursor-pointer rounded-md px-2 py-1 text-[13px] font-medium text-primary transition-colors duration-150 hover:bg-primary-soft"
            >
              Today
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
