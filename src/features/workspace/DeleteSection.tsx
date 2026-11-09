import { useState } from 'react'
import { Download, Mail, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, useData } from '@/data/store'
import { Section } from '@/components/ui/layout'
import { Field } from '@/components/ui/field'

/** Everything this person can see, as one JSON file. */
export function buildExport() {
  const s = useData.getState()
  const data = {
    clients: s.clients, projects: s.projects, tasks: s.tasks, subtasks: s.subtasks, access_items: s.accessItems,
    project_notes: s.notes, task_comments: s.comments, task_attachments: s.attachments, time_entries: s.timeEntries,
    task_watchers: s.watchers, code_snippets: s.snippets, payments: s.payments, invoices: s.invoices,
    payment_reminders: s.reminders, invoice_settings: s.invoiceSettings, profiles: s.profiles,
    client_members: s.clientMembers, invites: s.invites, activity_log: s.activity, notifications: s.notifications,
    learning_items: s.learning, learning_goals: s.goals, learning_topics: s.topics, learning_lessons: s.lessons,
    learning_resources: s.resources, learning_topic_members: s.topicMembers, learning_progress: s.progress,
    team_links: s.teamLinks,
  }
  const json = JSON.stringify(
    {
      app: 'MyDesk',
      exported_at: new Date().toISOString(),
      exported_by: s.me ? { id: s.me.id, email: s.me.email, role: s.me.role } : null,
      workspace: s.workspace,
      note: 'Uploaded files are listed in task_attachments but not included in this file.',
      data,
    },
    null,
    2,
  )
  const slug = (s.workspace?.name ?? 'workspace').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'
  return { json, filename: `mydesk-${slug}-export-${new Date().toISOString().slice(0, 10)}.json` }
}

function toBase64(text: string) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function download(json: string, filename: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Deleting is deliberately slow: open the section, download the export, type the
 * workspace name (owners) or email (everyone else), then confirm from an emailed link.
 * An owner's account and workspace are deleted together.
 */
export function DeleteSection({ id = 'delete' }: { id?: string }) {
  const { me, workspace } = useData()
  const [open, setOpen] = useState(false)
  const [exported, setExported] = useState<{ json: string; filename: string } | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<{ email: string; attached: boolean } | null>(null)
  if (!me) return null

  const isOwner = Boolean(workspace && workspace.owner_id === me.id) || me.role === 'owner'
  const expected = isOwner ? (workspace?.name ?? '') : me.email
  const matches = typed.trim().toLowerCase() === expected.trim().toLowerCase() && expected.trim() !== ''

  const doExport = () => {
    const out = buildExport()
    download(out.json, out.filename)
    setExported(out)
    toast.success('Export downloaded')
  }

  const request = async () => {
    if (!exported || !matches) return
    setBusy(true)
    try {
      const res = await api<{ email: string; attached: boolean }>('account/delete-request', {
        kind: isOwner ? 'workspace' : 'account',
        confirm: typed.trim(),
        export_base64: toBase64(exported.json),
        export_filename: exported.filename,
      })
      setSent(res)
    } catch (err) {
      toast.error('Couldn’t send the confirmation email', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  const title = isOwner ? 'Delete workspace and account' : 'Delete my account'
  const what = isOwner ? (
    <>
      Permanently deletes <strong>{workspace?.name}</strong>, all its clients, projects, tasks, invoices, payments and files, and your
      account. Your teammates lose access straight away. This can’t be undone.
    </>
  ) : (
    <>Permanently deletes your login. Your work stays in the workspace (tasks assigned to you become unassigned). This can’t be undone.</>
  )

  return (
    <Section id={id} title="Danger zone" danger>
      <div className="danger-row">
        <div>
          <b>{title}</b>
          <small>{what}</small>
        </div>
        {!open && (
          <button type="button" className="btn btn-danger" onClick={() => setOpen(true)}>
            <Trash2 className="i i-sm" />
            {isOwner ? 'Delete workspace…' : 'Delete account…'}
          </button>
        )}
      </div>

      {open && sent && (
        <p className="small">
          <Mail className="i i-sm" /> We emailed a confirmation link to <b>{sent.email}</b>
          {sent.attached ? ', with your export attached' : ''}. Open it within 30 minutes to finish. Nothing has been deleted yet.
        </p>
      )}

      {open && !sent && (
        <ol className="danger-steps">
          <li className={exported ? 'done' : undefined}>
            <span className="num">{exported ? '✓' : 1}</span>
            <div className="grow stack-sm">
              <span className="small">Download a copy of your data first.</span>
              <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={doExport}>
                <Download className="i i-sm" />
                {exported ? 'Download again' : 'Export data (.json)'}
              </button>
            </div>
          </li>
          <li className={matches ? 'done' : undefined}>
            <span className="num">{matches ? '✓' : 2}</span>
            <div className="grow">
              <Field label={<>Type <b>{expected}</b> to confirm</>}>
                <input className="inp" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={!exported} autoComplete="off" spellCheck={false} />
              </Field>
            </div>
          </li>
          <li>
            <span className="num">3</span>
            <div className="grow stack-sm">
              <span className="small">We’ll email you a link. Deleting only happens after you open it and confirm once more.</span>
              <div className="row wrap" style={{ gap: 8 }}>
                <button type="button" className="btn btn-sm btn-destroy" disabled={!exported || !matches || busy} onClick={() => void request()}>
                  <Mail className="i i-sm" />
                  {busy ? 'Sending…' : 'Email me the confirmation link'}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); setTyped('') }}>Cancel</button>
              </div>
            </div>
          </li>
        </ol>
      )}
    </Section>
  )
}
