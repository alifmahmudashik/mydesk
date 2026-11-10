import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Play, Plus, Square, X } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { deleteTimeEntry, discardTimer, logTime, startTimer, stopTimer } from '@/data/actions'
import { Modal } from '@/components/ui/modal'
import { Field, Select } from '@/components/ui/field'
import { DateInput } from '@/components/ui/date-picker'
import { Avatar } from '@/components/ui/avatar'
import { Empty } from '@/components/ui/layout'
import { profileDisplayName, shortProjectTitle, taskRef } from '@/lib/derive'
import { formatDate, formatMinutes, formatMoney, parseDuration, todayISO } from '@/lib/format'
import type { Project, TimeEntry, TimeTimer } from '@/types'

/** 3723000 → "1:02:03" */
export function formatClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** Re-renders every second while a timer is running. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

function useMyTimer(): TimeTimer | undefined {
  const me = useData((s) => s.me?.id)
  return useData((s) => s.timers.find((t) => t.user_id === me))
}

/**
 * Log time by hand. From a task it logs on that task; from a project you can pick one of
 * its tasks or leave it on the project itself.
 */
export function LogTimeModal({ open, onClose, projectId, taskId }: { open: boolean; onClose: () => void; projectId: string; taskId?: string | null }) {
  const tasks = useData((s) => s.tasks)
  const [f, setF] = useState({ duration: '', date: todayISO(), note: '', task: taskId ?? '' })
  useEffect(() => {
    if (open) setF({ duration: '', date: todayISO(), note: '', task: taskId ?? '' })
  }, [open, taskId])
  const projectTasks = tasks.filter((t) => t.project_id === projectId && t.status !== 'cancelled').sort((a, b) => (b.number ?? 0) - (a.number ?? 0))
  const save = () => {
    const minutes = parseDuration(f.duration)
    if (!minutes) return toast.error('Enter time like “1h 30m”, “45m” or “1.5”')
    logTime({ projectId, taskId: f.task || null, minutes, date: f.date, note: f.note })
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
            <DateInput value={f.date} onChange={(v) => setF({ ...f, date: v ?? todayISO() })} clearable={false} />
          </Field>
        </div>
        {!taskId && (
          <Field label="Task" hint="Leave on the project if it wasn’t for one task.">
            <Select
              value={f.task}
              onChange={(e) => setF({ ...f, task: e.target.value })}
              options={[{ value: '', label: 'No task (the project itself)' }, ...projectTasks.map((t) => ({ value: t.id, label: t.title }))]}
            />
          </Field>
        )}
        <Field label="Note">
          <input className="inp" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="What did you work on?" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

/** Start / stop a timer for a task or a project. */
export function TimerButton({ projectId, taskId, small }: { projectId: string; taskId?: string | null; small?: boolean }) {
  const ready = useData((s) => s.accessV2Ready)
  const timer = useMyTimer()
  const here = Boolean(timer && timer.project_id === projectId && (timer.task_id ?? null) === (taskId ?? null))
  const now = useNow(here)
  if (!ready) return null
  const cls = `btn btn-sm${here ? ' btn-pri' : ''}`
  const style = small ? { height: 24, fontSize: 11.5 } : undefined
  return here && timer ? (
    <button type="button" className={cls} style={style} onClick={() => stopTimer(timer)} title="Stop and log this time">
      <Square className="i i-xs" />
      <span className="num">{formatClock(now - new Date(timer.started_at).getTime())}</span>
    </button>
  ) : (
    <button
      type="button"
      className={cls}
      style={style}
      title={timer ? 'Stops your other timer (and logs it) first' : 'Start a timer'}
      onClick={() => startTimer(projectId, taskId)}
    >
      <Play className="i i-xs" />
      Start timer
    </button>
  )
}

/** Sidebar strip while your timer runs, so you can stop it from anywhere. */
export function RunningTimer() {
  const timer = useMyTimer()
  const now = useNow(Boolean(timer))
  const task = useData((s) => s.tasks.find((t) => t.id === timer?.task_id))
  const project = useData((s) => s.projects.find((p) => p.id === timer?.project_id))
  if (!timer) return null
  const to = task ? `/tasks/${task.id}` : `/projects/${timer.project_id}`
  return (
    <div className="run-timer" role="status">
      <span className="live" />
      <Link to={to} className="grow trunc" title={task?.title ?? project?.title}>
        <b className="num">{formatClock(now - new Date(timer.started_at).getTime())}</b>
        <small className="trunc">{task?.title ?? (project ? shortProjectTitle(project.title) : 'Timer')}</small>
      </Link>
      <button type="button" className="btn btn-sm btn-icon" aria-label="Stop timer and log time" title="Stop and log" onClick={() => stopTimer(timer)}><Square className="i i-xs" /></button>
      <button type="button" className="btn btn-sm btn-icon btn-ghost" aria-label="Discard timer" title="Discard (log nothing)" onClick={() => discardTimer(timer)}><X className="i i-xs" /></button>
    </div>
  )
}

/** One time entry row. */
export function TimeEntryRow({ entry, showTask }: { entry: TimeEntry; showTask?: boolean }) {
  const me = useData((s) => s.me)
  const who = useData((s) => s.profiles.find((p) => p.id === entry.user_id))
  const task = useData((s) => (entry.task_id ? s.tasks.find((t) => t.id === entry.task_id) : undefined))
  const project = useData((s) => s.projects.find((p) => p.id === entry.project_id))
  const canDelete = entry.user_id === me?.id || me?.role !== 'member'
  return (
    <div className="row-sm time-row">
      <Avatar profile={who} size="xs" />
      <span className="grow trunc muted">
        {formatDate(entry.logged_on)}
        {who ? ` · ${profileDisplayName(who)}` : ''}
        {showTask && (task ? <> · <Link className="link" to={`/tasks/${task.id}`}>{taskRef(task, project) || task.title}</Link> {task.title}</> : ' · Project')}
        {entry.note ? ` · ${entry.note}` : ''}
      </span>
      <b className="m">{formatMinutes(entry.minutes)}</b>
      {canDelete && (
        <button type="button" className="btn btn-ghost btn-sm btn-icon" style={{ width: 22, height: 22 }} aria-label="Delete entry" onClick={() => deleteTimeEntry(entry)}>
          <X className="i i-xs" />
        </button>
      )}
    </div>
  )
}

/** The project's Time tab: totals, timer, logging, and every entry (project and tasks). */
export function ProjectTimePanel({ project }: { project: Project }) {
  const me = useData((s) => s.me)
  const timeEntries = useData((s) => s.timeEntries)
  const ready = useData((s) => s.accessV2Ready)
  const [logOpen, setLogOpen] = useState(false)
  const entries = timeEntries
    .filter((e) => e.project_id === project.id)
    .sort((a, b) => b.logged_on.localeCompare(a.logged_on) || b.created_at.localeCompare(a.created_at))
  const total = entries.reduce((s, e) => s + (Number(e.minutes) || 0), 0)
  const month = todayISO().slice(0, 7)
  const thisMonth = entries.filter((e) => e.logged_on.startsWith(month)).reduce((s, e) => s + (Number(e.minutes) || 0), 0)
  const mine = entries.filter((e) => e.user_id === me?.id).reduce((s, e) => s + (Number(e.minutes) || 0), 0)
  const onProject = entries.filter((e) => !e.task_id).reduce((s, e) => s + (Number(e.minutes) || 0), 0)
  const isAdmin = me?.role !== 'member'
  const hourly = project.billing_type === 'hourly'
  const rate = project.hourly_rate != null ? Number(project.hourly_rate) : null

  return (
    <div className="content narrow" style={{ paddingTop: 20 }}>
      {!ready && <p className="small muted">Run <b>supabase/schema.sql</b> in the Supabase SQL editor to log time on the project itself and use timers.</p>}
      <div className="kstrip">
        <div><div className="xs muted">Total logged</div><div className="val" style={{ fontSize: 20 }}>{formatMinutes(total)}</div></div>
        <div><div className="xs muted">This month</div><div className="val" style={{ fontSize: 20 }}>{formatMinutes(thisMonth)}</div></div>
        {isAdmin && hourly ? (
          <div>
            <div className="xs muted">{rate != null ? `Billable at ${formatMoney(rate, project.currency)}/h` : 'Billable'}</div>
            <div className="val priv" style={{ fontSize: 20 }}>{rate != null ? formatMoney(Number(project.amount) || 0, project.currency) : <span className="small muted m">Set an hourly rate</span>}</div>
          </div>
        ) : (
          <div><div className="xs muted">By you</div><div className="val" style={{ fontSize: 20 }}>{formatMinutes(mine)}</div></div>
        )}
      </div>
      <div className="row wrap">
        <span className="small muted">{onProject ? `${formatMinutes(onProject)} on the project, ${formatMinutes(total - onProject)} on tasks` : 'Log time on the project here, or on a task from the task page.'}</span>
        <span className="spacer" />
        <TimerButton projectId={project.id} />
        <button type="button" className="btn btn-sm" onClick={() => setLogOpen(true)}><Plus className="i i-sm" />Log time</button>
      </div>
      <div className="card card-b">
        {entries.length === 0 ? (
          <Empty small icon={<Clock className="i" />} title="No time logged yet">Start a timer or log time by hand. Time on tasks shows up here too.</Empty>
        ) : (
          <div className="stack-sm small">
            {entries.map((e) => <TimeEntryRow key={e.id} entry={e} showTask />)}
          </div>
        )}
      </div>
      <LogTimeModal open={logOpen} onClose={() => setLogOpen(false)} projectId={project.id} />
    </div>
  )
}
