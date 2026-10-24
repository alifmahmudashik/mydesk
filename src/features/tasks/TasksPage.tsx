import { useMemo, useState } from 'react'
import { addDays, endOfWeek, format } from 'date-fns'
import { AlertCircle, Calendar, ChevronDown, Clock, Filter, Folder, LayoutGrid, List, ListChecks, Plus, Search, User } from 'lucide-react'
import { useData } from '@/data/store'
import { useUI } from '@/data/ui'
import { Topbar, Content, Empty, PageHead } from '@/components/ui/layout'
import { Tabs } from '@/components/ui/tabs'
import { Menu, MenuItem, MenuSearch, MenuTitle } from '@/components/ui/menu'
import { Avatar, ClientMark } from '@/components/ui/avatar'
import { StatusRing } from '@/components/ui/pill'
import { DoneRow, TaskBoard, TaskGroup, TaskListRow } from '@/components/domain/TaskViews'
import { ClientGroup, groupByClient } from '@/components/domain/ClientGroup'
import { clientDisplayName, profileDisplayName, shortProjectTitle, taskRef } from '@/lib/derive'
import { taskStatus } from '@/lib/status'
import type { Task, TaskStatus } from '@/types'

type Group = 'client' | 'due' | 'project' | 'status' | 'assignee'
const groupLabel: Record<Group, string> = { client: 'Client', due: 'Due date', project: 'Project', status: 'Status', assignee: 'Assignee' }

function usePersisted<T extends string>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      return (localStorage.getItem(key) as T) || initial
    } catch {
      return initial
    }
  })
  return [
    v,
    (next: T) => {
      setV(next)
      try {
        localStorage.setItem(key, next)
      } catch {
        // ignore
      }
    },
  ] as const
}

