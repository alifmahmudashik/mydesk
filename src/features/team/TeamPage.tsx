import { AnimatePresence, motion } from 'framer-motion'
import { UserRound } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { CheckboxRow } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Select, type SelectOption } from '@/components/ui/select'
import { ListSkeleton } from '@/components/ui/skeleton'
import { StatusPill } from '@/components/ui/status-pill'
import { useData } from '@/data/store'
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

/**
 * Team management, open to everyone: roles (promote/demote anyone but yourself
 * or the owner) and per-client access (grant clients you yourself can see).
 */
export function TeamPage() {
  const { ready, profiles, projects, clients, clientMembers, me, updateRow, createRow, deleteRow } =
    useData()

  if (!ready) {
    return (
      <>
        <PageHeader title="Team" />
        <ListSkeleton rows={3} />
      </>
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
        description="Who can sign in, their role, and which clients they can see."
      />

      <p className="mb-4 rounded-xl border border-dashed px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        Anyone can create an account from the sign-in page — they start as a{' '}
        <span className="font-medium text-foreground">member</span> with no access until granted a
        client here. A granted client unlocks every project and task under it — create, edit, delete,
        assign teammates, invite others — including work assigned to someone else. Client contact
        details, budgets, and payments stay visible to{' '}
        <span className="font-medium text-foreground">admins</span> only, who also see every client.
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
                    {profile.role === 'owner' || isSelf ? (
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
                      {isSelf ? (
                        // You can't grant yourself a client you don't already have (the database
                        // correctly blocks it — you can only invite others into clients you can
                        // already see), so this is a read-only summary, not a checklist.
                        memberClients.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {memberClients.map((m) => {
                              const c = clients.find((c) => c.id === m.client_id)
                              return c ? (
                                <span
                                  key={m.id}
                                  className="rounded-md bg-surface-hover px-2 py-1 text-[13px] font-medium"
                                >
                                  {clientDisplayName(c)}
                                </span>
                              ) : null
                            })}
                          </div>
                        ) : (
                          <p className="text-[13px] text-muted-foreground">
                            No client access yet — ask an admin or a teammate on the relevant account
                            to grant you one.
                          </p>
                        )
                      ) : clients.length === 0 ? (
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
