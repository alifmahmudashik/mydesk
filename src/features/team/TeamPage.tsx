import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Link2, Mail, MoreHorizontal, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { useUI } from '@/data/ui'
import { useIsAdmin } from '@/hooks/usePermissions'
import { TeamLinks } from '@/features/team/TeamLinks'
import { MemberAccessModal } from '@/features/team/MemberAccessModal'
import { setMemberAccess } from '@/data/actions'
import { Topbar, Content, PageHead } from '@/components/ui/layout'
import { Tabs } from '@/components/ui/tabs'
import { Menu, MenuItem } from '@/components/ui/menu'
import { Avatar } from '@/components/ui/avatar'
import { supabase } from '@/lib/supabase'
import { clientColor, clientDisplayName, OPEN_PROJECT, OPEN_TASK, profileDisplayName, profileFullName, isAssignedTo, shortProjectTitle } from '@/lib/derive'
import { formatFeedAgo } from '@/lib/format'
import { copyText } from '@/lib/utils'
import type { Invite, Profile } from '@/types'

const roleTone = { owner: 'pri', admin: 'teal', member: '' } as const
const roleLabel = { owner: 'Owner', admin: 'Admin', member: 'Member' } as const

export function inviteLink(inv: Invite) {
  return `${window.location.origin}/invite/${inv.token}`
}