export function TasksPage() {
  const { tasks, projects, clients, profiles, me } = useData()
  const { openCreate } = useUI()
  const [view, setView] = usePersisted<'list' | 'board'>('mydesk-tasks-view', 'list')
  // Default: only tasks assigned to you (new key so earlier saved 'Everyone' choices reset once).
  const [who, setWho] = usePersisted<string>('mydesk-tasks-who-v2', 'me')
  const [group, setGroup] = usePersisted<Group>('mydesk-tasks-group-v2', 'client')
  const [projectId, setProjectId] = useState('all')
  const [q, setQ] = useState('')
  const [projectQ, setProjectQ] = useState('')

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return tasks.filter((t) => {
      if (t.status === 'cancelled') return false
      if (who === 'me' && t.assignee_id !== me?.id) return false
      if (who === 'none' && t.assignee_id) return false
      if (who !== 'me' && who !== 'none' && who !== 'everyone' && t.assignee_id !== who) return false
      if (projectId !== 'all' && t.project_id !== projectId) return false
      if (query) {
        const p = projects.find((x) => x.id === t.project_id)
        if (!`${t.title} ${taskRef(t, p)} ${(t.labels ?? []).join(' ')}`.toLowerCase().includes(query)) return false
      }
      return true
    })
  }, [tasks, who, projectId, q, me?.id, projects])

  const open = filtered.filter((t) => t.status !== 'done')
  const done = filtered.filter((t) => t.status === 'done').sort((a, b) => (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at))
  const byDue = (a: Task, b: Task) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || b.created_at.localeCompare(a.created_at)

  const today = format(new Date(), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const nextWeekEnd = format(addDays(endOfWeek(new Date(), { weekStartsOn: 1 }), 7), 'yyyy-MM-dd')

  const groups: { key: string; title: string; icon?: React.ReactNode; tasks: Task[] }[] = useMemo(() => {
    const sorted = [...open].sort(byDue)
    if (group === 'client') {
      const clientOf = (t: Task) => projects.find((p) => p.id === t.project_id)?.client_id ?? ''
      return groupByClient(sorted, clientOf, clients).map((g) => ({ key: g.id, title: clientDisplayName(g.client), tasks: g.rows }))
    }
    if (group === 'due') {
      return [
        { key: 'late', title: 'Overdue', icon: <AlertCircle className="i i-sm t-bad" />, tasks: sorted.filter((t) => t.due_date && t.due_date < today) },
        { key: 'week', title: 'This week', icon: <Calendar className="i i-sm" />, tasks: sorted.filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd) },
        { key: 'next', title: 'Next week', icon: <Calendar className="i i-sm" />, tasks: sorted.filter((t) => t.due_date && t.due_date > weekEnd && t.due_date <= nextWeekEnd) },
        { key: 'later', title: 'Later', icon: <Calendar className="i i-sm" />, tasks: sorted.filter((t) => t.due_date && t.due_date > nextWeekEnd) },
        { key: 'none', title: 'No due date', icon: <Clock className="i i-sm" />, tasks: sorted.filter((t) => !t.due_date) },
      ]
    }
    if (group === 'project') {
      const ids = [...new Set(sorted.map((t) => t.project_id))]
      return ids.map((id) => {
        const p = projects.find((x) => x.id === id)
        return { key: id, title: p ? shortProjectTitle(p.title) : 'Unknown project', icon: <ClientMark client={clients.find((c) => c.id === p?.client_id)} size="xs" />, tasks: sorted.filter((t) => t.project_id === id) }
      })
    }
    if (group === 'status') {
      return (['todo', 'in_progress', 'review'] as TaskStatus[]).map((s) => ({ key: s, title: taskStatus[s].label, icon: <StatusRing status={s} />, tasks: sorted.filter((t) => t.status === s) }))
    }
    const ids = [...new Set(sorted.map((t) => t.assignee_id ?? ''))]
    return ids.map((id) => {
      const p = profiles.find((x) => x.id === id)
      return { key: id || 'none', title: p ? (p.id === me?.id ? 'Me' : profileDisplayName(p)) : 'Unassigned', icon: <Avatar profile={p} size="xs" />, tasks: sorted.filter((t) => (t.assignee_id ?? '') === id) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group, projects, profiles, clients])

  const whoLabel = who === 'everyone' ? 'Everyone' : who === 'me' ? 'Me' : who === 'none' ? 'Unassigned' : profileDisplayName(profiles.find((p) => p.id === who))
  const project = projects.find((p) => p.id === projectId)
  const projectList = projects.filter((p) => tasks.some((t) => t.project_id === p.id) && `${p.title}`.toLowerCase().includes(projectQ.toLowerCase()))

  return (
    <>
      <Topbar crumbs={[{ label: 'My tasks' }]}>
        <button type="button" className="btn btn-pri" onClick={() => openCreate('task', { project_id: projectId !== 'all' ? projectId : undefined })}>
          <Plus className="i" />New task<kbd>T</kbd>
        </button>
      </Topbar>
      <Content>
        <PageHead title="Tasks" sub="Everything on your plate across all projects." />
        <div className="tabs">
          <Tabs
            variant="seg"
            value={view}
            onChange={setView}
            tabs={[
              { id: 'list', label: <><List className="i i-sm" />List</> },
              { id: 'board', label: <><LayoutGrid className="i i-sm" />Board</> },
            ]}
          />
          <div className="row wrap" style={{ marginTop: -4 }}>
            <label className="inp-wrap" style={{ width: 260, maxWidth: '100%' }}>
              <Search className="i i-sm" />
              <input placeholder="Search tasks…" aria-label="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <Menu align="left" trigger={({ toggle }) => <button type="button" className="chip" onClick={toggle}><User className="i i-sm" />{whoLabel}<ChevronDown className="i i-xs" /></button>}>
              <MenuTitle>Assignee</MenuTitle>
              <MenuItem on={who === 'everyone'} onSelect={() => setWho('everyone')}>Everyone</MenuItem>
              <MenuItem on={who === 'me'} icon={<Avatar profile={me} size="xs" />} onSelect={() => setWho('me')}>Me</MenuItem>
              {profiles.filter((p) => p.id !== me?.id).map((p) => (
                <MenuItem key={p.id} on={who === p.id} icon={<Avatar profile={p} size="xs" />} onSelect={() => setWho(p.id)}>{profileDisplayName(p)}</MenuItem>
              ))}
              <MenuItem on={who === 'none'} icon={<Avatar size="xs" />} onSelect={() => setWho('none')}>Unassigned</MenuItem>
            </Menu>
            <Menu align="left" wide trigger={({ toggle }) => <button type="button" className="chip" onClick={toggle}><Folder className="i i-sm" /><span className="trunc" style={{ maxWidth: 200 }}>{project ? shortProjectTitle(project.title) : 'All projects'}</span><ChevronDown className="i i-xs" /></button>}>
              {projects.length > 8 && <MenuSearch value={projectQ} onChange={setProjectQ} />}
              <MenuItem on={projectId === 'all'} onSelect={() => setProjectId('all')}>All projects</MenuItem>
              {projectList.map((p) => (
                <MenuItem key={p.id} on={projectId === p.id} icon={<ClientMark client={clients.find((c) => c.id === p.client_id)} size="xs" />} onSelect={() => setProjectId(p.id)}>
                  {shortProjectTitle(p.title)} <span className="faint">· {clientDisplayName(clients.find((c) => c.id === p.client_id))}</span>
                </MenuItem>
              ))}
            </Menu>
            {view === 'list' && (
              <Menu align="left" trigger={({ toggle }) => <button type="button" className="chip" onClick={toggle}><Filter className="i i-sm" />Group: {groupLabel[group]}<ChevronDown className="i i-xs" /></button>}>
                {(Object.keys(groupLabel) as Group[]).map((g) => (
                  <MenuItem key={g} on={g === group} onSelect={() => setGroup(g)}>{groupLabel[g]}</MenuItem>
                ))}
              </Menu>
            )}
          </div>

          {view === 'list' ? (
            <div className="stack-lg panel-in">
              {open.length === 0 && done.length === 0 && (
                <div className="card">
                  <Empty icon={<ListChecks className="i" />} title={tasks.length ? 'No tasks match' : 'No tasks yet'} action={<button type="button" className="btn btn-pri" onClick={() => openCreate('task')}><Plus className="i" />New task</button>}>
                    {tasks.length ? 'Try a different filter.' : 'Tasks live inside projects. Create one to get going.'}
                  </Empty>
                </div>
              )}
              {open.length === 0 && done.length > 0 && <div className="card"><Empty small title="All clear">Nothing open here.</Empty></div>}
              {group === 'client' && open.length > 0 && (
                <div className="client-groups">
                  {groups.map((g) => {
                    const lateN = g.tasks.filter((t) => t.due_date && t.due_date < today).length
                    return (
                      <ClientGroup
                        key={g.key}
                        client={clients.find((c) => c.id === g.key)}
                        meta={`${g.tasks.length} open task${g.tasks.length === 1 ? '' : 's'} \u00b7 ${new Set(g.tasks.map((t) => t.project_id)).size} project${new Set(g.tasks.map((t) => t.project_id)).size === 1 ? '' : 's'}${lateN ? ` \u00b7 ${lateN} overdue` : ''}`}
                      >
                        <div className="list">{g.tasks.map((t) => <TaskListRow key={t.id} task={t} showClient={false} />)}</div>
                      </ClientGroup>
                    )
                  })}
                </div>
              )}
              {group !== 'client' && groups.map((g) => (
                <TaskGroup key={g.key} icon={g.icon} title={g.title} tasks={g.tasks} />
              ))}
              <TaskGroup collapsible defaultOpen={false} icon={<span className="st done" />} title="Wrapped up" tasks={done.slice(0, 50)} render={(t) => <DoneRow key={t.id} task={t} />} />
            </div>
          ) : (
            <div className="panel-in">
              <TaskBoard tasks={[...open, ...done.slice(0, 20)].sort(byDue)} projectId={projectId !== 'all' ? projectId : undefined} />
            </div>
          )}
        </div>
      </Content>
    </>
  )
}
