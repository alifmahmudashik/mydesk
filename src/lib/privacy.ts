import { useSyncExternalStore } from 'react'

/**
 * Privacy mode: blurs earnings and project counts so the screen can be shared in a meeting.
 * Saved per device in localStorage and applied as `html.privacy`; anything marked `.priv` blurs.
 */
const KEY = 'mydesk-privacy'
const subs = new Set<() => void>()

function read() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

let on = read()

function apply() {
  document.documentElement.classList.toggle('privacy', on)
  subs.forEach((f) => f())
}

apply()

// Keep other open tabs in sync.
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return
  on = e.newValue === '1'
  apply()
})

export function setPrivacy(value: boolean) {
  on = value
  try {
    localStorage.setItem(KEY, value ? '1' : '0')
  } catch {
    // Storage blocked: the toggle still works for this visit.
  }
  apply()
}

export function usePrivacy() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => on,
  )
}
