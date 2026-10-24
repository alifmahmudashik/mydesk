import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

export interface SettingsNavItem {
  id: string
  label: string
  icon?: ReactNode
  danger?: boolean
}

/** Settings page frame: sticky section nav on the left (with scroll-spy), sections on the right. */
export function SettingsLayout({ nav, children }: { nav: SettingsNavItem[]; children: ReactNode }) {
  const [active, setActive] = useState(nav[0]?.id)
  const location = useLocation()

  const jump = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.remove('flash')
    void el.offsetWidth
    el.classList.add('flash')
    setActive(id)
    history.replaceState(null, '', `#${id}`)
  }

  // Deep links like /account#notifications.
  useEffect(() => {
    const id = location.hash.slice(1)
    if (id && nav.some((n) => n.id === id)) setTimeout(() => jump(id), 250)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-80px 0px -60% 0px' },
    )
    for (const n of nav) {
      const el = document.getElementById(n.id)
      if (el) obs.observe(el)
    }
    return () => obs.disconnect()
  }, [nav])

  return (
    <div className="settings">
      <nav className="snav" aria-label="Sections">
        {nav.map((n) => (
          <a
            key={n.id}
            href={`#${n.id}`}
            className={cn(active === n.id && 'on')}
            style={n.danger ? { color: 'var(--bad)' } : undefined}
            onClick={(e) => {
              e.preventDefault()
              jump(n.id)
            }}
          >
            {n.icon}
            {n.label}
          </a>
        ))}
      </nav>
      <div className="sbody">{children}</div>
    </div>
  )
}

/** Warn before leaving a page with unsaved edits (browser close/refresh). */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBefore)
    return () => window.removeEventListener('beforeunload', onBefore)
  }, [dirty])
}
