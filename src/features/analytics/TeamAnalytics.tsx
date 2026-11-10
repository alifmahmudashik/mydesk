import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '@/data/store'
import { Avatar, AvatarStack, ClientMark } from '@/components/ui/avatar'
import { StatusPill } from '@/components/ui/pill'
import { toUSD } from '@/lib/currency'
import { clientDisplayName, isAssignedTo, OPEN_TASK, profileDisplayName, projectWorkDate } from '@/lib/derive'
import { formatMoney, isOverdue } from '@/lib/format'
import { projectStatus } from '@/lib/status'
import type { Project } from '@/types'

const isDone = (p: Project) => p.status === 'completed' || p.status === 'finished'
const hours = (min: number) => (min >= 600 ? `${Math.round(min / 60)}h` : `${Math.round((min / 60) * 10) / 10}h`)

/**
 * Who did what: per person, the projects they worked on (anyone assigned to a task in the
 * project counts), what they finished, hours logged, and their share of project value.
 * Projects count in the range by their work month, like the rest of Analytics.
 */
export function TeamAnalytics({ since, rangeText, rates }: { since: string; rangeText: string; rates: Record<string, number> | null }) {
  const { profiles, tasks, projects, clients, timeEntries, me } = useData()

  const data = useMemo(() => {
    const rangeProjects = projects.filter((p) => projectWorkDate(p) >= since).sort((a, b) => projectWorkDate(b).localeCompare(projectWorkDate(a)))
    const liveTasks = tasks.filter((t) => t.status !== 'cancelled')
    const people = new Map(
      rangeProjects.map((p) => [p.id, profiles.filter((u) => liveTasks.some((t) => t.project_id === p.id && isAssignedTo(t, u.id)))]),
    )
    // A project's time: logged on the project itself or on any of its tasks.
    const minutesOn = (projectId: string, taskIds: Set<string>) =>
      timeEntries.filter((e) => (e.project_id === projectId || taskIds.has(e.task_id ?? '')) && e.logged_on >= since).reduce((s, e) => s + (Number(e.minutes) || 0), 0)

    const rows = profiles
      .map((u) => {
        const projs = rangeProjects.filter((p) => people.get(p.id)!.some((x) => x.id === u.id))
        const mine = tasks.filter((t) => isAssignedTo(t, u.id))
        const finished = mine.filter((t) => t.status === 'done' && (t.completed_at ?? '').slice(0, 10) >= since)
        const withDue = finished.filter((t) => t.due_date)
        const onTime = withDue.filter((t) => t.completed_at!.slice(0, 10) <= t.due_date!).length
        const open = mine.filter(OPEN_TASK)
        const minutes = timeEntries.filter((e) => e.user_id === u.id && e.logged_on >= since).reduce((s, e) => s + (Number(e.minutes) || 0), 0)
        // A project's value is split evenly between everyone who worked on it.
        const value = projs.reduce((s, p) => s + toUSD(Number(p.amount) || 0, p.currency, rates) / Math.max(1, people.get(p.id)!.length), 0)
        return {
          user: u,
          projects: projs,
          completed: projs.filter(isDone).length,
          clients: new Set(projs.map((p) => p.client_id)).size,
          finished: finished.length,
          onTimePct: withDue.length ? Math.round((onTime / withDue.length) * 100) : null,
          open: open.length,
          late: open.filter((t) => isOverdue(t.due_date)).length,
          minutes,
          value,
        }
      })
      .filter((r) => r.projects.length || r.finished || r.open || r.minutes)
      .sort((a, b) => b.projects.length - a.projects.length || b.finished - a.finished)

    const projectRows = rangeProjects.map((p) => {
      const pt = liveTasks.filter((t) => t.project_id === p.id)
      return {
        project: p,
        client: clients.find((c) => c.id === p.client_id),
        people: people.get(p.id)!,
        done: pt.filter((t) => t.status === 'done').length,
        total: pt.length,
        minutes: minutesOn(p.id, new Set(pt.map((t) => t.id))),
      }
    })
    return { rows, projectRows, unstaffed: projectRows.filter((r) => r.people.length === 0).length }
  }, [projects, tasks, profiles, clients, timeEntries, since, rates])

  const meRow = data.rows.find((r) => r.user.id === me?.id)
  const topValue = Math.max(...data.rows.map((r) => r.value), 1)

  return (
    <div className="stack-lg panel-in">
      {meRow && (
        <div className="kpis">
          <div className="kpi"><span className="lbl">Your projects</span><span className="val">{meRow.projects.length}</span><span className="sub">{meRow.completed} completed · {meRow.clients} client{meRow.clients === 1 ? '' : 's'}</span></div>
          <div className="kpi"><span className="lbl">Tasks you finished</span><span className="val">{meRow.finished}</span><span className="sub">{meRow.onTimePct === null ? 'No due dates to compare' : `${meRow.onTimePct}% on time`}{meRow.late ? ` · ${meRow.late} late now` : ''}</span></div>
          <div className="kpi"><span className="lbl">Hours you logged</span><span className="val">{hours(meRow.minutes)}</span><span className="sub">{meRow.open} open task{meRow.open === 1 ? '' : 's'} right now</span></div>
          <div className="kpi"><span className="lbl">Your share of project value</span><span className="val">{formatMoney(Math.round(meRow.value))}</span><span className="sub">split between everyone on each project</span></div>
        </div>
      )}

      <section className="card">
        <div className="card-h">
          <div>
            <h2 className="h2">Who did what</h2>
            <span className="xs muted">{rangeText} · anyone assigned to a task in a project counts as working on it</span>
          </div>
        </div>
        {data.rows.length === 0 ? (
          <div className="empty sm"><p>No assigned work in this range yet. Assign people to tasks to see who did what.</p></div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Person</th>
                  <th className="r" style={{ width: 90 }}>Projects</th>
                  <th className="r" style={{ width: 100 }}>Completed</th>
                  <th className="r" style={{ width: 100 }}>Tasks done</th>
                  <th className="r" style={{ width: 90 }}>On time</th>
                  <th className="r" style={{ width: 100 }}>Open (late)</th>
                  <th className="r" style={{ width: 80 }}>Hours</th>
                  <th style={{ width: '24%' }}>Share of project value</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.user.id} className="hov">
                    <td>
                      <Link className="row-sm m cover" to={`/team/${r.user.id}`}>
                        <Avatar profile={r.user} size="sm" />
                        {profileDisplayName(r.user)}
                        {r.user.id === me?.id && <span className="pill">You</span>}
                      </Link>
                    </td>
                    <td className="r num b">{r.projects.length}</td>
                    <td className="r num">{r.completed}</td>
                    <td className="r num">{r.finished}</td>
                    <td className="r num">{r.onTimePct === null ? '—' : `${r.onTimePct}%`}</td>
                    <td className="r num">{r.open}{r.late ? <span className="t-bad"> ({r.late})</span> : ''}</td>
                    <td className="r num">{hours(r.minutes)}</td>
                    <td>
                      <div className="row">
                        <div className="bar lg grow"><i style={{ width: `${Math.max(r.value ? 3 : 0, (r.value / topValue) * 100)}%` }} /></div>
                        <span className="num small priv" style={{ width: 64, textAlign: 'right' }}>{formatMoney(Math.round(r.value))}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-h">
          <div>
            <h2 className="h2">Who worked on each project</h2>
            <span className="xs muted">{data.projectRows.length} project{data.projectRows.length === 1 ? '' : 's'} · {rangeText}{data.unstaffed ? ` · ${data.unstaffed} with nobody assigned` : ''}</span>
          </div>
        </div>
        {data.projectRows.length === 0 ? (
          <div className="empty sm"><p>No projects in this range.</p></div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th>Project</th>
                  <th style={{ width: 170 }}>Client</th>
                  <th style={{ width: 150 }}>Status</th>
                  <th style={{ width: 140 }}>People</th>
                  <th className="r" style={{ width: 90 }}>Tasks</th>
                  <th className="r" style={{ width: 80 }}>Hours</th>
                </tr>
              </thead>
              <tbody>
                {data.projectRows.slice(0, 30).map((r) => (
                  <tr key={r.project.id} className="hov">
                    <td><Link className="m cover" to={`/projects/${r.project.id}`}>{r.project.title}</Link></td>
                    <td><span className="row-sm"><ClientMark client={r.client} size="xs" /><span className="trunc">{clientDisplayName(r.client)}</span></span></td>
                    <td><StatusPill meta={projectStatus[r.project.status]} /></td>
                    <td>{r.people.length ? <AvatarStack profiles={r.people} /> : <span className="xs faint">Nobody</span>}</td>
                    <td className="r small muted">{r.done}/{r.total}</td>
                    <td className="r small muted">{r.minutes ? hours(r.minutes) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.projectRows.length > 30 && <div className="card-f"><span className="muted">Showing the 30 newest of {data.projectRows.length}.</span></div>}
      </section>
    </div>
  )
}
