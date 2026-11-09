import { useEffect, useState, type FormEvent } from 'react'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { signOut } from '@/hooks/useAuth'
import { useData } from '@/data/store'
import { Field } from '@/components/ui/field'
import { AuthLayout } from '@/features/auth/AuthLayout'

interface PendingInvite {
  id: string
  workspace: string
  inviter: string
  role: string
}

/** Shown after sign-up to anyone who isn't in a workspace yet: name one, or join an invite. */
export function CreateWorkspacePage() {
  const { me, init } = useData()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [invite, setInvite] = useState<PendingInvite | null>(null)

  useEffect(() => {
    if (!supabase) return
    void supabase.rpc('my_pending_invite').then(({ data }) => setInvite((data as PendingInvite[] | null)?.[0] ?? null))
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !name.trim()) return
    setBusy(true)
    const { error } = await supabase.rpc('create_workspace', { p_name: name.trim() })
    if (error) {
      setBusy(false)
      return toast.error('Couldn’t create the workspace', { description: error.message })
    }
    toast.success(`Welcome to ${name.trim()}`)
    await init()
  }

  async function join() {
    if (!supabase || !invite) return
    setBusy(true)
    const { error } = await supabase.rpc('accept_invite', { p_invite: invite.id })
    if (error) {
      setBusy(false)
      return toast.error('Couldn’t join', { description: error.message })
    }
    toast.success(`You joined ${invite.workspace}`)
    await init()
  }

  return (
    <AuthLayout>
      <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.025em' }}>Name your workspace</h1>
      <p className="muted" style={{ marginTop: 6 }}>
        Your clients, projects and invoices live here. You can rename it later in Workspace settings.
      </p>

      {invite && (
        <div className="ws-invite">
          <div className="grow">
            <b>{invite.inviter} invited you to {invite.workspace}</b>
            <span className="small muted">Join as {invite.role === 'admin' ? 'an admin' : 'a member'} instead of creating your own.</span>
          </div>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void join()}>Join</button>
        </div>
      )}

      <form className="stack" style={{ marginTop: 24 }} onSubmit={submit}>
        <Field label="Workspace name" hint="Usually your studio, agency or business name.">
          <input className="inp" required maxLength={80} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Northwind Studio" />
        </Field>
        <button type="submit" className="btn btn-pri btn-lg btn-block" disabled={busy || !name.trim()}>
          {busy ? 'Creating…' : 'Create workspace'}
        </button>
      </form>

      <p className="small muted" style={{ marginTop: 20 }}>
        Signed in as {me?.email}.{' '}
        <button type="button" className="link-btn small" onClick={() => void signOut()}>
          <LogOut className="i i-xs" /> Sign out
        </button>
      </p>
    </AuthLayout>
  )
}
