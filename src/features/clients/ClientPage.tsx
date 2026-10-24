import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { Check, Clock, CreditCard, Edit3, FileText, Folder, Globe, Mail, Phone, Plus, User } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { useUI } from '@/data/ui'
import { paymentTitle } from '@/data/actions'
import { useIsAdmin } from '@/hooks/usePermissions'
import { pushRecent } from '@/components/layout/CommandPalette'
import { Topbar, Content, Empty } from '@/components/ui/layout'
import { Tabs } from '@/components/ui/tabs'
import { Menu, MenuItem } from '@/components/ui/menu'
import { Avatar, ClientMark } from '@/components/ui/avatar'
import { StatusPill } from '@/components/ui/pill'
import { RemindModal } from '@/features/payments/RemindModal'
import { PaymentModal } from '@/features/payments/PaymentModal'
import { ClientProjects } from '@/features/clients/ClientProjects'
import { clientColor, clientDisplayName, clientSecondaryName, effectivePaymentStatus, invoicePaymentStatus, isOpenPayment, OPEN_PROJECT, profileDisplayName, sumByCurrency } from '@/lib/derive'
import { formatDate, formatMoney, lateLabel } from '@/lib/format'
import { clientStatus, paymentStatus } from '@/lib/status'
import type { Payment } from '@/types'

type Tab = 'projects' | 'invoices' | 'payments' | 'notes'

