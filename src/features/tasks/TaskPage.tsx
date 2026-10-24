import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Calendar, Check, ChevronDown, ChevronUp, Copy, Eye, EyeOff, Folder, Link2, Mail, MoreHorizontal, Paperclip, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { addComment, assignTask, deleteTask, duplicateTask, setTaskStatus, toggleSubtask, updateTask } from '@/data/actions'
import { pushRecent } from '@/components/layout/CommandPalette'
import { Topbar, Empty } from '@/components/ui/layout'
import { Menu, MenuItem, MenuSep, MenuTitle, MenuSearch } from '@/components/ui/menu'
import { Tabs } from '@/components/ui/tabs'
import { Avatar, ClientMark } from '@/components/ui/avatar'
import { PrioBars, StatusRing } from '@/components/ui/pill'
import { RichText } from '@/components/ui/rich-text'
import { Composer, MentionText } from '@/components/ui/mentions'
import { ConfirmDialog, Modal } from '@/components/ui/modal'
import { Field } from '@/components/ui/field'
import { labelTone } from '@/components/domain/TaskRow'
import { supabase } from '@/lib/supabase'
import { clientDisplayName, eligibleAssignees, profileDisplayName, profileFullName, shortProjectTitle, taskRef } from '@/lib/derive'
import { daysUntil, formatBytes, formatDate, formatDateTime, formatFeedAgo, formatMinutes, parseDuration, todayISO } from '@/lib/format'
import { priorityMeta, taskRing, taskStatus } from '@/lib/status'
import { copyText } from '@/lib/utils'
import type { Priority, Subtask, TaskAttachment, TaskStatus, TaskWatcher, TimeEntry } from '@/types'
import { format, parseISO } from 'date-fns'

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']

function fileExt(name: string) {
  return (name.split('.').pop() ?? 'FILE').toUpperCase().slice(0, 4)
}

