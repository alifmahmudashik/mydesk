import { createHash, randomBytes } from 'node:crypto'
import { adminClient, HttpError, type Caller } from './server.js'

/** How long an emailed "confirm delete" link works. */
export const LINK_MINUTES = 30

export type DeletionKind = 'account' | 'workspace'

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
export const newToken = () => randomBytes(32).toString('hex')

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()

/**
 * What's being deleted, and the text the person must type to confirm it.
 * An owner's account and their workspace are one thing: deleting either deletes both.
 */
export async function deletionTarget(caller: Caller, kind: DeletionKind) {
  const sb = adminClient()
  const { data: ws } = caller.workspace_id
    ? await sb.from('workspaces').select('id, name, owner_id').eq('id', caller.workspace_id).maybeSingle()
    : { data: null }
  const isOwner = Boolean(ws && ws.owner_id === caller.id)

  if (kind === 'workspace' || isOwner) {
    if (!ws || !isOwner) throw new HttpError(403, 'Only the workspace owner can delete the workspace')
    return { kind: 'workspace' as const, workspace: ws as { id: string; name: string; owner_id: string }, confirmText: ws.name as string }
  }
  return { kind: 'account' as const, workspace: ws as { id: string; name: string } | null, confirmText: caller.email }
}

export function checkConfirmText(typed: unknown, expected: string) {
  if (norm(typed) !== norm(expected) || !norm(expected)) {
    throw new HttpError(400, 'The confirmation text doesn’t match')
  }
}
