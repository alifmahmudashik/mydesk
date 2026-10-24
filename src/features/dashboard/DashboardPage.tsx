import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addDays, endOfWeek, format, isSameDay, parseISO, startOfMonth, startOfWeek, startOfYear, subMonths } from 'date-fns'
import { Briefcase, Calendar, ChevronDown, ChevronRight, CreditCard, FileText, Folder, ListChecks, Plus } from 'lucide-react'
import { useData } from '@/data/store'
import { useUI } from '@/data/ui'
import { paymentTitle } from '@/data/actions'
import { useIsAdmin } from '@/hooks/usePermissions'
import { Topbar, Content, Empty } from '@/components/ui/layout'
import { Menu, MenuItem, MenuSep } from '@/components/ui/menu'
import { Tabs } from '@/components/ui/tabs'
import { Avatar, AvatarStack, ClientMark } from '@/components/ui/avatar'
import { TaskRow } from '@/components/domain/TaskRow'
import { RevenueChart, Spark, monthlyBuckets } from '@/components/domain/RevenueChart'
import { ActivityItem } from '@/components/domain/ActivityItem'
import { RemindModal } from '@/features/payments/RemindModal'
import { sumUSD, useUsdRates } from '@/lib/currency'
import { clientDisplayName, effectivePaymentStatus, isOpenPayment, OPEN_PROJECT, OPEN_TASK, profileDisplayName, shortProjectTitle } from '@/lib/derive'
import { daysUntil, formatFeedAgo, formatMoney, lateLabel } from '@/lib/format'
import type { Payment } from '@/types'

type Period = 'week' | 'month' | '3m' | 'year'
const periodLabel: Record<Period, string> = { week: 'This week', month: 'This month', '3m': 'Last 3 months', year: 'This year' }

