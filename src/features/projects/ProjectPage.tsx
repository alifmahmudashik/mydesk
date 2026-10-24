import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Archive, Calendar, Copy, Edit3, FileText, Filter, Folder, Lock, MoreHorizontal, Pin, PinOff, Plus, Trash2, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { useUI } from '@/data/ui'
import { archiveProject, createTask, deleteProject, duplicateForNextMonth, setProjectStatus, updateProject } from '@/data/actions'
import { useIsAdmin } from '@/hooks/usePermissions'
import { pushRecent } from '@/components/layout/CommandPalette'
import { Topbar, Empty } from '@/components/ui/layout'
import { Tabs } from '@/components/ui/tabs'
import { Menu, MenuItem, MenuSep } from '@/components/ui/menu'
import { Avatar, AvatarStack, ClientMark } from '@/components/ui/avatar'
import { PrioBars, StatusPill } from '@/components/ui/pill'
import { RichText, RichView } from '@/components/ui/rich-text'
import { Composer, MentionText } from '@/components/ui/mentions'
import { ConfirmDialog } from '@/components/ui/modal'
import { DoneRow, TaskGroup, TaskListRow } from '@/components/domain/TaskViews'
import { ProjectFormModal } from '@/features/create/ProjectFormModal'
import { clientDisplayName, effectivePaymentStatus, eligibleAssignees, profileDisplayName, profileFullName, shortProjectTitle } from '@/lib/derive'
import { formatDate, formatFeedAgo, formatMoney } from '@/lib/format'
import { accessStatus, billingLabel, paymentStatus, priorityMeta, projectStatus } from '@/lib/status'
import type { AccessItem, AccessStatus, Priority, ProjectNote, ProjectStatus, Task, TaskStatus } from '@/types'

type Tab = 'tasks' | 'overview' | 'notes' | 'access' | 'activity'
const RING: Record<ProjectStatus, string> = { not_started: '', in_progress: 'prog', waiting_for_client: 'rev', blocked: 'rev', completed: 'done', finished: 'done', cancelled: 'cancel' }

