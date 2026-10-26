import { useEffect, useState } from 'react'
import { Copy, ExternalLink, Pencil, Plus, Trash2, Video } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { useIsAdmin } from '@/hooks/usePermissions'
import { Modal } from '@/components/ui/modal'
import { Field } from '@/components/ui/field'
import { copyText } from '@/lib/utils'
import type { TeamLink } from '@/types'

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
const normUrl = (url: string) => (/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`)

/** Meeting rooms and shared links for the whole team (Team page). */
export function TeamLinks() {
  const { teamLinks, teamLinksReady, deleteRow } = useData()
  const isAdmin = useIsAdmin()
  const [editing, setEditing] = useState<{ open: boolean; link?: TeamLink }>({ open: false })
  const links = [...teamLinks].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
  const canEdit = isAdmin && teamLinksReady
  // Members see nothing until an admin adds a link.
  if (!links.length && !isAdmin) return null

  return (
    <section className="tl-wrap">
      {links.map((l) => (
        <div key={l.id} className="tl-card">
          <span className="tl-icon"><Video className="i" /></span>
          <div className="grow" style={{ minWidth: 0 }}>
            <b className="trunc">{l.title}</b>
            <small className="trunc">{l.note ? `${l.note} · ` : ''}{host(l.url)}</small>
          </div>
          <div className="row-sm" style={{ flex: 'none' }}>
            <button type="button" className="btn btn-sm btn-ghost btn-icon" title="Copy link" aria-label="Copy link" onClick={() => void copyText(l.url).then(() => toast.success('Meeting link copied'))}><Copy className="i i-sm" /></button>
            {canEdit && (
              <>
                <button type="button" className="btn btn-sm btn-ghost btn-icon" title="Edit" aria-label="Edit link" onClick={() => setEditing({ open: true, link: l })}><Pencil className="i i-sm" /></button>
                <button type="button" className="btn btn-sm btn-ghost btn-icon" title="Remove" aria-label="Remove link" onClick={() => { deleteRow('team_links', l.id); toast.success('Link removed') }}><Trash2 className="i i-sm" /></button>
              </>
            )}
            <a className="btn btn-sm btn-pri" href={l.url} target="_blank" rel="noreferrer"><ExternalLink className="i i-sm" />Join</a>
          </div>
        </div>
      ))}
      {canEdit && (
        links.length === 0 ? (
          <button type="button" className="tl-card tl-empty" onClick={() => setEditing({ open: true })}>
            <span className="tl-icon"><Video className="i" /></span>
            <div className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
              <b>Add your team meeting link</b>
              <small>Google Meet, Zoom… everyone gets a one-click Join button here.</small>
            </div>
            <span className="btn btn-sm"><Plus className="i i-sm" />Add link</span>
          </button>
        ) : (
          <button type="button" className="tl-add" onClick={() => setEditing({ open: true })}><Plus className="i i-sm" />Add another meeting or link</button>
        )
      )}
      {isAdmin && !teamLinksReady && <span className="xs faint">Run <b>supabase/team-links.sql</b> in Supabase once to turn on team links.</span>}
      <LinkModal state={editing} count={teamLinks.length} onClose={() => setEditing({ open: false })} />
    </section>
  )
}

function LinkModal({ state, count, onClose }: { state: { open: boolean; link?: TeamLink }; count: number; onClose: () => void }) {
  const { createRow, updateRow } = useData()
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  useEffect(() => {
    if (!state.open) return
    setTitle(state.link?.title ?? '')
    setUrl(state.link?.url ?? '')
    setNote(state.link?.note ?? '')
  }, [state.open, state.link])
  const save = () => {
    if (!url.trim()) return toast.error('Add the link')
    const data = { title: title.trim() || host(normUrl(url)), url: normUrl(url), note: note.trim() || null }
    if (state.link) updateRow('team_links', state.link.id, data)
    else createRow<TeamLink>('team_links', { ...data, position: count })
    toast.success(state.link ? 'Link saved' : 'Link added')
    onClose()
  }
  return (
    <Modal open={state.open} onClose={onClose} size="narrow" title={state.link ? 'Edit link' : 'Add a team link'} footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn btn-pri" onClick={save}>Save</button></>}>
      <form className="dlg-b" onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Link"><input data-autofocus className="inp" placeholder="https://meet.google.com/…" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
        <Field label="Name"><input className="inp" placeholder="e.g. Daily meeting" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="When / what for (optional)"><input className="inp" placeholder="e.g. Every day at 10:00 AM" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
