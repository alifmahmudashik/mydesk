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
import { clientDisplayName } from '@/lib/derive'
import { listContainer, listItem } from '@/lib/motion'
import type { Profile, ProjectMember, Role } from '@/types'

const roleMeta: Record<Role, { label: string; tone: 'accent' | 'green' | 'neutral' }> = {
  owner: { label: 'Owner', tone: 'accent' },
  admin: { label: 'Admin', tone: 'green' },
  member: { label: 'Member', tone: 'neutral' },
}

const roleOptions: SelectOption<Role>[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
]

function displayName(p: Profile) {
  return p.display_name || p.email.split('@')[0] || 'User'
}

/** Team management: roles (owner-only) and per-member project access (admins). */
export function TeamPage() {
  const { ready, profiles, projects, clients, projectMembers, me, updateRow, createRow, deleteRow } =
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

  const toggleAccess = (profile: Profile, projectId: string, on: boolean) => {
    const existing = projectMembers.find(
      (m) => m.project_id === projectId && m.user_id === profile.id,
    )
    if (on && !existing) {
      createRow<ProjectMember>('project_members', { project_id: projectId, user_id: profile.id })
    } else if (!on && existing) {
      deleteRow('project_members', existing.id)
    }
  }

  return (
    <>
      <PageHeader
        title="Team"
        description="Who can sign in, their role, and which projects members can see."
      />

      <p className="mb-4 rounded-xl border border-dashed px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        Anyone can create an account from the sign-in page — they start as a{' '}
        <span className="font-medium text-foreground">member</span> with no access until you grant
        projects below. Members see only their granted projects, tasks, checklists and notes; client
        contact details, budgets, and payments stay hidden.{' '}
        <span className="font-medium text-foreground">Admins</span> see everything you see.
      </p>

      <motion.div variants={listContainer} initial="initial" animate="animate" className="space-y-4">
        <AnimatePresence initial={false}>
          {profiles.map((profile) => {
            const isSelf = profile.id === me?.id
            const memberProjects = projectMembers.filter((m) => m.user_id === profile.id)
            return (
              <motion.div key={profile.id} layout="position" variants={listItem} exit="exit">
                <Card className="p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar name={displayName(profile)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {displayName(profile)}
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
                        aria-label={`Role for ${displayName(profile)}`}
                        className="h-8 w-30 text-[13px]"
                      />
                    )}
                  </div>

                  {profile.role === 'member' && (
                    <div className="mt-4 border-t pt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Project access · {memberProjects.length}
                      </p>
                      {projects.length === 0 ? (
                        <p className="text-[13px] text-muted-foreground">No projects yet.</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {projects.map((p) => (
                            <CheckboxRow
                              key={p.id}
                              checked={memberProjects.some((m) => m.project_id === p.id)}
                              onChange={(on) => toggleAccess(profile, p.id, on)}
                              label={p.title}
                              sublabel={clientDisplayName(clients.find((c) => c.id === p.client_id))}
                            />
                          ))}
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
            description="Share the app's sign-in link — new sign-ups appear here as members with no access until you grant projects."
          />
        </div>
      )}
    </>
  )
}
