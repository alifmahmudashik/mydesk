import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Link2, Mail, MoreHorizontal, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { useUI } from '@/data/ui'
import { useIsAdmin } from '@/hooks/usePermissions'
import { TeamLinks } from '@/features/team/TeamLinks'
import { Topbar, Content, PageHead } from '@/components/ui/layout'
import { Tabs } from '@/components/ui/tabs'
import { Menu, MenuItem } from '@/components/ui/menu'
import { Avatar } from '@/components/ui/avatar'
import { supabase } from '@/lib/supabase'
import { clientColor, clientDisplayName, OPEN_PROJECT, OPEN_TASK, profileDisplayName, profileFullName, isAssignedTo } from '@/lib/derive'
import { formatFeedAgo } from '@/lib/format'
import { copyText } from '@/lib/utils'
import type { ClientMember, Invite } from '@/types'

const roleTone = { owner: 'pri', admin: 'teal', member: '' } as const
const roleLabel = { owner: 'Owner', admin: 'Admin', member: 'Member' } as const

export function inviteLink(inv: Invite) {
  return `${window.location.origin}/invite/${inv.token}`
}

export function TeamPage() {
  const isAdmin = useIsAdmin()
  const { openCreate } = useUI()
  const { profiles, clients, projects, tasks, clientMembers, invites, me, onlineIds, demoMode, createRow, deleteRow, updateRow } = useData()
  const [params, setParams] = useSearchParams()
  const focusClient = params.get('client')
  const tab = (params.get('tab') as 'members' | 'access' | 'roles') || (focusClient ? 'access' : 'members')

  const members = profiles.filter((p) => p.role === 'member')
  const pending = invites.filter((i) => !i.accepted_at && !i.revoked_at)
  const sortedClients = [...clients].sort((a, b) => Number(a.status === 'archived') - Number(b.status === 'archived') || clientDisplayName(a).localeCompare(clientDisplayName(b)))

  // Client-access matrix is edited as a draft, then saved in one go.
  const current = useMemo(() => new Set(clientMembers.map((m) => `${m.client_id}:${m.user_id}`)), [clientMembers])
  const [draft, setDraft] = useState<Set<string>>(current)
  useEffect(() => setDraft(new Set(current)), [current])
  const changed = [...draft].filter((k) => !current.has(k)).length + [...current].filter((k) => !draft.has(k)).length

  const saveAccess = () => {
    for (const key of draft) {
      if (current.has(key)) continue
      const [client_id, user_id] = key.split(':')
      createRow<ClientMember>('client_members', { client_id, user_id })
    }
    for (const m of clientMembers) {
      if (!draft.has(`${m.client_id}:${m.user_id}`)) deleteRow('client_members', m.id)
    }
    toast.success('Access saved')
  }

  const resend = async (inv: Invite) => {
    if (demoMode || !supabase) return toast.success(`Invite re-sent to ${inv.email} (demo)`)
    const { error } = await supabase.rpc('resend_invite', { p_invite: inv.id })
    if (error) toast.error('Couldn’t resend', { description: error.message })
    else toast.success(`Invite re-sent to ${inv.email}`)
  }

  const copyInvite = async () => {
    const inv = pending[0]
    if (!inv) {
      openCreate('invite')
      return
    }
    await copyText(inviteLink(inv))
    toast.success(`Copied invite link for ${inv.email}`)
  }

  const lastActive = (id: string, at?: string | null) => {
    if (onlineIds.includes(id) || id === me?.id) return <span className="row-sm t-ok small"><span className="live" />{id === me?.id ? 'Now' : 'Online'}</span>
    if (!at) return <span className="small muted">—</span>
    const recent = Date.now() - new Date(at).getTime() < 30 * 60 * 1000
    return recent ? <span className="row-sm t-ok small"><span className="live" />{formatFeedAgo(at)}</span> : <span className="small muted">{formatFeedAgo(at)}</span>
  }

  return (
    <>
      <Topbar crumbs={[{ label: 'Team & access' }]}>
        {isAdmin && (
          <>
            <button type="button" className="btn hide-sm" onClick={() => void copyInvite()}><Link2 className="i" />Copy invite link</button>
            <button type="button" className="btn btn-pri" onClick={() => openCreate('invite')}><UserPlus className="i" />Invite member</button>
          </>
        )}
      </Topbar>
      <Content>
        <PageHead title="Team & access" sub="Who is in your workspace, what they can do, and which clients they can see." />
        <TeamLinks />
        <div className="tabs">
          <Tabs
            value={tab}
            onChange={(t) => setParams(t === 'members' ? {} : { tab: t }, { replace: true })}
            tabs={[
              { id: 'members', label: 'Members', count: profiles.length },
              ...(isAdmin ? [{ id: 'access' as const, label: 'Client access' }] : []),
              { id: 'roles', label: 'Roles' },
            ]}
          />
          <div className="panel-in" key={tab}>
            {tab === 'members' && (
              <div className="card tbl-wrap">
                <table className="tbl" style={{ minWidth: 860 }}>
                  <thead><tr><th>Person</th><th>Role</th><th>Access</th><th>Open tasks</th><th>Last active</th><th /></tr></thead>
                  <tbody>
                    {profiles.map((p) => {
                      const granted = clients.filter((c) => clientMembers.some((m) => m.client_id === c.id && m.user_id === p.id))
                      // Current work only: open projects under the clients they can see (not every project ever made).
                      const nProjects = projects.filter((x) => OPEN_PROJECT(x) && granted.some((c) => c.id === x.client_id)).length
                      const open = tasks.filter((t) => isAssignedTo(t, p.id) && OPEN_TASK(t)).length
                      const to = p.id === me?.id ? '/account' : `/team/${p.id}`
                      return (
                        <tr key={p.id} className="hov">
                          <td>
                            <Link className="row cover" to={to}>
                              <Avatar profile={p} size="lg" />
                              <span style={{ minWidth: 0 }}>
                                <span className="b" style={{ display: 'block' }}>{profileFullName(p)} {p.id === me?.id && <span className="muted m">(you)</span>}</span>
                                <span className="xs muted">{p.email}</span>
                              </span>
                            </Link>
                          </td>
                          <td><span className={`pill ${roleTone[p.role]}`}>{roleLabel[p.role]}</span></td>
                          <td>
                            {p.role !== 'member' ? (
                              <span className="muted">All {clients.length} clients</span>
                            ) : granted.length === 0 ? (
                              <span className="faint small">No clients yet</span>
                            ) : (
                              <span className="row-sm wrap">
                                {granted.slice(0, 3).map((c) => <span key={c.id} className="tag" style={{ background: `${clientColor(c)}1F`, color: clientColor(c) }}>{clientDisplayName(c)}</span>)}
                                {granted.length > 3 && <span className="xs muted">+{granted.length - 3}</span>}
                                <span className="xs muted">{nProjects} active project{nProjects === 1 ? '' : 's'}</span>
                              </span>
                            )}
                          </td>
                          <td>{open}</td>
                          <td>{lastActive(p.id, p.last_active_at)}</td>
                          <td className="r">{isAdmin && p.id !== me?.id && p.role !== 'owner' && <Link className="btn btn-sm above" to={to}>Edit</Link>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {isAdmin && pending.length > 0 && (
                  <div className="list" style={{ borderTop: '1px solid var(--line-s)' }}>
                    {pending.map((inv) => (
                      <div key={inv.id} className="li">
                        <span className="av md gray"><Mail className="i i-sm" /></span>
                        <div className="grow" style={{ minWidth: 0 }}>
                          <div className="t trunc">{inv.email}</div>
                          <div className="s">Pending invite · {roleLabel[inv.role]}{inv.client_ids.length ? ` · ${inv.client_ids.length} client${inv.client_ids.length === 1 ? '' : 's'}` : ''} · sent {formatFeedAgo(inv.created_at)}</div>
                        </div>
                        <button type="button" className="btn btn-sm" onClick={() => void resend(inv)}>Resend</button>
                        <Menu trigger={({ toggle }) => <button type="button" className="btn btn-sm btn-icon" aria-label="More" onClick={toggle}><MoreHorizontal className="i" /></button>}>
                          <MenuItem icon={<Link2 className="i" />} onSelect={() => void copyText(inviteLink(inv)).then(() => toast.success('Invite link copied'))}>Copy invite link</MenuItem>
                          <MenuItem danger icon={<Trash2 className="i" />} onSelect={() => { updateRow('invites', inv.id, { revoked_at: new Date().toISOString() }); toast.success('Invite revoked') }}>Revoke invite</MenuItem>
                        </Menu>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'access' && isAdmin && (
              <div className="card">
                <div className="card-h">
                  <div>
                    <h2 className="h2">Client access</h2>
                    <div className="xs muted" style={{ marginTop: 2 }}>Granting a client opens every project and task under it.</div>
                  </div>
                  <span className="small muted">{draft.size} grant{draft.size === 1 ? '' : 's'}</span>
                </div>
                {members.length === 0 ? (
                  <div className="empty">
                    <b>No members yet</b>
                    <p>Owners and admins see every client. Invite a member to give them access to specific clients.</p>
                    <button type="button" className="btn btn-sm mt-8" onClick={() => openCreate('invite')}><UserPlus className="i i-sm" />Invite member</button>
                  </div>
                ) : (
                  <div className="tbl-wrap matrix">
                    <table className="tbl" style={{ minWidth: 600 }}>
                      <thead>
                        <tr>
                          <th>Client</th>
                          <th>Projects</th>
                          {profiles.filter((p) => p.role !== 'member').slice(0, 1).map((p) => <th key={p.id} className="c" style={{ width: 120 }}>{profileDisplayName(p)}</th>)}
                          {members.map((p) => <th key={p.id} className="c" style={{ width: 120 }}>{profileDisplayName(p)}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedClients.map((c, i) => (
                          <Fragment key={c.id}>
                            {c.status === 'archived' && sortedClients[i - 1]?.status !== 'archived' && (
                              <tr className="grp"><td colSpan={3 + members.length}>Archived</td></tr>
                            )}
                            <tr className="hov" style={focusClient === c.id ? { background: 'var(--sel-bg)' } : undefined}>
                              <td><span className="row"><span className="sq cc" style={{ ['--cc' as string]: clientColor(c) }} /><span className={c.status === 'archived' ? 'muted' : 'm'}>{clientDisplayName(c)}</span></span></td>
                              <td className="muted">{projects.filter((p) => p.client_id === c.id).length}</td>
                              <td className="c"><span className="st done" style={{ display: 'block', margin: 'auto' }} title="Owners and admins see every client" /></td>
                              {members.map((p) => {
                                const key = `${c.id}:${p.id}`
                                return (
                                  <td key={p.id}>
                                    <input
                                      className="cb"
                                      type="checkbox"
                                      checked={draft.has(key)}
                                      aria-label={`${profileDisplayName(p)} — ${clientDisplayName(c)}`}
                                      onChange={(e) =>
                                        setDraft((s) => {
                                          const n = new Set(s)
                                          if (e.target.checked) n.add(key)
                                          else n.delete(key)
                                          return n
                                        })
                                      }
                                    />
                                  </td>
                                )
                              })}
                            </tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="card-f">
                  <span className="muted">Owners and admins always see every client.</span>
                  <div className="row-sm">
                    {changed > 0 && <button type="button" className="btn btn-sm" onClick={() => setDraft(new Set(current))}>Reset</button>}
                    <button type="button" className="btn btn-pri btn-sm" disabled={changed === 0} onClick={saveAccess}>Save access{changed ? ` (${changed})` : ''}</button>
                  </div>
                </div>
              </div>
            )}

            {tab === 'roles' && (
              <div className="grid-3">
                <div className="role-card"><span className="pill pri">Owner</span><p>Everything: all clients, money, invoices, billing and team settings. Only one owner.</p></div>
                <div className="role-card"><span className="pill teal">Admin</span><p>Every client and project, payments and invoices. Can invite people. Can’t remove the owner.</p></div>
                <div className="role-card"><span className="pill">Member</span><p>Projects, tasks, notes and comments under the clients you grant. No budgets, payments or contact details.</p></div>
              </div>
            )}
          </div>
        </div>
      </Content>
    </>
  )
}
