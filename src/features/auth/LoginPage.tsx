import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { signInWithGoogle } from '@/hooks/useAuth'
import { Field } from '@/components/ui/field'
import { AuthLayout, GoogleIcon } from '@/features/auth/AuthLayout'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'signin' | 'forgot' | 'setup'>('signin')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        toast.success('Check your email for a reset link')
        setMode('signin')
      } else if (mode === 'setup') {
        // First-time setup: the very first account becomes the workspace owner.
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) toast.success('Check your email to confirm your account')
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

  return (
    <AuthLayout>
      <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.025em' }}>
        {mode === 'forgot' ? 'Reset your password' : mode === 'setup' ? 'Create the owner account' : 'Welcome back'}
      </h1>
      <p className="muted" style={{ marginTop: 6 }}>
        {mode === 'forgot' ? 'We’ll email you a link to set a new one.' : mode === 'setup' ? 'Only for setting up a brand-new workspace.' : 'Sign in to your workspace.'}
      </p>
      <form className="stack" style={{ marginTop: 28 }} onSubmit={submit}>
        {mode === 'signin' && (
          <>
            <button type="button" className="btn btn-lg btn-block" onClick={() => void signInWithGoogle()}>
              <GoogleIcon />
              Continue with Google
            </button>
            <div className="or">or</div>
          </>
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
          >
            <input className="inp" type="password" required minLength={6} autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        <button type="submit" className="btn btn-pri btn-lg btn-block" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'forgot' ? 'Send reset link' : mode === 'setup' ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <p className="small muted" style={{ marginTop: 20 }}>
        {mode === 'signin' ? (
          <>New here? Ask the workspace owner for an invite. <button type="button" className="link-btn small" onClick={() => setMode('setup')}>Setting up?</button></>
        ) : (
          <button type="button" className="link-btn small" onClick={() => setMode('signin')}>Back to sign in</button>
        )}
      </p>
    </AuthLayout>
  )
}
