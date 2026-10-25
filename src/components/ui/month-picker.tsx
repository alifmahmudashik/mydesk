import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarRange, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "2026-10" or "2026-10-01" → { y, m } (m is 1–12). */
function parse(v?: string | null) {
  const m = /^(\d{4})-(\d{2})/.exec(v ?? '')
  return m ? { y: Number(m[1]), m: Number(m[2]) } : null
}
/** "October 2026" from "2026-10" / "2026-10-01". */
export function monthLabel(v?: string | null) {
  const p = parse(v)
  return p ? `${LONG[p.m - 1]} ${p.y}` : ''
}

export function MonthPopover({ anchor, value, onChange, onClose, clearable }: { anchor: HTMLElement | null; value?: string | null; onChange: (v: string | null) => void; onClose: () => void; clearable?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const sel = parse(value)
  const now = new Date()
  const [year, setYear] = useState(sel?.y ?? now.getFullYear())

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return
    const a = anchor.getBoundingClientRect()
    const p = ref.current.getBoundingClientRect()
    let top = a.bottom + 6
    if (top + p.height > window.innerHeight - 8) top = Math.max(8, a.top - p.height - 6)
    let left = a.left
    if (left + p.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - p.width - 8)
    setPos({ top, left })
  }, [anchor])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
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

  const pick = (m: number) => {
    onChange(`${year}-${String(m).padStart(2, '0')}-01`)
    onClose()
  }

  return createPortal(
    <div ref={ref} className="mp-pop" style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }} role="dialog" aria-label="Choose month">
      <div className="mp-head">
        <button type="button" className="mp-nav" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}><ChevronLeft className="i i-sm" /></button>
        <span className="mp-year">{year}</span>
        <button type="button" className="mp-nav" aria-label="Next year" onClick={() => setYear((y) => y + 1)}><ChevronRight className="i i-sm" /></button>
      </div>
      <div className="mp-grid">
        {MONTHS.map((label, i) => {
          const m = i + 1
          const isSel = sel?.y === year && sel.m === m
          const isNow = now.getFullYear() === year && now.getMonth() + 1 === m
          return (
            <button key={label} type="button" className={cn(isSel && 'on', isNow && 'now')} onClick={() => pick(m)}>{label}</button>
          )
        })}
      </div>
      {clearable && value && (
        <div className="mp-foot">
          <button type="button" className="mi danger" onClick={() => { onChange(null); onClose() }}><X className="i i-sm" />Clear</button>
        </div>
      )}
    </div>,
    document.body,
  )
}

/** Month + year picker. Value is the first day of the month: "2026-10-01". */
export function MonthInput({ value, onChange, placeholder = 'Pick a month', clearable, className, label = 'Month' }: { value?: string | null; onChange: (v: string | null) => void; placeholder?: string; clearable?: boolean; className?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const text = monthLabel(value)
  return (
    <>
      <button ref={btn} type="button" className={cn('inp date-inp', open && 'focus', className)} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <CalendarRange className="i i-sm faint" />
        <span className={cn('grow trunc', !text && 'placeholder')}>{text || placeholder}</span>
      </button>
      {open && <MonthPopover anchor={btn.current} value={value} onChange={onChange} onClose={() => setOpen(false)} clearable={clearable} />}
    </>
  )
}

/** "‹ October 2026 › · All" — steps through work months, or shows everything.
 *  Value is "yyyy-MM" or "all". */
export function MonthFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const all = value === 'all'
  const step = (d: number) => {
    const base = all ? new Date() : new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, 1)
    const n = new Date(base.getFullYear(), base.getMonth() + d, 1)
    onChange(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`)
  }
  return (
    <div className="mf" role="group" aria-label="Work month">
      <button type="button" className="mf-step" aria-label="Previous month" onClick={() => step(-1)}><ChevronLeft className="i i-sm" /></button>
      <button ref={btn} type="button" className={cn('mf-label', open && 'focus')} onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}>
        <CalendarRange className="i i-sm" />
        {all ? 'All months' : monthLabel(value)}
      </button>
      <button type="button" className="mf-step" aria-label="Next month" onClick={() => step(1)}><ChevronRight className="i i-sm" /></button>
      <button type="button" className={cn('mf-all', all && 'on')} onClick={() => onChange('all')}>All</button>
      {open && <MonthPopover anchor={btn.current} value={all ? null : `${value}-01`} onChange={(v) => v && onChange(v.slice(0, 7))} onClose={() => setOpen(false)} />}
    </div>
  )
}
