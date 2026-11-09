import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Code2, Copy, Edit3, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { Menu, MenuItem } from '@/components/ui/menu'
import { ConfirmDialog } from '@/components/ui/modal'
import { copyText } from '@/lib/utils'
import type { CodeSnippet } from '@/types'

const LANGUAGES: { value: string; label: string }[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
  { value: 'python', label: 'Python' },
  { value: 'php', label: 'PHP' },
  { value: 'shell', label: 'Shell' },
  { value: 'text', label: 'Plain text' },
]
const langLabel = (v: string) => LANGUAGES.find((l) => l.value === v)?.label ?? v
const PREVIEW_LINES = 14

/**
 * Saved code for a task or a project (a dataLayer push, a GTM tag, a script…):
 * several separate snippets, each with a title, a language and a copy button.
 */
export function CodeSnippets({ taskId, projectId, compact }: { taskId?: string; projectId?: string; compact?: boolean }) {
  const { snippets, snippetsReady, createRow } = useData()
  const [editing, setEditing] = useState<string | null>(null)
  const list = snippets
    .filter((s) => (taskId ? s.task_id === taskId : s.project_id === projectId))
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))

  const add = () => {
    const row = createRow<CodeSnippet>('code_snippets', {
      task_id: taskId ?? null,
      project_id: taskId ? null : projectId ?? null,
      title: '',
      language: 'javascript',
      code: '',
      position: (list.at(-1)?.position ?? 0) + 1,
    })
    setEditing(row.id)
  }

  if (!snippetsReady) {
    return <p className="small muted">Run <b>supabase/schema.sql</b> in the Supabase SQL editor to turn on code snippets.</p>
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {list.length === 0 && !compact && (
        <div className="card"><div className="empty sm"><p>Save code here: a dataLayer push, a GTM tag, a script. Keep each piece separate with its own title.</p></div></div>
      )}
      {list.map((s) => (
        <SnippetCard key={s.id} snippet={s} editing={editing === s.id} onEdit={() => setEditing(s.id)} onDone={() => setEditing(null)} />
      ))}
      <div>
        <button type="button" className="btn btn-sm" onClick={add}><Plus className="i i-sm" />Add code</button>
      </div>
    </div>
  )
}

function SnippetCard({ snippet, editing, onEdit, onDone }: { snippet: CodeSnippet; editing: boolean; onEdit: () => void; onDone: () => void }) {
  const { updateRow, deleteRow } = useData()
  const [title, setTitle] = useState(snippet.title)
  const [code, setCode] = useState(snippet.code)
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const lines = snippet.code.split('\n')
  const long = lines.length > PREVIEW_LINES
  const shown = long && !expanded ? lines.slice(0, PREVIEW_LINES).join('\n') : snippet.code

  const save = () => {
    const patch: Partial<CodeSnippet> = {}
    if (title.trim() !== snippet.title) patch.title = title.trim()
    if (code !== snippet.code) patch.code = code
    if (Object.keys(patch).length) updateRow('code_snippets', snippet.id, patch)
    onDone()
  }
  const cancel = () => {
    // A brand-new empty snippet that was never filled in just goes away.
    if (!snippet.title && !snippet.code && !title.trim() && !code.trim()) deleteRow('code_snippets', snippet.id)
    setTitle(snippet.title)
    setCode(snippet.code)
    onDone()
  }
  const copy = () => {
    void copyText(snippet.code).then(() => {
      setCopied(true)
      toast.success('Code copied')
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="snippet">
      <div className="snippet-h">
        <Code2 className="i i-sm faint" />
        {editing ? (
          <input className="snippet-title-inp" autoFocus={!snippet.title} placeholder="Title, e.g. Book a demo dataLayer push" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        ) : (
          <b className="grow trunc">{snippet.title || <span className="faint m">Untitled code</span>}</b>
        )}
        <Menu
          align="right"
          trigger={({ toggle }) => (
            <button type="button" className="snippet-lang" onClick={toggle} title="Language">{langLabel(snippet.language)}<ChevronDown className="i i-xs" /></button>
          )}
        >
          {LANGUAGES.map((l) => (
            <MenuItem key={l.value} on={l.value === snippet.language} onSelect={() => updateRow('code_snippets', snippet.id, { language: l.value })}>{l.label}</MenuItem>
          ))}
        </Menu>
        {!editing && (
          <>
            <button type="button" className="btn btn-sm btn-ghost" onClick={copy} disabled={!snippet.code} title="Copy code">{copied ? <Check className="i i-sm" /> : <Copy className="i i-sm" />}{copied ? 'Copied' : 'Copy'}</button>
            <button type="button" className="btn btn-sm btn-ghost btn-icon" onClick={onEdit} aria-label="Edit code" title="Edit"><Edit3 className="i i-sm" /></button>
            <button type="button" className="btn btn-sm btn-ghost btn-icon" onClick={() => setConfirmDelete(true)} aria-label="Delete code" title="Delete"><Trash2 className="i i-sm" /></button>
          </>
        )}
      </div>
      {editing ? (
        <div className="snippet-edit">
          <textarea
            className="snippet-code"
            spellCheck={false}
            autoFocus={Boolean(snippet.title)}
            placeholder="Paste or type your code…"
            rows={Math.min(24, Math.max(6, code.split('\n').length + 1))}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              // Tab inserts two spaces instead of leaving the box; Ctrl/⌘+Enter saves.
              if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault()
                const el = e.currentTarget
                const { selectionStart: a, selectionEnd: b } = el
                const next = `${code.slice(0, a)}  ${code.slice(b)}`
                setCode(next)
                requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2))
              } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                save()
              } else if (e.key === 'Escape') cancel()
            }}
          />
          <div className="row between" style={{ padding: '8px 12px' }}>
            <span className="xs faint">Ctrl + Enter to save · Esc to cancel</span>
            <span className="row-sm">
              <button type="button" className="btn btn-sm btn-ghost" onClick={cancel}>Cancel</button>
              <button type="button" className="btn btn-sm btn-pri" onClick={save}>Save code</button>
            </span>
          </div>
        </div>
      ) : snippet.code ? (
        <>
          <pre className="snippet-pre"><code>{shown}</code></pre>
          {long && (
            <button type="button" className="snippet-more" onClick={() => setExpanded((x) => !x)}>
              {expanded ? <><ChevronUp className="i i-xs" />Show less</> : <><ChevronDown className="i i-xs" />Show all {lines.length} lines</>}
            </button>
          )}
        </>
      ) : (
        <button type="button" className="snippet-empty" onClick={onEdit}>No code yet. Click to add.</button>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${snippet.title ? `“${snippet.title}”` : 'this code'}?`}
        description="The saved code is removed for everyone."
        confirmLabel="Delete"
        onConfirm={() => deleteRow('code_snippets', snippet.id)}
      />
    </div>
  )
}
