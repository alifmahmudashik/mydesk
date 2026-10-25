import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

/** Pickers that render in their own portal; clicks inside them shouldn't close a popover. */
const NESTED = '.date-pop, .mp-pop, .tp-pop, .cur-pop, .menu-pop'

interface Props {
  trigger: (p: { open: boolean; toggle: () => void }) => ReactNode
  /** Content; gets `close` so a Save button can dismiss it. */
  children: (close: () => void) => ReactNode
  title?: ReactNode
  width?: number
  className?: string
}

/** Small anchored panel for quick edits (dates, budget…). Portal + fixed position, so
 *  nothing clips it; follows its field on scroll, closes on outside click or Esc. */
export function Popover({ trigger, children, title, width = 300, className }: Props) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  // Bumped on page scroll so the popover follows its field instead of closing.
  const [tick, setTick] = useState(0)
  const close = () => setOpen(false)

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    if (!anchor.current || !ref.current) return
    const a = anchor.current.getBoundingClientRect()
    const p = ref.current.getBoundingClientRect()
    let top = a.bottom + 6
    if (top + p.height > window.innerHeight - 8) top = Math.max(8, a.top - p.height - 6)
    const left = Math.min(Math.max(8, a.left), window.innerWidth - p.width - 8)
    setPos({ top, left })
  }, [open, tick])

  useEffect(() => {
    if (!open) return
    const inside = (t: EventTarget | null) => {
      const el = t as Element | null
      return Boolean(ref.current?.contains(el) || anchor.current?.contains(el) || el?.closest?.(NESTED))
    }
    const onDown = (e: MouseEvent) => {
      // Clicking/dragging the page scrollbar isn't a click outside.
      if (e.clientX >= document.documentElement.clientWidth || e.clientY >= document.documentElement.clientHeight) return
      if (!inside(e.target)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      // Let an open nested picker take Esc first.
      if (e.key === 'Escape' && !document.querySelector(NESTED)) {
        e.stopPropagation()
        close()
      }
    }
    const onScroll = (e: Event) => {
      if (!inside(e.target)) setTick((t) => t + 1)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  return (
    <>
      <span ref={anchor} className="pop-anchor">{trigger({ open, toggle: () => setOpen((o) => !o) })}</span>
      {open &&
        createPortal(
          <div ref={ref} className={cn('pop-card', className)} style={{ width, ...(pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }) }} role="dialog">
            {title && <div className="pop-title">{title}</div>}
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  )
}
