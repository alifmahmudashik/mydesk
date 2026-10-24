import { Check } from 'lucide-react'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
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
}

/** Dropdown menu matching the design's details.menu, with outside-click + Esc to close. */
export function Menu({ trigger, children, align = 'right', wide, className, popClassName }: MenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    <div ref={ref} className={cn('menu', open && 'open', className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <MenuCtx.Provider value={{ close: () => setOpen(false) }}>
          <div className={cn('menu-pop', align === 'left' && 'left', align === 'up' && 'up', wide && 'wide', popClassName)} role="menu">
            {children}
          </div>
        </MenuCtx.Provider>
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
