import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, Folder, Plus, Search } from 'lucide-react'
import { useData } from '@/data/store'
import { useUI } from '@/data/ui'
import { useIsAdmin } from '@/hooks/usePermissions'
import { Topbar, Content, Empty, PageHead } from '@/components/ui/layout'
import { Tabs } from '@/components/ui/tabs'
import { Menu, MenuItem, MenuSearch } from '@/components/ui/menu'
import { AvatarStack, ClientMark } from '@/components/ui/avatar'
import { StatusPill } from '@/components/ui/pill'
import { clientDisplayName, effectivePaymentStatus, OPEN_PROJECT } from '@/lib/derive'
import { formatDate, formatMoney, isOverdue } from '@/lib/format'
import { paymentStatus, projectStatus } from '@/lib/status'
import type { Profile, Project } from '@/types'

const PAGE = 25

export function ProjectsPage() {
  const isAdmin = useIsAdmin()
  const { projects, clients, tasks, profiles, clientMembers, payments } = useData()
  const { openCreate } = useUI()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as 'active' | 'done') || 'active'
  const [q, setQ] = useState('')
  const [clientId, setClientId] = useState(params.get('client') ?? 'all')
  const [clientQ, setClientQ] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const matches = (p: Project) => {
    if (clientId !== 'all' && p.client_id !== clientId) return false
    const c = clients.find((x) => x.id === p.client_id)
    return !q.trim() || `${p.title} ${clientDisplayName(c)} ${p.project_type ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())
  }
  const active = useMemo(() => projects.filter((p) => OPEN_PROJECT(p) && matches(p)).sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')), [projects, q, clientId, clients])
  const done = useMemo(
    () => projects.filter((p) => !OPEN_PROJECT(p) && matches(p)).sort((a, b) => (b.completed_at ?? b.due_date ?? b.created_at).localeCompare(a.completed_at ?? a.due_date ?? a.created_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, q, clientId, clients],
  )
  const allActive = projects.filter(OPEN_PROJECT).length

  const team = (p: Project): Profile[] => {
    const granted = new Set(clientMembers.filter((m) => m.client_id === p.client_id).map((m) => m.user_id))
    const assignees = new Set(tasks.filter((t) => t.project_id === p.id && t.assignee_id).map((t) => t.assignee_id!))
    return profiles.filter((u) => granted.has(u.id) || assignees.has(u.id))
  }

  const usedClients = clients.filter((c) => projects.some((p) => p.client_id === c.id) && clientDisplayName(c).toLowerCase().includes(clientQ.toLowerCase()))
  const client = clients.find((c) => c.id === clientId)
  const list = tab === 'active' ? active : done

  return (
    <>
      <Topbar crumbs={[{ label: 'Projects' }]}>
        <button type="button" className="btn btn-pri" onClick={() => openCreate('project', { client_id: clientId !== 'all' ? clientId : undefined })}>
          <Plus className="i" />New project<kbd>P</kbd>
        </button>
      </Topbar>
      <Content>
        <PageHead title="Projects" sub="Every engagement, where it stands, and what it's worth." />
        <div className="tabs">
          <Tabs
            value={tab}
            onChange={(t) => {
              setParams(t === 'active' ? {} : { tab: t }, { replace: true })
              setLimit(PAGE)
            }}
            tabs={[
              { id: 'active', label: 'Active', count: allActive },
              { id: 'done', label: 'Completed', count: projects.length - allActive },
            ]}
            after={
              <>
                <label className="inp-wrap hide-sm" style={{ width: 220, height: 32, marginBottom: 6 }}>
                  <Search className="i i-sm" />
                  <input placeholder="Search projects…" aria-label="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
                </label>
                <Menu
                  wide
                  className="hide-sm"
                  trigger={({ toggle }) => (
                    <button type="button" className="chip" style={{ margin: '0 0 6px 6px' }} onClick={toggle}>
                      {client ? <><ClientMark client={client} size="xs" />{clientDisplayName(client)}</> : 'All clients'}
                      <ChevronDown className="i i-xs" />
                    </button>
                  )}
                >
                  {clients.length > 8 && <MenuSearch value={clientQ} onChange={setClientQ} />}
                  <MenuItem on={clientId === 'all'} onSelect={() => setClientId('all')}>All clients</MenuItem>
                  {usedClients.map((c) => (
                    <MenuItem key={c.id} on={clientId === c.id} icon={<ClientMark client={c} size="xs" />} onSelect={() => setClientId(c.id)}>{clientDisplayName(c)}</MenuItem>
                  ))}
                </Menu>
              </>
            }
          />
          <div className="card tbl-wrap panel-in" key={tab}>
            {list.length === 0 ? (
              <Empty
                icon={<Folder className="i" />}
                title={projects.length === 0 ? 'No projects yet' : 'Nothing here'}
                action={projects.length === 0 ? <button type="button" className="btn btn-pri" onClick={() => openCreate('project')}><Plus className="i" />New project</button> : undefined}
              >
                {projects.length === 0 ? 'A project groups the tasks, notes and money for one engagement.' : 'Try another search or client.'}
              </Empty>
            ) : tab === 'active' ? (
              <table className="tbl" style={{ minWidth: 880 }}>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Status</th>
                    <th style={{ width: 160 }}>Progress</th>
                    <th>Team</th>
                    <th>Due</th>
                    {isAdmin && <th className="r">Amount</th>}
                  </tr>
                </thead>
                <tbody>
                  {list.slice(0, limit).map((p) => {
                    const c = clients.find((x) => x.id === p.client_id)
                    const pt = tasks.filter((t) => t.project_id === p.id && t.status !== 'cancelled')
                    const d = pt.filter((t) => t.status === 'done').length
                    const pct = pt.length ? (d / pt.length) * 100 : 0
                    const late = isOverdue(p.due_date)
                    return (
                      <tr key={p.id} className="hov">
                        <td>
                          <Link className="row cover" to={`/projects/${p.id}`}>
                            <ClientMark client={c} />
                            <span style={{ minWidth: 0 }}>
                              <span className="m" style={{ display: 'block' }}>{p.title}</span>
                              <span className="xs muted">{clientDisplayName(c)}</span>
                            </span>
                          </Link>
                        </td>
                        <td><StatusPill meta={projectStatus[p.status]} /></td>
                        <td>
                          <div className="row">
                            <div className="bar grow"><i className={pt.length && d === pt.length ? 'ok' : undefined} style={{ width: `${pct}%` }} /></div>
                            <span className="xs muted num">{d}/{pt.length}</span>
                          </div>
                        </td>
                        <td><AvatarStack profiles={team(p)} /></td>
                        <td className={late ? 't-bad m' : undefined}>{formatDate(p.due_date)}</td>
                        {isAdmin && <td className={`r num ${p.billing_type === 'retainer' ? 'muted' : 'b'}`}>{p.billing_type === 'retainer' ? 'Retainer' : p.amount ? formatMoney(p.amount, p.currency) : '—'}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <table className="tbl" style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Completed</th>
                    <th>Status</th>
                    {isAdmin && <th>Payment</th>}
                    {isAdmin && <th className="r">Amount</th>}
                  </tr>
                </thead>
                <tbody>
                  {list.slice(0, limit).map((p) => {
                    const c = clients.find((x) => x.id === p.client_id)
                    const linked = payments.filter((x) => x.project_ids?.includes(p.id))
                    const st = linked.length ? linked.map(effectivePaymentStatus).sort((a, b) => ['overdue', 'unpaid', 'partial', 'paid', 'refunded'].indexOf(a) - ['overdue', 'unpaid', 'partial', 'paid', 'refunded'].indexOf(b))[0] : null
                    return (
                      <tr key={p.id} className="hov">
                        <td>
                          <Link className="row cover" to={`/projects/${p.id}`}>
                            <ClientMark client={c} />
                            <span style={{ minWidth: 0 }}>
                              <span className="m" style={{ display: 'block' }}>{p.title}</span>
                              <span className="xs muted">{clientDisplayName(c)}</span>
                            </span>
                          </Link>
                        </td>
                        <td>{formatDate((p.completed_at ?? p.due_date ?? p.created_at).slice(0, 10))}</td>
                        <td>{p.archived_at ? <span className="pill gray">Archived</span> : <StatusPill meta={projectStatus[p.status]} />}</td>
                        {isAdmin && <td>{st ? <StatusPill meta={paymentStatus[st]} /> : <span className="faint xs">—</span>}</td>}
                        {isAdmin && <td className="r num b">{p.amount ? formatMoney(p.amount, p.currency) : '—'}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {list.length > limit && (
              <div className="card-f">
                <span className="muted">Showing {limit} of {list.length}</span>
                <button type="button" className="btn btn-sm" onClick={() => setLimit((l) => l + PAGE)}>Load more</button>
              </div>
            )}
          </div>
        </div>
      </Content>
    </>
  )
}
