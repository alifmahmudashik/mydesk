import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** When env vars are missing the app runs in local demo mode (seeded data in localStorage). */
export const isSupabaseConfigured = Boolean(url && anonKey)

type SyncStorage = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void }

/**
 * In the Windows app, keep the login in the app's own file (written to disk right away)
 * so a PC restart can't lose a freshly refreshed session. Every write also goes to
 * localStorage, which is read as a fallback (older app versions, first run after updating).
 */
function desktopAuthStorage(): SupportedStorage | undefined {
  if (typeof window === 'undefined') return undefined
  const app = (window as unknown as { mydeskDesktop?: { authStorage?: SyncStorage } }).mydeskDesktop?.authStorage
  if (!app) return undefined
  const local = {
    get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
    set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* full or blocked */ } },
    remove: (k: string) => { try { localStorage.removeItem(k) } catch { /* blocked */ } },
  }
  return {
    getItem(k) {
      const saved = app.getItem(k)
      if (saved != null) return saved
      const old = local.get(k)
      if (old != null) app.setItem(k, old)
      return old
    },
    setItem(k, v) {
      app.setItem(k, v)
      local.set(k, v)
    },
    removeItem(k) {
      app.removeItem(k)
      local.remove(k)
    },
  }
}

const appStorage = desktopAuthStorage()

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, appStorage ? { auth: { storage: appStorage } } : undefined)
  : null
