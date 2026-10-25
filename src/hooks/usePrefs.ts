import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'
const THEME_KEY = 'mydesk-theme'
const MOTION_KEY = 'mydesk-motion'

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // private mode: preference just won't persist
  }
}

export function applyTheme(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

// One shared theme value, so the sidebar toggle and the Account page stay in sync.
let themeNow: ThemePref = (read(THEME_KEY) as ThemePref) || 'system'
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function setThemeShared(t: ThemePref) {
  write(THEME_KEY, t)
  themeNow = t
  const run = () => {
    applyTheme(t)
    listeners.forEach((fn) => fn())
  }
  // Smooth cross-fade between light and dark where the browser supports it.
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  const calm = document.documentElement.classList.contains('no-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (doc.startViewTransition && !calm) doc.startViewTransition(run)
  else run()
}

/** True when the page is currently shown dark (resolves "system"). */
export function isDarkNow() {
  return document.documentElement.classList.contains('dark')
}

/** Appearance (light/dark/system) + animations toggle. Stored per device. */
export function usePrefs() {
  const theme = useSyncExternalStore(subscribe, () => themeNow)
  const [motion, setMotionState] = useState(() => read(MOTION_KEY) !== 'off')

  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => {
      applyTheme('system')
      listeners.forEach((fn) => fn())
    }
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('no-motion', !motion)
  }, [motion])

  const setTheme = useCallback((t: ThemePref) => setThemeShared(t), [])
  const setMotion = useCallback((on: boolean) => {
    write(MOTION_KEY, on ? 'on' : 'off')
    setMotionState(on)
  }, [])

  return { theme, setTheme, motion, setMotion }
}
