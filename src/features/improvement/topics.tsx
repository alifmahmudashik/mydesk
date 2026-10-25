import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDown, ArrowUp, BookOpen, Check, ChevronDown, ChevronRight, ExternalLink, LogOut, MoreHorizontal, Pencil, Play, Plus, Trash2, UserPlus, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { useIsAdmin } from '@/hooks/usePermissions'
import { Topbar, Content, Empty } from '@/components/ui/layout'
import { Menu, MenuItem, MenuSep } from '@/components/ui/menu'
import { Avatar, AvatarStack } from '@/components/ui/avatar'
import { Modal, ConfirmDialog } from '@/components/ui/modal'
import { Field } from '@/components/ui/field'
import { celebrateFrom } from '@/lib/confetti'
import { profileDisplayName } from '@/lib/derive'
import { formatFeedAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { LearningKind, LearningLesson, LearningProgress, LearningResource, LearningTopic, LearningTopicMember, Profile } from '@/types'
import { KINDS, TOPIC_COLORS, detectKind, hostOf, kindMeta, normUrl, topicProgress } from './learning-utils'

/* ---------- topics tab ---------- */

export function TopicsTab() {
  const { topics, lessons, progress, topicMembers, profiles, me, topicsReady, demoMode } = useData()
  const [creating, setCreating] = useState(false)
  const live = topics.filter((t) => !t.archived_at)
  const joined = live.filter((t) => topicMembers.some((m) => m.topic_id === t.id && m.user_id === me?.id))
  const others = live.filter((t) => !joined.includes(t))
  return (
    <div className="stack-lg">
      {!demoMode && !topicsReady && (
        <div className="card card-b" style={{ background: 'var(--warn-bg)', borderColor: 'transparent' }}>
          <span className="small" style={{ color: 'var(--warn)' }}>Run <b>supabase/improvement-topics.sql</b> in the Supabase SQL editor to turn on topics.</span>
        </div>
      )}
      <div className="row between wrap">
        <span className="small muted">A topic is a learning path, like “Google Tag Manager”, with lessons and a video, doc or link for each.</span>
        <button type="button" className="btn btn-pri btn-sm" onClick={() => setCreating(true)}><Plus className="i i-sm" />New topic</button>
      </div>
      {live.length === 0 ? (
        <div className="card">
          <Empty icon={<BookOpen className="i" />} title="No topics yet" action={<button type="button" className="btn btn-sm btn-pri" onClick={() => setCreating(true)}><Plus className="i i-sm" />Create the first topic</button>}>
            Start one for something the team wants to learn, then add lessons and resources inside it.
          </Empty>
        </div>
      ) : (
        <>
          {joined.length > 0 && (
            <section className="stack">
              <h2 className="h2">You’re learning <span className="faint" style={{ fontWeight: 500 }}>{joined.length}</span></h2>
              <div className="tp-grid">{joined.map((t) => <TopicCard key={t.id} topic={t} me={me} lessons={lessons} progress={progress} members={topicMembers} people={profiles} />)}</div>
            </section>
          )}
          {others.length > 0 && (
            <section className="stack">
              <h2 className="h2">{joined.length ? 'Other topics' : 'All topics'} <span className="faint" style={{ fontWeight: 500 }}>{others.length}</span></h2>
              <div className="tp-grid">{others.map((t) => <TopicCard key={t.id} topic={t} me={me} lessons={lessons} progress={progress} members={topicMembers} people={profiles} />)}</div>
            </section>
          )}
        </>
      )}
      <TopicModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

export function TopicCard({ topic, me, lessons, progress, members, people, compact }: {
  topic: LearningTopic
  me: Profile | null
  lessons: LearningLesson[]
  progress: LearningProgress[]
  members: LearningTopicMember[]
  people: Profile[]
  compact?: boolean
}) {
  const p = topicProgress(topic.id, me?.id, lessons, progress)
  const learners = people.filter((x) => members.some((m) => m.topic_id === topic.id && m.user_id === x.id))
  const color = topic.color || TOPIC_COLORS[0]
  return (
    <Link to={`/improvement/topics/${topic.id}`} className={cn('tp-card lift', compact && 'compact')} style={{ ['--tc' as string]: color }}>
      <div className="tp-card-h">
        <span className="tp-icon"><BookOpen className="i" /></span>
        <div className="grow" style={{ minWidth: 0 }}>
          <b className="trunc">{topic.title}</b>
          <small>{p.total} lesson{p.total === 1 ? '' : 's'}</small>
        </div>
      </div>
      {!compact && topic.description && <p className="tp-desc">{topic.description}</p>}
      <div className="tp-card-f">
        <div className="grow">
          <div className="bar"><i style={{ width: `${p.pct}%`, background: color }} /></div>
          <small>{p.total ? `${p.done} of ${p.total} done by you` : 'No lessons yet'}</small>
        </div>
        {learners.length > 0 && <AvatarStack profiles={learners} size="xs" max={4} />}
      </div>
    </Link>
  )
}

/* ---------- create / edit topic ---------- */

function TopicModal({ open, onClose, edit }: { open: boolean; onClose: () => void; edit?: LearningTopic }) {
  const { profiles, me, createRow, updateRow } = useData()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [color, setColor] = useState(TOPIC_COLORS[0])
  const [people, setPeople] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!open) return
    setTitle(edit?.title ?? '')
    setDesc(edit?.description ?? '')
    setColor(edit?.color ?? TOPIC_COLORS[Math.floor(Math.random() * TOPIC_COLORS.length)])
    setPeople(new Set(me ? [me.id] : []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const save = () => {
    if (!title.trim()) return toast.error('Name the topic')
    if (edit) {
      updateRow('learning_topics', edit.id, { title: title.trim(), description: desc.trim() || null, color })
      toast.success('Topic saved')
      onClose()
      return
    }
    const t = createRow<LearningTopic>('learning_topics', { title: title.trim(), description: desc.trim() || null, color, created_by: me?.id ?? null })
    for (const id of people) createRow<LearningTopicMember>('learning_topic_members', { topic_id: t.id, user_id: id, added_by: me?.id ?? null })
    toast.success('Topic created — add the first lesson')
    onClose()
    navigate(`/improvement/topics/${t.id}`)
  }
  const toggle = (id: string) => setPeople((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })
  return (
    <Modal open={open} onClose={onClose} title={edit ? 'Edit topic' : 'New learning topic'} footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn btn-pri" onClick={save}>{edit ? 'Save' : 'Create topic'}</button></>}>
      <form className="dlg-b" onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Topic"><input data-autofocus className="inp" placeholder="e.g. Google Tag Manager" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="What it covers (optional)"><textarea className="inp" rows={2} placeholder="e.g. From a clean container to server-side tagging" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <div className="field">
          <span className="lbl">Color</span>
          <div className="swatches">
            {TOPIC_COLORS.map((c) => <input key={c} className="swatch" type="radio" name="tpc" style={{ ['--c' as string]: c }} checked={color === c} onChange={() => setColor(c)} aria-label={c} />)}
          </div>
        </div>
        {!edit && (
          <div className="field">
            <span className="lbl">Who’s learning it</span>
            <div className="row wrap" style={{ gap: 6 }}>
              <button type="button" className={cn('chip', profiles.every((p) => people.has(p.id)) && 'sel')} onClick={() => setPeople(profiles.every((p) => people.has(p.id)) ? new Set(me ? [me.id] : []) : new Set(profiles.map((p) => p.id)))}><Users className="i i-sm" />Everyone</button>
              {profiles.map((p) => (
                <button key={p.id} type="button" className={cn('chip', people.has(p.id) && 'sel')} onClick={() => toggle(p.id)}>
                  <Avatar profile={p} size="xs" />{p.id === me?.id ? 'Me' : profileDisplayName(p)}{people.has(p.id) && <Check className="i i-xs" />}
                </button>
              ))}
            </div>
            <span className="hint">They get a notification. Anyone can join later.</span>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

/* ---------- topic page ---------- */

export function TopicPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const { topics, lessons, progress, topicMembers, profiles, me, createRow, updateRow, deleteRow } = useData()
  const topic = topics.find((t) => t.id === id)
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [newLesson, setNewLesson] = useState('')
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  if (!topic) {
    return (
      <>
        <Topbar crumbs={[{ label: 'Improvement', to: '/improvement' }, { label: 'Not found' }]} />
        <Content><div className="card"><Empty title="Topic not found">It may have been deleted.</Empty></div></Content>
      </>
    )
  }

  const color = topic.color || TOPIC_COLORS[0]
  const list = lessons.filter((l) => l.topic_id === topic.id).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
  const members = topicMembers.filter((m) => m.topic_id === topic.id)
  const learners = profiles.filter((p) => members.some((m) => m.user_id === p.id))
  const amIn = members.some((m) => m.user_id === me?.id)
  const canManage = topic.created_by === me?.id || isAdmin
  const mine = topicProgress(topic.id, me?.id, lessons, progress)
  const nextLesson = list.find((l) => !progress.some((p) => p.lesson_id === l.id && p.user_id === me?.id && p.status === 'done'))
  const recent = progress
    .filter((p) => p.status === 'done' && p.takeaway && list.some((l) => l.id === p.lesson_id))
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    .slice(0, 5)

  const join = () => {
    if (!me || amIn) return
    createRow<LearningTopicMember>('learning_topic_members', { topic_id: topic.id, user_id: me.id, added_by: me.id })
    toast.success(`You joined ${topic.title}`)
  }
  const leave = () => {
    const m = members.find((x) => x.user_id === me?.id)
    if (m) deleteRow('learning_topic_members', m.id)
  }
  const addLesson = () => {
    const t = newLesson.trim()
    if (!t) return
    const pos = Math.max(0, ...list.map((l) => l.position)) + 1
    const l = createRow<LearningLesson>('learning_lessons', { topic_id: topic.id, title: t, position: pos, created_by: me?.id ?? null })
    setNewLesson('')
    setOpenIds((s) => new Set(s).add(l.id))
  }
  const move = (l: LearningLesson, dir: -1 | 1) => {
    const i = list.findIndex((x) => x.id === l.id)
    const other = list[i + dir]
    if (!other) return
    // Re-number everything so equal positions from older data still sort predictably.
    list.forEach((x, idx) => {
      const want = x.id === l.id ? i + dir + 1 : x.id === other.id ? i + 1 : idx + 1
      if (x.position !== want) updateRow('learning_lessons', x.id, { position: want })
    })
  }

  return (
    <>
      <Topbar crumbs={[{ label: 'Improvement', to: '/improvement' }, { label: 'Topics', to: '/improvement?tab=topics' }, { label: topic.title }]}>
        {amIn ? null : <button type="button" className="btn btn-pri" onClick={join}><Plus className="i" />Join topic</button>}
        <button type="button" className="btn" onClick={() => setAdding(true)}><UserPlus className="i" />Add people</button>
        <Menu trigger={({ toggle }) => <button type="button" className="btn btn-icon" aria-label="More" onClick={toggle}><MoreHorizontal className="i" /></button>}>
          {canManage && <MenuItem icon={<Pencil className="i" />} onSelect={() => setEditing(true)}>Edit topic</MenuItem>}
          {amIn && <MenuItem icon={<LogOut className="i" />} onSelect={leave}>Leave topic</MenuItem>}
          {canManage && (
            <>
              <MenuSep />
              <MenuItem danger icon={<Trash2 className="i" />} onSelect={() => setConfirmDel(true)}>Delete topic</MenuItem>
            </>
          )}
        </Menu>
      </Topbar>
      <Content>
        <div className="tp-hero" style={{ ['--tc' as string]: color }}>
          <span className="tp-icon lg"><BookOpen className="i" /></span>
          <div className="grow" style={{ minWidth: 0 }}>
            <h1>{topic.title}</h1>
            {topic.description && <p>{topic.description}</p>}
            <div className="tp-hero-f">
              <div style={{ width: 220 }}>
                <div className="bar lg"><i style={{ width: `${mine.pct}%`, background: color }} /></div>
                <small>{mine.total ? `${mine.done} of ${mine.total} lessons done by you` : 'No lessons yet'}</small>
              </div>
              {nextLesson && amIn && (
                <button type="button" className="btn btn-sm" onClick={() => { setOpenIds((s) => new Set(s).add(nextLesson.id)); setTimeout(() => document.getElementById(`ls-${nextLesson.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50) }}>
                  <Play className="i i-sm" />Next: {nextLesson.title}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="cols">
          <div className="col-main stack">
            <div className="row between"><h2 className="h2">Lessons <span className="faint" style={{ fontWeight: 500 }}>{list.length}</span></h2>
              {list.length > 0 && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpenIds(openIds.size ? new Set() : new Set(list.map((l) => l.id)))}>{openIds.size ? 'Collapse all' : 'Expand all'}</button>}
            </div>
            <div className="ls-list">
              {list.map((l, i) => (
                <LessonCard
                  key={l.id}
                  lesson={l}
                  index={i}
                  last={i === list.length - 1}
                  open={openIds.has(l.id)}
                  onToggle={() => setOpenIds((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n })}
                  onMove={(d) => move(l, d)}
                  canManage={canManage}
                  topic={topic}
                />
              ))}
              <form className="ls-add" onSubmit={(e) => { e.preventDefault(); addLesson() }}>
                <Plus className="i i-sm" />
                <input value={newLesson} onChange={(e) => setNewLesson(e.target.value)} placeholder={list.length ? 'Add a lesson, e.g. “Triggers and variables”, then press Enter' : 'Add the first lesson, e.g. “How to set it up”, then press Enter'} aria-label="New lesson" />
                {newLesson.trim() && <button type="submit" className="btn btn-sm btn-pri">Add</button>}
              </form>
            </div>
          </div>

          <div className="col-side stack">
            <section className="card card-b stack">
              <div className="row between"><div className="label-caps">Learners</div><button type="button" className="link-btn xs" onClick={() => setAdding(true)}>Add people</button></div>
              {learners.length === 0 && <span className="small muted">Nobody has joined yet.</span>}
              {learners.map((p) => {
                const pr = topicProgress(topic.id, p.id, lessons, progress)
                return (
                  <div key={p.id} className="tp-learner">
                    <Avatar profile={p} size="sm" />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row between small"><span className="m trunc">{p.id === me?.id ? 'You' : profileDisplayName(p)}</span><span className="faint num">{pr.done}/{pr.total}</span></div>
                      <div className="bar"><i style={{ width: `${pr.pct}%`, background: color }} /></div>
                    </div>
                  </div>
                )
              })}
            </section>
            {recent.length > 0 && (
              <section className="card card-b stack">
                <div className="label-caps">Recently learned</div>
                {recent.map((p) => {
                  const who = profiles.find((x) => x.id === p.user_id)
                  const l = list.find((x) => x.id === p.lesson_id)
                  return (
                    <div key={p.id} className="tp-recent">
                      <div className="row-sm xs muted"><Avatar profile={who} size="xs" /><b className="m">{profileDisplayName(who)}</b> · {l?.title} · {formatFeedAgo(p.completed_at!)}</div>
                      <div className="small">{p.takeaway}</div>
                    </div>
                  )
                })}
              </section>
            )}
          </div>
        </div>
      </Content>
      <TopicModal open={editing} onClose={() => setEditing(false)} edit={topic} />
      <AddPeopleModal open={adding} onClose={() => setAdding(false)} topic={topic} members={members} />
      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title={`Delete ${topic.title}?`}
        description="This removes the topic with all its lessons, resources and everyone’s progress."
        onConfirm={() => { deleteRow('learning_topics', topic.id); navigate('/improvement?tab=topics') }}
      />
    </>
  )
}

/* ---------- lesson ---------- */

function LessonCard({ lesson, index, last, open, onToggle, onMove, canManage, topic }: {
  lesson: LearningLesson
  index: number
  last: boolean
  open: boolean
  onToggle: () => void
  onMove: (d: -1 | 1) => void
  canManage: boolean
  topic: LearningTopic
}) {
  const { resources, progress, profiles, topicMembers, me, createRow, updateRow, deleteRow } = useData()
  const isAdmin = useIsAdmin()
  const [editing, setEditing] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [takeaway, setTakeaway] = useState('')
  const res = resources.filter((r) => r.lesson_id === lesson.id).sort((a, b) => a.created_at.localeCompare(b.created_at))
  const mineP = progress.find((p) => p.lesson_id === lesson.id && p.user_id === me?.id)
  const doneBy = profiles.filter((p) => progress.some((x) => x.lesson_id === lesson.id && x.user_id === p.id && x.status === 'done'))
  const done = mineP?.status === 'done'
  const canEdit = canManage || lesson.created_by === me?.id || isAdmin

  // Doing a lesson means you're learning the topic.
  const ensureMember = () => {
    if (me && !topicMembers.some((m) => m.topic_id === topic.id && m.user_id === me.id)) {
      createRow<LearningTopicMember>('learning_topic_members', { topic_id: topic.id, user_id: me.id, added_by: me.id })
    }
  }
  const setMine = (status: 'learning' | 'done', extra: Partial<LearningProgress> = {}) => {
    ensureMember()
    const patch = { status, completed_at: status === 'done' ? new Date().toISOString() : null, ...extra }
    if (mineP) updateRow('learning_progress', mineP.id, patch)
    else createRow<LearningProgress>('learning_progress', { lesson_id: lesson.id, user_id: me!.id, ...patch })
  }
  const finish = (el: HTMLElement) => {
    setMine('done', { takeaway: takeaway.trim() || null })
    setFinishing(false)
    setTakeaway('')
    celebrateFrom(el)
  }

  return (
    <div id={`ls-${lesson.id}`} className={cn('ls-card', open && 'open', done && 'done')}>
      <div className="ls-head">
        <button type="button" className={cn('ls-num', done && 'done', mineP?.status === 'learning' && 'now')} title={done ? 'Learned — click to undo' : 'Mark learned'} onClick={() => {
            if (done) { if (mineP) updateRow('learning_progress', mineP.id, { status: 'learning', completed_at: null }) }
            else { if (!open) onToggle(); setFinishing(true) }
          }}>
          {done ? <Check className="i i-sm" /> : index + 1}
        </button>
        <button type="button" className="ls-title" onClick={onToggle} aria-expanded={open}>
          <b>{lesson.title}</b>
          <span className="ls-sub">
            {res.length ? `${res.length} resource${res.length === 1 ? '' : 's'}` : 'No resources yet'}
            {mineP?.status === 'learning' && <span className="pill pri" style={{ height: 18, fontSize: 11 }}>Learning</span>}
          </span>
        </button>
        {doneBy.length > 0 && <span title={`Learned by ${doneBy.map((p) => profileDisplayName(p)).join(', ')}`}><AvatarStack profiles={doneBy} size="xs" max={3} /></span>}
        {canEdit && (
          <Menu align="right" trigger={({ toggle }) => <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label="Lesson options" onClick={toggle}><MoreHorizontal className="i i-sm" /></button>}>
            <MenuItem icon={<Pencil className="i" />} onSelect={() => setEditing(true)}>Edit lesson</MenuItem>
            {index > 0 && <MenuItem icon={<ArrowUp className="i" />} onSelect={() => onMove(-1)}>Move up</MenuItem>}
            {!last && <MenuItem icon={<ArrowDown className="i" />} onSelect={() => onMove(1)}>Move down</MenuItem>}
            <MenuSep />
            <MenuItem danger icon={<Trash2 className="i" />} onSelect={() => deleteRow('learning_lessons', lesson.id)}>Delete lesson</MenuItem>
          </Menu>
        )}
        <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label={open ? 'Collapse' : 'Expand'} onClick={onToggle}>{open ? <ChevronDown className="i i-sm" /> : <ChevronRight className="i i-sm" />}</button>
      </div>

      {open && (
        <div className="ls-body">
          {lesson.details ? <p className="ls-details">{lesson.details}</p> : canEdit && <button type="button" className="link-btn small" onClick={() => setEditing(true)}>+ Add details for this lesson</button>}
          <div className="ls-res">
            {res.map((r) => <ResourceRow key={r.id} r={r} canDelete={canEdit || r.created_by === me?.id} onDelete={() => deleteRow('learning_resources', r.id)} />)}
            <ResourceForm onAdd={(r) => createRow<LearningResource>('learning_resources', { ...r, lesson_id: lesson.id, created_by: me?.id ?? null })} />
          </div>
          {mineP?.status === 'done' && mineP.takeaway && <div className="lg-takeaway"><b>You learned:</b> {mineP.takeaway}</div>}
          <div className="ls-actions">
            {!mineP && <button type="button" className="btn btn-sm" onClick={() => setMine('learning')}><Play className="i i-sm" />Start</button>}
            {!done && !finishing && <button type="button" className="btn btn-sm btn-pri" onClick={() => setFinishing(true)}><Check className="i i-sm" />Mark learned</button>}
            {done && <button type="button" className="btn btn-sm btn-ghost" onClick={() => mineP && updateRow('learning_progress', mineP.id, { status: 'learning', completed_at: null })}>Undo learned</button>}
          </div>
          {finishing && !done && (
            <div className="ls-finish">
              <textarea data-autofocus className="inp" rows={2} placeholder="What did you learn? One or two lines the team can use (optional)" value={takeaway} onChange={(e) => setTakeaway(e.target.value)} autoFocus />
              <div className="row-sm" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-sm" onClick={() => setFinishing(false)}>Cancel</button>
                <button type="button" className="btn btn-sm btn-pri" onClick={(e) => finish(e.currentTarget)}><Check className="i i-sm" />Done</button>
              </div>
            </div>
          )}
        </div>
      )}
      <LessonModal open={editing} onClose={() => setEditing(false)} lesson={lesson} />
    </div>
  )
}

function ResourceRow({ r, canDelete, onDelete }: { r: LearningResource; canDelete: boolean; onDelete: () => void }) {
  const k = kindMeta(r.kind)
  const host = hostOf(r.url)
  return (
    <div className="ls-r">
      <span className="lg-kind sm" style={{ ['--k' as string]: k.color }} title={k.label}>{k.icon}</span>
      <div className="grow" style={{ minWidth: 0 }}>
        {r.url ? <a className="ls-r-t" href={normUrl(r.url)} target="_blank" rel="noreferrer">{r.title}<ExternalLink className="i i-xs" /></a> : <span className="ls-r-t">{r.title}</span>}
        <div className="xs faint">{k.label}{host ? ` · ${host}` : ''}{r.note ? ` · ${r.note}` : ''}</div>
      </div>
      {canDelete && <button type="button" className="btn btn-sm btn-ghost btn-icon ls-r-x" aria-label="Remove resource" onClick={onDelete}><Trash2 className="i i-xs" /></button>}
    </div>
  )
}

function ResourceForm({ onAdd }: { onAdd: (r: { title: string; url: string | null; kind: LearningKind; note: string | null }) => void }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<LearningKind>('article')
  const [touched, setTouched] = useState(false)
  const reset = () => { setUrl(''); setTitle(''); setKind('article'); setTouched(false) }
  if (!open) return <button type="button" className="ls-r-add" onClick={() => setOpen(true)}><Plus className="i i-sm" />Add a video, doc or link</button>
  const add = () => {
    const t = title.trim() || hostOf(url)
    if (!t) return toast.error('Paste a link or add a title')
    onAdd({ title: t, url: url.trim() ? normUrl(url) : null, kind, note: null })
    reset()
  }
  return (
    <form className="ls-r-form" onSubmit={(e) => { e.preventDefault(); add() }}>
      <div className="f2">
        <input className="inp sm" autoFocus placeholder="Paste a link (YouTube, docs, course…)" value={url} onChange={(e) => { setUrl(e.target.value); const k = detectKind(e.target.value); if (k && !touched) setKind(k) }} />
        <input className="inp sm" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="row between wrap" style={{ gap: 8 }}>
        <div className="lg-kinds">
          {KINDS.map((k) => (
            <button key={k.id} type="button" className={cn('lg-kind-pick sm', kind === k.id && 'on')} style={{ ['--k' as string]: k.color }} onClick={() => { setKind(k.id); setTouched(true) }}>{k.icon}{k.label}</button>
          ))}
        </div>
        <div className="row-sm">
          <button type="button" className="btn btn-sm" onClick={() => { reset(); setOpen(false) }}>Done</button>
          <button type="submit" className="btn btn-sm btn-pri">Add</button>
        </div>
      </div>
    </form>
  )
}

function LessonModal({ open, onClose, lesson }: { open: boolean; onClose: () => void; lesson: LearningLesson }) {
  const { updateRow } = useData()
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  useEffect(() => {
    if (!open) return
    setTitle(lesson.title)
    setDetails(lesson.details ?? '')
  }, [open, lesson])
  const save = () => {
    if (!title.trim()) return toast.error('Name the lesson')
    updateRow('learning_lessons', lesson.id, { title: title.trim(), details: details.trim() || null })
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Edit lesson" footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn btn-pri" onClick={save}>Save</button></>}>
      <form className="dlg-b" onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Lesson"><input data-autofocus className="inp" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Details"><textarea className="inp" rows={5} placeholder="What to learn here, steps to follow, what “done” looks like…" value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

function AddPeopleModal({ open, onClose, topic, members }: { open: boolean; onClose: () => void; topic: LearningTopic; members: LearningTopicMember[] }) {
  const { profiles, me, createRow } = useData()
  const [sel, setSel] = useState<Set<string>>(new Set())
  useEffect(() => { if (open) setSel(new Set()) }, [open])
  const outside = profiles.filter((p) => !members.some((m) => m.user_id === p.id))
  const add = () => {
    for (const id of sel) createRow<LearningTopicMember>('learning_topic_members', { topic_id: topic.id, user_id: id, added_by: me?.id ?? null })
    if (sel.size) toast.success(`Added ${sel.size} ${sel.size === 1 ? 'person' : 'people'} to ${topic.title}`)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} size="narrow" title={`Add people to ${topic.title}`} footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn btn-pri" disabled={!sel.size} onClick={add}>Add {sel.size || ''}</button></>}>
      <div className="dlg-b">
        {outside.length === 0 ? (
          <span className="small muted">Everyone is already learning this.</span>
        ) : (
          <div className="row wrap" style={{ gap: 6 }}>
            {outside.map((p) => (
              <button key={p.id} type="button" className={cn('chip', sel.has(p.id) && 'sel')} onClick={() => setSel((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })}>
                <Avatar profile={p} size="xs" />{p.id === me?.id ? 'Me' : profileDisplayName(p)}{sel.has(p.id) && <Check className="i i-xs" />}
              </button>
            ))}
          </div>
        )}
        <span className="hint">They get a notification in their inbox.</span>
      </div>
    </Modal>
  )
}
