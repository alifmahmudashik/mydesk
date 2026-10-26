import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format, isAfter, parseISO, startOfMonth } from 'date-fns'
import {
  BookOpen, Check, ExternalLink, Flame, MoreHorizontal, Pencil, Play, Plus, Send, Sprout, Target, Trash2, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { useIsAdmin } from '@/hooks/usePermissions'
import { Topbar, Content, PageHead, Empty } from '@/components/ui/layout'
import { Tabs } from '@/components/ui/tabs'
import { Menu, MenuItem, MenuSep } from '@/components/ui/menu'
import { Avatar } from '@/components/ui/avatar'
import { Modal } from '@/components/ui/modal'
import { Field, Select } from '@/components/ui/field'
import { DateInput } from '@/components/ui/date-picker'
import { celebrateFrom } from '@/lib/confetti'
import { profileDisplayName } from '@/lib/derive'
import { formatDate, formatFeedAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { LearningGoal, LearningItem, LearningKind, LearningStatus, LearningTopic, Profile } from '@/types'
import { KINDS, detectKind, hostOf, kindMeta, learnedEvents, normUrl, streak, weekStart, type LearnedEvent } from './learning-utils'
import { TopicCard, TopicsTab } from './topics'

/* ---------- page ---------- */

type Tab = 'mine' | 'topics' | 'team' | 'feed'

export function ImprovementPage() {
  const { learning, goals, profiles, me, learningReady, demoMode, progress, lessons, topics, topicMembers } = useData()
  const events = useMemo(() => learnedEvents(learning, progress, lessons, topics), [learning, progress, lessons, topics])
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'mine'
  const setTab = (t: Tab) => {
    if (t === 'mine') params.delete('tab')
    else params.set('tab', t)
    params.delete('item')
    setParams(params, { replace: true })
  }
  const [share, setShare] = useState<{ open: boolean; to?: string[]; edit?: LearningItem }>({ open: false })
  const [goalModal, setGoalModal] = useState<{ open: boolean; edit?: LearningGoal }>({ open: false })
  const [finishing, setFinishing] = useState<LearningItem | null>(null)

  // Deep link from the inbox: ?item=<id> jumps to it and highlights it.
  const focusId = params.get('item')
  useEffect(() => {
    if (!focusId) return
    const item = learning.find((i) => i.id === focusId)
    if (!item) return
    const want: Tab = item.assignee_id === me?.id ? 'mine' : item.status === 'done' ? 'feed' : 'team'
    if (want !== tab) {
      if (want === 'mine') params.delete('tab')
      else params.set('tab', want)
      setParams(params, { replace: true })
    }
    const t = setTimeout(() => document.getElementById(`li-${focusId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, learning.length])

  const mine = learning.filter((i) => i.assignee_id === me?.id)
  const myGoals = goals.filter((g) => g.user_id === me?.id)
  const thisWeek = weekStart()
  const doneThisWeek = events.filter((e) => isAfter(parseISO(e.completed_at), thisWeek))
  const myTopics = topics.filter((t) => !t.archived_at && topicMembers.some((m) => m.topic_id === t.id && m.user_id === me?.id))

  return (
    <>
      <Topbar crumbs={[{ label: 'Improvement' }]}>
        <button type="button" className="btn hide-sm" onClick={() => setGoalModal({ open: true })}><Target className="i" />Add goal</button>
        <button type="button" className="btn btn-pri" onClick={() => setShare({ open: true })}><Plus className="i" />Share something</button>
      </Topbar>
      <Content>
        <PageHead title="Improvement" sub="Learn something new every week. Share links, videos and courses with the team, and note what you learned." />
        {!demoMode && !learningReady && (
          <div className="card card-b row" style={{ background: 'var(--warn-bg)', borderColor: 'transparent' }}>
            <span className="small grow" style={{ color: 'var(--warn)' }}>Run <b>supabase/improvement.sql</b> in the Supabase SQL editor to turn this on.</span>
          </div>
        )}
        <div className="tabs">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'mine', label: 'My learning', count: mine.filter((i) => i.status !== 'done').length || undefined },
              { id: 'topics', label: <><BookOpen className="i i-sm" />Topics</>, count: topics.filter((t) => !t.archived_at).length || undefined },
              { id: 'team', label: <><Users className="i i-sm" />Team</> },
              { id: 'feed', label: 'What we learned', count: doneThisWeek.length || undefined },
            ]}
          />
          <div className="panel-in" key={tab}>
            {tab === 'mine' && me && (
              <MyLearning
                me={me}
                items={mine}
                goals={myGoals}
                events={events.filter((e) => e.user_id === me.id)}
                myTopics={myTopics}
                focusId={focusId}
                onShare={() => setShare({ open: true, to: [me.id] })}
                onEdit={(i) => setShare({ open: true, edit: i })}
                onFinish={setFinishing}
                onGoal={(g) => setGoalModal({ open: true, edit: g })}
              />
            )}
            {tab === 'topics' && <TopicsTab />}
            {tab === 'team' && (
              <TeamView people={profiles} items={learning} goals={goals} events={events} me={me} focusId={focusId} onShareTo={(id) => setShare({ open: true, to: [id] })} />
            )}
            {tab === 'feed' && <Feed events={events} people={profiles} goals={goals} focusId={focusId} />}
          </div>
        </div>
      </Content>
      <ShareModal state={share} onClose={() => setShare({ open: false })} />
      <GoalModal state={goalModal} onClose={() => setGoalModal({ open: false })} />
      <FinishModal item={finishing} onClose={() => setFinishing(null)} />
    </>
  )
}

/* ---------- my learning ---------- */

function MyLearning({ me, items, goals, events, myTopics, focusId, onShare, onEdit, onFinish, onGoal }: {
  me: Profile
  items: LearningItem[]
  goals: LearningGoal[]
  events: LearnedEvent[]
  myTopics: LearningTopic[]
  focusId: string | null
  onShare: () => void
  onEdit: (i: LearningItem) => void
  onFinish: (i: LearningItem) => void
  onGoal: (g?: LearningGoal) => void
}) {
  const [showAllDone, setShowAllDone] = useState(false)
  const now = items.filter((i) => i.status === 'learning')
  const todo = items.filter((i) => i.status === 'todo')
  const done = items.filter((i) => i.status === 'done').sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
  const week = weekStart()
  const thisWeek = events.filter((e) => isAfter(parseISO(e.completed_at), week)).length
  const s = streak(events)
  const { lessons, progress, topicMembers, profiles } = useData()
  const activeGoals = goals.filter((g) => g.status === 'active')

  return (
    <div className="stack-lg">
      <div className="kstrip">
        <div><div className="small muted m">Learned this week</div><div className="val">{thisWeek}</div><div className="xs muted">{thisWeek ? 'Nice work' : 'Pick one thing to finish this week'}</div></div>
        <div><div className="small muted m">Learning now</div><div className="val">{now.length}</div><div className="xs muted">{todo.length} more on your list</div></div>
        <div><div className="small muted m">Total learned</div><div className="val">{events.length}</div><div className="xs muted">since you started</div></div>
        <div><div className="row-sm small muted m"><Flame className="i i-sm" style={{ color: s ? 'var(--warn-dot)' : undefined }} />Weekly streak</div><div className="val">{s} {s === 1 ? 'week' : 'weeks'}</div><div className="xs muted">weeks in a row with something learned</div></div>
      </div>

      {myTopics.length > 0 && (
        <section className="stack">
          <div className="row between"><h2 className="h2">My topics</h2><Link className="link small" to="/improvement?tab=topics">All topics →</Link></div>
          <div className="tpc-grid">{myTopics.map((t) => <TopicCard key={t.id} topic={t} me={me} lessons={lessons} progress={progress} members={topicMembers} people={profiles} compact />)}</div>
        </section>
      )}

      <section className="stack">
        <div className="row between"><h2 className="h2">My goals</h2></div>
        <div className="lg-goals">
          {activeGoals.map((g) => <GoalCard key={g.id} goal={g} items={items} onEdit={() => onGoal(g)} />)}
          <button type="button" className="lg-goal add" onClick={() => onGoal()}>
            <Target className="i" />
            <span>Add a goal</span>
            <small>What do you want to get better at?</small>
          </button>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="card">
          <Empty icon={<Sprout className="i" />} title="Nothing on your list yet" action={<button type="button" className="btn btn-sm btn-pri" onClick={onShare}><Plus className="i i-sm" />Add something to learn</button>}>
            Save a video, article or course you want to learn from. Teammates can send you things too.
          </Empty>
        </div>
      ) : (
        <>
          <ItemSection title="Learning now" items={now} me={me} goals={goals} focusId={focusId} onEdit={onEdit} onFinish={onFinish} empty="Start something from your list below." />
          <ItemSection title="To learn" items={todo} me={me} goals={goals} focusId={focusId} onEdit={onEdit} onFinish={onFinish} empty="Your list is clear." action={<button type="button" className="btn btn-sm" onClick={onShare}><Plus className="i i-sm" />Add</button>} />
          {done.length > 0 && (
            <ItemSection title="Done" items={showAllDone ? done : done.slice(0, 5)} me={me} goals={goals} focusId={focusId} onEdit={onEdit} onFinish={onFinish}
              action={done.length > 5 ? <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowAllDone((v) => !v)}>{showAllDone ? 'Show less' : `Show all ${done.length}`}</button> : undefined} />
          )}
        </>
      )}
    </div>
  )
}

function GoalCard({ goal, items, onEdit }: { goal: LearningGoal; items: LearningItem[]; onEdit: () => void }) {
  const linked = items.filter((i) => i.goal_id === goal.id)
  const done = linked.filter((i) => i.status === 'done').length
  const pct = linked.length ? Math.round((done / linked.length) * 100) : 0
  return (
    <button type="button" className="lg-goal" onClick={onEdit}>
      <span className="row-sm" style={{ minWidth: 0 }}><Target className="i i-sm" style={{ color: 'var(--pri)' }} /><b className="trunc">{goal.title}</b></span>
      <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${pct}%` }} /></div>
      <small>{linked.length ? `${done} of ${linked.length} learned` : 'Nothing linked yet'}{goal.target_date ? ` · by ${formatDate(goal.target_date)}` : ''}</small>
    </button>
  )
}

function ItemSection({ title, items, me, goals, focusId, onEdit, onFinish, empty, action }: {
  title: string
  items: LearningItem[]
  me: Profile | null
  goals: LearningGoal[]
  focusId: string | null
  onEdit?: (i: LearningItem) => void
  onFinish?: (i: LearningItem) => void
  empty?: string
  action?: ReactNode
}) {
  return (
    <section className="stack">
      <div className="row between"><h2 className="h2">{title} <span className="faint" style={{ fontWeight: 500 }}>{items.length || ''}</span></h2>{action}</div>
      {items.length === 0 ? (
        empty ? <div className="small muted">{empty}</div> : null
      ) : (
        <div className="lg-list">
          {items.map((i) => <ItemRow key={i.id} item={i} me={me} goal={goals.find((g) => g.id === i.goal_id)} focused={i.id === focusId} onEdit={onEdit} onFinish={onFinish} />)}
        </div>
      )}
    </section>
  )
}

function ItemRow({ item, me, goal, focused, onEdit, onFinish, showLearner }: {
  item: LearningItem
  me: Profile | null
  goal?: LearningGoal
  focused?: boolean
  onEdit?: (i: LearningItem) => void
  onFinish?: (i: LearningItem) => void
  showLearner?: boolean
}) {
  const { profiles, updateRow, deleteRow } = useData()
  const isAdmin = useIsAdmin()
  const k = kindMeta(item.kind)
  const from = profiles.find((p) => p.id === item.created_by)
  const learner = profiles.find((p) => p.id === item.assignee_id)
  const mineToLearn = item.assignee_id === me?.id
  const canEdit = mineToLearn || item.created_by === me?.id || isAdmin
  const setStatus = (status: LearningStatus) =>
    updateRow('learning_items', item.id, {
      status,
      started_at: status === 'learning' ? item.started_at ?? new Date().toISOString() : item.started_at ?? null,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    })
  const host = hostOf(item.url)
  const Title = item.url ? (
    <a className="lg-title" href={normUrl(item.url)} target="_blank" rel="noreferrer">{item.title}<ExternalLink className="i i-xs" /></a>
  ) : (
    <span className="lg-title">{item.title}</span>
  )

  return (
    <div id={`li-${item.id}`} className={cn('lg-item', item.status === 'done' && 'done', focused && 'focus')}>
      <span className="lg-kind" style={{ ['--k' as string]: k.color }} title={k.label}>{k.icon}</span>
      <div className="lg-body">
        {Title}
        <div className="lg-meta">
          <span>{k.label}{host ? ` · ${host}` : ''}</span>
          {showLearner && learner && <span className="row-sm"><Avatar profile={learner} size="xs" />{profileDisplayName(learner)}</span>}
          {from && from.id !== item.assignee_id && <span className="lg-from"><Send className="i i-xs" />from {from.id === me?.id ? 'you' : profileDisplayName(from)}</span>}
          {goal && <span className="lg-goal-tag"><Target className="i i-xs" />{goal.title}</span>}
          <span>{item.status === 'done' && item.completed_at ? `learned ${formatFeedAgo(item.completed_at)}` : `added ${formatFeedAgo(item.created_at)}`}</span>
        </div>
        {item.note && <div className="lg-note">“{item.note}”</div>}
        {item.status === 'done' && item.takeaway && <div className="lg-takeaway"><b>Learned:</b> {item.takeaway}</div>}
      </div>
      <div className="lg-actions">
        {mineToLearn && item.status === 'todo' && <button type="button" className="btn btn-sm" onClick={() => setStatus('learning')}><Play className="i i-sm" />Start</button>}
        {mineToLearn && item.status !== 'done' && onFinish && <button type="button" className="btn btn-sm btn-pri" onClick={() => onFinish(item)}><Check className="i i-sm" />Learned it</button>}
        {!mineToLearn && <span className={cn('pill', item.status === 'done' ? 'ok' : item.status === 'learning' ? 'pri' : 'gray')}>{item.status === 'done' ? 'Learned' : item.status === 'learning' ? 'Learning' : 'To learn'}</span>}
        {canEdit && (
          <Menu align="right" trigger={({ toggle }) => <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label="More" onClick={toggle}><MoreHorizontal className="i i-sm" /></button>}>
            {onEdit && <MenuItem icon={<Pencil className="i" />} onSelect={() => onEdit(item)}>Edit</MenuItem>}
            {mineToLearn && item.status === 'done' && <MenuItem icon={<Play className="i" />} onSelect={() => setStatus('learning')}>Move back to learning</MenuItem>}
            {mineToLearn && item.status === 'learning' && <MenuItem icon={<Sprout className="i" />} onSelect={() => setStatus('todo')}>Move back to list</MenuItem>}
            <MenuSep />
            <MenuItem danger icon={<Trash2 className="i" />} onSelect={() => { deleteRow('learning_items', item.id); toast.success('Removed') }}>Remove</MenuItem>
          </Menu>
        )}
      </div>
    </div>
  )
}

/* ---------- team ---------- */

function TeamView({ people, items, goals, events, me, focusId, onShareTo }: { people: Profile[]; items: LearningItem[]; goals: LearningGoal[]; events: LearnedEvent[]; me: Profile | null; focusId: string | null; onShareTo: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const week = weekStart()
  const rows = useMemo(
    () =>
      people
        .map((p) => {
          const theirs = items.filter((i) => i.assignee_id === p.id)
          const done = theirs.filter((i) => i.status === 'done')
          const ev = events.filter((e) => e.user_id === p.id)
          return {
            p,
            theirs,
            now: theirs.filter((i) => i.status === 'learning'),
            todo: theirs.filter((i) => i.status === 'todo'),
            done,
            week: ev.filter((e) => isAfter(parseISO(e.completed_at), week)).length,
            learned: ev.length,
            streak: streak(ev),
            lastEvent: ev[0],
            goals: goals.filter((g) => g.user_id === p.id && g.status === 'active'),
            last: [...done].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))[0],
          }
        })
        .sort((a, b) => Number(b.p.id === me?.id) - Number(a.p.id === me?.id) || b.week - a.week || b.learned - a.learned),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, items, goals, events, me?.id],
  )
  return (
    <div className="lg-team">
      {rows.map((r) => (
        <section key={r.p.id} className="card lg-person">
          <div className="lg-person-h">
            <Avatar profile={r.p} size="md" />
            <div className="grow" style={{ minWidth: 0 }}>
              <b className="trunc">{profileDisplayName(r.p)}{r.p.id === me?.id && <span className="faint" style={{ fontWeight: 500 }}> · you</span>}</b>
              <small className="trunc">{r.p.job_title || (r.p.role === 'member' ? 'Member' : r.p.role === 'owner' ? 'Owner' : 'Admin')}</small>
            </div>
            {r.p.id !== me?.id && <button type="button" className="btn btn-sm" onClick={() => onShareTo(r.p.id)}><Send className="i i-sm" />Share</button>}
          </div>
          <div className="lg-person-stats">
            <span><b>{r.week}</b> this week</span>
            <span><b>{r.learned}</b> learned</span>
            <span><Flame className="i i-xs" style={{ color: r.streak ? 'var(--warn-dot)' : 'var(--faint)' }} /><b>{r.streak}</b> wk streak</span>
          </div>
          {r.goals.length > 0 && (
            <div className="lg-person-goals">{r.goals.map((g) => <span key={g.id} className="lg-goal-tag"><Target className="i i-xs" />{g.title}</span>)}</div>
          )}
          <div className="lg-person-now">
            {r.now.length ? (
              <><span className="label-caps">Learning now</span>{r.now.slice(0, 2).map((i) => <MiniItem key={i.id} item={i} />)}</>
            ) : r.todo.length ? (
              <><span className="label-caps">Up next</span><MiniItem item={r.todo[0]} /></>
            ) : (
              <span className="small muted">Nothing on the list right now.</span>
            )}
            {r.lastEvent?.takeaway && <div className="lg-takeaway sm"><b>Last learned:</b> {r.lastEvent.takeaway}</div>}
          </div>
          {r.theirs.length > 0 && (
            <button type="button" className="link-btn lg-person-more" onClick={() => setOpen(open === r.p.id ? null : r.p.id)}>
              {open === r.p.id ? 'Hide list' : `See everything (${r.theirs.length})`}
            </button>
          )}
          {(open === r.p.id || r.theirs.some((i) => i.id === focusId)) && (
            <div className="lg-list" style={{ marginTop: 10 }}>
              {[...r.now, ...r.todo, ...r.done].map((i) => <ItemRow key={i.id} item={i} me={me} goal={goals.find((g) => g.id === i.goal_id)} focused={i.id === focusId} />)}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

function MiniItem({ item }: { item: LearningItem }) {
  const k = kindMeta(item.kind)
  return (
    <div className="lg-mini">
      <span className="lg-kind sm" style={{ ['--k' as string]: k.color }}>{k.icon}</span>
      {item.url ? <a className="trunc" href={normUrl(item.url)} target="_blank" rel="noreferrer">{item.title}</a> : <span className="trunc">{item.title}</span>}
    </div>
  )
}

/* ---------- feed ---------- */

function Feed({ events, people, goals, focusId }: { events: LearnedEvent[]; people: Profile[]; goals: LearningGoal[]; focusId: string | null }) {
  const [range, setRange] = useState<'week' | 'month' | 'all'>('month')
  const since = range === 'week' ? weekStart() : range === 'month' ? startOfMonth(new Date()) : null
  const done = events.filter((e) => !since || isAfter(parseISO(e.completed_at), since))
  // Group by week so it reads like a weekly log.
  const byWeek = new Map<string, LearnedEvent[]>()
  for (const e of done) {
    const key = format(weekStart(parseISO(e.completed_at)), 'yyyy-MM-dd')
    byWeek.set(key, [...(byWeek.get(key) ?? []), e])
  }
  return (
    <div className="stack-lg">
      <Tabs variant="seg" value={range} onChange={setRange} tabs={[{ id: 'week', label: 'This week' }, { id: 'month', label: 'This month' }, { id: 'all', label: 'All time' }]} />
      {done.length === 0 ? (
        <div className="card"><Empty icon={<Sprout className="i" />} title="Nothing learned yet in this period">When someone finishes a resource or a lesson, their takeaway shows up here.</Empty></div>
      ) : (
        [...byWeek.entries()].map(([wk, list]) => (
          <section key={wk} className="stack">
            <h2 className="h2">{wk === format(weekStart(), 'yyyy-MM-dd') ? 'This week' : `Week of ${format(parseISO(wk), 'MMM d')}`} <span className="faint" style={{ fontWeight: 500 }}>{list.length}</span></h2>
            <div className="lg-feed">
              {list.map((e) => {
                const who = people.find((p) => p.id === e.user_id)
                const k = e.kind ? kindMeta(e.kind) : null
                const goal = goals.find((g) => g.id === e.goal_id)
                return (
                  <article key={e.id} id={`li-${e.id}`} className={cn('card lg-post', e.id === focusId && 'focus')}>
                    <div className="lg-post-h">
                      <Avatar profile={who} size="sm" />
                      <span className="small"><b>{profileDisplayName(who)}</b> <span className="muted">{e.topic ? 'finished a lesson' : 'learned'}</span></span>
                      <span className="xs faint" style={{ marginLeft: 'auto' }}>{formatFeedAgo(e.completed_at)}</span>
                    </div>
                    <div className="lg-mini" style={{ marginTop: 8 }}>
                      {k ? <span className="lg-kind sm" style={{ ['--k' as string]: k.color }}>{k.icon}</span> : <span className="lg-kind sm" style={{ ['--k' as string]: e.topic?.color || '#2563EB' }}><BookOpen className="i i-sm" /></span>}
                      {e.url ? <a className="m trunc" href={normUrl(e.url)} target="_blank" rel="noreferrer">{e.title}</a> : <span className="m trunc">{e.title}</span>}
                    </div>
                    {e.topic && <Link className="xs faint" style={{ marginTop: 4 }} to={`/improvement/topics/${e.topic.id}`}>in {e.topic.title} →</Link>}
                    {e.takeaway ? <blockquote className="lg-quote">{e.takeaway}</blockquote> : <div className="xs faint" style={{ marginTop: 8 }}>No notes added.</div>}
                    {goal && <span className="lg-goal-tag" style={{ marginTop: 10 }}><Target className="i i-xs" />{goal.title}</span>}
                  </article>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

/* ---------- modals ---------- */

function ShareModal({ state, onClose }: { state: { open: boolean; to?: string[]; edit?: LearningItem }; onClose: () => void }) {
  const { profiles, goals, me, createRow, updateRow } = useData()
  const edit = state.edit
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<LearningKind>('article')
  const [kindTouched, setKindTouched] = useState(false)
  const [note, setNote] = useState('')
  const [to, setTo] = useState<Set<string>>(new Set())
  const [goalId, setGoalId] = useState('')

  useEffect(() => {
    if (!state.open) return
    setUrl(edit?.url ?? '')
    setTitle(edit?.title ?? '')
    setKind(edit?.kind ?? 'article')
    setKindTouched(Boolean(edit))
    setNote(edit?.note ?? '')
    setTo(new Set(edit ? [edit.assignee_id] : state.to ?? (me ? [me.id] : [])))
    setGoalId(edit?.goal_id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open])

  const onUrl = (v: string) => {
    setUrl(v)
    const k = detectKind(v)
    if (k && !kindTouched) setKind(k)
  }
  const everyone = profiles.length > 0 && profiles.every((p) => to.has(p.id))
  const toggle = (id: string) => setTo((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })
  const single = to.size === 1 ? [...to][0] : null
  const goalOptions = single ? goals.filter((g) => g.user_id === single && g.status === 'active') : []

  const save = () => {
    const t = title.trim() || hostOf(url) || ''
    if (!t) return toast.error('Add a link or a title')
    if (!edit && to.size === 0) return toast.error('Pick at least one person')
    const base = { title: t, url: url.trim() ? normUrl(url) : null, kind, note: note.trim() || null }
    if (edit) {
      updateRow('learning_items', edit.id, { ...base, goal_id: goalId || null })
      toast.success('Saved')
    } else {
      for (const id of to) {
        createRow<LearningItem>('learning_items', { ...base, created_by: me?.id ?? null, assignee_id: id, goal_id: single ? goalId || null : null, status: 'todo' })
      }
      const names = [...to].map((id) => (id === me?.id ? 'your list' : profileDisplayName(profiles.find((p) => p.id === id))))
      toast.success(to.size === 1 && single === me?.id ? 'Added to your list' : `Shared with ${everyone ? 'everyone' : names.join(', ')}`)
    }
    onClose()
  }

  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={edit ? 'Edit resource' : 'Share something to learn'}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn btn-pri" onClick={save}>{edit ? 'Save' : to.size === 1 && single === me?.id ? 'Add to my list' : 'Share'}</button></>}
    >
      <form className="dlg-b" onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Title">
          <input data-autofocus className="inp" placeholder={hostOf(url) ? `e.g. what is this ${kindMeta(kind).label.toLowerCase()} about?` : 'What is it?'} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Link">
          <input className="inp" placeholder="Paste a YouTube video, article, course…" value={url} onChange={(e) => onUrl(e.target.value)} />
        </Field>
        <div className="field">
          <span className="lbl">Type</span>
          <div className="lg-kinds">
            {KINDS.map((k) => (
              <button key={k.id} type="button" className={cn('lg-kind-pick', kind === k.id && 'on')} style={{ ['--k' as string]: k.color }} onClick={() => { setKind(k.id); setKindTouched(true) }}>
                {k.icon}{k.label}
              </button>
            ))}
          </div>
        </div>
        {!edit && (
          <div className="field">
            <span className="lbl">For</span>
            <div className="row wrap" style={{ gap: 6 }}>
              <button type="button" className={cn('chip', everyone && 'sel')} onClick={() => setTo(everyone ? new Set(me ? [me.id] : []) : new Set(profiles.map((p) => p.id)))}><Users className="i i-sm" />Everyone</button>
              {profiles.map((p) => (
                <button key={p.id} type="button" className={cn('chip', to.has(p.id) && 'sel')} onClick={() => toggle(p.id)} aria-pressed={to.has(p.id)}>
                  <Avatar profile={p} size="xs" />{p.id === me?.id ? 'Me' : profileDisplayName(p)}{to.has(p.id) && <Check className="i i-xs" />}
                </button>
              ))}
            </div>
            {to.size > 1 && <span className="hint">Each person gets their own copy to track and note what they learned.</span>}
          </div>
        )}
        {(edit ? goals.some((g) => g.user_id === edit.assignee_id) : goalOptions.length > 0) && (
          <Field label="Goal (optional)">
            <Select value={goalId} onChange={(e) => setGoalId(e.target.value)} options={[{ value: '', label: 'No goal' }, ...goals.filter((g) => g.user_id === (edit?.assignee_id ?? single) && g.status === 'active').map((g) => ({ value: g.id, label: g.title }))]} />
          </Field>
        )}
        <Field label={edit || single === me?.id ? 'Note' : 'Why it’s worth it'}>
          <textarea className="inp" rows={2} placeholder={single === me?.id ? 'Why you saved it (optional)' : 'e.g. Watch this before the Stape setup next week'} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

function GoalModal({ state, onClose }: { state: { open: boolean; edit?: LearningGoal }; onClose: () => void }) {
  const { profiles, me, createRow, updateRow, deleteRow } = useData()
  const isAdmin = useIsAdmin()
  const edit = state.edit
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [who, setWho] = useState('')
  useEffect(() => {
    if (!state.open) return
    setTitle(edit?.title ?? '')
    setDate(edit?.target_date ?? '')
    setWho(edit?.user_id ?? me?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open])
  const save = () => {
    if (!title.trim()) return toast.error('Name the goal')
    if (edit) updateRow('learning_goals', edit.id, { title: title.trim(), target_date: date || null })
    else createRow<LearningGoal>('learning_goals', { user_id: who || me!.id, created_by: me?.id ?? null, title: title.trim(), target_date: date || null, status: 'active' })
    toast.success(edit ? 'Goal saved' : 'Goal added')
    onClose()
  }
  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={edit ? 'Edit goal' : 'New learning goal'}
      size="narrow"
      footer={
        <>
          {edit && (
            <>
              <button type="button" className="btn btn-ghost" style={{ marginRight: 'auto', color: 'var(--bad)' }} onClick={() => { deleteRow('learning_goals', edit.id); onClose() }}><Trash2 className="i i-sm" />Delete</button>
              <button type="button" className="btn" onClick={() => { updateRow('learning_goals', edit.id, { status: 'done' }); toast.success('Goal reached 🎉'); onClose() }}><Check className="i i-sm" />Reached</button>
            </>
          )}
          <button type="button" className="btn btn-pri" onClick={save}>{edit ? 'Save' : 'Add goal'}</button>
        </>
      }
    >
      <form className="dlg-b" onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Goal"><input data-autofocus className="inp" placeholder="e.g. Get confident with server-side GTM" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Target date (optional)"><DateInput value={date} onChange={(v) => setDate(v ?? '')} placeholder="No deadline" /></Field>
        {!edit && isAdmin && profiles.length > 1 && (
          <Field label="For">
            <Select value={who} onChange={(e) => setWho(e.target.value)} options={profiles.map((p) => ({ value: p.id, label: p.id === me?.id ? 'Me' : profileDisplayName(p) }))} />
          </Field>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

function FinishModal({ item, onClose }: { item: LearningItem | null; onClose: () => void }) {
  const { updateRow } = useData()
  const [text, setText] = useState('')
  useEffect(() => setText(item?.takeaway ?? ''), [item])
  const finish = (el?: HTMLElement) => {
    if (!item) return
    updateRow('learning_items', item.id, {
      status: 'done',
      takeaway: text.trim() || null,
      started_at: item.started_at ?? new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    if (el) celebrateFrom(el)
    toast.success('Nice — added to what we learned')
    onClose()
  }
  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      title="What did you learn?"
      size="narrow"
      footer={<><button type="button" className="btn" onClick={() => finish()}>Skip</button><button type="button" className="btn btn-pri" onClick={(e) => finish(e.currentTarget)}><Check className="i i-sm" />Mark learned</button></>}
    >
      <div className="dlg-b">
        <div className="small muted">{item?.title}</div>
        <textarea data-autofocus className="inp" rows={4} placeholder="One or two lines the team can learn from, e.g. “Run the server container on a subdomain so cookies stay first-party.”" value={text} onChange={(e) => setText(e.target.value)} />
        <span className="hint">Shows in “What we learned” for the whole team.</span>
      </div>
    </Modal>
  )
}
