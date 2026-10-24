import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Briefcase, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { useUI } from '@/data/ui'
import { useIsAdmin } from '@/hooks/usePermissions'
import { Topbar, Content, Empty, PageHead } from '@/components/ui/layout'
import { Tabs } from '@/components/ui/tabs'
import { AvatarStack, ClientMark } from '@/components/ui/avatar'
import { StatusPill } from '@/components/ui/pill'
import { clientDisplayName, clientSecondaryName, effectivePaymentStatus, isOpenPayment, OPEN_PROJECT, sumByCurrency } from '@/lib/derive'
import { formatDate, formatShortAgo } from '@/lib/format'
import { clientStatus } from '@/lib/status'
import type { Client } from '@/types'

export function ClientsPage() {
  const isAdmin = useIsAdmin()
  const { clients, projects, payments, invoices, profiles, clientMembers, activity, updateRow } = useData()
  const { openCreate } = useUI()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as 'active' | 'archived') || 'active'
  const [q, setQ] = useState('')

  const match = (c: Client) => !q.trim() || `${c.name} ${c.company_name ?? ''} ${c.email ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())
  const active = useMemo(() => clients.filter((c) => c.status !== 'archived' && match(c)), [clients, q]) // eslint-disable-line react-hooks/exhaustive-deps
  const archived = useMemo(() => clients.filter((c) => c.status === 'archived' && match(c)), [clients, q]) // eslint-disable-line react-hooks/exhaustive-deps

  const lastTouch = (c: Client) => {
    const pids = new Set(projects.filter((p) => p.client_id === c.id).map((p) => p.id))
    const ev = activity.find((a) => (a.project_id && pids.has(a.project_id)) || a.entity_id === c.id)
    return ev?.created_at ?? c.created_at
  }

  const restore = (c: Client) => {
    updateRow('clients', c.id, { status: 'active' }, { entity: 'client', entityId: c.id, action: 'updated', message: `restored client ${clientDisplayName(c)}` })
    toast.success(`${clientDisplayName(c)} restored`)
  }

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
              <label className="inp-wrap" style={{ width: 240, maxWidth: '50vw', height: 32, marginBottom: 6 }}>
                <Search className="i i-sm" />
                <input placeholder="Search clients…" aria-label="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
            }
          />
          {tab === 'active' ? (
            active.length === 0 ? (
              <div className="card">
                <Empty icon={<Briefcase className="i" />} title={clients.length ? 'No matches' : 'No clients yet'} action={isAdmin && !clients.length ? <button type="button" className="btn btn-pri" onClick={() => openCreate('client')}><Plus className="i" />Add client</button> : undefined}>
                  {clients.length ? 'Try a different search.' : 'Add your first client to start tracking projects and payments.'}
                </Empty>
              </div>
            ) : (
              <div className="grid-cards panel-in">
                {active.map((c) => {
                  const cp = projects.filter((p) => p.client_id === c.id)
                  const activeCount = cp.filter(OPEN_PROJECT).length
                  const cPay = payments.filter((p) => p.client_id === c.id)
                  const billed = cPay.filter((p) => p.status === 'paid')
                  const open = cPay.filter(isOpenPayment)
                  const overdue = open.filter((p) => effectivePaymentStatus(p) === 'overdue').length
                  const team = profiles.filter((u) => clientMembers.some((m) => m.client_id === c.id && m.user_id === u.id))
                  const sub = c.company_name && !c.use_company_name ? c.company_name : clientSecondaryName(c) ?? c.country ?? ''
                  return (
                    <Link key={c.id} className="ccard lift" to={`/clients/${c.id}`}>
                      <div className="row">
                        <ClientMark client={c} size="lg" />
                        <div className="grow" style={{ minWidth: 0 }}>
                          <div className="h3 trunc" style={{ fontSize: 15 }}>{clientDisplayName(c)}</div>
                          <div className="small muted trunc">{sub || ' '}</div>
                        </div>
                        <StatusPill meta={clientStatus[c.status]} />
                      </div>
                      {isAdmin ? (
                        <div className="mini-stats">
                          <div><small>Projects</small><b>{cp.length}</b></div>
                          <div><small>Billed</small><b className="trunc">{billed.length ? sumByCurrency(billed) : '—'}</b></div>
                          <div><small>Open</small><b className={`trunc ${overdue ? 't-bad' : open.length ? 't-warn' : 'muted'}`}>{open.length ? sumByCurrency(open) : '—'}</b></div>
                        </div>
                      ) : (
                        <div className="mini-stats" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
                          <div><small>Projects</small><b>{cp.length}</b></div>
                          <div><small>Active</small><b>{activeCount}</b></div>
                        </div>
                      )}
                      <div className="row small muted">
                        {isAdmin && overdue > 0 ? (
                          <span className="pill bad">{overdue} overdue</span>
                        ) : isAdmin && open.length > 0 ? (
                          <span className="pill warn">{open.length} unpaid</span>
                        ) : team.length > 0 ? (
                          <AvatarStack profiles={team} />
                        ) : null}
                        <span className="grow trunc">{cp.length === 0 ? (invoices.some((i) => i.client_id === c.id) ? 'Invoices only' : 'No projects yet') : !(isAdmin && open.length) ? `${activeCount} active project${activeCount === 1 ? '' : 's'}` : ''}</span>
                        <span>{formatShortAgo(lastTouch(c))}</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )
          ) : archived.length === 0 ? (
            <div className="card"><Empty small title="No archived clients">Archived clients keep their projects and payments, just out of the way.</Empty></div>
          ) : (
            <div className="card list panel-in">
              {archived.map((c) => {
                const n = projects.filter((p) => p.client_id === c.id).length
                const lastInv = invoices.filter((i) => i.client_id === c.id).sort((a, b) => (b.issue_date ?? '').localeCompare(a.issue_date ?? ''))[0]
                return (
                  <div className="li hover" key={c.id}>
                    <ClientMark client={c} />
                    <Link className="grow cover" to={`/clients/${c.id}`}>
                      <div className="t">{clientDisplayName(c)}</div>
                      <div className="s">{n} project{n === 1 ? '' : 's'}{lastInv?.issue_date ? ` · last invoice ${formatDate(lastInv.issue_date)}` : ''}</div>
                    </Link>
                    {isAdmin && <button type="button" className="btn btn-sm above" onClick={() => restore(c)}>Restore</button>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Content>
    </>
  )
}
