import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, Check, Clock, DollarSign, KeyRound, ExternalLink, Inbox as InboxIcon, Mail, Settings } from 'lucide-react'
import { useData } from '@/data/store'
import { addComment } from '@/data/actions'
import { Topbar, Content, Empty } from '@/components/ui/layout'
import { Tabs } from '@/components/ui/tabs'
import { Avatar, ClientMark } from '@/components/ui/avatar'
import { Composer, MentionText } from '@/components/ui/mentions'
import { DateChip, StatusPill } from '@/components/ui/pill'
import { labelTone } from '@/components/domain/TaskRow'
import { clientDisplayName, eligibleAssignees, profileDisplayName, shortProjectTitle, taskRef } from '@/lib/derive'
import { formatFeedAgo, formatShortAgo } from '@/lib/format'
import { taskStatus } from '@/lib/status'
import type { AppNotification } from '@/types'
import { cn } from '@/lib/utils'

const verb: Record<string, string> = {
  assigned: 'assigned you',
  mentioned: 'mentioned you on',
  mentioned_note: 'mentioned you in a note on',
  comment: 'commented on',
  completed: 'completed',
  invite_accepted: '',
  due_soon: '',
  access_granted: '',
  overdue: '',
  paid: '',
  learning_shared: 'shared something for you to learn:',
  learning_done: 'finished learning',
  topic_added: 'added you to the learning topic',
}

function NotifIcon({ n }: { n: AppNotification }) {
  const actor = useData((s) => s.profiles.find((p) => p.id === n.actor_id))
  if (n.type === 'overdue') return <span className="av md bad"><AlertCircle className="i i-sm" /></span>
  if (n.type === 'paid') return <span className="av md ok"><DollarSign className="i i-sm" /></span>
  if (n.type === 'due_soon') return <span className="av md warn"><Clock className="i i-sm" /></span>
  if (n.type === 'access_granted') return <span className="av md pri"><KeyRound className="i i-sm" /></span>
  return <Avatar profile={actor} size="md" />
}

function NotifText({ n }: { n: AppNotification }) {
  const actor = useData((s) => s.profiles.find((p) => p.id === n.actor_id))
  if (n.type === 'overdue') {
    const [, rest] = n.title.split('Payment overdue')
    return <><b>Payment overdue</b>{rest}</>
  }
  if (n.type === 'paid' || n.type === 'invite_accepted' || n.type === 'access_granted') return <><b>{n.title}</b></>
  if (n.type === 'due_soon') return <><b>Due tomorrow</b> · {n.title}</>
  return (
    <>
      <b>{profileDisplayName(actor)}</b> {verb[n.type] ?? ''} <b>{n.type === 'mentioned_note' ? shortProjectTitle(n.title) : n.title}</b>
    </>
  )
}

