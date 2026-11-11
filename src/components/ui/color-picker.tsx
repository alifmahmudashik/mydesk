import { useEffect, useState } from 'react'
import { Check, Pipette } from 'lucide-react'
import { cn } from '@/lib/utils'

/** A brand palette that reads well as a white-text header on an invoice. */
export const BRAND_COLORS = ['#4F46E5', '#7C3AED', '#DB2777', '#E11D48', '#EA580C', '#D97706', '#16A34A', '#0D9488', '#0284C7', '#1E40AF', '#475569', '#0F0F14']

const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v)

/** Black or white, whichever reads better on this colour (for the tick mark). */
function inkOn(hex: string) {
  if (!isHex(hex)) return '#fff'
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? '#111' : '#fff'
}

interface Props {
  value: string
  onChange: (hex: string) => void
  /** Extra colours shown first (e.g. the client's own colour). */
  extra?: (string | null | undefined)[]
  colors?: string[]
  /** Hide the "#hex" field (compact places). */
  hideHex?: boolean
  className?: string
}

/**
 * Pick a colour: a row of swatches (ticked when chosen), a custom-colour button that opens
 * the system picker, and a hex field. Always reports a full #RRGGBB value.
 */
export function ColorPicker({ value, onChange, extra = [], colors = BRAND_COLORS, hideHex, className }: Props) {
  const list = [...new Set([...extra, ...colors].filter((c): c is string => Boolean(c) && isHex(c!)).map((c) => c.toUpperCase()))]
  const current = (value || '').toUpperCase()
  const custom = isHex(current) && !list.includes(current)
  const [hex, setHex] = useState(current.replace('#', ''))
  useEffect(() => setHex(current.replace('#', '')), [current])

  return (
    <div className={cn('cpick', className)}>
      <div className="cpick-swatches" role="radiogroup" aria-label="Colour">
        {list.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={current === c}
            aria-label={c}
            title={c}
            className={cn('cpick-sw', current === c && 'on')}
            style={{ ['--c' as string]: c, color: inkOn(c) }}
            onClick={() => onChange(c)}
          >
            {current === c && <Check className="i i-xs" strokeWidth={3} />}
          </button>
        ))}
        <label className={cn('cpick-sw cpick-custom', custom && 'on')} title="Custom colour" style={custom ? { ['--c' as string]: current, color: inkOn(current) } : undefined}>
          {custom ? <Check className="i i-xs" strokeWidth={3} /> : <Pipette className="i i-xs" />}
          <input type="color" value={isHex(current) ? current.toLowerCase() : '#4f46e5'} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label="Custom colour" />
        </label>
      </div>
      {!hideHex && (
        <span className="cpick-hex">
          <span className="cpick-dot" style={{ background: isHex(current) ? current : 'transparent' }} />
          <span className="faint">#</span>
          <input
            className="mono"
            value={hex}
            maxLength={6}
            spellCheck={false}
            aria-label="Hex colour"
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6)
              setHex(v)
              if (v.length === 6) onChange(`#${v.toUpperCase()}`)
            }}
            onBlur={() => setHex(current.replace('#', ''))}
          />
        </span>
      )}
    </div>
  )
}
