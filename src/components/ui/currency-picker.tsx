import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

let names: Intl.DisplayNames | null = null
function currencyName(code: string) {
  try {
    names ??= new Intl.DisplayNames(['en'], { type: 'currency' })
    return names.of(code) ?? code
  } catch {
    return code
  }
}

interface PopProps {
  anchor: HTMLElement | null
  value: string
  currencies: string[]
  onChange: (v: string) => void
  onClose: () => void
}

/** Searchable currency list, rendered in a portal and kept on screen. */
function CurrencyPopover({ anchor, value, currencies, onChange, onClose }: PopProps) {
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [q, setQ] = useState('')

  const items = useMemo(() => {
    const s = q.trim().toLowerCase()
    const all = currencies.map((c) => ({ code: c, name: currencyName(c) }))
    return s ? all.filter((i) => i.code.toLowerCase().includes(s) || i.name.toLowerCase().includes(s)) : all
  }, [currencies, q])

  const [active, setActive] = useState(() => Math.max(0, currencies.indexOf(value)))
  useEffect(() => setActive(q ? 0 : Math.max(0, items.findIndex((i) => i.code === value))), [q])

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

  // Keep the highlighted row in view.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, pos])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor?.contains(e.target as Node)) onClose()
    }
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [anchor, onClose])

  const pick = (code: string) => {
    onChange(code)
    onClose()
    anchor?.focus()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      anchor?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(items.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[active]) pick(items[active].code)
    }
  }

  return createPortal(
    <div
      ref={ref}
      className="cur-pop"
      style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
      role="dialog"
      aria-label="Choose currency"
      onKeyDown={onKey}
    >
      <div className="cur-search">
        <Search className="i i-sm faint" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search currency" aria-label="Search currency" />
      </div>
      <div ref={listRef} className="cur-list" role="listbox">
        {items.length === 0 && <div className="cur-empty">No match</div>}
        {items.map((it, i) => (
          <button
            key={it.code}
            type="button"
            role="option"
            aria-selected={it.code === value}
            data-i={i}
            className={cn('mi', it.code === value && 'on', i === active && 'act')}
            onMouseEnter={() => setActive(i)}
            onClick={() => pick(it.code)}
          >
            <span className="cur-code">{it.code}</span>
            <span className="grow trunc cur-name">{it.name}</span>
            {it.code === value && <Check className="i i-sm" />}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}

interface Props {
  value: string
  onChange: (v: string) => void
  currencies: string[]
  /** "prefix" is the compact trigger inside MoneyInput; "field" looks like a regular input. */
  variant?: 'prefix' | 'field'
  sm?: boolean
  className?: string
}

export function CurrencySelect({ value, onChange, currencies, variant = 'field', sm, className }: Props) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={btn}
        type="button"
        className={cn(variant === 'prefix' ? 'cur-trigger' : cn('inp cur-inp', sm && 'sm'), open && 'focus', className)}
        aria-label={`Currency: ${value}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span className={variant === 'field' ? 'grow trunc' : undefined}>
          {value}
          {variant === 'field' && <span className="faint"> · {currencyName(value)}</span>}
        </span>
        <ChevronDown className="i i-xs" />
      </button>
      {open && <CurrencyPopover anchor={btn.current} value={value} currencies={currencies} onChange={onChange} onClose={() => setOpen(false)} />}
    </>
  )
}
