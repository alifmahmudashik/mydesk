import { AnimatePresence, motion } from 'framer-motion'
import { ShieldCheck, UserRound } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { CheckboxRow } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Select, type SelectOption } from '@/components/ui/select'
import { ListSkeleton } from '@/components/ui/skeleton'
import { StatusPill } from '@/components/ui/status-pill'
import { useData } from '@/data/store'
import { useIsAdmin, useIsOwner } from '@/hooks/usePermissions'
import { clientDisplayName, profileDisplayName } from '@/lib/derive'
import { listContainer, listItem } from '@/lib/motion'
import type { ClientMember, Profile, Role } from '@/types'

const roleMeta: Record<Role, { label: string; tone: 'accent' | 'green' | 'neutral' }> = {
  owner: { label: 'Owner', tone: 'accent' },
  admin: { label: 'Admin', tone: 'green' },
  member: { label: 'Member', tone: 'neutral' },
}

const roleOptions: SelectOption<Role>[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
]

/** Team management: roles (owner-only) and per-member client access (admins). */
export function TeamPage() {
  const { ready, profiles, projects, clients, clientMembers, me, updateRow, createRow, deleteRow } =
    useData()
  const isAdmin = useIsAdmin()
  const isOwner = useIsOwner()

  if (!ready) {
    return (
      <>
        <PageHeader title="Team" />
        <ListSkeleton rows={3} />
      </>
    )
  }

  if (!isAdmin) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Admins only"
        description="Ask the workspace owner if you need access changes."
      />
    )
  }

  const setRole = (profile: Profile, role: Role) => {
    if (role === profile.role) return
    updateRow('profiles', profile.id, { role })
  }

  const toggleAccess = (profile: Profile, clientId: string, on: boolean) => {
    const existing = clientMembers.find(
      (m) => m.client_id === clientId && m.user_id === profile.id,
    )
    if (on && !existing) {
      createRow<ClientMember>('client_members', { client_id: clientId, user_id: profile.id })
    } else if (!on && existing) {
      deleteRow('client_members', existing.id)
    }
  }

  return (
    <>
      <PageHeader
        title="Team"
        description="Who can sign in, their role, and which clients members can see."
      />

      <p className="mb-4 rounded-xl border border-dashed px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        Anyone can create an account from the sign-in page — they start as a{' '}
        <span className="font-medium text-foreground">member</span> with no access until you grant
        clients below. Granting a client gives every project (and task) under it, including work
        assigned to teammates — client contact details, budgets, and payments stay hidden.{' '}
        <span className="font-medium text-foreground">Admins</span> see everything you see.
      </p>

      <motion.div variants={listContainer} initial="initial" animate="animate" className="space-y-4">
        <AnimatePresence initial={false}>
          {profiles.map((profile) => {
            const isSelf = profile.id === me?.id
            const memberClients = clientMembers.filter((m) => m.user_id === profile.id)
            return (
              <motion.div key={profile.id} layout="position" variants={listItem} exit="exit">
                <Card className="p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar name={profileDisplayName(profile)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {profileDisplayName(profile)}
                        {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
                    </div>
                    {profile.role === 'owner' || isSelf || !isOwner ? (
                      <StatusPill meta={roleMeta[profile.role]} animate={false} />
                    ) : (
                      <Select
                        value={profile.role}
                        onChange={(v) => setRole(profile, v)}
                        options={roleOptions}
                        aria-label={`Role for ${profileDisplayName(profile)}`}
                        className="h-8 w-30 text-[13px]"
                      />
                    )}
                  </div>

                  {profile.role === 'member' && (
                    <div className="mt-4 border-t pt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Client access · {memberClients.length}
                      </p>
                      {clients.length === 0 ? (
                        <p className="text-[13px] text-muted-foreground">No clients yet.</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {clients.map((c) => {
                            const count = projects.filter((p) => p.client_id === c.id).length
                            return (
                              <CheckboxRow
                                key={c.id}
                                checked={memberClients.some((m) => m.client_id === c.id)}
                                onChange={(on) => toggleAccess(profile, c.id, on)}
                                label={clientDisplayName(c)}
                                sublabel={`${count} project${count === 1 ? '' : 's'}`}
                              />
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </motion.div>

      {profiles.length <= 1 && (
        <div className="mt-4">
          <EmptyState
            icon={UserRound}
            title="Just you so far"
            description="Share the app's sign-in link — new sign-ups appear here as members with no access until you grant clients."
          />
        </div>
      )}
    </>
  )
}