export function ProjectPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const { openCreate } = useUI()
  const { projects, clients, tasks, profiles, clientMembers, notes, accessItems, activity, payments, invoices, me } = useData()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'tasks'
  const setTab = (t: Tab) => setParams(t === 'tasks' ? {} : { tab: t }, { replace: true })
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [filter, setFilter] = useState<'all' | 'mine' | 'dated' | 'late'>('all')

  const project = projects.find((p) => p.id === id)
  const client = clients.find((c) => c.id === project?.client_id)

  useEffect(() => {
    if (project) pushRecent(`/projects/${project.id}`)
  }, [project?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const projectTasks = useMemo(() => tasks.filter((t) => t.project_id === id && t.status !== 'cancelled'), [tasks, id])
  const projectNotes = notes.filter((n) => n.project_id === id).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.created_at.localeCompare(a.created_at))
  const access = accessItems.filter((a) => a.project_id === id)
  const history = activity.filter((a) => a.project_id === id || a.entity_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const linkedPayments = payments.filter((p) => p.project_ids?.includes(id))

  if (!project) {
    return (
      <>
        <Topbar crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Not found' }]} />
        <div className="content"><div className="card"><Empty title="Project not found">It may have been deleted, or you don’t have access to its client.</Empty></div></div>
      </>
    )
  }

  const done = projectTasks.filter((t) => t.status === 'done')
  const pct = projectTasks.length ? Math.round((done.length / projectTasks.length) * 100) : 0
  const granted = new Set(clientMembers.filter((m) => m.client_id === project.client_id).map((m) => m.user_id))
  const team = profiles.filter((p) => p.role === 'member' && granted.has(p.id))
  const people = eligibleAssignees(project.client_id, profiles, clientMembers)
  const pinnedNote = projectNotes[0]

  const filtered = projectTasks.filter((t) => {
    if (filter === 'mine') return t.assignee_id === me?.id
    if (filter === 'dated') return Boolean(t.due_date)
    if (filter === 'late') return t.due_date && t.due_date < new Date().toISOString().slice(0, 10) && t.status !== 'done'
    return true
  })
  const byStatus = (s: TaskStatus) => filtered.filter((t) => t.status === s).sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
  const projectInvoices = invoices.filter((inv) => inv.client_id === project.client_id && inv.line_items.some((li) => li.description.trim() === project.title.trim()))

  return (
    <>
      <Topbar
        crumbs={[
          { label: 'Projects', to: '/projects' },
          ...(client ? [{ label: clientDisplayName(client), to: `/clients/${client.id}`, icon: <ClientMark client={client} size="xs" /> }] : []),
          { label: shortProjectTitle(project.title) },
        ]}
      >
        {isAdmin && (
          <Link className="btn hide-sm" to={`/team?client=${project.client_id}`}>
            <UserPlus className="i" />Share
          </Link>
        )}
        <Menu trigger={({ toggle }) => <button type="button" className="btn btn-icon" aria-label="More" onClick={toggle}><MoreHorizontal className="i" /></button>}>
          <MenuItem icon={<Edit3 className="i" />} onSelect={() => setEditOpen(true)}>Edit project</MenuItem>
          {isAdmin && <MenuItem icon={<FileText className="i" />} onSelect={() => navigate(`/invoices/new?client=${project.client_id}&projects=${project.id}`)}>Create invoice</MenuItem>}
          <MenuItem icon={<Copy className="i" />} onSelect={() => { const c = duplicateForNextMonth(project); navigate(`/projects/${c.id}`) }}>Duplicate for next month</MenuItem>
          <MenuSep />
          <MenuItem icon={<Archive className="i" />} onSelect={() => { archiveProject(project, !project.archived_at); toast.success(project.archived_at ? 'Project restored' : 'Project archived') }}>{project.archived_at ? 'Restore' : 'Archive'}</MenuItem>
          <MenuItem danger icon={<Trash2 className="i" />} onSelect={() => setConfirmDelete(true)}>Delete</MenuItem>
        </Menu>
      </Topbar>

      <div className="content" style={{ paddingBottom: 0, gap: 14, maxWidth: 1320 }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="cl lg pri"><Folder className="i" /></span>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.02em' }}>{project.title}</h1>
          {project.archived_at && <span className="pill gray">Archived</span>}
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <Menu align="left" trigger={({ toggle }) => <button type="button" className="chip" onClick={toggle}><span className={`st ${RING[project.status]}`} style={{ width: 12, height: 12 }} />{projectStatus[project.status].label}</button>}>
            {(Object.keys(projectStatus) as ProjectStatus[]).map((s) => (
              <MenuItem key={s} on={s === project.status} icon={<span className={`st ${RING[s]}`} />} onSelect={() => setProjectStatus(project, s)}>
                {projectStatus[s].label}
                {s === 'finished' && isAdmin && <span className="xs faint"> · settles payments</span>}
              </MenuItem>
            ))}
          </Menu>
          <Menu align="left" trigger={({ toggle }) => <button type="button" className="chip" onClick={toggle}><PrioBars priority={project.priority} />{priorityMeta[project.priority].label}</button>}>
            {(Object.keys(priorityMeta) as Priority[]).map((p) => (
              <MenuItem key={p} on={p === project.priority} icon={<PrioBars priority={p} />} onSelect={() => updateProject(project, { priority: p })}>{priorityMeta[p].label}</MenuItem>
            ))}
          </Menu>
          {(project.start_date || project.due_date) && (
            <button type="button" className="chip" onClick={() => setEditOpen(true)}>
              <Calendar className="i i-sm" />
              {project.start_date ? formatDate(project.start_date) : '…'} → {project.due_date ? formatDate(project.due_date) : '…'}
            </button>
          )}
          {(project.project_type || project.billing_type) && <span className="chip">{[project.project_type, project.billing_type ? billingLabel[project.billing_type] : null].filter(Boolean).join(' · ')}</span>}
          {isAdmin && (
            <button type="button" className={`chip${project.amount ? '' : ' dashed'}`} title="Only owners and admins see this" onClick={() => setEditOpen(true)}>
              <Lock className="i i-sm" />
              {project.amount ? `Budget · ${formatMoney(project.amount, project.currency)}` : 'Budget · set amount'}
            </button>
          )}
          <span className="spacer" />
          <div className="row-sm">
            <div className="bar" style={{ width: 120 }}><i className="ok" style={{ width: `${pct}%` }} /></div>
            <span className="small muted">{done.length} of {projectTasks.length} done</span>
          </div>
        </div>
      </div>

      <div className="tabs" style={{ gap: 0, maxWidth: 1320 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          pad
          tabs={[
            { id: 'tasks', label: 'Tasks', count: projectTasks.filter((t) => t.status !== 'done').length },
            { id: 'overview', label: 'Overview' },
            { id: 'notes', label: 'Notes', count: projectNotes.length || undefined },
            { id: 'access', label: 'Access checklist', count: access.length || undefined },
            { id: 'activity', label: 'Activity' },
          ]}
        />
        <div className="panel-in" key={tab}>
          {tab === 'tasks' && (
            <div className="cols" style={{ gap: 0, alignItems: 'stretch' }}>
              <div className="col-main" style={{ padding: '20px 32px 48px', gap: 16 }}>
                <div className="row wrap">
                  <Menu align="left" trigger={({ toggle }) => <button type="button" className={`chip${filter !== 'all' ? ' on' : ''}`} onClick={toggle}><Filter className="i i-sm" />{{ all: 'Filter', mine: 'Assigned to me', dated: 'Has due date', late: 'Overdue' }[filter]}</button>}>
                    <MenuItem on={filter === 'all'} onSelect={() => setFilter('all')}>All tasks</MenuItem>
                    <MenuItem on={filter === 'mine'} onSelect={() => setFilter('mine')}>Assigned to me</MenuItem>
                    <MenuItem on={filter === 'dated'} onSelect={() => setFilter('dated')}>Has due date</MenuItem>
                    <MenuItem on={filter === 'late'} onSelect={() => setFilter('late')}>Overdue</MenuItem>
                  </Menu>
                  <span className="spacer" />
                  <button type="button" className="btn btn-dark btn-sm" onClick={() => openCreate('task', { project_id: project.id })}><Plus className="i" />New task</button>
                </div>
                {(['review', 'in_progress'] as TaskStatus[]).map((s) => (
                  <TaskGroup key={s} icon={<span className={`st ${s === 'review' ? 'rev' : 'prog'}`} />} title={s === 'review' ? 'In review' : 'In progress'} tasks={byStatus(s)} render={(t) => <TaskListRow key={t.id} task={t} showProject={false} />} />
                ))}
                <div>
                  <div className="grp-h"><span className="st" />To do <span className="n">{byStatus('todo').length}</span></div>
                  <div className="card list">
                    {byStatus('todo').map((t) => <TaskListRow key={t.id} task={t} showProject={false} />)}
                    <QuickAdd projectId={project.id} people={people.map((p) => ({ id: p.id, name: profileDisplayName(p) }))} />
                  </div>
                </div>
                <TaskGroup collapsible defaultOpen={done.length <= 5} icon={<span className="st done" />} title="Done" tasks={byStatus('done').sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))} render={(t) => <DoneRow key={t.id} task={t} />} />
              </div>
              <aside className="col-side" style={{ padding: '20px 32px 48px 24px', borderLeft: '1px solid var(--line-s)', gap: 16, flex: '0 1 340px' }}>
                <div className="label-caps">About</div>
                {project.description ? <RichView html={project.description} /> : <button type="button" className="link-btn small" style={{ textAlign: 'left' }} onClick={() => setTab('overview')}>Add a description</button>}
                <div className="kv">
                  <span>Client</span>
                  {client ? <Link className="row-sm m" to={`/clients/${client.id}`}><ClientMark client={client} size="xs" />{clientDisplayName(client)}</Link> : <span>—</span>}
                  <span>Team</span>
                  <AvatarStack profiles={team} />
                  {project.link_url && (
                    <>
                      <span>Link</span>
                      <a className="link trunc" href={project.link_url} target="_blank" rel="noreferrer">{project.link_label || 'Open link'} ↗</a>
                    </>
                  )}
                </div>
                {pinnedNote && (
                  <>
                    <div className="divider" />
                    <div className="row between">
                      <span className="label-caps">Latest note</span>
                      <button type="button" className="link-btn small" onClick={() => setTab('notes')}>All notes</button>
                    </div>
                    <NoteCard note={pinnedNote} />
                  </>
                )}
              </aside>
            </div>
          )}

          {tab === 'overview' && (
            <div className="content" style={{ maxWidth: 'none', paddingTop: 20 }}>
              <div className="cols">
                <div className="col-main">
                  <section>
                    <div className="label-caps" style={{ marginBottom: 8 }}>Description</div>
                    <RichText key={project.id} defaultValue={project.description} placeholder="What is this project about? Deliverables, links, context…" showSaved onSave={(html) => updateProject(project, { description: html })} />
                  </section>
                  {isAdmin && (
                    <section className="card">
                      <div className="card-h">
                        <h2 className="h2">Invoices &amp; payments</h2>
                        <div className="row-sm">
                          <button type="button" className="btn btn-sm" onClick={() => openCreate('payment', { client_id: project.client_id, project_ids: [project.id] })}><Plus className="i i-sm" />Payment</button>
                          <Link className="btn btn-sm" to={`/invoices/new?client=${project.client_id}&projects=${project.id}`}><Plus className="i i-sm" />Invoice</Link>
                        </div>
                      </div>
                      {linkedPayments.length === 0 && projectInvoices.length === 0 ? (
                        <Empty icon={<FileText className="i" />} title="No invoice yet">Create one at month end. Line items fill in from this project.</Empty>
                      ) : (
                        <div className="list">
                          {linkedPayments.map((p) => (
                            <Link key={p.id} className="li" to={`/payments?p=${p.id}`}>
                              <div className="grow"><div className="t">{formatMoney(p.amount, p.currency)}</div><div className="s">{p.status === 'paid' ? `Paid ${formatDate(p.payment_date)}` : p.due_date ? `Due ${formatDate(p.due_date)}` : 'No due date'}{p.project_ids.length > 1 ? ` · covers ${p.project_ids.length} projects` : ''}</div></div>
                              <StatusPill meta={paymentStatus[effectivePaymentStatus(p)]} />
                            </Link>
                          ))}
                          {projectInvoices.map((inv) => (
                            <Link key={inv.id} className="li" to={`/invoices/${inv.id}`}>
                              <FileText className="i faint" />
                              <div className="grow"><div className="t mono">{inv.number}</div><div className="s">Issued {formatDate(inv.issue_date)}</div></div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                </div>
                <div className="col-side">
                  <section className="card card-b stack">
                    <div className="label-caps">Properties</div>
                    <div className="kv">
                      <span>Status</span><span style={{ justifySelf: 'start' }}><StatusPill meta={projectStatus[project.status]} dot={false} /></span>
                      <span>Priority</span><span className="m">{priorityMeta[project.priority].label}</span>
                      <span>Start</span><span>{formatDate(project.start_date)}</span>
                      <span>Due</span><span>{formatDate(project.due_date)}</span>
                      <span>Type</span><span>{project.billing_type ? billingLabel[project.billing_type] : '—'}</span>
                      <span>Task key</span><span className="mono">{project.key ?? '—'}</span>
                      <span>Created</span><span>{formatDate(project.created_at.slice(0, 10))}</span>
                    </div>
                  </section>
                  <section className="card card-b stack">
                    <div className="label-caps">Team access</div>
                    {team.length === 0 && <span className="small muted">Only owners and admins can see this project.</span>}
                    {team.map((p) => (
                      <div className="row" key={p.id}>
                        <Avatar profile={p} size="md" />
                        <div className="grow" style={{ minWidth: 0 }}><div className="small m">{profileFullName(p)}</div><div className="xs muted trunc">{p.email}</div></div>
                        <span className="pill">Member</span>
                      </div>
                    ))}
                    {isAdmin && <Link className="link small" to={`/team?client=${project.client_id}`}>Manage access →</Link>}
                  </section>
                </div>
              </div>
            </div>
          )}

          {tab === 'notes' && <NotesPanel projectId={project.id} notes={projectNotes} people={people} />}
          {tab === 'access' && <AccessPanel projectId={project.id} items={access} />}

          {tab === 'activity' && (
            <div className="content narrow" style={{ paddingTop: 20, gap: 2 }}>
              {history.length === 0 && <span className="small muted">No activity yet.</span>}
              {history.slice(0, 100).map((h) => {
                const actor = profiles.find((p) => p.id === h.actor_id)
                return (
                  <div key={h.id} className="sys">
                    <span className="dot" />
                    <b>{actor ? profileDisplayName(actor) : 'Someone'}</b> {h.message} · {formatFeedAgo(h.created_at)}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <ProjectFormModal open={editOpen} onClose={() => setEditOpen(false)} project={project} />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete “${shortProjectTitle(project.title)}”?`}
        description={`This removes the project, its ${projectTasks.length} task${projectTasks.length === 1 ? '' : 's'}, notes and checklist${isAdmin ? ', plus payments that only covered this project' : ''}. This can’t be undone.`}
        onConfirm={() => {
          deleteProject(project)
          navigate('/projects')
        }}
      />
    </>
  )
}

/** "Add a task — type @ to assign", Enter to create. */
function QuickAdd({ projectId, people }: { projectId: string; people: { id: string; name: string }[] }) {
  const { me } = useData()
  const [text, setText] = useState('')
  const match = text.match(/@(\S+)/)
  const who = match ? people.find((p) => p.name.toLowerCase().startsWith(match[1].toLowerCase())) : undefined
  const assignee = useData((s) => s.profiles.find((p) => p.id === who?.id))
  const submit = () => {
    const title = text.replace(/@\S+/, '').trim()
    if (!title) return
    createTask({ project_id: projectId, title, assignee_id: who?.id ?? (me?.role === 'member' ? me.id : null) } as Task & { project_id: string; title: string })
    setText('')
  }
  return (
    <div className="row" style={{ padding: '8px 10px 8px 14px', borderTop: '1px solid var(--line-xs)' }}>
      <Plus className="i i-sm faint" />
      <input className="grow" style={{ border: 0, outline: 0, background: 'transparent', fontSize: 13.5 }} placeholder="Add a task — type @ to assign" aria-label="Quick add task" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <Avatar profile={assignee} />
      <kbd>Enter</kbd>
    </div>
  )
}

function NoteCard({ note, actions }: { note: ProjectNote; actions?: React.ReactNode }) {
  const author = useData((s) => s.profiles.find((p) => p.id === note.author_id))
  return (
    <div className={`note-card${note.pinned ? ' pinned' : ''}`}>
      <div className="row-sm">
        <Avatar profile={author} size="xs" />
        <b className="small m">{author ? profileDisplayName(author) : note.created_by || 'Someone'}</b>
        <span className="xs faint">· {note.pinned ? 'Pinned · ' : ''}{formatDate(note.created_at.slice(0, 10))}</span>
        <span className="spacer" />
        {actions}
      </div>
      <MentionText body={note.note.replace(/<[^>]+>/g, '')} />
    </div>
  )
}

function NotesPanel({ projectId, notes, people }: { projectId: string; notes: ProjectNote[]; people: ReturnType<typeof eligibleAssignees> }) {
  const { me, createRow, updateRow, deleteRow } = useData()
  const isAdmin = useIsAdmin()
  const [pin, setPin] = useState(false)
  return (
    <div className="content narrow" style={{ paddingTop: 20 }}>
      <Composer
        people={people}
        meId={me?.id}
        placeholder="Write a note for the project team… type @ to mention"
        submitLabel="Add note"
        footnote={<label className="row-sm" style={{ cursor: 'pointer' }}><input type="checkbox" className="cb" checked={pin} onChange={(e) => setPin(e.target.checked)} />Pin to top</label>}
        onSubmit={(body, mentions) => {
          createRow<ProjectNote>('project_notes', { project_id: projectId, note: body, mentions, pinned: pin, created_by: me ? profileDisplayName(me) : null }, { entity: 'note', action: 'created', message: 'added a note', projectId })
          setPin(false)
        }}
      />
      {notes.length === 0 && <Empty small title="No notes yet">Notes are for context the whole team should know: preferences, decisions, gotchas.</Empty>}
      {notes.map((n) => (
        <NoteCard
          key={n.id}
          note={n}
          actions={
            <>
              <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={n.pinned ? 'Unpin' : 'Pin'} onClick={() => updateRow('project_notes', n.id, { pinned: !n.pinned })}>
                {n.pinned ? <PinOff className="i i-sm" /> : <Pin className="i i-sm" />}
              </button>
              {(n.author_id === me?.id || isAdmin) && (
                <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Delete note" onClick={() => deleteRow('project_notes', n.id)}>
                  <Trash2 className="i i-sm" />
                </button>
              )}
            </>
          }
        />
      ))}
    </div>
  )
}

const ACCESS_ORDER: AccessStatus[] = ['needed', 'requested', 'received', 'not_needed']

function AccessPanel({ projectId, items }: { projectId: string; items: AccessItem[] }) {
  const { createRow, updateRow, deleteRow } = useData()
  const [name, setName] = useState('')
  const add = () => {
    const n = name.trim()
    if (!n) return
    createRow<AccessItem>('access_items', { project_id: projectId, access_name: n, status: 'needed', is_required: true }, { entity: 'access_item', action: 'created', message: `added access item “${n}”`, projectId })
    setName('')
  }
  const received = items.filter((i) => i.status === 'received' || i.status === 'not_needed').length
  return (
    <div className="content narrow" style={{ paddingTop: 20 }}>
      {items.length > 0 && <div className="row-sm small muted"><div className="bar" style={{ width: 140 }}><i className="ok" style={{ width: `${(received / items.length) * 100}%` }} /></div>{received} of {items.length} sorted</div>}
      <div className="card">
        {items.map((a) => (
          <div key={a.id} className="check-row" style={{ cursor: 'default' }}>
            <input className="cb" type="checkbox" checked={a.status === 'received'} aria-label={a.access_name} onChange={(e) => updateRow('access_items', a.id, { status: e.target.checked ? 'received' : 'needed' })} />
            <span className="txt">
              <input className="inp-inline m" defaultValue={a.access_name} onBlur={(e) => e.target.value.trim() && e.target.value !== a.access_name && updateRow('access_items', a.id, { access_name: e.target.value.trim() })} />
              <input className="inp-inline xs muted" style={{ display: 'block' }} defaultValue={a.description ?? ''} placeholder="Add details (who, what level of access)" onBlur={(e) => e.target.value !== (a.description ?? '') && updateRow('access_items', a.id, { description: e.target.value.trim() || null })} />
            </span>
            <Menu trigger={({ toggle }) => <button type="button" className="btn-ghost" style={{ border: 0, background: 'none', padding: 0 }} onClick={toggle}><StatusPill meta={a.status === 'needed' ? { ...accessStatus.needed, tone: 'bad' } : accessStatus[a.status]} /></button>}>
              {ACCESS_ORDER.map((s) => <MenuItem key={s} on={s === a.status} onSelect={() => updateRow('access_items', a.id, { status: s })}>{accessStatus[s].label}</MenuItem>)}
              <MenuSep />
              <MenuItem danger icon={<X className="i" />} onSelect={() => deleteRow('access_items', a.id)}>Remove</MenuItem>
            </Menu>
          </div>
        ))}
        <div className="check-row" style={{ cursor: 'text' }}>
          <Plus className="i i-sm faint" />
          <input className="grow" style={{ border: 0, outline: 0, background: 'transparent', fontSize: 13.5 }} placeholder="Add access item, e.g. Google Ads admin" aria-label="Add access item" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        </div>
      </div>
    </div>
  )
}