function periodStart(p: Period) {
  const now = new Date()
  if (p === 'week') return startOfWeek(now, { weekStartsOn: 1 })
  if (p === 'month') return startOfMonth(now)
  if (p === '3m') return startOfMonth(subMonths(now, 2))
  return startOfYear(now)
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function DashboardPage() {
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()
  const { openCreate } = useUI()
  const { me, tasks, projects, clients, payments, profiles, notifications, activity, onlineIds } = useData()
  const rates = useUsdRates()
  const [period, setPeriod] = useState<Period>('month')
  const [tab, setTab] = useState<'open' | 'mine' | 'mentions'>('open')
  const [remind, setRemind] = useState<Payment | null>(null)

  const open = payments.filter(isOpenPayment)
  const overdue = payments.filter((p) => effectivePaymentStatus(p) === 'overdue').sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  const since = format(periodStart(period), 'yyyy-MM-dd')
  const paidInPeriod = payments.filter((p) => p.status === 'paid' && (p.payment_date ?? '') >= since)
  const activeProjects = projects.filter(OPEN_PROJECT)
  const completedProjects = projects.filter((p) => p.status === 'completed' || p.status === 'finished')
  const inProgress = activeProjects.filter((p) => p.status === 'in_progress').length

  const openTasks = tasks.filter(OPEN_TASK)
  const myTasks = openTasks.filter((t) => t.assignee_id === me?.id)
  const mentions = notifications.filter((n) => n.type === 'mentioned' || n.type === 'mentioned_note')
  const sortTasks = (list: typeof tasks) =>
    [...list].sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || b.created_at.localeCompare(a.created_at))

  const nextWeekEnd = format(addDays(endOfWeek(new Date(), { weekStartsOn: 1 }), 7), 'yyyy-MM-dd')
  const closingSoon = activeProjects.filter((p) => p.due_date && p.due_date <= nextWeekEnd).length

  const buckets = useMemo(() => monthlyBuckets(payments, rates, 6), [payments, rates])
  const collected6 = buckets.reduce((s, b) => s + b.collected, 0)

  // Next 7 days agenda: my tasks (or all open tasks for admins) + project due dates.
  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i))
  const agenda = [
    ...(isAdmin ? openTasks : myTasks).filter((t) => t.due_date).map((t) => ({ kind: 'task' as const, id: t.id, title: t.title, date: t.due_date!, to: `/tasks/${t.id}` })),
    ...activeProjects.filter((p) => p.due_date).map((p) => ({ kind: 'project' as const, id: p.id, title: shortProjectTitle(p.title), date: p.due_date!, to: `/projects/${p.id}` })),
  ]
    .filter((a) => {
      const d = daysUntil(a.date)!
      return d >= 0 && d < 7
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const online = profiles.filter((p) => onlineIds.includes(p.id) && p.id !== me?.id)
  const recentActivity = activity.filter((a) => isAdmin || a.actor_id === me?.id).slice(0, 4)

  const overdueTotal = sumUSD(overdue, rates)
  const tabs = [
    { id: 'open' as const, label: 'All open', count: openTasks.length },
    { id: 'mine' as const, label: 'Assigned to me', count: myTasks.length },
    { id: 'mentions' as const, label: 'Mentions', count: mentions.length },
  ]
  const listed = tab === 'open' ? sortTasks(openTasks).slice(0, 8) : tab === 'mine' ? sortTasks(myTasks).slice(0, 8) : []

  return (
    <>
      <Topbar crumbs={[{ label: 'Home' }, { label: 'Dashboard' }]}>
        {isAdmin && (
          <Menu
            trigger={({ toggle }) => (
              <button type="button" className="btn" onClick={toggle}>
                <Calendar className="i" />
                {periodLabel[period]}
                <ChevronDown className="i i-sm" />
              </button>
            )}
          >
            {(Object.keys(periodLabel) as Period[]).map((p) => (
              <MenuItem key={p} on={p === period} onSelect={() => setPeriod(p)}>{periodLabel[p]}</MenuItem>
            ))}
          </Menu>
        )}
        <Menu
          trigger={({ toggle }) => (
            <button type="button" className="btn btn-pri" onClick={toggle}>
              <Plus className="i" />
              Create
            </button>
          )}
        >
          <MenuItem icon={<ListChecks className="i" />} hint={<kbd>T</kbd>} onSelect={() => openCreate('task')}>New task</MenuItem>
          <MenuItem icon={<Folder className="i" />} hint={<kbd>P</kbd>} onSelect={() => openCreate('project')}>New project</MenuItem>
          {isAdmin && <MenuItem icon={<Briefcase className="i" />} onSelect={() => openCreate('client')}>New client</MenuItem>}
          {isAdmin && (
            <>
              <MenuSep />
              <MenuItem icon={<FileText className="i" />} onSelect={() => navigate('/invoices/new')}>New invoice</MenuItem>
              <MenuItem icon={<CreditCard className="i" />} onSelect={() => openCreate('payment')}>Record payment</MenuItem>
            </>
          )}
        </Menu>
      </Topbar>
      <Content>
        <div className="ph">
          <div>
            <div className="eyebrow">{format(new Date(), 'EEEE, d MMMM yyyy')}</div>
            <h1>{greeting()}, {me ? profileDisplayName(me) : 'there'}</h1>
            <p className="greet">
              You have{' '}
              {isAdmin && overdue.length > 0 && (
                <>
                  <Link className="t-bad" to="/payments">{formatMoney(Math.round(overdueTotal))} overdue</Link> across {overdue.length} payment{overdue.length === 1 ? '' : 's'},{' '}
                </>
              )}
              <Link className="t-pri" to="/tasks">{myTasks.length} open task{myTasks.length === 1 ? '' : 's'}</Link>, and {closingSoon} project{closingSoon === 1 ? '' : 's'} closing out by next week.
            </p>
          </div>
          {online.length > 0 && (
            <Link className="row-sm small muted" to="/team">
              <AvatarStack profiles={online} size="md" />
              <span className="live" style={{ marginLeft: 4 }} />
              {online.length === 1 ? `${profileDisplayName(online[0])} is online` : `${online.length} teammates online`}
            </Link>
          )}
        </div>

        {isAdmin ? (
          <div className="kpis">
            <Link className="kpi lift" to="/payments">
              <span className="lbl">Outstanding <span className="xs">{open.length} open</span></span>
              <span className="val">{formatMoney(Math.round(sumUSD(open, rates)))}</span>
              <Spark values={buckets.map((b) => b.open + b.overdue)} color="#4F46E5" />
            </Link>
            <Link className={`kpi lift${overdue.length ? ' alert' : ''}`} to="/payments?tab=overdue">
              <span className="lbl">Overdue <span className="xs">{overdue.length} to chase</span></span>
              <span className="val">{formatMoney(Math.round(overdueTotal))}</span>
              {overdue.length > 0 ? (
                <div className="seg-bar" style={{ height: 8, marginTop: 14 }} title={overdue.map((p) => lateLabel(p.due_date)).join(', ')}>
                  {overdue.slice(0, 6).map((p, i) => (
                    <i key={p.id} style={{ flex: Math.max(1, -(daysUntil(p.due_date) ?? 0)), background: ['#E5484D', '#F08A8D', '#F7C0C1', '#FAD4D5', '#FCE4E4', '#FDEEEE'][i] }} />
                  ))}
                </div>
              ) : (
                <span className="sub">Nothing late. Nice.</span>
              )}
            </Link>
            <Link className="kpi lift" to="/analytics">
              <span className="lbl">Paid {periodLabel[period].toLowerCase()} <span className="pill ok">{paidInPeriod.length} payment{paidInPeriod.length === 1 ? '' : 's'}</span></span>
              <span className="val">{formatMoney(sumUSD(paidInPeriod, rates))}</span>
              <Spark values={buckets.map((b) => b.collected)} color="#16A34A" />
            </Link>
            <Link className="kpi lift" to="/projects">
              <span className="lbl">Active projects <span className="xs">{completedProjects.length} completed</span></span>
              <span className="val">{activeProjects.length}</span>
              <div className="seg-bar" style={{ height: 6, marginTop: 10 }}>
                <i style={{ flex: inProgress || 0.0001, background: 'var(--pri)' }} />
                <i style={{ flex: activeProjects.length - inProgress || 0.0001, background: 'var(--pri-mid)' }} />
              </div>
              <span className="sub">{inProgress} in progress · {activeProjects.length - inProgress} not started</span>
            </Link>
          </div>
        ) : (
          <div className="kpis">
            <Link className="kpi lift" to="/tasks"><span className="lbl">My open tasks</span><span className="val">{myTasks.length}</span></Link>
            <Link className="kpi lift" to="/tasks"><span className="lbl">Overdue</span><span className="val">{myTasks.filter((t) => (daysUntil(t.due_date) ?? 0) < 0).length}</span></Link>
            <Link className="kpi lift" to="/projects"><span className="lbl">Active projects</span><span className="val">{activeProjects.length}</span></Link>
            <Link className="kpi lift" to="/tasks"><span className="lbl">Done this month</span><span className="val">{tasks.filter((t) => t.assignee_id === me?.id && t.status === 'done' && (t.completed_at ?? '') >= format(startOfMonth(new Date()), 'yyyy-MM-dd')).length}</span></Link>
          </div>
        )}

        {/* Two independent columns, so a short card never leaves a gap beside a tall one. */}
        <div className="dash">
          <div className="stack-lg dash-col">
          {isAdmin && (
            <section className="card card-b dash-a">
              <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h2 className="h2">Revenue</h2>
                  <div className="row" style={{ alignItems: 'baseline', marginTop: 6 }}>
                    <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.02em' }}>{formatMoney(Math.round(collected6))}</span>
                    <span className="small muted">collected, last 6 months</span>
                  </div>
                </div>
                <div className="legend">
                  <span><i className="c-col" />Collected</span>
                  <span><i className="c-open" />Outstanding</span>
                  <Link className="link" to="/analytics">Open analytics →</Link>
                </div>
              </div>
              <RevenueChart buckets={buckets} />
            </section>
          )}
          <section className="card dash-c">
            <Tabs pad tabs={tabs} value={tab} onChange={setTab} before={<h2 className="h2">Up next</h2>} after={<Link className="link small" to="/tasks">View all</Link>} />
            <div className="list panel-in" key={tab}>
              {tab !== 'mentions' && listed.length === 0 && <Empty small icon={<ListChecks className="i" />} title="Nothing open">Create a task with <kbd>T</kbd>.</Empty>}
              {tab !== 'mentions' && listed.map((t) => <TaskRow key={t.id} task={t} />)}
              {tab === 'mentions' && mentions.length === 0 && <Empty small title="No mentions yet">When someone @mentions you, it shows up here.</Empty>}
              {tab === 'mentions' &&
                mentions.slice(0, 6).map((n) => {
                  const actor = profiles.find((p) => p.id === n.actor_id)
                  return (
                    <Link className="li" key={n.id} to={n.link ?? '/inbox'}>
                      <Avatar profile={actor} />
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="t trunc">{profileDisplayName(actor)} mentioned you {n.type === 'mentioned_note' ? 'in a note on' : 'on'} {shortProjectTitle(n.title)}</div>
                        <div className="s"><span className="trunc">“{n.excerpt}” · {formatFeedAgo(n.created_at)}</span></div>
                      </div>
                      <ChevronRight className="i faint" />
                    </Link>
                  )
                })}
            </div>
          </section>

          </div>
          <div className="stack-lg dash-col">
          {isAdmin && (
            <section className="card dash-b">
              <div className="card-h">
                <h2 className="h2">Needs chasing</h2>
                <span className="b t-bad num">{formatMoney(Math.round(overdueTotal))}</span>
              </div>
              <div className="list">
                {overdue.length === 0 && <Empty small title="All caught up">No overdue payments.</Empty>}
                {overdue.slice(0, 4).map((p) => {
                  const c = clients.find((x) => x.id === p.client_id)
                  return (
                    <div className="li" key={p.id}>
                      <ClientMark client={c} />
                      <Link className="grow cover" to={`/payments?p=${p.id}`} style={{ minWidth: 0 }}>
                        <div className="t trunc" style={{ fontSize: 13.5 }}>{clientDisplayName(c)} · {formatMoney(p.amount, p.currency)}</div>
                        <div className="s t-bad"><span className="trunc">{paymentTitle(p)} · {lateLabel(p.due_date)}</span></div>
                      </Link>
                      <button type="button" className="btn btn-sm above" onClick={() => setRemind(p)}>Remind</button>
                    </div>
                  )
                })}
              </div>
              <div className="card-f">
                <span className="muted">{overdue.length} payment{overdue.length === 1 ? '' : 's'} overdue</span>
                <Link className="link" to="/payments">All payments</Link>
              </div>
            </section>
          )}

            <section className="card card-b stack">
              <h2 className="h2">Next 7 days</h2>
              <div className="week">
                {days.map((d, i) => {
                  const items = agenda.filter((a) => isSameDay(parseISO(a.date), d))
                  return (
                    <div key={i} className={i === 0 ? 'today' : undefined} title={items.map((a) => a.title).join('\n')}>
                      <small>{format(d, 'EEE')}</small>
                      <b>{format(d, 'd')}</b>
                      {items.length > 0 && <i style={{ background: items.some((a) => a.kind === 'task') ? 'var(--warn-dot)' : 'var(--pri)' }} />}
                    </div>
                  )
                })}
              </div>
              {agenda.length === 0 && <span className="small muted">Nothing due this week.</span>}
              {agenda.slice(0, 5).map((a) => (
                <Link key={a.kind + a.id} className="ag" to={a.to} style={{ ['--c' as string]: a.kind === 'task' ? 'var(--warn-dot)' : 'var(--pri)' }}>
                  <span>
                    <b className="trunc">{a.title}</b>
                    <small>{a.kind === 'task' ? 'Task' : 'Project due'} · {format(parseISO(a.date), 'EEE d')}</small>
                  </span>
                </Link>
              ))}
            </section>
            <section className="card">
              <div className="card-h">
                <h2 className="h2">Activity</h2>
                <span className="row-sm xs t-ok"><span className="live" />Live</span>
              </div>
              <div className="card-b stack" style={{ gap: 16 }}>
                {recentActivity.length === 0 && <span className="small muted">No activity yet.</span>}
                {recentActivity.map((ev) => <ActivityItem key={ev.id} ev={ev} />)}
              </div>
              <div className="card-f">
                <span className="muted">Latest</span>
                <Link className="link" to="/inbox">Open inbox</Link>
              </div>
            </section>
                    </div>
        </div>
      </Content>
      <RemindModal payment={remind} onClose={() => setRemind(null)} />
    </>
  )
}
