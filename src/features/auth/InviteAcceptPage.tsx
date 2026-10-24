import { useEffect, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { signInWithGoogle } from '@/hooks/useAuth'
import { Field } from '@/components/ui/field'
import { AuthLayout, GoogleIcon } from '@/features/auth/AuthLayout'

/** /invite/:token: create an account for an invited email. The database applies the
 *  invite's role and client access automatically when the account is created. */
export function InviteAcceptPage() {
  // Rendered outside <Routes>, so read the token from the path directly.
  const token = decodeURIComponent(useLocation().pathname.split('/invite/')[1] ?? '').replace(/\/$/, '')
  const [invite, setInvite] = useState<{ email: string; role: string; inviter: string } | null | undefined>(undefined)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!supabase) return
    void supabase.rpc('invite_lookup', { p_token: token }).then(({ data }) => {
      const row = (data as { email: string; role: string; inviter: string }[] | null)?.[0]
      setInvite(row ?? null)
    })
  }, [token])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !invite) return
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) return toast.error(error.message)
    if (!data.session) setSent(true)
    else window.history.replaceState(null, '', '/')
  }

  return (
    <AuthLayout>
      {invite === undefined && <p className="muted">Checking your invite…</p>}
      {invite === null && (
        <>
          <h1 style={{ fontSize: 26, fontWeight: 600 }}>This invite isn’t valid</h1>
          <p className="muted" style={{ marginTop: 6 }}>It may have been used already or revoked. Ask the workspace owner for a new one.</p>
          <a className="btn btn-lg mt-16" href="/">Go to sign in</a>
        </>
      )}
      {invite && sent && (
        <>
          <h1 style={{ fontSize: 26, fontWeight: 600 }}>Check your email</h1>
          <p className="muted" style={{ marginTop: 6 }}>We sent a confirmation link to <b>{invite.email}</b>. Click it to finish joining.</p>
        </>
      )}
      {invite && !sent && (
        <>
          <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.025em' }}>Join {invite.inviter}’s workspace</h1>
          <p className="muted" style={{ marginTop: 6 }}>You’re invited as {invite.role === 'admin' ? 'an admin' : 'a member'}.</p>
          <form className="stack" style={{ marginTop: 28 }} onSubmit={submit}>
            <button type="button" className="btn btn-lg btn-block" onClick={() => void signInWithGoogle('/')}>
              <GoogleIcon />
              Continue with Google
            </button>
            <span className="hint">Use the Google account for {invite.email}.</span>
            <div className="or">or</div>
            <Field label="Email">
              <input className="inp" value={invite.email} disabled />
            </Field>
            <Field label="Your name">
              <input className="inp" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </Field>
            <Field label="Choose a password">
              <input className="inp" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <button type="submit" className="btn btn-pri btn-lg btn-block" disabled={busy}>{busy ? 'Creating…' : 'Accept invite'}</button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
