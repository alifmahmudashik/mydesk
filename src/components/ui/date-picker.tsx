import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import { addDays, addMonths, addWeeks, format, isValid, nextMonday, parseISO } from 'date-fns'
import { Calendar, X } from 'lucide-react'
import 'react-day-picker/style.css'
import { cn } from '@/lib/utils'

const toISO = (d: Date) => format(d, 'yyyy-MM-dd')
const fromISO = (v?: string | null) => {
  if (!v) return undefined
  const d = parseISO(v)
  return isValid(d) ? d : undefined
}

interface PopoverProps {
  anchor: HTMLElement | null
  value?: string | null
  onChange: (v: string | null) => void
  onClose: () => void
  clearable?: boolean
}

/** Calendar popover with quick picks, rendered in a portal and kept on screen. */
function CalendarPopover({ anchor, value, onChange, onClose, clearable }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  // Bumped on page scroll so the popover follows its field instead of closing.
  const [tick, setTick] = useState(0)
  const selected = fromISO(value)

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return
    const a = anchor.getBoundingClientRect()
    const p = ref.current.getBoundingClientRect()
    let top = a.bottom + 6
    if (top + p.height > window.innerHeight - 8) top = Math.max(8, a.top - p.height - 6)
    let left = a.left
    if (left + p.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - p.width - 8)
    setPos({ top, left })
  }, [anchor, tick])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      // Clicking/dragging the page scrollbar isn't a click outside.
      if (e.clientX >= document.documentElement.clientWidth || e.clientY >= document.documentElement.clientHeight) return
      if (!ref.current?.contains(e.target as Node) && !anchor?.contains(e.target as Node)) onClose()
    }
    // Capture phase so Esc closes the calendar without also closing a dialog behind it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setTick((t) => t + 1)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [anchor, onClose])

  const pick = (d: Date | null) => {
    onChange(d ? toISO(d) : null)
    onClose()
  }
  const today = new Date()
  const quick: [string, Date][] = [
    ['Today', today],
    ['Tomorrow', addDays(today, 1)],
    ['Next Monday', nextMonday(today)],
    ['In 1 week', addWeeks(today, 1)],
    ['In 1 month', addMonths(today, 1)],
  ]

  return createPortal(
    <div ref={ref} className="date-pop" style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }} role="dialog" aria-label="Choose date">
      <div className="date-quick">
        {quick.map(([label, d]) => (
          <button key={label} type="button" className={cn('mi', selected && toISO(selected) === toISO(d) && 'on')} onClick={() => pick(d)}>
            <span className="grow">{label}</span>
            <span className="xs faint">{format(d, 'EEE d')}</span>
          </button>
        ))}
        {clearable && value && (
          <>
            <div className="menu-sep" />
            <button type="button" className="mi danger" onClick={() => pick(null)}>
              <X className="i i-sm" />Clear date
            </button>
          </>
        )}
      </div>
      <DayPicker
        className="md-cal"
        mode="single"
        selected={selected}
        defaultMonth={selected ?? today}
        onSelect={(d) => d && pick(d)}
        weekStartsOn={1}
        showOutsideDays
        fixedWeeks
      />
    </div>,
    document.body,
  )
}

interface FieldProps {
  value?: string | null
  onChange: (v: string | null) => void
  placeholder?: string
  sm?: boolean
  clearable?: boolean
  className?: string
  style?: React.CSSProperties
  label?: string
}

/** Form field version: looks like the app's inputs, opens the calendar on click. */
export function DateInput({ value, onChange, placeholder = 'Pick a date', sm, clearable = true, className, style, label }: FieldProps) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const d = fromISO(value)
  return (
    <>
      <button
        ref={btn}
        type="button"
        className={cn('inp date-inp', sm && 'sm', open && 'focus', className)}
        style={style}
        aria-label={label ?? placeholder}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Calendar className="i i-sm faint" />
        <span className={cn('grow trunc', !d && 'placeholder')}>{d ? format(d, 'EEE, MMM d, yyyy') : placeholder}</span>
        {clearable && d && (
          <span
            role="button"
            tabIndex={0}
            className="date-clear"
            aria-label="Clear date"
            onClick={(e) => {
              e.stopPropagation()
              onChange(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), onChange(null))}
          >
            <X className="i i-xs" />
          </span>
        )}
      </button>
      {open && <CalendarPopover anchor={btn.current} value={value} onChange={onChange} onClose={() => setOpen(false)} clearable={clearable} />}
    </>
  )
}

/** Compact property version (task details panel): text-like button + calendar. */
export function DateButton({ value, onChange, children, className, label = 'Date' }: { value?: string | null; onChange: (v: string | null) => void; children: ReactNode; className?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  return (
    <span className="row-sm" style={{ gap: 2 }}>
      <button ref={btn} type="button" className={cn('prop', className)} onClick={() => setOpen((o) => !o)} aria-label={label} aria-expanded={open}>
        <Calendar className="i i-sm" />
        {children}
      </button>
      {value && (
        <button type="button" className="btn btn-ghost btn-sm btn-icon" style={{ width: 24, height: 24 }} aria-label={`Clear ${label.toLowerCase()}`} title="Clear" onClick={() => onChange(null)}>
          <X className="i i-xs" />
        </button>
      )}
      {open && <CalendarPopover anchor={btn.current} value={value} onChange={onChange} onClose={() => setOpen(false)} clearable />}
    </span>
  )
}
