import { Avatar } from '@/components/ui/avatar'
import { CheckboxRow } from '@/components/ui/checkbox'
import { useData } from '@/data/store'
import { profileDisplayName } from '@/lib/derive'
import type { ClientMember } from '@/types'

/**
 * Admin control: grant/revoke access to this client. Checking someone here
 * gives them every project (and its tasks) under this client — not just the
 * one you happened to open this from. No heading of its own; callers provide
 * one (FormSection title, or a local <h3>) since it's embedded in different
 * contexts (project form, project detail).
 */
export function ClientAccessEditor({ clientId }: { clientId: string }) {
  const profiles = useData((s) => s.profiles)
  const clientMembers = useData((s) => s.clientMembers)
  const createRow = useData((s) => s.createRow)
  const deleteRow = useData((s) => s.deleteRow)

  const members = profiles.filter((p) => p.role === 'member')

  if (members.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        No teammates yet — invite them from the Team page.
      </p>
    )
  }

  const toggle = (userId: string, on: boolean) => {
    const existing = clientMembers.find((m) => m.client_id === clientId && m.user_id === userId)
    if (on && !existing) {
      createRow<ClientMember>('client_members', { client_id: clientId, user_id: userId })
    } else if (!on && existing) {
      deleteRow('client_members', existing.id)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {members.map((p) => (
        <CheckboxRow
          key={p.id}
          checked={clientMembers.some((m) => m.client_id === clientId && m.user_id === p.id)}
          onChange={(on) => toggle(p.id, on)}
          label={profileDisplayName(p)}
          sublabel={p.email}
        />
      ))}
    </div>
  )
}

/** Read-only teammate avatars — who else can see this client's work. Renders nothing if no one is granted. */
export function ClientTeamAvatars({ clientId }: { clientId: string }) {
  const profiles = useData((s) => s.profiles)
  const clientMembers = useData((s) => s.clientMembers)

  const granted = clientMembers
    .filter((m) => m.client_id === clientId)
    .map((m) => profiles.find((p) => p.id === m.user_id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  if (granted.length === 0) return null

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team</h3>
      <div className="flex items-center gap-1.5">
        {granted.map((p) => (
          <span key={p.id} title={profileDisplayName(p)}>
            <Avatar name={profileDisplayName(p)} size="sm" />
          </span>
        ))}
      </div>
    </section>
  )
}
