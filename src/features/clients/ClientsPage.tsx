import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Briefcase, LayoutGrid, List, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { useUI } from '@/data/ui'
import { useIsAdmin } from '@/hooks/usePermissions'
import { Topbar, Content, Empty, PageHead } from '@/components/ui/layout'
import { Tabs } from '@/components/ui/tabs'
import { AvatarStack, ClientMark } from '@/components/ui/avatar'
import { StatusPill } from '@/components/ui/pill'
import { clientColor, clientDisplayName, clientSecondaryName, effectivePaymentStatus, isOpenPayment, OPEN_PROJECT, sumByCurrency } from '@/lib/derive'
import { formatDate, formatShortAgo } from '@/lib/format'
import { clientStatus } from '@/lib/status'
import type { Client } from '@/types'

type View = 'list' | 'cards'

function readView(): View {
  try {
    return (localStorage.getItem('mydesk-clients-view') as View) || 'list'
  } catch {
    return 'list'
  }
}

/** "9:14 PM" in the client's own timezone. */
function localTime(tz?: string | null) {
  if (!tz) return null
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date())
  } catch {
    return null
  }
}

export function ClientsPage() {
  const isAdmin = useIsAdmin()
  const { clients, projects, payments, invoices, profiles, clientMembers, activity, updateRow } = useData()
  const { openCreate } = useUI()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as 'active' | 'archived') || 'active'
  const [q, setQ] = useState('')
  const [view, setViewState] = useState<View>(readView)
  const setView = (v: View) => {
    setViewState(v)
    try {
      localStorage.setItem('mydesk-clients-view', v)
    } catch {
      // ignore
    }
  }

  const match = (c: Client) => !q.trim() || `${c.name} ${c.company_name ?? ''} ${c.email ?? ''} ${c.country ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())
  const active = useMemo(() => clients.filter((c) => c.status !== 'archived' && match(c)), [clients, q]) // eslint-disable-line react-hooks/exhaustive-deps
  const archived = useMemo(() => clients.filter((c) => c.status === 'archived' && match(c)), [clients, q]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Everything the cards and rows show about one client. */
  const info = (c: Client) => {
    const cp = projects.filter((p) => p.client_id === c.id)
    const pids = new Set(cp.map((p) => p.id))
    const cPay = payments.filter((p) => p.client_id === c.id)
    const billed = cPay.filter((p) => p.status === 'paid')
    const open = cPay.filter(isOpenPayment)
    const overdue = open.filter((p) => effectivePaymentStatus(p) === 'overdue').length
    const team = profiles.filter((u) => clientMembers.some((m) => m.client_id === c.id && m.user_id === u.id))
    const ev = activity.find((a) => (a.project_id && pids.has(a.project_id)) || a.entity_id === c.id)
    const lastInv = invoices.filter((i) => i.client_id === c.id).sort((a, b) => (b.issue_date ?? '').localeCompare(a.issue_date ?? ''))[0]
    return {
      projects: cp.length,
      activeProjects: cp.filter(OPEN_PROJECT).length,
      billed,
      open,
      overdue,
      team,
      lastTouch: ev?.created_at ?? c.created_at,
      lastInv,
      sub: clientSecondaryName(c) || c.country || '',
    }
  }

  const restore = (c: Client) => {
    updateRow('clients', c.id, { status: 'active' }, { entity: 'client', entityId: c.id, action: 'updated', message: `restored client ${clientDisplayName(c)}` })
    toast.success(`${clientDisplayName(c)} restored`)
  }

  const list = tab === 'active' ? active : archived

  return (
    <>
      <Topbar crumbs={[{ label: 'Clients' }]}>
        {isAdmin && <button type="button" className="btn btn-pri" onClick={() => openCreate('client')}><Plus className="i" />Add client</button>}
      </Topbar>
      <Content>
        <PageHead
          title="Clients"
          sub={
            <>
              {clients.filter((c) => c.status !== 'archived').length} active · {projects.length} projects all-time
              {isAdmin && <> · <Link to="/analytics?tab=clients">see client analytics</Link></>}
            </>
          }
        />
        <div className="tabs">
          <Tabs
            value={tab}
            onChange={(t) => setParams(t === 'active' ? {} : { tab: t }, { replace: true })}
            tabs={[
              { id: 'active', label: 'Active', count: clients.filter((c) => c.status !== 'archived').length },
              { id: 'archived', label: 'Archived', count: clients.filter((c) => c.status === 'archived').length },
            ]}
            after={
              <>
                <label className="inp-wrap" style={{ width: 240, maxWidth: '50vw', height: 32 }}>
                  <Search className="i i-sm" />
                  <input placeholder="Search clients…" aria-label="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />
                </label>
                <Tabs
                  variant="seg"
                  value={view}
                  onChange={setView}
                  tabs={[
                    { id: 'list', label: <><List className="i i-sm" />List</> },
                    { id: 'cards', label: <><LayoutGrid className="i i-sm" />Cards</> },
                  ]}
                />
              </>
            }
          />

          {list.length === 0 ? (
            <div className="card">
              {tab === 'active' ? (
                <Empty icon={<Briefcase className="i" />} title={clients.length ? 'No matches' : 'No clients yet'} action={isAdmin && !clients.length ? <button type="button" className="btn btn-pri" onClick={() => openCreate('client')}><Plus className="i" />Add client</button> : undefined}>
                  {clients.length ? 'Try a different search.' : 'Add your first client to start tracking projects and payments.'}
                </Empty>
              ) : (
                <Empty small title="No archived clients">Archived clients keep their projects and payments, just out of the way.</Empty>
              )}
            </div>
          ) : view === 'list' ? (
            <div className="card tbl-wrap panel-in" key={`${tab}-list`}>
              <table className="tbl" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Location</th>
                    <th>Projects</th>
                    {isAdmin && <th className="r">Billed</th>}
                    {isAdmin && <th className="r">Open</th>}
                    <th>Team</th>
                    <th>{tab === 'active' ? 'Last activity' : 'Last invoice'}</th>
                    {tab === 'archived' && isAdmin && <th />}
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => {
                    const x = info(c)
                    const time = localTime(c.timezone)
                    return (
                      <tr key={c.id} className="hov client-row" style={{ ['--cc' as string]: clientColor(c) }}>
                        <td>
                          <Link className="row cover" to={`/clients/${c.id}`}>
                            <ClientMark client={c} size="md" />
                            <span style={{ minWidth: 0 }}>
                              <span className="m row-sm" style={{ display: 'flex' }}>
                                {clientDisplayName(c)}
                                {c.status !== 'active' && c.status !== 'archived' && <StatusPill meta={clientStatus[c.status]} />}
                              </span>
                              <span className="xs muted trunc" style={{ display: 'block', maxWidth: 240 }}>{x.sub || c.email || ' '}</span>
                            </span>
                          </Link>
                        </td>
                        <td>
                          <div className="small">{c.country ?? <span className="faint">—</span>}</div>
                          {time && <div className="xs muted">{time} local</div>}
                        </td>
                        <td>
                          <div className="small"><b className="m">{x.activeProjects}</b> active</div>
                          <div className="xs muted">{x.projects} all-time</div>
                        </td>
                        {isAdmin && <td className="r num m">{x.billed.length ? sumByCurrency(x.billed) : <span className="faint">—</span>}</td>}
                        {isAdmin && (
                          <td className="r">
                            {x.open.length ? (
                              <>
                                <div className={`num b ${x.overdue ? 't-bad' : 't-warn'}`}>{sumByCurrency(x.open)}</div>
                                <div className={`xs ${x.overdue ? 't-bad' : 'muted'}`}>{x.overdue ? `${x.overdue} overdue` : `${x.open.length} unpaid`}</div>
                              </>
                            ) : (
                              <span className="faint">—</span>
                            )}
                          </td>
                        )}
                        <td><AvatarStack profiles={x.team} /></td>
                        <td className="small muted">
                          {tab === 'active' ? formatShortAgo(x.lastTouch) : x.lastInv?.issue_date ? formatDate(x.lastInv.issue_date) : '—'}
                        </td>
                        {tab === 'archived' && isAdmin && (
                          <td className="r"><button type="button" className="btn btn-sm above" onClick={() => restore(c)}>Restore</button></td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid-cards panel-in" key={`${tab}-cards`}>
              {list.map((c) => {
                const x = info(c)
                return (
                  <Link key={c.id} className="ccard lift" to={`/clients/${c.id}`} style={{ ['--cc' as string]: clientColor(c) }}>
                    <div className="row">
                      <ClientMark client={c} size="lg" />
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="h3 trunc" style={{ fontSize: 15 }}>{clientDisplayName(c)}</div>
                        <div className="small muted trunc">{x.sub || ' '}</div>
                      </div>
                      <StatusPill meta={clientStatus[c.status]} />
                    </div>
                    {isAdmin ? (
                      <div className="mini-stats">
                        <div><small>Projects</small><b>{x.projects}</b></div>
                        <div><small>Billed</small><b className="trunc">{x.billed.length ? sumByCurrency(x.billed) : '—'}</b></div>
                        <div><small>Open</small><b className={`trunc ${x.overdue ? 't-bad' : x.open.length ? 't-warn' : 'muted'}`}>{x.open.length ? sumByCurrency(x.open) : '—'}</b></div>
                      </div>
                    ) : (
                      <div className="mini-stats" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
                        <div><small>Projects</small><b>{x.projects}</b></div>
                        <div><small>Active</small><b>{x.activeProjects}</b></div>
                      </div>
                    )}
                    <div className="row small muted">
                      {isAdmin && x.overdue > 0 ? <span className="pill bad">{x.overdue} overdue</span> : isAdmin && x.open.length > 0 ? <span className="pill warn">{x.open.length} unpaid</span> : x.team.length > 0 ? <AvatarStack profiles={x.team} /> : null}
                      <span className="grow trunc">{x.projects === 0 ? (x.lastInv ? 'Invoices only' : 'No projects yet') : `${x.activeProjects} active project${x.activeProjects === 1 ? '' : 's'}`}</span>
                      {tab === 'archived' && isAdmin ? (
                        <button type="button" className="btn btn-sm" onClick={(e) => { e.preventDefault(); restore(c) }}>Restore</button>
                      ) : (
                        <span>{formatShortAgo(x.lastTouch)}</span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </Content>
    </>
  )
}
