import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { api, useData } from '@/data/store'
import { supabase } from '@/lib/supabase'
import { Topbar, Content } from '@/components/ui/layout'
import { Field } from '@/components/ui/field'

/** /confirm-delete?token=…: the last step, opened from the emailed link. */
export function ConfirmDeletePage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { me, workspace } = useData()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  if (!me) return null

  const isOwner = Boolean(workspace && workspace.owner_id === me.id) || me.role === 'owner'
  const expected = isOwner ? (workspace?.name ?? '') : me.email
  const matches = typed.trim().toLowerCase() === expected.trim().toLowerCase() && expected.trim() !== ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!matches || !token) return
    setBusy(true)
    try {
      await api('account/delete-confirm', { token, confirm: typed.trim() })
    } catch (err) {
      setBusy(false)
      return toast.error('Couldn’t delete', { description: err instanceof Error ? err.message : undefined })
    }
    // The login no longer exists; clear the local session and leave.
    await supabase?.auth.signOut().catch(() => {})
    window.location.href = '/'
  }

  return (
    <>
      <Topbar crumbs={[{ label: 'Confirm delete' }]} />
      <Content>
        <div style={{ maxWidth: 520, margin: '24px auto' }} className="stack">
          <div className="row" style={{ gap: 10, color: 'var(--bad)' }}>
            <AlertTriangle className="i" />
            <h1 style={{ fontSize: 22, fontWeight: 600 }}>{isOwner ? `Delete ${workspace?.name ?? 'workspace'} forever?` : 'Delete your account forever?'}</h1>
          </div>
          <p className="muted">
            {isOwner
              ? 'This deletes the workspace, all its clients, projects, tasks, invoices, payments and files, and your account. Your teammates lose access. It can’t be undone.'
              : 'This deletes your login. Your work stays in the workspace. It can’t be undone.'}
          </p>
          {!token ? (
            <p className="small">This link is missing its code. Start again from your settings.</p>
          ) : (
            <form className="stack" onSubmit={submit}>
              <Field label={<>Type <b>{expected}</b> one last time</>}>
                <input className="inp" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
              </Field>
              <div className="row wrap" style={{ gap: 8 }}>
                <button type="submit" className="btn btn-destroy" disabled={!matches || busy}>{busy ? 'Deleting…' : 'Delete forever'}</button>
                <Link to="/" className="btn btn-ghost">Keep everything</Link>
              </div>
            </form>
          )}
        </div>
      </Content>
    </>
  )
}
