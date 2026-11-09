import { useEffect } from 'react'
import type { Workspace } from '@/types'

/** Colour choices offered when setting up or editing a workspace. */
export const BRAND_SWATCHES = ['#4F46E5', '#2563EB', '#0891B2', '#059669', '#16A34A', '#CA8A04', '#EA580C', '#DC2626', '#DB2777', '#7C3AED', '#0F172A', '#475569']

const HEX = /^#[0-9a-f]{6}$/i

export function isHex(v: string | null | undefined): v is string {
  return Boolean(v && HEX.test(v))
}

/** Black or white, whichever reads better on this background. */
export function readableOn(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.4 ? '#0F0F14' : '#FFFFFF'
}

type LogoSource = Pick<Workspace, 'name' | 'logo_url' | 'logo_color'> | null | undefined

/**
 * The workspace logo tile: the uploaded logo, else the workspace's first letter on its
 * logo colour, else the MyDesk flame (workspaces that never picked a colour).
 */
export function WorkspaceLogo({ workspace, size = 32 }: { workspace: LogoSource; size?: number }) {
  const color = isHex(workspace?.logo_color) ? workspace.logo_color : null
  const box = { width: size, height: size, flex: 'none' as const }

  if (workspace?.logo_url) {
    return (
      <div className="logo" style={{ ...box, background: color ?? 'var(--panel)', overflow: 'hidden', padding: 0 }}>
        <img src={workspace.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
  if (color) {
    const letter = (workspace?.name?.trim()[0] ?? 'W').toUpperCase()
    return (
      <div className="logo" style={{ ...box, background: color, color: readableOn(color), fontSize: Math.round(size * 0.47) }} aria-hidden>
        {letter}
      </div>
    )
  }
  return (
    <div className="logo" style={box}>
      <img src="/mydesk-fire.png" alt="" style={{ width: size * 0.7, height: size * 0.7 }} />
    </div>
  )
}

const STYLE_ID = 'mydesk-accent'

/** CSS that swaps the app's indigo for the workspace accent, in light and dark. */
export function accentCss(c: string) {
  // `html:root` outranks the plain `:root` rules in tokens.css.
  return `
html:root:not(.dark) {
  --pri: ${c};
  --pri-h: color-mix(in oklab, ${c} 82%, black);
  --pri-soft: color-mix(in oklab, ${c} 10%, white);
  --pri-mid: color-mix(in oklab, ${c} 35%, white);
  --pri-deep: color-mix(in oklab, ${c} 55%, black);
  --sel-bg: color-mix(in oklab, ${c} 7%, white);
}
html:root:not(.dark) .side { --pri: color-mix(in oklab, ${c} 65%, white); }
html:root:not(.dark) .side .badge { background: color-mix(in oklab, ${c} 80%, white); }
html:root.dark {
  --pri: color-mix(in oklab, ${c} 85%, white);
  --pri-h: color-mix(in oklab, ${c} 65%, white);
  --pri-soft: color-mix(in srgb, ${c} 18%, transparent);
  --pri-mid: color-mix(in oklab, ${c} 60%, black);
  --pri-deep: color-mix(in oklab, ${c} 40%, white);
  --sel-bg: color-mix(in srgb, ${c} 12%, transparent);
}`
}

/** Applies the workspace accent colour to the whole app while it's mounted. */
export function useWorkspaceAccent(accent: string | null | undefined) {
  useEffect(() => {
    const color = isHex(accent) ? accent : null
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
    if (!color) {
      el?.remove()
      return
    }
    if (!el) {
      el = document.createElement('style')
      el.id = STYLE_ID
      document.head.appendChild(el)
    }
    el.textContent = accentCss(color)
  }, [accent])
}

/** Round colour swatches plus a custom colour input. */
export function ColorPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="row wrap" style={{ gap: 8 }} role="radiogroup" aria-label={label}>
      {BRAND_SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === c.toLowerCase()}
          aria-label={c}
          title={c}
          onClick={() => onChange(c)}
          className="ws-swatch"
          style={{ background: c, color: readableOn(c) }}
        >
          {value.toLowerCase() === c.toLowerCase() ? '✓' : ''}
        </button>
      ))}
      <label className="ws-swatch ws-swatch-custom" title="Custom colour" style={{ background: BRAND_SWATCHES.some((c) => c.toLowerCase() === value.toLowerCase()) ? undefined : value }}>
        <input type="color" value={isHex(value) ? value : '#4F46E5'} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label={`${label}: custom`} />
        <span aria-hidden>+</span>
      </label>
    </div>
  )
}
