import { Check } from 'lucide-react'
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

const MenuCtx = createContext<{ close: () => void }>({ close: () => {} })

interface MenuProps {
  /** Render prop for the trigger; gets `open` and a toggle handler. */
  trigger: (p: { open: boolean; toggle: () => void }) => ReactNode
  children: ReactNode
  align?: 'left' | 'right' | 'up'
  wide?: boolean
  className?: string
  popClassName?: string
  /** Make the popover at least as wide as the trigger. */
  matchWidth?: boolean
}

/** Dropdown menu matching the design's details.menu, with outside-click + Esc to close.
 *  The popover renders in a portal with fixed positioning, so scrolling tables and
 *  cards with overflow can't clip it. */
export function Menu({ trigger, children, align = 'right', wide, className, popClassName, matchWidth }: MenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; minWidth?: number; up: boolean } | null>(null)
  // Bumped on page scroll so the popover follows its field instead of closing.
  const [tick, setTick] = useState(0)

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const place = () => {
      if (!ref.current || !popRef.current) return
      const a = ref.current.getBoundingClientRect()
      const p = popRef.current.getBoundingClientRect()
      const minWidth = matchWidth ? a.width : undefined
      const w = Math.max(p.width, minWidth ?? 0)
      let up = align === 'up'
      if (!up && a.bottom + 6 + p.height > window.innerHeight - 8 && a.top - 6 - p.height > 8) up = true
      if (up && a.top - 6 - p.height < 8) up = false
      const top = up ? a.top - 6 - p.height : a.bottom + 6
      let left = align === 'right' ? a.right - w : a.left
      left = Math.min(Math.max(8, left), window.innerWidth - w - 8)
      setPos({ top, left, minWidth, up })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, align, matchWidth, tick])

  useEffect(() => {
    if (!open) return
    const inside = (t: EventTarget | null) => Boolean(ref.current?.contains(t as Node) || popRef.current?.contains(t as Node))
    const onDown = (e: MouseEvent) => {
      // Clicking/dragging the page scrollbar isn't a click outside.
      if (e.clientX >= document.documentElement.clientWidth || e.clientY >= document.documentElement.clientHeight) return
      if (!inside(e.target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    // The popover is fixed to the screen, so close it when the page underneath scrolls.
    const onScroll = (e: Event) => {
      if (!popRef.current?.contains(e.target as Node)) setTick((t) => t + 1)
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
    <div ref={ref} className={cn('menu', open && 'open', className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open &&
        createPortal(
          <MenuCtx.Provider value={{ close: () => setOpen(false) }}>
            <div
              ref={popRef}
              className={cn('menu-pop floating', align === 'left' && 'left', pos?.up && 'up', wide && 'wide', popClassName)}
              style={pos ? { top: pos.top, left: pos.left, minWidth: pos.minWidth } : { top: -9999, left: -9999 }}
              role="menu"
            >
              {children}
            </div>
          </MenuCtx.Provider>,
          document.body,
        )}
    </div>
  )
}

interface ItemProps {
  icon?: ReactNode
  children: ReactNode
  onSelect?: () => void
  danger?: boolean
  on?: boolean
  hint?: ReactNode
  /** Keep the menu open after selecting (multi-select lists). */
  keepOpen?: boolean
  href?: string
}

export function MenuItem({ icon, children, onSelect, danger, on, hint, keepOpen, href }: ItemProps) {
  const { close } = useContext(MenuCtx)
  const inner = (
    <>
      {icon}
      <span className="grow trunc">{children}</span>
      {hint !== undefined ? <span className="hint-r faint xs">{hint}</span> : on ? <Check className="i i-sm hint-r" /> : null}
    </>
  )
  const cls = cn('mi', danger && 'danger', on && 'on')
  if (href) {
    return (
      <a className={cls} href={href} target="_blank" rel="noreferrer" role="menuitem" onClick={() => close()}>
        {inner}
      </a>
    )
  }
  return (
    <button
      type="button"
      role="menuitem"
      className={cls}
      onClick={() => {
        onSelect?.()
        if (!keepOpen) close()
      }}
    >
      {inner}
    </button>
  )
}

export function MenuSep() {
  return <div className="menu-sep" />
}

export function MenuTitle({ children }: { children: ReactNode }) {
  return <div className="menu-title">{children}</div>
}

/** Text filter at the top of long menus. */
export function MenuSearch({ value, onChange, placeholder = 'Filter…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="menu-search">
      <input autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

interface PickProps<T extends string> {
  value: T
  options: { value: T; label: string; icon?: ReactNode }[]
  onChange: (v: T) => void
  /** How the closed trigger looks. Defaults to a .prop button showing the label. */
  render?: (current: { value: T; label: string; icon?: ReactNode } | undefined) => ReactNode
  className?: string
  align?: 'left' | 'right' | 'up'
  title?: string
}

/** Compact single-select used for task/project properties. */
export function Pick<T extends string>({ value, options, onChange, render, className, align = 'left', title }: PickProps<T>) {
  const current = options.find((o) => o.value === value)
  return (
    <Menu
      align={align}
      className={className}
      trigger={({ toggle }) => (
        <button type="button" className="prop" onClick={toggle} title={title}>
          {render ? render(current) : (
            <>
              {current?.icon}
              {current?.label ?? 'Select'}
            </>
          )}
        </button>
      )}
    >
      {title && <MenuTitle>{title}</MenuTitle>}
      {options.map((o) => (
        <MenuItem key={o.value} icon={o.icon} on={o.value === value} onSelect={() => onChange(o.value)}>
          {o.label}
        </MenuItem>
      ))}
    </Menu>
  )
}
