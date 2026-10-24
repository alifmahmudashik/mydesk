import { useRef, type ReactNode } from 'react'
import { Calendar, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value?: string | null
  onChange: (value: string | null) => void
  /** What the button shows (formatted date, or a placeholder). */
  children: ReactNode
  className?: string
  label?: string
}

/**
 * A compact button that opens the browser's native date picker. An invisible
 * <input type="date"> laid over a button doesn't open on click in Chrome, so this
 * calls showPicker() explicitly (with a focus/click fallback for older browsers).
 */
export function DateButton({ value, onChange, children, className, label = 'Date' }: Props) {
  const ref = useRef<HTMLInputElement>(null)

  const open = () => {
    const el = ref.current
    if (!el) return
    try {
      el.showPicker()
    } catch {
      el.focus()
      el.click()
    }
  }

  return (
    <span className="row-sm" style={{ position: 'relative', gap: 2 }}>
      <button type="button" className={cn('prop', className)} onClick={open} aria-label={label}>
        <Calendar className="i i-sm" />
        {children}
      </button>
      {value && (
        <button type="button" className="btn btn-ghost btn-sm btn-icon" style={{ width: 24, height: 24 }} aria-label={`Clear ${label.toLowerCase()}`} title="Clear" onClick={() => onChange(null)}>
          <X className="i i-xs" />
        </button>
      )}
      {/* Kept in the layout (not display:none) so showPicker() can anchor to it. */}
      <input
        ref={ref}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        style={{ position: 'absolute', left: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none', border: 0, padding: 0 }}
      />
    </span>
  )
}
