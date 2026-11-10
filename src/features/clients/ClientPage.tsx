import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Archive, ArchiveRestore, Check, Clock, CreditCard, Edit3, FileText, Folder, Globe, Mail, Phone, Plus, User } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { invoiceTotal } from '@/lib/invoice-math'
import { useUI } from '@/data/ui'
import { clientNoteFor, paymentTitle, saveClientNote } from '@/data/actions'
import { useIsAdmin } from '@/hooks/usePermissions'
import { pushRecent } from '@/components/layout/CommandPalette'
import { Topbar, Content, Empty } from '@/components/ui/layout'
import { Tabs } from '@/components/ui/tabs'
import { Menu, MenuItem } from '@/components/ui/menu'
import { ConfirmDialog } from '@/components/ui/modal'
import { Avatar, ClientMark } from '@/components/ui/avatar'
import { StatusPill } from '@/components/ui/pill'
import { RemindModal } from '@/features/payments/RemindModal'
import { PaymentModal } from '@/features/payments/PaymentModal'
import { ClientProjects } from '@/features/clients/ClientProjects'
import { PrivacyToggle } from '@/components/ui/privacy-toggle'
import { clientColor, clientDisplayName, clientSecondaryName, effectivePaymentStatus, hasClientAccess, invoiceStatus, isOpenPayment, OPEN_PROJECT, profileDisplayName, sumByCurrency } from '@/lib/derive'
import { formatDate, formatMoney, lateLabel } from '@/lib/format'
import { clientStatus, paymentStatus } from '@/lib/status'
import type { Payment } from '@/types'

type Tab = 'projects' | 'invoices' | 'payments' | 'notes'