export function InboxPage() {
  const { notifications, markNotificationsRead, tasks, projects, clients, comments, profiles, clientMembers, attachments, me } = useData()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'all' | 'unread' | 'mentions'>('all')
  const [selId, setSelId] = useState<string | null>(null)

  const list = useMemo(() => {
    const sorted = [...notifications].sort((a, b) => b.created_at.localeCompare(a.created_at))
    if (filter === 'unread') return sorted.filter((n) => !n.read_at)
    if (filter === 'mentions') return sorted.filter((n) => n.type === 'mentioned' || n.type === 'mentioned_note')
    return sorted
  }, [notifications, filter])

  const selected = list.find((n) => n.id === selId) ?? list[0]

  // Opening an item marks it read.
  useEffect(() => {
    if (selected && !selected.read_at) {
      const t = setTimeout(() => markNotificationsRead([selected.id]), 600)
      return () => clearTimeout(t)
    }
  }, [selected, markNotificationsRead])

  const task = selected?.entity === 'task' ? tasks.find((t) => t.id === selected.entity_id) : undefined
  const project = projects.find((p) => p.id === (task?.project_id ?? selected?.project_id))
  const client = clients.find((c) => c.id === project?.client_id)
  const commentId = selected?.link?.split('#c-')[1]
  const comment = comments.find((c) => c.id === commentId) ?? (task ? [...comments].filter((c) => c.task_id === task.id).pop() : undefined)
  const commentAuthor = profiles.find((p) => p.id === comment?.author_id)
  const files = task ? attachments.filter((a) => a.task_id === task.id && a.kind === 'file').slice(0, 2) : []
  const people = task ? eligibleAssignees(project?.client_id, profiles, clientMembers) : []

  const unread = notifications.filter((n) => !n.read_at).length

  return (
    <>
      <Topbar crumbs={[{ label: 'Inbox' }]}>
        <button type="button" className="btn" disabled={!unread} onClick={() => markNotificationsRead()}>
          <Check className="i" />Mark all read
        </button>
        <Link className="btn" to="/account#notifications"><Settings className="i" />Notification settings</Link>
      </Topbar>
      <Content width="full">
        <div className="ph">
          <div>
            <h1>Inbox</h1>
            <p>Mentions, assignments and payment alerts in one place.</p>
          </div>
          <Tabs variant="seg" value={filter} onChange={setFilter} tabs={[{ id: 'all', label: 'All' }, { id: 'unread', label: 'Unread', count: unread || undefined }, { id: 'mentions', label: 'Mentions' }]} />
        </div>
        {list.length === 0 ? (
          <div className="card">
            <Empty icon={<InboxIcon className="i" />} title={filter === 'all' ? 'Inbox zero' : 'Nothing here'}>
              Mentions, assignments, completed tasks and payment alerts land here.
            </Empty>
          </div>
        ) : (
          <div className="inbox">
            <div className="ib-list" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
              {list.map((n) => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  className={cn('ib', selected?.id === n.id && 'sel', !n.read_at && 'unread')}
                  onClick={() => {
                    // Small screens have no preview pane: go straight to the item.
                    if (window.innerWidth <= 1000 && n.link) {
                      markNotificationsRead([n.id])
                      navigate(n.link)
                    } else setSelId(n.id)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && setSelId(n.id)}
                >
                  <NotifIcon n={n} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="t"><NotifText n={n} /></div>
                    {n.excerpt && <div className="ex trunc">{n.excerpt}</div>}
                  </div>
                  <span className="when">{formatShortAgo(n.created_at)}</span>
                </div>
              ))}
            </div>
            <div className="ib-view">
              {selected && (
                <>
                  <div className="row between wrap">
                    <div className="row-sm small muted" style={{ minWidth: 0 }}>
                      {client && <><ClientMark client={client} size="xs" />{clientDisplayName(client)}<span>/</span></>}
                      {project && <span className="trunc">{shortProjectTitle(project.title)}</span>}
                      {task && <><span>/</span><span className="mono">{taskRef(task, project)}</span></>}
                    </div>
                    <div className="row-sm">
                      {selected.emailed && <span className="xs faint row-sm"><Mail className="i i-xs" />Emailed</span>}
                      {selected.link && (
                        <Link className="btn btn-sm" to={selected.link}>
                          Open {task ? 'task' : selected.entity === 'payment' ? 'payment' : selected.entity === 'member' ? 'profile' : selected.entity === 'learning' ? 'resource' : selected.entity === 'learning_topic' ? 'topic' : 'project'}
                          <ExternalLink className="i i-sm" />
                        </Link>
                      )}
                    </div>
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>{task?.title ?? selected.title}</h2>
                  {task && (
                    <div className="row-sm wrap">
                      <StatusPill meta={taskStatus[task.status]} />
                      <DateChip date={task.due_date} done={task.status === 'done'} />
                      {task.labels?.map((l) => <span key={l} className={`tag ${labelTone(l)}`}>{l}</span>)}
                    </div>
                  )}
                  {comment && (selected.type === 'mentioned' || selected.type === 'comment') ? (
                    <div className="card card-b" style={{ background: 'var(--soft2)' }}>
                      <div className="comment" style={{ padding: 0 }}>
                        <Avatar profile={commentAuthor} size="md" />
                        <div className="body">
                          <div className="head"><b className="m">{profileDisplayName(commentAuthor)}</b> <span>· {formatFeedAgo(comment.created_at)}</span></div>
                          <MentionText body={comment.body} />
                          {files.length > 0 && (
                            <div className="row wrap" style={{ marginTop: 10 }}>
                              {files.map((f) => (
                                <Link key={f.id} className="file" to={`/tasks/${task!.id}`} style={{ display: 'inline-flex' }}>
                                  <span className="ext ok">{f.name.split('.').pop()?.toUpperCase().slice(0, 4)}</span>
                                  <span className="small m">{f.name}</span>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    selected.excerpt && <div className="card card-b" style={{ background: 'var(--soft2)' }}><MentionText body={selected.excerpt} className="small" /></div>
                  )}
                  {task && (
                    <Composer
                      people={people}
                      meId={me?.id}
                      placeholder={`Reply${commentAuthor && commentAuthor.id !== me?.id ? ` to ${profileDisplayName(commentAuthor)}` : ''}… type @ to mention`}
                      submitLabel="Reply"
                      footnote="Replies post as a comment on the task"
                      onSubmit={(body, mentions) => addComment(task, body, mentions)}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </Content>
    </>
  )
}
