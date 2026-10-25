import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { format, parseISO, startOfMonth } from 'date-fns'
import { AlertTriangle, Briefcase, Key, ListChecks, User } from 'lucide-react'
import { toast } from 'sonner'
import { api, useData } from '@/data/store'
import { useIsAdmin, useIsOwner } from '@/hooks/usePermissions'
import { Topbar, Content, Empty, Section, SaveBar } from '@/components/ui/layout'
import { SettingsLayout, useUnsavedGuard } from '@/components/ui/settings-layout'
import { RadioCard } from '@/components/ui/field'
import { Avatar, ClientMark } from '@/components/ui/avatar'
import { DateChip, StatusRing } from '@/components/ui/pill'
import { ConfirmDialog } from '@/components/ui/modal'
import { ProfileFields, draftPatch, profileDraft, type ProfileDraft } from '@/features/team/ProfileFields'
import { clientDisplayName, OPEN_TASK, profileDisplayName, profileFullName, shortProjectTitle, isAssignedTo, taskAssigneeIds } from '@/lib/derive'
import { formatDate, formatFeedAgo } from '@/lib/format'
import type { ClientMember, Role } from '@/types'

const roleLabel = { owner: 'Owner', admin: 'Admin', member: 'Member' } as const

export function MemberPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const isOwner = useIsOwner()
  const { profiles, clients, projects, tasks, clientMembers, onlineIds, me, demoMode, updateRow, createRow, deleteRow } = useData()
  const person = profiles.find((p) => p.id === id)

  const grantedNow = useMemo(() => new Set(clientMembers.filter((m) => m.user_id === id).map((m) => m.client_id)), [clientMembers, id])
  const [draft, setDraft] = useState<ProfileDraft | null>(person ? profileDraft(person) : null)
  const [role, setRole] = useState<Role>(person?.role ?? 'member')
  const [access, setAccess] = useState<Set<string>>(grantedNow)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    if (person) {
      setDraft(profileDraft(person))
      setRole(person.role)
    }
  }, [person?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setAccess(new Set(grantedNow)), [grantedNow])

  const profileDirty = person && draft ? JSON.stringify(draftPatch(draft)) !== JSON.stringify(draftPatch(profileDraft(person))) : false
  const accessDirty = [...access].some((c) => !grantedNow.has(c)) || [...grantedNow].some((c) => !access.has(c))
  const dirty = profileDirty || accessDirty || role !== person?.role
  useUnsavedGuard(dirty)

  if (id === me?.id) return <Navigate to="/account" replace />
  if (!person || !draft) {
    return (
      <>
        <Topbar crumbs={[{ label: 'Team', to: '/team' }, { label: 'Not found' }]} />
        <Content><div className="card"><Empty title="Person not found">They may have been removed from the workspace.</Empty></div></Content>
      </>
    )
  }

  const name = profileDisplayName(person)
  const canEdit = isAdmin && person.role !== 'owner' && (person.role !== 'admin' || isOwner)
  const open = tasks.filter((t) => isAssignedTo(t, id) && OPEN_TASK(t))
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const doneThisMonth = tasks.filter((t) => isAssignedTo(t, id) && t.status === 'done' && (t.completed_at ?? '') >= monthStart)
  const work = [...open, ...doneThisMonth.slice(0, 5)]
  const activeClients = clients.filter((c) => c.status !== 'archived')

  const save = () => {
    if (profileDirty) updateRow('profiles', person.id, draftPatch(draft))
    if (role !== person.role) updateRow('profiles', person.id, { role }, { entity: 'member', entityId: person.id, action: 'updated', message: `changed ${name}'s role to ${roleLabel[role]}` })
    if (accessDirty) {
      for (const c of access) if (!grantedNow.has(c)) createRow<ClientMember>('client_members', { client_id: c, user_id: person.id })
      for (const m of clientMembers.filter((m) => m.user_id === person.id)) if (!access.has(m.client_id)) deleteRow('client_members', m.id)
    }
    toast.success(`Saved changes for ${name}`)
  }

  const remove = async () => {
    try {
      if (!demoMode) await api('team/remove', { user_id: person.id })
      useData.setState((s) => ({
        profiles: s.profiles.filter((p) => p.id !== person.id),
        clientMembers: s.clientMembers.filter((m) => m.user_id !== person.id),
        tasks: s.tasks.map((t) => {
          if (!isAssignedTo(t, person.id)) return t
          const ids = taskAssigneeIds(t).filter((x) => x !== person.id)
          return { ...t, assignee_ids: ids, assignee_id: ids[0] ?? null }
        }),
      }))
      toast.success(`${name} was removed`)
      navigate('/team')
    } catch (err) {
      toast.error('Couldn’t remove member', { description: err instanceof Error ? err.message : undefined })
    }
  }

  const online = onlineIds.includes(person.id)

  return (
    <>
      <Topbar crumbs={[{ label: 'Team', to: '/team' }, { label: name }]}>
        {canEdit && (
          <>
            <button type="button" className="btn" onClick={() => navigate('/team')}>Cancel</button>
            <button type="button" className="btn btn-pri" disabled={!dirty} onClick={save}>Save changes</button>
          </>
        )}
      </Topbar>
      <Content>
        <div className="profile-head">
          <Avatar profile={person} size="xl" />
          <div className="grow">
            <div className="row-sm wrap">
              <h1>{name}</h1>
              <span className="pill">{roleLabel[person.role]}</span>
              {(online || person.last_active_at) && (
                <span className={`row-sm small ${online ? 't-ok' : 'muted'}`}>
                  {online && <span className="live" />}
                  {online ? 'Online now' : `Active ${formatFeedAgo(person.last_active_at!)}`}
                </span>
              )}
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {person.email} · joined {format(parseISO(person.created_at), 'MMM d')}
              {person.job_title ? ` · ${person.job_title}` : ''}
            </div>
          </div>
          <div className="kstrip" style={{ gridTemplateColumns: 'repeat(3,auto)' }}>
            <div style={{ padding: '10px 16px' }}><div className="xs muted">Open tasks</div><div className="b" style={{ fontSize: 18 }}>{open.length}</div></div>
            <div style={{ padding: '10px 16px' }}><div className="xs muted">Done this month</div><div className="b" style={{ fontSize: 18 }}>{doneThisMonth.length}</div></div>
            <div style={{ padding: '10px 16px' }}><div className="xs muted">Clients</div><div className="b" style={{ fontSize: 18 }}>{person.role === 'member' ? grantedNow.size : 'All'}</div></div>
          </div>
        </div>

        <SettingsLayout
          nav={[
            ...(canEdit ? [{ id: 'profile', label: 'Personal info', icon: <User className="i i-sm" /> }, { id: 'role', label: 'Role', icon: <Key className="i i-sm" /> }] : []),
            ...(canEdit && role === 'member' ? [{ id: 'access', label: 'Client access', icon: <Briefcase className="i i-sm" /> }] : []),
            { id: 'work', label: 'Work', icon: <ListChecks className="i i-sm" /> },
            ...(canEdit ? [{ id: 'danger', label: 'Remove', icon: <AlertTriangle className="i i-sm" />, danger: true }] : []),
          ]}
        >
          {canEdit && (
            <Section id="profile" title="Personal info" desc={`${name} can also edit this from their own profile.`}>
              <ProfileFields profile={person} draft={draft} onChange={setDraft} phoneLabel="Phone / WhatsApp" />
            </Section>
          )}
          {canEdit && (
            <Section id="role" title="Role" desc={`What ${name} can see and change.`}>
              <div className="grid-3">
                <RadioCard name="mbr" checked={role === 'owner'} onChange={() => {}} disabled title="Owner" desc="Only one per workspace." />
                <RadioCard name="mbr" checked={role === 'admin'} onChange={() => setRole('admin')} title="Admin" desc="All clients, payments and invoices." />
                <RadioCard name="mbr" checked={role === 'member'} onChange={() => setRole('member')} title="Member" desc="Only granted clients. No money." />
              </div>
            </Section>
          )}
          {canEdit && role === 'member' && (
            <Section id="access" title="Client access" desc="Every project and task under a checked client.">
              <div className="card" style={{ margin: '-4px 0' }}>
                {activeClients.map((c) => {
                  const n = projects.filter((p) => p.client_id === c.id).length
                  return (
                    <label key={c.id} className="check-row">
                      <input
                        className="cb"
                        type="checkbox"
                        checked={access.has(c.id)}
                        onChange={(e) =>
                          setAccess((s) => {
                            const x = new Set(s)
                            if (e.target.checked) x.add(c.id)
                            else x.delete(c.id)
                            return x
                          })
                        }
                      />
                      <ClientMark client={c} size="sm" />
                      <span className="txt m">{clientDisplayName(c)}</span>
                      <span className="xs muted">{n} project{n === 1 ? '' : 's'}</span>
                    </label>
                  )
                })}
              </div>
            </Section>
          )}
          <section id="work" className="sec">
            <div className="sec-h"><h2>Current work</h2></div>
            <div className="list">
              {work.length === 0 && <Empty small title="Nothing assigned">Tasks assigned to {name} show up here.</Empty>}
              {work.map((t) => {
                const p = projects.find((x) => x.id === t.project_id)
                return (
                  <Link key={t.id} className="li" to={`/tasks/${t.id}`}>
                    <StatusRing status={t.status} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className={`t trunc ${t.status === 'done' ? 'muted' : ''}`}>{t.title}</div>
                      <div className="s">{p ? shortProjectTitle(p.title) : ''}</div>
                    </div>
                    {t.status === 'done' ? <span className="xs muted">{formatDate((t.completed_at ?? t.created_at).slice(0, 10))}</span> : <DateChip date={t.due_date} empty="" />}
                  </Link>
                )
              })}
            </div>
          </section>
          {canEdit && (
            <Section id="danger" title="Remove from workspace" danger>
              <div className="danger-row">
                <div><b>Remove {name}</b><small>Their tasks stay and become unassigned. They lose access immediately.</small></div>
                <button type="button" className="btn btn-danger" onClick={() => setConfirmRemove(true)}>Remove member</button>
              </div>
            </Section>
          )}
        </SettingsLayout>
      </Content>
      {canEdit && dirty && <SaveBar note={`Changes save for ${name} only`} onCancel={() => { setDraft(profileDraft(person)); setRole(person.role); setAccess(new Set(grantedNow)) }} onSave={save} />}
      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={`Remove ${profileFullName(person)}?`}
        description={`${open.length} open task${open.length === 1 ? '' : 's'} will become unassigned and they lose access right away. You can invite them again later.`}
        confirmLabel="Remove member"
        onConfirm={() => void remove()}
      />
    </>
  )
}