export function ClientPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const { openCreate } = useUI()
  const { clients, projects, tasks, payments, invoices, profiles, clientMembers, projectMembers, clientNotes, me, updateRow } = useData()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'projects'
  const [note, setNote] = useState('')
  const [shared, setShared] = useState(false)
  const [remind, setRemind] = useState<Payment | null>(null)
  const [editPay, setEditPay] = useState<Payment | undefined>()
  const [confirmArchive, setConfirmArchive] = useState(false)

  const client = clients.find((c) => c.id === id)
  useEffect(() => {
    if (client) {
      const n = clientNoteFor(client.id)
      setNote(n.body)
      setShared(n.shared)
    }
    if (client) pushRecent(`/clients/${client.id}`)
  }, [client?.id, clientNotes.length]) // eslint-disable-line react-hooks/exhaustive-deps

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
  // People who only have some of this client's projects.
  const projectOnly = profiles.filter((u) => !team.includes(u) && projectMembers.some((m) => m.user_id === u.id && cProjects.some((p) => p.id === m.project_id)))
  const savedNote = clientNoteFor(id)
  const sharedNote = clientNotes.find((n) => n.client_id === id && n.shared && n.body.trim())
  const canAddProject = hasClientAccess(me, id, clientMembers)

  const statusOfInvoice = (invId: string) => {
    const inv = invoices.find((i) => i.id === invId)
    return inv ? invoiceStatus(inv, projects, payments) : null
  }

  const setStatus = (status: 'active' | 'archived') => {
    const prev = client.status
    const prevPinned = Boolean(client.pinned)
    const log = (msg: string) => ({ entity: 'client' as const, entityId: client.id, action: 'updated' as const, message: msg })
    updateRow('clients', client.id, status === 'archived' ? { status, pinned: false } : { status }, log(`${status === 'archived' ? 'archived' : 'restored'} client ${name}`))
    toast.success(status === 'archived' ? `${name} archived` : `${name} restored`, {
      description: status === 'archived' ? 'Hidden from lists and the sidebar. Nothing was deleted.' : undefined,
      action: { label: 'Undo', onClick: () => updateRow('clients', client.id, { status: prev, pinned: prevPinned }, log(`restored client ${name}`)) },
    })
  }

  const tabs = [
    { id: 'projects' as const, label: 'Projects', count: cProjects.length },
    ...(isAdmin
      ? [
          { id: 'invoices' as const, label: 'Invoices', count: cInvoices.length || undefined },
          { id: 'payments' as const, label: 'Payments', count: open.length || undefined },
          { id: 'notes' as const, label: 'Notes' },
        ]
      : sharedNote
        ? [{ id: 'notes' as const, label: 'Notes' }]
        : []),
  ]

  return (
    <>
      <Topbar crumbs={[{ label: 'Clients', to: '/clients' }, { label: name }]}>
        {isAdmin && <PrivacyToggle />}
        {isAdmin && <Link className="btn" to={`/clients/${id}/settings`}><Edit3 className="i" />Edit client</Link>}
        {isAdmin && (client.status === 'archived' ? (
          <button type="button" className="btn" onClick={() => setStatus('active')}><ArchiveRestore className="i" />Restore</button>
        ) : (
          <button type="button" className="btn btn-icon" aria-label="Archive client" title="Archive client" onClick={() => setConfirmArchive(true)}><Archive className="i" /></button>
        ))}
        {(isAdmin || canAddProject) && <Menu trigger={({ toggle }) => <button type="button" className="btn btn-pri" onClick={toggle}><Plus className="i" />New</button>}>
          <MenuItem icon={<Folder className="i" />} onSelect={() => openCreate('project', { client_id: id })}>Project for {first}</MenuItem>
          {isAdmin && <MenuItem icon={<FileText className="i" />} onSelect={() => navigate(`/invoices/new?client=${id}`)}>Invoice</MenuItem>}
          {isAdmin && <MenuItem icon={<CreditCard className="i" />} onSelect={() => openCreate('payment', { client_id: id })}>Payment</MenuItem>}
        </Menu>}
      </Topbar>
      <Content>
        <div className="client-head">
          <ClientMark client={client} size="lg" />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row-sm wrap">
              <h1>{name}</h1>
              <StatusPill meta={clientStatus[client.status]} />
            </div>
            <div className="small muted" style={{ marginTop: 2 }}>
              Client since {format(parseISO(client.created_at), 'MMM yyyy')}
              {clientSecondaryName(client) ? ` · ${clientSecondaryName(client)}` : ''}
            </div>
          </div>
          <div className="client-stats">
            <div><span>Active</span><b className="priv">{activeN}</b></div>
            <div><span>Done</span><b className="priv">{cProjects.length - activeN}</b></div>
            {isAdmin ? (
              <>
                <div><span>Billed</span><b className="priv">{paid.length ? sumByCurrency(paid) : '—'}</b></div>
                <button type="button" onClick={() => setParams({ tab: 'payments' }, { replace: true })} title="Open payments">
                  <span>Outstanding</span>
                  <b className={`priv ${open.some((p) => effectivePaymentStatus(p) === 'overdue') ? 't-bad' : open.length ? '' : 't-ok'}`}>{open.length ? sumByCurrency(open) : 'All paid'}</b>
                </button>
              </>
            ) : (
              <div><span>Open tasks</span><b>{tasks.filter((t) => cProjects.some((p) => p.id === t.project_id) && t.status !== 'done' && t.status !== 'cancelled').length}</b></div>
            )}
          </div>
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
                            const st = statusOfInvoice(inv.id)
                            const total = invoiceTotal(inv)
                            return (
                              <tr key={inv.id} className="hov">
                                <td><Link className="mono m cover" to={`/invoices/${inv.id}`}>{inv.number}</Link></td>
                                <td>{formatDate(inv.issue_date)}</td>
                                <td>{st ? <StatusPill meta={paymentStatus[st]} /> : <span className="pill gray">Draft</span>}</td>
                                <td className="r num b priv">{formatMoney(total, inv.currency)}</td>
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
                              <b className="num priv">{formatMoney(p.amount, p.currency)}</b>
                              <StatusPill meta={paymentStatus[st]} />
                              <button type="button" className="btn btn-sm above" onClick={() => setRemind(p)}>Remind</button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {paid.length > 0 && (
                      <div className="card-f"><span className="muted">{paid.length} paid · <span className="priv">{sumByCurrency(paid)}</span></span><Link className="link" to="/payments?tab=paid">All payments</Link></div>
                    )}
                  </div>
                )}

                {tab === 'notes' && isAdmin && (
                  <div className="stack">
                    <div className="composer">
                      <textarea placeholder="Note about this client…" aria-label="Client note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
                      <div className="row between wrap">
                        <label className="row-sm small" style={{ cursor: 'pointer' }} title="Everyone with access to this client (or one of its projects) can read the note">
                          <input
                            type="checkbox"
                            className="cb"
                            checked={shared}
                            onChange={(e) => {
                              setShared(e.target.checked)
                              // Sharing an already-saved note takes effect straight away.
                              if (savedNote.body.trim() && note.trim() === savedNote.body.trim()) {
                                saveClientNote(client.id, { shared: e.target.checked })
                                toast.success(e.target.checked ? 'Note shared with the team' : 'Note is private again')
                              }
                            }}
                          />
                          Share with team
                          <span className="xs muted">{shared ? '· everyone with access to this client can read it' : '· only owners and admins'}</span>
                        </label>
                        <button
                          type="button"
                          className="btn btn-pri btn-sm"
                          disabled={note.trim() === savedNote.body.trim() && shared === savedNote.shared}
                          onClick={() => {
                            saveClientNote(client.id, { body: note, shared })
                            toast.success(shared ? 'Note saved and shared' : 'Note saved')
                          }}
                        >
                          Save note
                        </button>
                      </div>
                    </div>
                    {savedNote.body.trim() && (
                      <div className="note-card">
                        <div className="row-sm"><Avatar profile={me} size="xs" /><b className="small m">Client notes</b>{savedNote.shared && <span className="pill">Shared with team</span>}</div>
                        <p style={{ whiteSpace: 'pre-wrap' }}>{savedNote.body}</p>
                      </div>
                    )}
                  </div>
                )}
                {tab === 'notes' && !isAdmin && (
                  sharedNote ? (
                    <div className="note-card">
                      <div className="row-sm"><b className="small m">Client notes</b><span className="xs muted">· shared by the team</span></div>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{sharedNote.body}</p>
                    </div>
                  ) : (
                    <Empty small title="No shared notes">Notes appear here when an owner or admin shares them.</Empty>
                  )
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
              {team.length === 0 && projectOnly.length === 0 && <span className="small muted">Only owners and admins.</span>}
              {team.map((u) => (
                <Link key={u.id} className="row" to={`/team/${u.id}`}>
                  <Avatar profile={u} size="md" />
                  <div className="grow small m">{profileDisplayName(u)}</div>
                  <span className="pill" title="Every project for this client">Whole client</span>
                </Link>
              ))}
              {projectOnly.map((u) => {
                const n = projectMembers.filter((m) => m.user_id === u.id && cProjects.some((p) => p.id === m.project_id)).length
                return (
                  <Link key={u.id} className="row" to={`/team/${u.id}`}>
                    <Avatar profile={u} size="md" />
                    <div className="grow small m">{profileDisplayName(u)}</div>
                    <span className="pill" title="Only the projects shared with them">{n} project{n === 1 ? '' : 's'}</span>
                  </Link>
                )
              })}
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
      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title={`Archive ${name}?`}
        description="They’re hidden from lists and the sidebar. Projects, invoices and payments are kept, and you can restore them anytime."
        confirmLabel="Archive"
        onConfirm={() => setStatus('archived')}
      />
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