export function ClientPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const { openCreate } = useUI()
  const { clients, projects, tasks, payments, invoices, profiles, clientMembers, me, updateRow } = useData()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'projects'
  const [note, setNote] = useState('')
  const [remind, setRemind] = useState<Payment | null>(null)
  const [editPay, setEditPay] = useState<Payment | undefined>()

  const client = clients.find((c) => c.id === id)
  useEffect(() => {
    setNote(client?.notes ?? '')
    if (client) pushRecent(`/clients/${client.id}`)
  }, [client?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!client) {
    return (
      <>
        <Topbar crumbs={[{ label: 'Clients', to: '/clients' }, { label: 'Not found' }]} />
        <Content><div className="card"><Empty title="Client not found">It may have been deleted, or you don’t have access to it.</Empty></div></Content>
      </>
    )
  }

  const name = clientDisplayName(client)
  const first = client.name.split(' ')[0]
  const cProjects = projects.filter((p) => p.client_id === id).sort((a, b) => Number(OPEN_PROJECT(b)) - Number(OPEN_PROJECT(a)) || (b.due_date ?? b.created_at).localeCompare(a.due_date ?? a.created_at))
  const activeN = cProjects.filter(OPEN_PROJECT).length
  const cPayments = payments.filter((p) => p.client_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const paid = cPayments.filter((p) => p.status === 'paid')
  const open = cPayments.filter(isOpenPayment)
  const cInvoices = invoices.filter((i) => i.client_id === id).sort((a, b) => (b.issue_date ?? '').localeCompare(a.issue_date ?? ''))
  const team = profiles.filter((u) => clientMembers.some((m) => m.client_id === id && m.user_id === u.id))
  const daysToPay = paid.filter((p) => p.payment_date).map((p) => differenceInCalendarDays(parseISO(p.payment_date!), parseISO(p.created_at)))
  const avgDays = daysToPay.length ? Math.max(0, Math.round(daysToPay.reduce((a, b) => a + b, 0) / daysToPay.length)) : null
  const allPaidDays = payments.filter((p) => p.status === 'paid' && p.payment_date).map((p) => differenceInCalendarDays(parseISO(p.payment_date!), parseISO(p.created_at)))
  const globalAvg = allPaidDays.length ? allPaidDays.reduce((a, b) => a + b, 0) / allPaidDays.length : null

  const invoiceStatus = (invId: string) => invoicePaymentStatus(invId, payments)

  const tabs = [
    { id: 'projects' as const, label: 'Projects', count: cProjects.length },
    ...(isAdmin
      ? [
          { id: 'invoices' as const, label: 'Invoices', count: cInvoices.length || undefined },
          { id: 'payments' as const, label: 'Payments', count: open.length || undefined },
          { id: 'notes' as const, label: 'Notes' },
        ]
      : []),
  ]

  return (
    <>
      <Topbar crumbs={[{ label: 'Clients', to: '/clients' }, { label: name }]}>
        {isAdmin && <Link className="btn" to={`/clients/${id}/settings`}><Edit3 className="i" />Edit client</Link>}
        <Menu trigger={({ toggle }) => <button type="button" className="btn btn-pri" onClick={toggle}><Plus className="i" />New</button>}>
          <MenuItem icon={<Folder className="i" />} onSelect={() => openCreate('project', { client_id: id })}>Project for {first}</MenuItem>
          {isAdmin && <MenuItem icon={<FileText className="i" />} onSelect={() => navigate(`/invoices/new?client=${id}`)}>Invoice</MenuItem>}
          {isAdmin && <MenuItem icon={<CreditCard className="i" />} onSelect={() => openCreate('payment', { client_id: id })}>Payment</MenuItem>}
        </Menu>
      </Topbar>
      <Content>
        <div className="profile-head">
          <ClientMark client={client} size="xl" />
          <div className="grow">
            <div className="row-sm wrap">
              <h1>{name}</h1>
              <StatusPill meta={clientStatus[client.status]} />
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              Client since {format(parseISO(client.created_at), 'MMM yyyy')}
              {clientSecondaryName(client) ? ` · ${clientSecondaryName(client)}` : ''}
            </div>
          </div>
        </div>

        <div className="kstrip">
          <div><div className="small muted m">Projects</div><div className="val">{cProjects.length}</div><div className="xs muted">{activeN} active · {cProjects.length - activeN} done</div></div>
          {isAdmin ? (
            <>
              <div><div className="small muted m">Billed</div><div className="val trunc">{paid.length ? sumByCurrency(paid) : '—'}</div><div className="xs muted">{cInvoices.length} invoice{cInvoices.length === 1 ? '' : 's'}</div></div>
              <div>
                <div className="small muted m">Outstanding</div>
                <div className={`val trunc ${open.some((p) => effectivePaymentStatus(p) === 'overdue') ? 't-bad' : ''}`}>{open.length ? sumByCurrency(open) : formatMoney(0, client.default_currency ?? 'USD')}</div>
                <div className={`xs ${open.length ? 'muted' : 't-ok'}`}>{open.length ? `${open.length} open payment${open.length === 1 ? '' : 's'}` : 'All paid'}</div>
              </div>
              <div>
                <div className="small muted m">Avg. days to pay</div>
                <div className="val">{avgDays ?? '—'}</div>
                <div className="xs muted">{avgDays === null || globalAvg === null ? 'No paid payments yet' : avgDays <= globalAvg ? 'Faster than average' : 'Slower than average'}</div>
              </div>
            </>
          ) : (
            <div><div className="small muted m">Open tasks</div><div className="val">{tasks.filter((t) => cProjects.some((p) => p.id === t.project_id) && t.status !== 'done' && t.status !== 'cancelled').length}</div><div className="xs muted">across {activeN} active projects</div></div>
          )}
        </div>

        <div className="cols">
          <div className="col-main">
            <div className="tabs">
              <Tabs value={tab} onChange={(t) => setParams(t === 'projects' ? {} : { tab: t }, { replace: true })} tabs={tabs} />
              <div className="panel-in" key={tab}>
                {tab === 'projects' && <ClientProjects client={client} />}

                {tab === 'invoices' && (
                  <div className="card tbl-wrap">
                    {cInvoices.length === 0 ? (
                      <Empty small icon={<FileText className="i" />} title="No invoices yet" action={<Link className="btn btn-sm" to={`/invoices/new?client=${id}`}><Plus className="i i-sm" />New invoice</Link>} />
                    ) : (
                      <table className="tbl">
                        <thead><tr><th>Invoice</th><th>Issued</th><th>Status</th><th className="r">Amount</th></tr></thead>
                        <tbody>
                          {cInvoices.map((inv) => {
                            const st = invoiceStatus(inv.id)
                            const total = inv.line_items.reduce((s, li) => s + li.price * li.qty, 0) * (1 + inv.tax_rate / 100)
                            return (
                              <tr key={inv.id} className="hov">
                                <td><Link className="mono m cover" to={`/invoices/${inv.id}`}>{inv.number}</Link></td>
                                <td>{formatDate(inv.issue_date)}</td>
                                <td>{st ? <StatusPill meta={paymentStatus[st]} /> : <span className="pill gray">Draft</span>}</td>
                                <td className="r num b">{formatMoney(total, inv.currency)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {tab === 'payments' && (
                  <div className="card">
                    {open.length === 0 ? (
                      <Empty
                        icon={<Check className="i" />}
                        title="Nothing outstanding"
                        action={<button type="button" className="btn btn-sm" onClick={() => openCreate('payment', { client_id: id })}>Record payment</button>}
                      >
                        {paid.length ? `${first} has paid every invoice. New payments show up here.` : 'No payments recorded yet.'}
                      </Empty>
                    ) : (
                      <div className="list">
                        {open.map((p) => {
                          const st = effectivePaymentStatus(p)
                          return (
                            <div key={p.id} className="li hover">
                              <div className="grow cover" role="button" tabIndex={0} onClick={() => setEditPay(p)} onKeyDown={(e) => e.key === 'Enter' && setEditPay(p)} style={{ minWidth: 0, cursor: 'pointer' }}>
                                <div className="t trunc">{paymentTitle(p)}</div>
                                <div className={`s ${st === 'overdue' ? 't-bad' : ''}`}>{st === 'overdue' ? lateLabel(p.due_date) : p.due_date ? `Due ${formatDate(p.due_date)}` : 'No due date'}</div>
                              </div>
                              <b className="num">{formatMoney(p.amount, p.currency)}</b>
                              <StatusPill meta={paymentStatus[st]} />
                              <button type="button" className="btn btn-sm above" onClick={() => setRemind(p)}>Remind</button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {paid.length > 0 && (
                      <div className="card-f"><span className="muted">{paid.length} paid · {sumByCurrency(paid)}</span><Link className="link" to="/payments?tab=paid">All payments</Link></div>
                    )}
                  </div>
                )}

                {tab === 'notes' && (
                  <div className="stack">
                    <div className="composer">
                      <textarea placeholder="Private note about this client…" aria-label="Client note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
                      <div className="row between">
                        <span className="xs muted">Only owners and admins see client notes</span>
                        <button
                          type="button"
                          className="btn btn-pri btn-sm"
                          disabled={note === (client.notes ?? '')}
                          onClick={() => {
                            updateRow('clients', client.id, { notes: note.trim() || null })
                            toast.success('Note saved')
                          }}
                        >
                          Save note
                        </button>
                      </div>
                    </div>
                    {client.notes && (
                      <div className="note-card">
                        <div className="row-sm"><Avatar profile={me} size="xs" /><b className="small m">Client notes</b></div>
                        <p style={{ whiteSpace: 'pre-wrap' }}>{client.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="col-side">
            {isAdmin && (
              <section className="card card-b stack">
                <div className="row between"><span className="label-caps">Contact</span><Link className="link small" to={`/clients/${id}/settings#contact`}>Edit</Link></div>
                <div className="contact-list">
                  <div className="row"><User className="i i-sm" />{client.name}</div>
                  <div className="row"><Mail className="i i-sm" />{client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : <Link className="ph-t" to={`/clients/${id}/settings#contact`}>Add email</Link>}</div>
                  <div className="row"><Phone className="i i-sm" />{client.phone ? <a href={`tel:${client.phone}`}>{client.phone}</a> : <Link className="ph-t" to={`/clients/${id}/settings#contact`}>Add phone</Link>}</div>
                  <div className="row"><Globe className="i i-sm" />{client.website ? <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer">{client.website}</a> : <Link className="ph-t" to={`/clients/${id}/settings#contact`}>Add website</Link>}</div>
                  <div className="row"><Clock className="i i-sm" />{client.timezone ? <LocalTime tz={client.timezone} /> : <Link className="ph-t" to={`/clients/${id}/settings#contact`}>Add timezone</Link>}</div>
                </div>
              </section>
            )}
            <section className="card card-b stack">
              <div className="row between"><span className="label-caps">Team with access</span>{isAdmin && <Link className="link small" to={`/team?client=${id}`}>Manage</Link>}</div>
              {team.length === 0 && <span className="small muted">Only owners and admins.</span>}
              {team.map((u) => (
                <Link key={u.id} className="row" to={`/team/${u.id}`}>
                  <Avatar profile={u} size="md" />
                  <div className="grow small m">{profileDisplayName(u)}</div>
                  <span className="pill">Member</span>
                </Link>
              ))}
            </section>
            {isAdmin && (
              <section className="card card-b stack">
                <span className="label-caps">Invoice branding</span>
                <div className="row"><span style={{ width: 28, height: 28, borderRadius: 7, background: clientColor(client) }} /><span className="small mono">{clientColor(client).toUpperCase()}</span></div>
                <span className="xs muted">Used on every PDF invoice for this client.</span>
              </section>
            )}
          </aside>
        </div>
      </Content>
      <RemindModal payment={remind} onClose={() => setRemind(null)} />
      <PaymentModal open={Boolean(editPay)} payment={editPay} onClose={() => setEditPay(undefined)} onRemind={(p) => { setEditPay(undefined); setRemind(p) }} />
    </>
  )
}

/** "America/Denver · 9:14 AM local". */
function LocalTime({ tz }: { tz: string }) {
  let time = ''
  try {
    time = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date())
  } catch {
    time = ''
  }
  return <span>{tz}{time ? <span className="muted"> · {time} local</span> : null}</span>
}
