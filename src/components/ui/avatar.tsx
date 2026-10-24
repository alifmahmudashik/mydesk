import type { Client, Profile } from '@/types'
import { avatarTone, clientColor, clientDisplayName, initials, profileDisplayName, profileFullName } from '@/lib/derive'
import { cn } from '@/lib/utils'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | ''

export function Avatar({ profile, size = '', className, title }: { profile?: Profile | null; size?: Size; className?: string; title?: string }) {
  if (!profile) {
    return <span className={cn('av none', size, className)} title={title ?? 'Unassigned'} aria-label="Unassigned" />
  }
  const name = profileFullName(profile)
  return (
    <span className={cn('av', size, avatarTone(profile.id), className)} title={title ?? profileDisplayName(profile)}>
      {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : initials(name)}
    </span>
  )
}

export function AvatarStack({ profiles, size = 'sm', max = 4 }: { profiles: Profile[]; size?: Size; max?: number }) {
  if (profiles.length === 0) return <span className="faint xs">—</span>
  const shown = profiles.slice(0, max)
  const extra = profiles.length - shown.length
  return (
    <span className="avs">
      {shown.map((p) => (
        <Avatar key={p.id} profile={p} size={size} />
      ))}
      {extra > 0 && <span className={cn('av gray', size)}>+{extra}</span>}
    </span>
  )
}

/** Client badge: the logo if there is one, otherwise initials tinted with the brand colour.
 *  Colours are applied in CSS (.cl.tint) so dark brand colours can be lifted in dark mode. */
export function ClientMark({ client, size = '', className }: { client?: Client | null; size?: Size; className?: string }) {
  const color = clientColor(client)
  const name = clientDisplayName(client)
  if (client?.logo_url) {
    return (
      <span className={cn('cl has-logo', size, className)} title={name}>
        <img src={client.logo_url} alt="" loading="lazy" />
      </span>
    )
  }
  const valid = /^#[0-9a-f]{6}$/i.test(color)
  return (
    <span className={cn('cl', valid && 'tint', size, className)} style={valid ? { ['--cm' as string]: color } : { background: 'var(--line-xs)', color: 'var(--ink3)' }} title={name}>
      {initials(name)}
    </span>
  )
}
