import type { ReactNode } from 'react'
import { UserMinus, Users } from 'lucide-react'
import { Menu, MenuItem, MenuSep, MenuTitle } from '@/components/ui/menu'
import { Avatar, AvatarStack } from '@/components/ui/avatar'
import { profileDisplayName, profileFullName } from '@/lib/derive'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'

/** "Unassigned", "Mahedi", "Mahedi & Anik", "Mahedi +2". */
export function assigneesLabel(ids: string[], profiles: Profile[], meId?: string | null) {
  const names = ids.map((id) => profiles.find((p) => p.id === id)).filter(Boolean).map((p) => (p!.id === meId ? 'Me' : profileDisplayName(p!)))
  if (names.length === 0) return 'Unassigned'
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names[0]} +${names.length - 1}`
}

/** Faces for a task's assignees (or the empty "unassigned" circle). */
export function Assignees({ ids, profiles, size = '' as '' | 'xs' | 'sm' | 'md', max = 3 }: { ids: string[]; profiles: Profile[]; size?: '' | 'xs' | 'sm' | 'md'; max?: number }) {
  const people = ids.map((id) => profiles.find((p) => p.id === id)).filter(Boolean) as Profile[]
  if (people.length <= 1) return <Avatar profile={people[0]} size={size} />
  return <span title={people.map((p) => profileDisplayName(p)).join(', ')}><AvatarStack profiles={people} size={size || 'sm'} max={max} /></span>
}

interface Props {
  people: Profile[]
  value: string[]
  onChange: (ids: string[]) => void
  meId?: string | null
  /** "prop" = compact text button (task side panel); "field" = looks like a form input. */
  variant?: 'prop' | 'field'
  align?: 'left' | 'right'
  /** Custom trigger (e.g. just the avatars on a list row). */
  trigger?: (p: { open: boolean; toggle: () => void }) => ReactNode
}

/** Pick one or more people. Each click toggles a person and closes the menu. */
export function AssigneePicker({ people, value, onChange, meId, variant = 'prop', align = 'left', trigger }: Props) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <Menu
      align={align}
      matchWidth={variant === 'field'}
      className={variant === 'field' ? 'conv-pick' : undefined}
      trigger={trigger ?? (({ open, toggle: t }) => (
        <button type="button" className={cn(variant === 'field' ? 'inp cur-inp' : 'prop', open && 'focus')} onClick={t} aria-haspopup="menu" aria-expanded={open}>
          <Assignees ids={value} profiles={people} size="xs" />
          <span className={cn('grow trunc', !value.length && variant === 'field' && 'faint')} style={{ textAlign: 'left' }}>{assigneesLabel(value, people, meId)}</span>
        </button>
      ))}
    >
      <MenuTitle>Click to add · again to remove</MenuTitle>
      {people.length === 0 && <div className="xs faint" style={{ padding: '6px 10px' }}>No one has access to this project yet</div>}
      {people.map((p) => (
        <MenuItem key={p.id} on={value.includes(p.id)} icon={<Avatar profile={p} size="xs" />} onSelect={() => toggle(p.id)}>
          {p.id === meId ? `Me (${profileDisplayName(p)})` : profileFullName(p)}
        </MenuItem>
      ))}
      {((people.length > 1 && value.length < people.length) || value.length > 1) && <MenuSep />}
      {people.length > 1 && value.length < people.length && (
        <MenuItem icon={<Users className="i" />} onSelect={() => onChange([...value, ...people.map((p) => p.id).filter((id) => !value.includes(id))])}>Everyone</MenuItem>
      )}
      {value.length > 1 && <MenuItem icon={<UserMinus className="i" />} onSelect={() => onChange([])}>Unassign all</MenuItem>}
    </Menu>
  )
}
