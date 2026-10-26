import { goOffline } from '@/features/notifications/desktop'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

/** In demo mode (no Supabase env), auth is bypassed entirely. */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  return {
    session,
    loading,
    recovery,
    clearRecovery: () => setRecovery(false),
    authRequired: isSupabaseConfigured,
  }
}

export async function signOut() {
  await goOffline()
  if (supabase) await supabase.auth.signOut()
  window.location.href = '/'
}

export async function signInWithGoogle(next = '/') {
  if (!supabase) return
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${next}` },
  })
}
