import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Field } from '@/components/ui/field'
import { AuthLayout } from '@/features/auth/AuthLayout'

/** Shown after clicking a password-reset email link. */
export function ResetPasswordPage({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) return toast.error('Passwords don’t match')
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success('Password updated')
    onDone()
  }

  return (
    <AuthLayout>
      <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.025em' }}>Set a new password</h1>
      <form className="stack" style={{ marginTop: 28 }} onSubmit={submit}>
        <Field label="New password">
          <input className="inp" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm new password">
          <input className="inp" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <button type="submit" className="btn btn-pri btn-lg btn-block" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
      </form>
    </AuthLayout>
  )
}