export function TeamPage() {
  const isAdmin = useIsAdmin()
  const { openCreate } = useUI()
  const { profiles, clients, projects, tasks, clientMembers, projectMembers, invites, me, onlineIds, demoMode, accessV2Ready, updateRow } = useData()
  const [accessFor, setAccessFor] = useState<Profile | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [params, setParams] = useSearchParams()
  const focusClient = params.get('client')
  const tab = (params.get('tab') as 'members' | 'access' | 'roles') || (focusClient ? 'access' : 'members')

  const members = profiles.filter((p) => p.role === 'member')
  const pending = invites.filter((i) => !i.accepted_at && !i.revoked_at)
  const sortedClients = [...clients].sort((a, b) => Number(a.status === 'archived') - Number(b.status === 'archived') || clientDisplayName(a).localeCompare(clientDisplayName(b)))

  // Access grid is edited as a draft, then saved in one go.
  // Keys: "c:<client>:<user>" for a whole client, "p:<project>:<user>" for one project.
  const current = useMemo(
    () => new Set([...clientMembers.map((m) => `c:${m.client_id}:${m.user_id}`), ...projectMembers.map((m) => `p:${m.project_id}:${m.user_id}`)]),
    [clientMembers, projectMembers],
  )
  const [draft, setDraft] = useState<Set<string>>(current)
  useEffect(() => setDraft(new Set(current)), [current])
  const changed = [...draft].filter((k) => !current.has(k)).length + [...current].filter((k) => !draft.has(k)).length
  const flip = (key: string, on: boolean) =>
    setDraft((s) => {
      const n = new Set(s)
      if (on) n.add(key)
      else n.delete(key)
      return n
    })

  // Clients that have single-project grants start opened, so those show.
  useEffect(() => {
    setExpanded((s) => new Set([...s, ...projectMembers.map((m) => projects.find((p) => p.id === m.project_id)?.client_id ?? '').filter(Boolean)]))
  }, [projectMembers.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveAccess = () => {
    for (const p of members) {
      const mine = (k: string) => k.endsWith(`:${p.id}`)
      const before = [...current].filter(mine).sort().join()
      const after = [...draft].filter(mine).sort().join()
      if (before === after) continue
      const keys = [...draft].filter(mine)
      setMemberAccess(
        p.id,
        new Set(keys.filter((k) => k.startsWith('c:')).map((k) => k.split(':')[1])),
        new Set(keys.filter((k) => k.startsWith('p:')).map((k) => k.split(':')[1])),
      )
    }
    toast.success('Access saved')
  }
  const sharedProjects = (clientId: string) => projects.filter((p) => p.client_id === clientId && (OPEN_PROJECT(p) || members.some((m) => draft.has(`p:${p.id}:${m.id}`))))

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
                      const single = projectMembers.filter((m) => m.user_id === p.id && !granted.some((c) => projects.find((x) => x.id === m.project_id)?.client_id === c.id)).length
                      // Current work only: open projects under the clients they can see (not every project ever made).
                      const nProjects = projects.filter((x) => OPEN_PROJECT(x) && (granted.some((c) => c.id === x.client_id) || projectMembers.some((m) => m.user_id === p.id && m.project_id === x.id))).length
                      const open = tasks.filter((t) => isAssignedTo(t, p.id) && OPEN_TASK(t)).length
                      const to = p.id === me?.id ? '/account' : `/team/${p.id}`
                      // Admins clicking a member open their access; Edit (right) opens the profile.
                      const opensAccess = isAdmin && p.role === 'member'
                      const who = (
                        <>
                          <Avatar profile={p} size="lg" />
                          <span style={{ minWidth: 0 }}>
                            <span className="b" style={{ display: 'block' }}>{profileFullName(p)} {p.id === me?.id && <span className="muted m">(you)</span>}</span>
                            <span className="xs muted">{p.email}</span>
                          </span>
                        </>
                      )
                      return (
                        <tr key={p.id} className="hov">
                          <td>
                            {opensAccess ? (
                              <button type="button" className="row cover link-plain" style={{ textAlign: 'left' }} title="Client and project access" onClick={() => setAccessFor(p)}>{who}</button>
                            ) : (
                              <Link className="row cover" to={to}>{who}</Link>
                            )}
                          </td>
                          <td><span className={`pill ${roleTone[p.role]}`}>{roleLabel[p.role]}</span></td>
                          <td>
                            {p.role !== 'member' ? (
                              <span className="muted">All {clients.length} clients</span>
                            ) : granted.length === 0 && single === 0 ? (
                              <span className="faint small">No access yet{isAdmin ? ' · click their name' : ''}</span>
                            ) : (
                              <span className="row-sm wrap">
                                <span className="small m">
                                  {[granted.length ? `${granted.length} client${granted.length === 1 ? '' : 's'}` : '', single ? `${single} project${single === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ')}
                                </span>
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
                    <div className="xs muted" style={{ marginTop: 2 }}>Tick a client for every project under it. Open a client (arrow) to tick single projects: they’ll see only those.</div>
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
                        {sortedClients.map((c, i) => {
                          const ps = sharedProjects(c.id)
                          const isOpen = expanded.has(c.id)
                          return (
                            <Fragment key={c.id}>
                              {c.status === 'archived' && sortedClients[i - 1]?.status !== 'archived' && (
                                <tr className="grp"><td colSpan={3 + members.length}>Archived</td></tr>
                              )}
                              <tr className="hov" style={focusClient === c.id ? { background: 'var(--sel-bg)' } : undefined}>
                                <td>
                                  <button
                                    type="button"
                                    className="row link-plain"
                                    style={ps.length ? undefined : { cursor: 'default' }}
                                    title={ps.length ? (isOpen ? 'Hide projects' : 'Show projects to share one at a time') : undefined}
                                    onClick={() => ps.length > 0 && setExpanded((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n })}
                                  >
                                    {ps.length ? (isOpen ? <ChevronDown className="i i-sm faint" /> : <ChevronRight className="i i-sm faint" />) : <span style={{ width: 16 }} />}
                                    <span className="sq cc" style={{ ['--cc' as string]: clientColor(c) }} />
                                    <span className={c.status === 'archived' ? 'muted' : 'm'}>{clientDisplayName(c)}</span>
                                  </button>
                                </td>
                                <td className="muted">{projects.filter((p) => p.client_id === c.id).length}</td>
                                <td className="c"><span className="st done" style={{ display: 'block', margin: 'auto' }} title="Owners and admins see every client" /></td>
                                {members.map((p) => {
                                  const key = `c:${c.id}:${p.id}`
                                  const some = ps.filter((x) => draft.has(`p:${x.id}:${p.id}`)).length
                                  return (
                                    <td key={p.id}>
                                      <span className="row-sm">
                                        <input className="cb" type="checkbox" checked={draft.has(key)} aria-label={`${profileDisplayName(p)}: all of ${clientDisplayName(c)}`} onChange={(e) => flip(key, e.target.checked)} />
                                        {!draft.has(key) && some > 0 && <span className="xs muted" title="Single projects">{some} proj</span>}
                                      </span>
                                    </td>
                                  )
                                })}
                              </tr>
                              {isOpen &&
                                ps.map((x) => (
                                  <tr key={x.id} className="proj-row">
                                    <td><span className="small trunc" style={{ display: 'block', maxWidth: 320 }}>{shortProjectTitle(x.title)}</span></td>
                                    <td className="xs muted">{OPEN_PROJECT(x) ? '' : 'closed'}</td>
                                    <td />
                                    {members.map((p) => {
                                      const whole = draft.has(`c:${c.id}:${p.id}`)
                                      const key = `p:${x.id}:${p.id}`
                                      return (
                                        <td key={p.id}>
                                          <input
                                            className="cb"
                                            type="checkbox"
                                            disabled={whole || !accessV2Ready}
                                            title={whole ? 'Included with the whole client' : 'Only this project'}
                                            checked={whole || draft.has(key)}
                                            aria-label={`${profileDisplayName(p)}: ${x.title}`}
                                            onChange={(e) => flip(key, e.target.checked)}
                                          />
                                        </td>
                                      )
                                    })}
                                  </tr>
                                ))}
                            </Fragment>
                          )
                        })}
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
                <div className="role-card"><span className="pill">Member</span><p>With a whole client: every project under it, and they can create projects and assign tasks. With a single project: only that project, where they can add and assign tasks. No budgets, payments or contact details.</p></div>
              </div>
            )}
          </div>
        </div>
      </Content>
      <MemberAccessModal person={accessFor} onClose={() => setAccessFor(null)} />
    </>
  )
}
