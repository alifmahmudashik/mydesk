import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)
const QUICK = ['09:00', '12:00', '15:00', '19:00']

const parse = (v: string) => {
  const [h, m] = v.split(':').map(Number)
  return { h: Number.isFinite(h) ? h : 9, m: Number.isFinite(m) ? m : 0 }
}
const to24 = (h12: number, pm: boolean) => (h12 % 12) + (pm ? 12 : 0)
const pad = (n: number) => String(n).padStart(2, '0')
export const label12 = (v: string) => {
  const { h, m } = parse(v)
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`
}

function TimePopover({ anchor, value, onChange, onClose }: { anchor: HTMLElement | null; value: string; onChange: (v: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  // Bumped on page scroll so the popover follows its field instead of closing.
  const [tick, setTick] = useState(0)
  const { h, m } = parse(value)
  const pm = h >= 12
  const h12 = h % 12 || 12

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
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

  const set = (hh: number, mm: number) => onChange(`${pad(hh)}:${pad(mm)}`)

  return createPortal(
    <div ref={ref} className="tp-pop" style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }} role="dialog" aria-label="Choose time">
      <div className="tp-top">
        <span className="tp-val">{h12}:{pad(m)}</span>
        <div className="tp-ampm" role="group" aria-label="AM or PM">
          <button type="button" className={cn(!pm && 'on')} aria-pressed={!pm} onClick={() => set(to24(h12, false), m)}>AM</button>
          <button type="button" className={cn(pm && 'on')} aria-pressed={pm} onClick={() => set(to24(h12, true), m)}>PM</button>
        </div>
      </div>
      <div className="tp-sec">
        <span className="tp-h">Hour</span>
        <div className="tp-grid">
          {HOURS.map((x) => (
            <button key={x} type="button" className={cn(x === h12 && 'on')} onClick={() => set(to24(x, pm), m)}>{x}</button>
          ))}
        </div>
      </div>
      <div className="tp-sec">
        <span className="tp-h">Minute</span>
        <div className="tp-grid">
          {MINUTES.map((x) => (
            <button key={x} type="button" className={cn(x === m && 'on')} onClick={() => { set(h, x); onClose() }}>{pad(x)}</button>
          ))}
        </div>
      </div>
      <div className="tp-quick">
        {QUICK.map((q) => (
          <button key={q} type="button" className={cn('tp-chip', q === value && 'on')} onClick={() => { onChange(q); onClose() }}>
            {label12(q).replace(":00", "")}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}

/** Click-to-pick time field. Value is 24h "HH:mm". */
export function TimeInput({ value, onChange, className, label = 'Time' }: { value: string; onChange: (v: string) => void; className?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={btn} type="button" className={cn('inp date-inp', open && 'focus', className)} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Clock className="i i-sm faint" />
        <span className="grow trunc">{label12(value)}</span>
      </button>
      {open && <TimePopover anchor={btn.current} value={value} onChange={onChange} onClose={() => setOpen(false)} />}
    </>
  )
}
