import type { Workspace } from '@/types'

/** The workspace logo: its first letter on the app's accent colour. */
export function WorkspaceLogo({ workspace, size = 32 }: { workspace: Pick<Workspace, 'name'> | null | undefined; size?: number }) {
  const letter = (workspace?.name?.trim()[0] ?? 'M').toUpperCase()
  return (
    <div className="logo" style={{ width: size, height: size, flex: 'none', fontSize: Math.round(size * 0.47) }} aria-hidden>
      {letter}
    </div>
  )
}
