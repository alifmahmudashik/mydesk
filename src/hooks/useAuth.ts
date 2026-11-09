import { goOffline } from '@/features/notifications/desktop'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export function isDemoSignedOut() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('mydesk_demo_signed_out') === 'true'
}

export function demoSignIn() {
  localStorage.removeItem('mydesk_demo_signed_out')
  window.location.href = '/'
}

/** In demo mode (no Supabase env), auth is bypassed unless explicitly signed out. */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [recovery, setRecovery] = useState(false)
  const [demoAuthed] = useState(() => !isDemoSignedOut())

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

  const authed = isSupabaseConfigured ? Boolean(session) : demoAuthed

  return {
    session,
    loading,
    recovery,
    clearRecovery: () => setRecovery(false),
    authRequired: true,
    authed,
  }
}

export async function signOut() {
  await goOffline()
  if (supabase) {
    await supabase.auth.signOut()
  } else {
    // In local demo mode without Supabase env, mark signed out so landing/login pages can be tested
    localStorage.setItem('mydesk_demo_signed_out', 'true')
  }
  window.location.href = '/'
}

export async function signInWithGoogle(next = '/') {
  if (!supabase) {
    demoSignIn()
    return
  }
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${next}` },
  })
}
