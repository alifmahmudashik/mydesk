import { adminClient, handle, HttpError, json, requireAdmin } from '../_lib/server.js'

/** "Remove from workspace": their tasks become unassigned and they lose access immediately. */
export const POST = handle(async (req) => {
  const caller = await requireAdmin(req)
  const { user_id } = (await req.json()) as { user_id?: string }
  if (!user_id) throw new HttpError(400, 'user_id is required')
  if (user_id === caller.id) throw new HttpError(400, "You can't remove yourself")

  const sb = adminClient()
  const { data: target } = await sb.from('profiles').select('id, role, email').eq('id', user_id).single()
  if (!target) throw new HttpError(404, 'Member not found')
  if (target.role === 'owner') throw new HttpError(403, 'The owner cannot be removed')
  if (target.role === 'admin' && caller.role !== 'owner') throw new HttpError(403, 'Only the owner can remove an admin')

  const { error: prepError } = await sb.rpc('prepare_member_removal', { p_user: user_id })
  if (prepError) throw new HttpError(400, prepError.message)
  const { error } = await sb.auth.admin.deleteUser(user_id)
  if (error) throw new HttpError(500, error.message)

  await sb.from('activity_log').insert({
    owner_id: caller.id,
    actor_id: caller.id,
    entity: 'member',
    entity_id: user_id,
    action: 'removed',
    message: `Removed ${target.email} from the workspace`,
  })
  return json({ ok: true })
})
