import { useCallback, useEffect, useState } from 'react'

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

/** Appearance (light/dark/system) + animations toggle. Stored per device. */
export function usePrefs() {
  const [theme, setThemeState] = useState<ThemePref>(() => (read(THEME_KEY) as ThemePref) || 'system')
  const [motion, setMotionState] = useState(() => read(MOTION_KEY) !== 'off')

  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => applyTheme('system')
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('no-motion', !motion)
  }, [motion])

  const setTheme = useCallback((t: ThemePref) => {
    write(THEME_KEY, t)
    setThemeState(t)
  }, [])
  const setMotion = useCallback((on: boolean) => {
    write(MOTION_KEY, on ? 'on' : 'off')
    setMotionState(on)
  }, [])

  return { theme, setTheme, motion, setMotion }
}
