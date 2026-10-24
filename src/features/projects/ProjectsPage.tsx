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
import { ClientGroup, groupByClient } from '@/components/domain/ClientGroup'
import { clientDisplayName, effectivePaymentStatus, OPEN_PROJECT, sumByCurrency } from '@/lib/derive'
import { formatDate, formatMoney, isOverdue } from '@/lib/format'
import { paymentStatus, projectStatus } from '@/lib/status'
import type { Profile, Project } from '@/types'

const PER_CLIENT = 6

export function ProjectsPage() {
  const isAdmin = useIsAdmin()
  const { projects, clients, tasks, profiles, clientMembers, payments } = useData()
  const { openCreate } = useUI()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as 'active' | 'done') || 'active'
  const [q, setQ] = useState('')
  const [clientId, setClientId] = useState(params.get('client') ?? 'all')
  const [clientQ, setClientQ] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const matches = (p: Project) => {
    if (clientId !== 'all' && p.client_id !== clientId) return false
    const c = clients.find((x) => x.id === p.client_id)
    return !q.trim() || `${p.title} ${clientDisplayName(c)} ${p.project_type ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())
  }
  const active = useMemo(() => projects.filter((p) => OPEN_PROJECT(p) && matches(p)).sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')), [projects, q, clientId, clients]) // eslint-disable-line react-hooks/exhaustive-deps
  const done = useMemo(
    () => projects.filter((p) => !OPEN_PROJECT(p) && matches(p)).sort((a, b) => (b.completed_at ?? b.due_date ?? b.created_at).localeCompare(a.completed_at ?? a.due_date ?? a.created_at)),
    [projects, q, clientId, clients], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const allActive = projects.filter(OPEN_PROJECT).length
  const list = tab === 'active' ? active : done
  // Clients with the soonest deadline (active) or most recent work (completed) first.
  const groups = groupByClient(list, (p) => p.client_id, clients)

  const team = (p: Project): Profile[] => {
    const granted = new Set(clientMembers.filter((m) => m.client_id === p.client_id).map((m) => m.user_id))
    const assignees = new Set(tasks.filter((t) => t.project_id === p.id && t.assignee_id).map((t) => t.assignee_id!))
    return profiles.filter((u) => granted.has(u.id) || assignees.has(u.id))
  }

  const usedClients = clients.filter((c) => projects.some((p) => p.client_id === c.id) && clientDisplayName(c).toLowerCase().includes(clientQ.toLowerCase()))
  const client = clients.find((c) => c.id === clientId)

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const projectCell = (p: Project) => (
    <td>
      <Link className="m cover" to={`/projects/${p.id}`} style={{ display: 'block' }}>{p.title}</Link>
      {p.project_type && <span className="xs muted">{p.project_type}</span>}
    </td>
  )

  return (
    <>
      <Topbar crumbs={[{ label: 'Projects' }]}>
        <button type="button" className="btn btn-pri" onClick={() => openCreate('project', { client_id: clientId !== 'all' ? clientId : undefined })}>
          <Plus className="i" />New project<kbd>P</kbd>
        </button>
      </Topbar>
      <Content>
        <PageHead title="Projects" sub="Every engagement, where it stands, and what it's worth, grouped by client." />
        <div className="tabs">
          <Tabs
            value={tab}
            onChange={(t) => setParams(t === 'active' ? {} : { tab: t }, { replace: true })}
            tabs={[
              { id: 'active', label: 'Active', count: allActive },
              { id: 'done', label: 'Completed', count: projects.length - allActive },
            ]}
            after={
              <>
                <label className="inp-wrap hide-sm" style={{ width: 220, height: 32 }}>
                  <Search className="i i-sm" />
                  <input placeholder="Search projects…" aria-label="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
                </label>
                <Menu
                  wide
                  className="hide-sm"
                  trigger={({ toggle: t }) => (
                    <button type="button" className="chip" style={{ marginLeft: 6 }} onClick={t}>
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
          <div className="panel-in" key={tab}>
            {list.length === 0 ? (
              <div className="card">
                <Empty
                  icon={<Folder className="i" />}
                  title={projects.length === 0 ? 'No projects yet' : 'Nothing here'}
                  action={projects.length === 0 ? <button type="button" className="btn btn-pri" onClick={() => openCreate('project')}><Plus className="i" />New project</button> : undefined}
                >
                  {projects.length === 0 ? 'A project groups the tasks, notes and money for one engagement.' : 'Try another search or client.'}
                </Empty>
              </div>
            ) : (
              <div className="client-groups">
                {groups.map((g) => {
                  const rows = expanded.has(g.id) ? g.rows : g.rows.slice(0, PER_CLIENT)
                  const budget = g.rows.filter((p) => p.amount > 0 && p.billing_type !== 'retainer')
                  const lateN = tab === 'active' ? g.rows.filter((p) => isOverdue(p.due_date)).length : 0
                  return (
                    <ClientGroup
                      key={g.id}
                      client={g.client}
                      meta={`${g.rows.length} ${tab === 'active' ? 'active' : 'completed'} project${g.rows.length === 1 ? '' : 's'}${lateN ? ` · ${lateN} past due` : ''}`}
                      right={
                        <>
                          {isAdmin && budget.length > 0 && <span className="group-total">{sumByCurrency(budget)}</span>}
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => openCreate('project', { client_id: g.id })} title="New project for this client"><Plus className="i i-sm" /></button>
                        </>
                      }
                    >
                      <div className="tbl-wrap">
                        {tab === 'active' ? (
                          <table className="tbl" style={{ minWidth: 820 }}>
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
                              {rows.map((p) => {
                                const pt = tasks.filter((t) => t.project_id === p.id && t.status !== 'cancelled')
                                const d = pt.filter((t) => t.status === 'done').length
                                return (
                                  <tr key={p.id} className="hov">
                                    {projectCell(p)}
                                    <td><StatusPill meta={projectStatus[p.status]} /></td>
                                    <td>
                                      <div className="row">
                                        <div className="bar grow"><i className={pt.length && d === pt.length ? 'ok' : undefined} style={{ width: `${pt.length ? (d / pt.length) * 100 : 0}%` }} /></div>
                                        <span className="xs muted num">{d}/{pt.length}</span>
                                      </div>
                                    </td>
                                    <td><AvatarStack profiles={team(p)} /></td>
                                    <td className={isOverdue(p.due_date) ? 't-bad m' : undefined}>{formatDate(p.due_date)}</td>
                                    {isAdmin && <td className={`r num ${p.billing_type === 'retainer' ? 'muted' : 'b'}`}>{p.billing_type === 'retainer' && !p.amount ? 'Retainer' : p.amount ? formatMoney(p.amount, p.currency) : '—'}</td>}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        ) : (
                          <table className="tbl" style={{ minWidth: 700 }}>
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
                              {rows.map((p) => {
                                const linked = payments.filter((x) => x.project_ids?.includes(p.id))
                                const order = ['overdue', 'unpaid', 'partial', 'paid', 'refunded']
                                const st = linked.length ? linked.map(effectivePaymentStatus).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] : null
                                return (
                                  <tr key={p.id} className="hov">
                                    {projectCell(p)}
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
                      </div>
                      {g.rows.length > PER_CLIENT && (
                        <div className="card-f">
                          <span className="muted">{expanded.has(g.id) ? `All ${g.rows.length} projects` : `${g.rows.length - PER_CLIENT} more`}</span>
                          <button type="button" className="link-btn" onClick={() => toggle(g.id)}>{expanded.has(g.id) ? 'Show less' : 'Show all'}</button>
                        </div>
                      )}
                    </ClientGroup>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </Content>
    </>
  )
}