export function TaskPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const data = useData()
  const { tasks, projects, clients, profiles, clientMembers, subtasks, comments, attachments, timeEntries, watchers, activity, me, demoMode, createRow, updateRow, deleteRow } = data
  const task = tasks.find((t) => t.id === id)
  const project = projects.find((p) => p.id === task?.project_id)
  const client = clients.find((c) => c.id === project?.client_id)

  const [tab, setTab] = useState<'comments' | 'activity'>('comments')
  const [title, setTitle] = useState(task?.title ?? '')
  const [newSub, setNewSub] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTitle(task?.title ?? '')
    if (task) pushRecent(`/tasks/${task.id}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id])

  // Deep link to a comment (#c-<id>): scroll + flash.
  useEffect(() => {
    const cid = location.hash.startsWith('#c-') ? location.hash.slice(1) : null
    if (!cid) return
    const t = setTimeout(() => {
      const el = document.getElementById(cid)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.classList.add('flash')
    }, 300)
    return () => clearTimeout(t)
  }, [location.hash, id])

  const subs = useMemo(() => subtasks.filter((s) => s.task_id === id).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)), [subtasks, id])
  const thread = useMemo(() => comments.filter((c) => c.task_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at)), [comments, id])
  const files = attachments.filter((a) => a.task_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at))
  const time = timeEntries.filter((t) => t.task_id === id)
  const watching = watchers.filter((w) => w.task_id === id)
  const iWatch = watching.find((w) => w.user_id === me?.id)
  const history = activity.filter((a) => a.entity_id === id && ['task', 'comment', 'subtask', 'attachment', 'time'].includes(a.entity)).sort((a, b) => b.created_at.localeCompare(a.created_at))

  // Prev/next within the same project, by task number.
  const siblings = tasks.filter((t) => t.project_id === task?.project_id).sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
  const idx = siblings.findIndex((t) => t.id === id)

  if (!task) {
    return (
      <>
        <Topbar crumbs={[{ label: 'My tasks', to: '/tasks' }, { label: 'Not found' }]} />
        <div className="content"><div className="card"><Empty title="Task not found">It may have been deleted, or you don’t have access to its client.</Empty></div></div>
      </>
    )
  }

  const people = eligibleAssignees(project?.client_id, profiles, clientMembers)
  const assignee = profiles.find((p) => p.id === task.assignee_id)
  const creator = profiles.find((p) => p.id === task.created_by)
  const logged = time.reduce((s, t) => s + t.minutes, 0)
  const doneSubs = subs.filter((s) => s.done).length
  const due = daysUntil(task.due_date)
  const ref = taskRef(task, project)

  const saveTitle = () => {
    const t = title.trim()
    if (!t) return setTitle(task.title)
    if (t !== task.title) updateTask(task, { title: t }, `renamed the task to “${t}”`)
  }

  const addSub = () => {
    const t = newSub.trim()
    if (!t) return
    createRow<Subtask>('subtasks', { task_id: task.id, title: t, done: false, assignee_id: null, position: subs.length ? Math.max(...subs.map((s) => s.position)) + 1 : 0 })
    setNewSub('')
  }

  const toggleWatch = () => {
    if (!me) return
    if (iWatch) deleteRow('task_watchers', iWatch.id)
    else createRow<TaskWatcher>('task_watchers', { task_id: task.id, user_id: me.id })
  }

  const uploadFiles = async (list: FileList | File[]) => {
    const arr = [...list]
    if (arr.length === 0) return
    if (demoMode || !supabase) {
      for (const f of arr) createRow<TaskAttachment>('task_attachments', { task_id: task.id, kind: 'file', name: f.name, size_bytes: f.size })
      toast('Demo mode: files are listed but not stored')
      return
    }
    for (const f of arr) {
      if (f.size > 25 * 1024 * 1024) {
        toast.error(`${f.name} is over 25 MB`)
        continue
      }
      const path = `${task.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]+/g, '_')}`
      const t = toast.loading(`Uploading ${f.name}…`)
      const { error } = await supabase.storage.from('attachments').upload(path, f, { contentType: f.type || undefined })
      toast.dismiss(t)
      if (error) {
        toast.error(`Couldn’t upload ${f.name}`, { description: error.message })
        continue
      }
      createRow<TaskAttachment>('task_attachments', { task_id: task.id, kind: 'file', name: f.name, storage_path: path, size_bytes: f.size })
      data.logActivity({ entity: 'attachment', entityId: task.id, action: 'created', message: `attached ${f.name}`, projectId: task.project_id })
    }
  }

  const openFile = async (a: TaskAttachment) => {
    if (a.kind === 'link' && a.url) return window.open(a.url, '_blank', 'noopener')
    if (!a.storage_path || !supabase) return toast('This file isn’t stored (added in demo mode)')
    const { data: signed, error } = await supabase.storage.from('attachments').createSignedUrl(a.storage_path, 60 * 10, { download: a.name })
    if (error || !signed) return toast.error('Couldn’t open the file', { description: error?.message })
    window.open(signed.signedUrl, '_blank', 'noopener')
  }

  const removeFile = async (a: TaskAttachment) => {
    deleteRow('task_attachments', a.id)
    if (a.storage_path && supabase) await supabase.storage.from('attachments').remove([a.storage_path])
  }

  const onPaste = (e: ClipboardEvent) => {
    const text = e.clipboardData.getData('text')
    if (/^https?:\/\/\S+$/.test(text.trim())) {
      e.preventDefault()
      addLink(text.trim())
    } else if (e.clipboardData.files.length) {
      e.preventDefault()
      void uploadFiles(e.clipboardData.files)
    }
  }

  const addLink = (url: string, name?: string) => {
    let host = url
    try {
      host = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      return toast.error('That doesn’t look like a link')
    }
    createRow<TaskAttachment>('task_attachments', { task_id: task.id, kind: 'link', name: name?.trim() || host, url })
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) void uploadFiles(e.dataTransfer.files)
    else {
      const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text')
      if (url) addLink(url.trim())
    }
  }

  const addLabel = () => {
    const l = labelDraft.trim()
    if (!l || task.labels?.includes(l)) return setLabelDraft('')
    updateTask(task, { labels: [...(task.labels ?? []), l] })
    setLabelDraft('')
  }

  // Who has been emailed about this task (assignment + @mentions), derived from history.
  const emailed = [
    ...history.filter((h) => h.action === 'assigned' && h.meta?.emailed).map((h) => ({ id: h.id, text: `${h.message.replace(/^assigned /, '')} emailed on assignment`, at: h.created_at })),
    ...thread.flatMap((c) =>
      c.mentions.filter((m) => m !== c.author_id).map((m) => {
        const p = profiles.find((x) => x.id === m)
        return p && p.notification_prefs?.mentioned !== false ? { id: c.id + m, text: `${profileDisplayName(p)} emailed for @mention`, at: c.created_at } : null
      }),
    ).filter(Boolean) as { id: string; text: string; at: string }[],
  ].sort((a, b) => a.at.localeCompare(b.at))

  return (
    <>
      <Topbar
        crumbs={[
          ...(client ? [{ label: clientDisplayName(client), to: `/clients/${client.id}`, icon: <ClientMark client={client} size="xs" /> }] : []),
          ...(project ? [{ label: shortProjectTitle(project.title), to: `/projects/${project.id}` }] : []),
          { label: <span className="mono" style={{ fontSize: 12.5 }}>{ref || 'Task'}</span> },
        ]}
      >
        <button type="button" className="btn hide-sm" onClick={() => void copyText(window.location.href).then(() => toast.success('Link copied'))}>
          <Link2 className="i" />Copy link
        </button>
        <button type="button" className="btn hide-sm" onClick={toggleWatch} title={iWatch ? 'Stop watching' : 'Watch: get comment notifications'}>
          {iWatch ? <Eye className="i" /> : <EyeOff className="i" />}
          {iWatch ? 'Watching' : 'Watch'}{watching.length ? ` · ${watching.length}` : ''}
        </button>
        <button type="button" className="btn btn-icon" aria-label="Previous task" disabled={idx <= 0} onClick={() => navigate(`/tasks/${siblings[idx - 1].id}`)}><ChevronUp className="i" /></button>
        <button type="button" className="btn btn-icon" aria-label="Next task" disabled={idx < 0 || idx >= siblings.length - 1} onClick={() => navigate(`/tasks/${siblings[idx + 1].id}`)}><ChevronDown className="i" /></button>
        <Menu trigger={({ toggle }) => <button type="button" className="btn btn-icon" aria-label="More" onClick={toggle}><MoreHorizontal className="i" /></button>}>
          <MenuItem icon={<Copy className="i" />} onSelect={() => { const c = duplicateTask(task); navigate(`/tasks/${c.id}`) }}>Duplicate</MenuItem>
          <MenuItem icon={<Folder className="i" />} onSelect={() => setMoveOpen(true)}>Move to project…</MenuItem>
          <MenuSep />
          <MenuItem danger icon={<Trash2 className="i" />} onSelect={() => setConfirmDelete(true)}>Delete task</MenuItem>
        </Menu>
      </Topbar>

      <div className="cols" style={{ gap: 0, maxWidth: 1320, alignItems: 'stretch' }}>
        <div className="col-main task-main" style={{ gap: 28 }} onPaste={onPaste}>
          <div className="row" style={{ alignItems: 'flex-start', gap: 12, animation: 'in .5s var(--ease) both' }}>
            <span style={{ marginTop: 9 }}><StatusRing status={task.status} size={18} onToggle={() => setTaskStatus(task, task.status === 'done' ? 'todo' : 'done')} /></span>
            <textarea
              className="title-input"
              value={title}
              rows={1}
              aria-label="Task title"
              onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto'
                  el.style.height = `${el.scrollHeight}px`
                }
              }}
            />
          </div>

          <section style={{ animation: 'in .5s var(--ease) .05s both' }}>
            <RichText key={task.id} defaultValue={task.description} placeholder="Add a description. What does done look like?" showSaved onSave={(html) => updateTask(task, { description: html })} />
          </section>

          <section style={{ animation: 'in .5s var(--ease) .1s both' }}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <h2 className="h3">Subtasks {subs.length > 0 && <span className="muted m">{doneSubs}/{subs.length}</span>}</h2>
              {subs.length > 0 && <div className="bar" style={{ width: 140 }}><i className={doneSubs === subs.length ? 'ok' : undefined} style={{ width: `${(doneSubs / subs.length) * 100}%` }} /></div>}
            </div>
            <div className="card">
              {subs.map((s) => {
                const who = profiles.find((p) => p.id === s.assignee_id)
                return (
                  <div key={s.id} className="check-row" style={{ cursor: 'default' }}>
                    <input className="cb" type="checkbox" checked={s.done} onChange={() => toggleSubtask(s, task)} aria-label={s.title} />
                    <input
                      className="txt inp-inline"
                      defaultValue={s.title}
                      style={s.done ? { textDecoration: 'line-through', color: 'var(--faint)' } : undefined}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (!v) deleteRow('subtasks', s.id)
                        else if (v !== s.title) updateRow('subtasks', s.id, { title: v })
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    />
                    <Menu trigger={({ toggle }) => <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={toggle} title={who ? profileDisplayName(who) : 'Assign'} style={{ width: 26, height: 26 }}><Avatar profile={who} size="xs" /></button>}>
                      <MenuTitle>Assign to</MenuTitle>
                      {people.map((p) => <MenuItem key={p.id} on={p.id === s.assignee_id} icon={<Avatar profile={p} size="xs" />} onSelect={() => updateRow('subtasks', s.id, { assignee_id: p.id })}>{p.id === me?.id ? 'Me' : profileFullName(p)}</MenuItem>)}
                      <MenuSep />
                      <MenuItem icon={<Avatar size="xs" />} onSelect={() => updateRow('subtasks', s.id, { assignee_id: null })}>Unassigned</MenuItem>
                      <MenuItem danger icon={<Trash2 className="i" />} onSelect={() => deleteRow('subtasks', s.id)}>Delete subtask</MenuItem>
                    </Menu>
                  </div>
                )
              })}
              <div className="sub-add">
                <Plus className="i i-sm faint" />
                <input placeholder="Add subtask" aria-label="Add subtask" value={newSub} onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()} onBlur={addSub} />
              </div>
            </div>
          </section>

          <section style={{ animation: 'in .5s var(--ease) .15s both' }}>
            <h2 className="h3" style={{ marginBottom: 10 }}>Attachments &amp; links</h2>
            <div className="row wrap">
              {files.map((a) => {
                const by = profiles.find((p) => p.id === a.uploaded_by)
                let host = ''
                try {
                  host = a.url ? new URL(a.url).hostname.replace(/^www\./, '') : ''
                } catch {
                  host = a.url ?? ''
                }
                return (
                  <div key={a.id} className="file" role="button" tabIndex={0} style={{ cursor: 'pointer', position: 'relative' }} onClick={() => void openFile(a)} onKeyDown={(e) => e.key === 'Enter' && void openFile(a)}>
                    <span className={`ext ${a.kind === 'link' ? 'pri' : 'ok'}`}>{a.kind === 'link' ? <Link2 className="i i-sm" /> : fileExt(a.name)}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="small m trunc" style={{ display: 'block', maxWidth: 200 }}>{a.name}</span>
                      <span className="xs muted">{a.kind === 'link' ? host : [formatBytes(a.size_bytes), by ? profileDisplayName(by) : null].filter(Boolean).join(' · ')}</span>
                    </span>
                    <button type="button" className="btn btn-ghost btn-sm btn-icon" style={{ width: 24, height: 24, marginLeft: 'auto' }} aria-label={`Remove ${a.name}`} onClick={(e) => { e.stopPropagation(); void removeFile(a) }}>
                      <X className="i i-xs" />
                    </button>
                  </div>
                )
              })}
              <div
                className={`file dropzone${dragOver ? ' over' : ''}`}
                style={{ borderStyle: 'dashed', cursor: 'pointer', color: 'var(--mute)' }}
                role="button"
                tabIndex={0}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <Paperclip className="i i-sm" />
                <span className="small">Drop files or paste a link</span>
                <input ref={fileRef} type="file" multiple className="sr" onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); e.target.value = '' }} />
              </div>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setLinkOpen(true)}><Link2 className="i i-sm" />Add link</button>
            </div>
          </section>

          <section className="tabs" style={{ animation: 'in .5s var(--ease) .2s both', gap: 14 }}>
            <Tabs variant="sm" value={tab} onChange={setTab} tabs={[{ id: 'comments', label: 'Comments', count: thread.length }, { id: 'activity', label: 'Activity' }]} />
            {tab === 'comments' ? (
              <div className="panel-in">
                <div className="sys">
                  <span className="dot" />
                  <b>{creator ? profileDisplayName(creator) : 'Someone'}</b> created the task{assignee && assignee.id !== task.created_by ? <> and assigned <b>{profileDisplayName(assignee)}</b></> : null} · {formatDateTime(task.created_at)}
                  {assignee && assignee.id !== task.created_by && assignee.notification_prefs?.assigned !== false && <span className="pill ok" style={{ height: 20 }}><Mail className="i i-xs" />Email sent</span>}
                </div>
                {thread.map((c) => {
                  const author = profiles.find((p) => p.id === c.author_id)
                  const mentioned = c.mentions.map((m) => profiles.find((p) => p.id === m)).filter(Boolean)
                  return (
                    <div key={c.id} id={`c-${c.id}`} className="comment">
                      <Avatar profile={author} size="md" />
                      <div className="body">
                        <div className="head row-sm">
                          <b className="m">{author ? profileDisplayName(author) : 'Former member'}</b> <span>· {formatFeedAgo(c.created_at)}{c.edited_at ? ' · edited' : ''}</span>
                          {(c.author_id === me?.id || me?.role !== 'member') && (
                            <button type="button" className="btn btn-ghost btn-sm btn-icon actions ml-auto" style={{ width: 24, height: 24 }} aria-label="Delete comment" onClick={() => deleteRow('task_comments', c.id)}>
                              <Trash2 className="i i-xs" />
                            </button>
                          )}
                        </div>
                        <MentionText body={c.body} />
                        {mentioned.length > 0 && <div className="xs muted" style={{ marginTop: 6 }}>Emailed {mentioned.map((p) => profileDisplayName(p)).join(', ')} once</div>}
                      </div>
                    </div>
                  )
                })}
                <div style={{ paddingTop: 14 }}>
                  <Composer
                    people={people}
                    meId={me?.id}
                    roleOf={(p) => (p.id === task.assignee_id ? 'assignee' : p.role)}
                    footnote="Mentioned people get one email per comment"
                    onSubmit={(body, mentions) => {
                      addComment(task, body, mentions)
                      // Commenting makes you a watcher, like most task tools.
                      if (me && !iWatch) createRow<TaskWatcher>('task_watchers', { task_id: task.id, user_id: me.id })
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="panel-in">
                {history.length === 0 && <span className="small muted">No activity yet.</span>}
                {history.map((h) => {
                  const actor = profiles.find((p) => p.id === h.actor_id)
                  return (
                    <div key={h.id} className="sys">
                      <span className="dot" />
                      <b>{actor ? profileDisplayName(actor) : 'Someone'}</b> {h.message} · {formatDate(h.created_at.slice(0, 10))}
                      {Boolean(h.meta?.emailed) && <span className="pill ok" style={{ height: 20 }}>Email sent</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="col-side task-side" style={{ borderLeft: '1px solid var(--line-s)', background: 'var(--soft2)', gap: 6, flex: '0 1 340px', animation: 'fade .5s ease both' }}>
          <div className="label-caps" style={{ marginBottom: 8 }}>Details</div>
          <div className="kv">
            <span>Status</span>
            <Menu align="left" trigger={({ toggle }) => <button type="button" className="prop" onClick={toggle}><span className={`st ${taskRing[task.status]}`} />{taskStatus[task.status].label}</button>}>
              {STATUSES.map((s) => <MenuItem key={s} on={s === task.status} icon={<span className={`st ${taskRing[s]}`} />} onSelect={() => setTaskStatus(task, s)}>{taskStatus[s].label}</MenuItem>)}
              <MenuSep />
              <MenuItem on={task.status === 'cancelled'} onSelect={() => setTaskStatus(task, 'cancelled')}>Cancelled</MenuItem>
            </Menu>

            <span>Assignee</span>
            <Menu align="left" trigger={({ toggle }) => <button type="button" className="prop" onClick={toggle}><Avatar profile={assignee} size="xs" />{assignee ? profileDisplayName(assignee) : 'Unassigned'}</button>}>
              <MenuTitle>Assign to</MenuTitle>
              {people.map((p) => <MenuItem key={p.id} on={p.id === task.assignee_id} icon={<Avatar profile={p} size="xs" />} onSelect={() => assignTask(task, p.id)}>{p.id === me?.id ? 'Me' : profileFullName(p)}</MenuItem>)}
              <MenuSep />
              <MenuItem icon={<Avatar size="xs" />} onSelect={() => assignTask(task, null)}>Unassigned</MenuItem>
            </Menu>

            <span>Priority</span>
            <Menu align="left" trigger={({ toggle }) => <button type="button" className="prop" onClick={toggle}><PrioBars priority={task.priority} />{priorityMeta[task.priority].label}</button>}>
              {(Object.keys(priorityMeta) as Priority[]).map((p) => <MenuItem key={p} on={p === task.priority} icon={<PrioBars priority={p} />} onSelect={() => updateTask(task, { priority: p }, `set priority to ${priorityMeta[p].label}`)}>{priorityMeta[p].label}</MenuItem>)}
            </Menu>

            <span>Due date</span>
            <label className={`prop ${due !== null && due < 0 && task.status !== 'done' ? 't-bad' : due !== null && due <= 2 && task.status !== 'done' ? 't-warn' : ''}`} style={{ position: 'relative' }}>
              <Calendar className="i i-sm" />
              {task.due_date ? format(parseISO(task.due_date), 'EEE, MMM d') : <span className="faint">Add date</span>}
              <input
                type="date"
                value={task.due_date ?? ''}
                onChange={(e) => updateTask(task, { due_date: e.target.value || null }, e.target.value ? `set due date to ${formatDate(e.target.value)}` : 'removed the due date')}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                aria-label="Due date"
              />
            </label>

            <span>Labels</span>
            <div className="row-sm wrap" style={{ padding: '4px 8px' }}>
              {task.labels?.map((l) => (
                <span key={l} className={`tag ${labelTone(l)}`} style={{ gap: 4 }}>
                  {l}
                  <button type="button" aria-label={`Remove ${l}`} onClick={() => updateTask(task, { labels: task.labels!.filter((x) => x !== l) })} style={{ border: 0, background: 'none', padding: 0, color: 'inherit', opacity: 0.6, display: 'inline-flex' }}><X className="i i-xs" /></button>
                </span>
              ))}
              <Menu align="left" trigger={({ toggle }) => <button className="btn btn-ghost btn-sm btn-icon" type="button" aria-label="Add label" style={{ height: 22, width: 22 }} onClick={toggle}><Plus className="i i-sm" /></button>}>
                <MenuSearch value={labelDraft} onChange={setLabelDraft} placeholder="New label, Enter to add" />
                {[...new Set(tasks.flatMap((t) => t.labels ?? []))].filter((l) => !task.labels?.includes(l) && l.toLowerCase().includes(labelDraft.toLowerCase())).slice(0, 8).map((l) => (
                  <MenuItem key={l} onSelect={() => updateTask(task, { labels: [...(task.labels ?? []), l] })}><span className={`tag ${labelTone(l)}`}>{l}</span></MenuItem>
                ))}
                {labelDraft.trim() && <MenuItem icon={<Plus className="i" />} onSelect={addLabel}>Add “{labelDraft.trim()}”</MenuItem>}
              </Menu>
            </div>

            <span>Estimate</span>
            <input
              className="prop inp-inline"
              style={{ width: 'auto', fontWeight: 500 }}
              defaultValue={task.estimate_minutes ? formatMinutes(task.estimate_minutes).replace(/ /g, '') : ''}
              key={`est-${task.estimate_minutes}`}
              placeholder="e.g. 3h"
              onBlur={(e) => {
                const v = e.target.value.trim()
                const mins = v ? parseDuration(v) : null
                if (v && !mins) return toast.error('Try “3h” or “90m”')
                if (mins !== (task.estimate_minutes ?? null)) updateTask(task, { estimate_minutes: mins })
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />

            <span>Time logged</span>
            <span className="row-sm" style={{ padding: '0 8px' }}>
              <b className={`m small ${task.estimate_minutes && logged > task.estimate_minutes ? 't-warn' : ''}`}>{formatMinutes(logged)}</b>
              <button className="btn btn-sm" type="button" style={{ height: 24, fontSize: 11.5 }} onClick={() => setLogOpen(true)}>+ Log time</button>
            </span>

            <span>Project</span>
            {project ? <Link className="prop link" to={`/projects/${project.id}`}><span className="trunc" style={{ maxWidth: 160 }}>{shortProjectTitle(project.title)}</span></Link> : <span>—</span>}
            <span>Client</span>
            {client ? <Link className="prop" to={`/clients/${client.id}`}><ClientMark client={client} size="xs" />{clientDisplayName(client)}</Link> : <span>—</span>}
          </div>

          {time.length > 0 && (
            <>
              <div className="divider" style={{ margin: '16px 0' }} />
              <div className="label-caps" style={{ marginBottom: 8 }}>Time entries</div>
              <div className="stack-sm small">
                {[...time].sort((a, b) => b.logged_on.localeCompare(a.logged_on)).map((t) => {
                  const who = profiles.find((p) => p.id === t.user_id)
                  return (
                    <div key={t.id} className="row-sm">
                      <Avatar profile={who} size="xs" />
                      <span className="grow trunc muted">{formatDate(t.logged_on)}{t.note ? ` · ${t.note}` : ''}</span>
                      <b className="m">{formatMinutes(t.minutes)}</b>
                      {(t.user_id === me?.id || me?.role !== 'member') && <button type="button" className="btn btn-ghost btn-sm btn-icon" style={{ width: 22, height: 22 }} aria-label="Delete entry" onClick={() => deleteRow('time_entries', t.id)}><X className="i i-xs" /></button>}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <div className="divider" style={{ margin: '16px 0' }} />
          <div className="label-caps" style={{ marginBottom: 10 }}>Notifications</div>
          <div className="stack small" style={{ gap: 10, color: 'var(--ink3)' }}>
            {emailed.map((e) => (
              <div key={e.id} className="row" style={{ alignItems: 'flex-start' }}>
                <Check className="i i-sm t-ok" style={{ marginTop: 2 }} />
                <span>{e.text} · {formatDateTime(e.at)}</span>
              </div>
            ))}
            <div className="card card-b xs muted" style={{ background: 'var(--soft)', border: 0, lineHeight: 1.55 }}>
              Editing this task never emails anyone again. Only a new assignee or a new @mention sends an email.
            </div>
          </div>
          <div className="divider" style={{ margin: '16px 0' }} />
          <div className="xs faint" style={{ lineHeight: 1.7 }}>
            Created by {creator ? profileDisplayName(creator) : '—'} · {formatDate(task.created_at.slice(0, 10))}
            {history[0] && <><br />Updated {formatFeedAgo(history[0].created_at)}</>}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this task?"
        description="Its subtasks, comments, files and time entries are deleted too."
        onConfirm={() => {
          deleteTask(task)
          navigate(project ? `/projects/${project.id}` : '/tasks')
        }}
      />
      <MoveModal open={moveOpen} onClose={() => setMoveOpen(false)} taskId={task.id} />
      <LogTimeModal open={logOpen} onClose={() => setLogOpen(false)} taskId={task.id} projectId={task.project_id} taskTitle={task.title} />
      <LinkModal open={linkOpen} onClose={() => setLinkOpen(false)} onAdd={addLink} />
    </>
  )
}

function MoveModal({ open, onClose, taskId }: { open: boolean; onClose: () => void; taskId: string }) {
  const { projects, clients, tasks } = useData()
  const [q, setQ] = useState('')
  const task = tasks.find((t) => t.id === taskId)
  const list = projects.filter((p) => p.id !== task?.project_id && !p.archived_at && p.title.toLowerCase().includes(q.toLowerCase()))
  return (
    <Modal open={open} onClose={onClose} title="Move to project" size="narrow">
      <div className="dlg-b">
        <input className="inp" placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="card list" style={{ maxHeight: 320, overflowY: 'auto' }}>
          {list.map((p) => (
            <button
              key={p.id}
              type="button"
              className="li hover"
              style={{ border: 0, background: 'none', width: '100%', textAlign: 'left', borderTop: '1px solid var(--line-xs)' }}
              onClick={() => {
                const next = tasks.filter((t) => t.project_id === p.id).reduce((m, t) => Math.max(m, t.number ?? 0), 0) + 1
                if (task) updateTask(task, { project_id: p.id, number: next }, `moved the task to ${shortProjectTitle(p.title)}`)
                toast.success(`Moved to ${shortProjectTitle(p.title)}`)
                onClose()
              }}
            >
              <ClientMark client={clients.find((c) => c.id === p.client_id)} size="sm" />
              <span className="grow trunc small">{p.title}</span>
            </button>
          ))}
          {list.length === 0 && <div className="empty sm"><p>No other projects.</p></div>}
        </div>
      </div>
    </Modal>
  )
}

function LogTimeModal({ open, onClose, taskId, projectId, taskTitle }: { open: boolean; onClose: () => void; taskId: string; projectId: string; taskTitle: string }) {
  const { createRow, logActivity } = useData()
  const [f, setF] = useState({ duration: '', date: todayISO(), note: '' })
  useEffect(() => {
    if (open) setF({ duration: '', date: todayISO(), note: '' })
  }, [open])
  const save = () => {
    const mins = parseDuration(f.duration)
    if (!mins) return toast.error('Enter time like “1h 30m”, “45m” or “1.5”')
    createRow<TimeEntry>('time_entries', { task_id: taskId, minutes: mins, logged_on: f.date || todayISO(), note: f.note.trim() || null })
    logActivity({ entity: 'time', entityId: taskId, action: 'logged', message: `logged ${formatMinutes(mins)} on “${taskTitle}”`, projectId })
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Log time" size="narrow" footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn btn-pri" onClick={save}>Log time</button></>}>
      <form className="dlg-b" onSubmit={(e) => { e.preventDefault(); save() }}>
        <div className="f2">
          <Field label="Time spent" hint="1h 30m, 45m, 1.5">
            <input data-autofocus className="inp" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} placeholder="1h 30m" />
          </Field>
          <Field label="Date">
            <input className="inp" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
        </div>
        <Field label="Note">
          <input className="inp" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="What did you work on?" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

function LinkModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (url: string, name?: string) => void }) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  useEffect(() => {
    if (open) {
      setUrl('')
      setName('')
    }
  }, [open])
  const save = () => {
    const u = /^https?:\/\//.test(url.trim()) ? url.trim() : `https://${url.trim()}`
    onAdd(u, name)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Add link" size="narrow" footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn btn-pri" onClick={save} disabled={!url.trim()}>Add link</button></>}>
      <form className="dlg-b" onSubmit={(e) => { e.preventDefault(); if (url.trim()) save() }}>
        <Field label="URL"><input data-autofocus className="inp" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></Field>
        <Field label="Name (optional)"><input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="Google Ads — CPS account" /></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
