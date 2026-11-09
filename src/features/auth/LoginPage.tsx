import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { demoSignIn, signInWithGoogle } from '@/hooks/useAuth'
import { Field } from '@/components/ui/field'
import { AuthLayout, GoogleIcon } from '@/features/auth/AuthLayout'

type Mode = 'signin' | 'forgot' | 'signup'

const COPY: Record<Mode, { title: string; sub: string; submit: string }> = {
  signin: { title: 'Welcome back', sub: 'Sign in to your workspace.', submit: 'Sign in' },
  forgot: { title: 'Reset your password', sub: 'We’ll email you a link to set a new one.', submit: 'Send reset link' },
  signup: { title: 'Create your account', sub: 'Next you’ll set up your workspace: its name, currency, logo and colours.', submit: 'Create account' },
}

export function LoginPage({ initialMode = 'signin' }: { initialMode?: Mode } = {}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [mode, setModeState] = useState<Mode>(initialMode)

  // Keep the address bar in step so /signup and /login can be shared directly.
  const setMode = (m: Mode) => {
    setModeState(m)
    if (m !== 'forgot') window.history.replaceState(null, '', m === 'signup' ? '/signup' : '/login')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) {
      demoSignIn()
      return
    }
    setBusy(true)
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        toast.success('Check your email for a reset link')
        setMode('signin')
      } else if (mode === 'signup') {
        // Invited emails join their team automatically; everyone else sets up a workspace next.
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name.trim() || undefined }, emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        if (!data.session) setSentTo(email)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <AuthLayout>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.025em' }}>Check your email</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          We sent a confirmation link to <b>{sentTo}</b>. Click it, then set up your workspace.
        </p>
        <button type="button" className="btn btn-lg mt-16" onClick={() => { setSentTo(null); setMode('signin') }}>
          Back to sign in
        </button>
      </AuthLayout>
    )
  }

  const copy = COPY[mode]
  return (
    <AuthLayout>
      <div style={{ marginBottom: 14 }}>
        <Link to="/" className="link-btn small">
          &larr; Back to home
        </Link>
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.025em' }}>{copy.title}</h1>
      <p className="muted" style={{ marginTop: 6 }}>{copy.sub}</p>
      <form className="stack" style={{ marginTop: 28 }} onSubmit={submit}>
        {mode !== 'forgot' && (
          <>
            <button type="button" className="btn btn-lg btn-block" onClick={() => void signInWithGoogle()}>
              <GoogleIcon />
              {mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}
            </button>
            <div className="or">or</div>
          </>
        )}
        {mode === 'signup' && (
          <Field label="Your name">
            <input className="inp" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </Field>
        )}
        <Field label="Email">
          <input className="inp" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </Field>
        {mode !== 'forgot' && (
          <Field
            label={
              <span className="row between" style={{ width: '100%' }}>
                Password
                {mode === 'signin' && <button type="button" className="link-btn small" onClick={() => setMode('forgot')}>Forgot?</button>}
              </span>
            }
            hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
          >
            <input
              className="inp"
              type="password"
              required
              minLength={mode === 'signup' ? 8 : 6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}
        <button type="submit" className="btn btn-pri btn-lg btn-block" disabled={busy}>
          {busy ? 'Please wait…' : copy.submit}
        </button>
      </form>
      <p className="small muted" style={{ marginTop: 20 }}>
        {mode === 'signin' ? (
          <>New to MyDesk? <button type="button" className="link-btn small" onClick={() => setMode('signup')}>Create an account</button></>
        ) : mode === 'signup' ? (
          <>Already have an account? <button type="button" className="link-btn small" onClick={() => setMode('signin')}>Sign in</button></>
        ) : (
          <button type="button" className="link-btn small" onClick={() => setMode('signin')}>Back to sign in</button>
        )}
      </p>
      {mode === 'signup' && <p className="xs faint" style={{ marginTop: 8 }}>Joining a team? Use the link in your invite email instead.</p>}
    </AuthLayout>
  )
}
