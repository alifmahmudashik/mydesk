import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDown, ArrowUp, BookOpen, Link2, MessageSquare, Send, Check, ChevronDown, ChevronRight, ExternalLink, LogOut, MoreHorizontal, Pencil, Play, Plus, Trash2, UserPlus, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { useIsAdmin } from '@/hooks/usePermissions'
import { Topbar, Content, Empty } from '@/components/ui/layout'
import { Menu, MenuItem, MenuSep } from '@/components/ui/menu'
import { Avatar, AvatarStack } from '@/components/ui/avatar'
import { Modal, ConfirmDialog } from '@/components/ui/modal'
import { Field } from '@/components/ui/field'
import { Tabs } from '@/components/ui/tabs'
import { celebrateFrom } from '@/lib/confetti'
import { profileDisplayName } from '@/lib/derive'
import { formatFeedAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { LearningKind, LearningLesson, LearningPost, LearningProgress, LearningResource, LearningTopic, LearningTopicMember, Profile } from '@/types'
import { KINDS, TOPIC_COLORS, detectKind, hostOf, kindMeta, normUrl, topicProgress } from './learning-utils'

/* ---------- topics tab ---------- */

export function TopicsTab({ onNew }: { onNew: () => void }) {
  const { topics, lessons, progress, topicMembers, profiles, me, topicsReady, demoMode } = useData()
  const live = topics.filter((t) => !t.archived_at)
  const joined = live.filter((t) => topicMembers.some((m) => m.topic_id === t.id && m.user_id === me?.id))
  const others = live.filter((t) => !joined.includes(t))
  return (
    <div className="stack-lg">
      {!demoMode && !topicsReady && (
        <div className="card card-b" style={{ background: 'var(--warn-bg)', borderColor: 'transparent' }}>
          <span className="small" style={{ color: 'var(--warn)' }}>Run <b>supabase/schema.sql</b> in the Supabase SQL editor to turn on topics.</span>
        </div>
      )}
      {live.length === 0 ? (
        <div className="card">
          <Empty icon={<BookOpen className="i" />} title="No topics yet" action={<button type="button" className="btn btn-sm btn-pri" onClick={onNew}><Plus className="i i-sm" />Create the first topic</button>}>
            A topic is a shared space for one thing to learn, like “Google Tag Manager”: lessons, links, a discussion, and everyone’s progress in one place.
          </Empty>
        </div>
      ) : (
        <>
          {joined.length > 0 && (
            <section className="stack">
              <h2 className="h2">You’re learning <span className="faint" style={{ fontWeight: 500 }}>{joined.length}</span></h2>
              <div className="tpc-grid">{joined.map((t) => <TopicCard key={t.id} topic={t} me={me} lessons={lessons} progress={progress} members={topicMembers} people={profiles} />)}</div>
            </section>
          )}
          {others.length > 0 && (
            <section className="stack">
              <h2 className="h2">{joined.length ? 'Other topics' : 'All topics'} <span className="faint" style={{ fontWeight: 500 }}>{others.length}</span></h2>
              <div className="tpc-grid">{others.map((t) => <TopicCard key={t.id} topic={t} me={me} lessons={lessons} progress={progress} members={topicMembers} people={profiles} />)}</div>
            </section>
          )}
        </>
      )}
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
  const allPosts = useData((st) => st.topicPosts)
  const posts = allPosts.filter((x) => x.topic_id === topic.id)
  const last = posts[posts.length - 1]
  const lastBy = last ? people.find((x) => x.id === last.user_id) : undefined
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
      {!compact && last && (
        <p className="tp-last trunc"><MessageSquare className="i i-xs" /><b>{last.user_id === me?.id ? 'You' : profileDisplayName(lastBy)}:</b> {last.body}</p>
      )}
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

export function TopicModal({ open, onClose, edit }: { open: boolean; onClose: () => void; edit?: LearningTopic }) {
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
  const [view, setView] = useState<'class' | 'lessons'>('class')
  const allPosts = useData((st) => st.topicPosts)
  const posts = allPosts.filter((x) => x.topic_id === id)

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
  // Each learner's status in this topic, for the side panel.
  const statusOf = (uid: string) => {
    const pr = topicProgress(topic.id, uid, lessons, progress)
    const mineRows = progress.filter((p) => p.user_id === uid && list.some((l) => l.id === p.lesson_id))
    const now = mineRows.find((p) => p.status === 'learning')
    const nowLesson = now ? list.find((l) => l.id === now.lesson_id) : undefined
    const stamps = [
      ...mineRows.map((p) => p.completed_at ?? p.created_at),
      ...posts.filter((p) => p.user_id === uid).map((p) => p.created_at),
    ].sort()
    const all = pr.total > 0 && pr.done === pr.total
    const label = all ? 'Finished every lesson' : nowLesson ? `Learning: ${nowLesson.title}` : pr.done > 0 ? `${pr.done} of ${pr.total} lessons done` : 'Not started yet'
    return { pr, label, tone: all ? 'ok' : nowLesson ? 'pri' : '', lastAt: stamps[stamps.length - 1] }
  }

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
                <button type="button" className="btn btn-sm" onClick={() => { setView('lessons'); setOpenIds((s) => new Set(s).add(nextLesson.id)); setTimeout(() => document.getElementById(`ls-${nextLesson.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50) }}>
                  <Play className="i i-sm" />Next: {nextLesson.title}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="cols">
          <div className="col-main stack">
            <Tabs
              value={view}
              onChange={setView}
              tabs={[
                { id: 'class', label: <><MessageSquare className="i i-sm" />Discussion</>, count: posts.length || undefined },
                { id: 'lessons', label: <><BookOpen className="i i-sm" />Lessons</>, count: list.length || undefined },
              ]}
              after={view === 'lessons' && list.length > 0 ? <button type="button" className="btn btn-sm btn-ghost" style={{ marginBottom: 6 }} onClick={() => setOpenIds(openIds.size ? new Set() : new Set(list.map((l) => l.id)))}>{openIds.size ? 'Collapse all' : 'Expand all'}</button> : undefined}
            />
            {view === 'class' && (
              <TopicClass
                topic={topic}
                lessons={list}
                posts={posts}
                amIn={amIn}
                onJoin={join}
                onOpenLesson={(lid) => {
                  setView('lessons')
                  setOpenIds((s) => new Set(s).add(lid))
                  setTimeout(() => document.getElementById(`ls-${lid}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80)
                }}
              />
            )}
            {view === 'lessons' && <div className="ls-list">
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
            </div>}
          </div>

          <div className="col-side stack">
            <section className="card card-b stack">
              <div className="row between"><div className="label-caps">Everyone’s status</div><button type="button" className="link-btn xs" onClick={() => setAdding(true)}>Add people</button></div>
              {learners.length === 0 && <span className="small muted">Nobody has joined yet.</span>}
              {[...learners].sort((a, b) => (a.id === me?.id ? -1 : b.id === me?.id ? 1 : 0)).map((p) => {
                const st = statusOf(p.id)
                return (
                  <div key={p.id} className="tp-learner">
                    <Avatar profile={p} size="sm" />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row between small"><span className="m trunc">{p.id === me?.id ? 'You' : profileDisplayName(p)}</span><span className="faint num">{st.pr.done}/{st.pr.total}</span></div>
                      <div className="bar"><i style={{ width: `${st.pr.pct}%`, background: color }} /></div>
                      <div className={cn('xs trunc tp-st', st.tone && `t-${st.tone}`)}>{st.label}{st.lastAt ? <span className="faint"> · {formatFeedAgo(st.lastAt)}</span> : null}</div>
                    </div>
                  </div>
                )
              })}
            </section>
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

/* ---------- discussion (the topic's classroom) ---------- */

type ClassEvent =
  | { kind: 'post'; id: string; at: string; user: string; post: LearningPost }
  | { kind: 'done' | 'start'; id: string; at: string; user: string; lesson: LearningLesson; takeaway?: string | null }
  | { kind: 'resource'; id: string; at: string; user: string; lesson: LearningLesson; res: LearningResource }
  | { kind: 'lesson'; id: string; at: string; user: string; lesson: LearningLesson }
  | { kind: 'join'; id: string; at: string; user: string }

/** One stream for the topic: comments people write, plus what they did (started or finished
 *  a lesson, added a link or a lesson, joined), newest first. */
function TopicClass({ topic, lessons, posts, amIn, onJoin, onOpenLesson }: {
  topic: LearningTopic
  lessons: LearningLesson[]
  posts: LearningPost[]
  amIn: boolean
  onJoin: () => void
  onOpenLesson: (id: string) => void
}) {
  const { progress, resources, topicMembers, profiles, me, createRow, deleteRow } = useData()
  const isAdmin = useIsAdmin()
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [withLink, setWithLink] = useState(false)
  const [limit, setLimit] = useState(30)

  const events: ClassEvent[] = []
  for (const p of posts) events.push({ kind: 'post', id: p.id, at: p.created_at, user: p.user_id, post: p })
  for (const l of lessons) {
    if (l.created_by) events.push({ kind: 'lesson', id: `l-${l.id}`, at: l.created_at, user: l.created_by, lesson: l })
    for (const r of resources.filter((x) => x.lesson_id === l.id)) {
      if (r.created_by) events.push({ kind: 'resource', id: `r-${r.id}`, at: r.created_at, user: r.created_by, lesson: l, res: r })
    }
    for (const pr of progress.filter((x) => x.lesson_id === l.id)) {
      if (pr.status === 'done' && pr.completed_at) events.push({ kind: 'done', id: `d-${pr.id}`, at: pr.completed_at, user: pr.user_id, lesson: l, takeaway: pr.takeaway })
      else events.push({ kind: 'start', id: `s-${pr.id}`, at: pr.created_at, user: pr.user_id, lesson: l })
    }
  }
  for (const m of topicMembers.filter((x) => x.topic_id === topic.id)) events.push({ kind: 'join', id: `j-${m.id}`, at: m.created_at, user: m.user_id })
  events.sort((a, b) => b.at.localeCompare(a.at))

  const post = () => {
    const text = body.trim()
    const link = url.trim()
    if ((!text && !link) || !me) return
    // Posting means you're part of the topic.
    if (!amIn) onJoin()
    createRow<LearningPost>('learning_posts', { topic_id: topic.id, user_id: me.id, body: text, url: link ? normUrl(link) : null })
    setBody('')
    setUrl('')
    setWithLink(false)
  }
  const name = (uid: string) => (uid === me?.id ? 'You' : profileDisplayName(profiles.find((p) => p.id === uid)))
  const lessonLink = (l: LearningLesson) => <button type="button" className="link-btn" onClick={() => onOpenLesson(l.id)}>{l.title}</button>

  return (
    <div className="stack">
      <form className="card tp-compose" onSubmit={(e) => { e.preventDefault(); post() }}>
        <Avatar profile={me} size="sm" />
        <div className="grow stack-sm" style={{ minWidth: 0 }}>
          <textarea
            className="inp"
            rows={2}
            placeholder="Share what you learned, ask a question, or post a useful link…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); post() } }}
            aria-label="Write a post"
          />
          {withLink && <input className="inp sm" autoFocus placeholder="https://… (video, doc, course)" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link" />}
          <div className="row between">
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setWithLink((v) => !v); setUrl('') }}><Link2 className="i i-sm" />{withLink ? 'Remove link' : 'Add a link'}</button>
            <button type="submit" className="btn btn-sm btn-pri" disabled={!body.trim() && !url.trim()}><Send className="i i-sm" />Post</button>
          </div>
        </div>
      </form>

      {events.length === 0 ? (
        <div className="card"><Empty icon={<MessageSquare className="i" />} title="Nothing here yet">Post the first message, or open Lessons and start one. Everything people do in this topic shows up here.</Empty></div>
      ) : (
        <div className="card tp-feed">
          {events.slice(0, limit).map((ev) => {
            const who = profiles.find((p) => p.id === ev.user)
            const canDelete = ev.kind === 'post' && (ev.user === me?.id || topic.created_by === me?.id || isAdmin)
            return (
              <div key={ev.id} className={cn('tp-ev', ev.kind === 'post' && 'is-post')}>
                <Avatar profile={who} size="sm" />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="tp-ev-h">
                    <b>{name(ev.user)}</b>
                    <span className="muted">
                      {ev.kind === 'post' && 'posted'}
                      {ev.kind === 'done' && <>finished {lessonLink(ev.lesson)}</>}
                      {ev.kind === 'start' && <>started {lessonLink(ev.lesson)}</>}
                      {ev.kind === 'resource' && <>added a {kindMeta(ev.res.kind).label.toLowerCase()} to {lessonLink(ev.lesson)}</>}
                      {ev.kind === 'lesson' && <>added the lesson {lessonLink(ev.lesson)}</>}
                      {ev.kind === 'join' && 'joined the topic'}
                    </span>
                    <span className="faint xs">{formatFeedAgo(ev.at)}</span>
                    {canDelete && ev.kind === 'post' && (
                      <button type="button" className="btn btn-sm btn-ghost btn-icon tp-ev-x" aria-label="Delete post" title="Delete" onClick={() => deleteRow('learning_posts', ev.post.id)}><Trash2 className="i i-xs" /></button>
                    )}
                  </div>
                  {ev.kind === 'post' && (
                    <>
                      {ev.post.body && <p className="tp-ev-body">{ev.post.body}</p>}
                      {ev.post.url && <a className="tp-ev-link" href={normUrl(ev.post.url)} target="_blank" rel="noreferrer"><ExternalLink className="i i-xs" />{hostOf(ev.post.url) || ev.post.url}</a>}
                    </>
                  )}
                  {ev.kind === 'done' && ev.takeaway && <p className="tp-ev-quote">{ev.takeaway}</p>}
                  {ev.kind === 'resource' && (
                    ev.res.url
                      ? <a className="tp-ev-link" href={normUrl(ev.res.url)} target="_blank" rel="noreferrer"><ExternalLink className="i i-xs" />{ev.res.title}</a>
                      : <p className="tp-ev-body">{ev.res.title}</p>
                  )}
                </div>
              </div>
            )
          })}
          {events.length > limit && <div className="card-f"><button type="button" className="btn btn-sm" onClick={() => setLimit((n) => n + 30)}>Show older</button></div>}
        </div>
      )}
    </div>
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
