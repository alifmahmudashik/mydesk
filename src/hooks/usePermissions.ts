import { useData } from '@/data/store'

/**
 * Role helpers. Until profiles load, default to admin so the owner's experience never
 * degrades; the database's row-level security is the real gate either way.
 */
export function useIsAdmin() {
  const me = useData((s) => s.me)
  return !me || me.role !== 'member'
}

export function useIsOwner() {
  const me = useData((s) => s.me)
  return !me || me.role === 'owner'
}
