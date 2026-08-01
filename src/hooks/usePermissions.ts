import { useData } from '@/data/store'

/**
 * Role helpers. Until profiles load (or when the collaborator migration hasn't been run),
 * default to admin so the owner's experience never degrades.
 */
export function useIsAdmin() {
  const me = useData((s) => s.me)
  return !me || me.role !== 'member'
}

export function useIsOwner() {
  const me = useData((s) => s.me)
  return !me || me.role === 'owner'
}
