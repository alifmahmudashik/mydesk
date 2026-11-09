import { adminClient, handle, HttpError, json, requireUser } from '../_lib/server.js'
import { esc, layout, sendEmail } from '../_lib/email.js'
import { checkConfirmText, deletionTarget, hashToken } from '../_lib/deletion.js'

interface Body {
  token: string
  confirm: string
}

type Admin = ReturnType<typeof adminClient>

/** Removes every file under these folders of a bucket. Best effort: a storage hiccup never blocks the delete. */
async function removeFolders(sb: Admin, bucket: string, folders: string[]) {
  for (const folder of folders) {
    try {
      const { data } = await sb.storage.from(bucket).list(folder, { limit: 1000 })
      const paths = (data ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`)
      if (paths.length) await sb.storage.from(bucket).remove(paths)
    } catch (err) {
      console.error(`storage cleanup ${bucket}/${folder}`, err)
    }
  }
}

/**
 * Step 2 of deleting, from the emailed link: same signed-in person, a valid unused link,
 * and the confirmation typed again. Owners: the workspace, all its data and files, and
 * their login. Everyone else: their login (their tasks become unassigned).
 */
export const POST = handle(async (req) => {
  const caller = await requireUser(req)
  const body = (await req.json()) as Body
  if (!body.token) throw new HttpError(400, 'Missing confirmation link')
  const sb = adminClient()

  const { data: request } = await sb
    .from('deletion_requests')
    .select('id, kind, workspace_id, expires_at, used_at')
    .eq('token_hash', hashToken(body.token))
    .eq('user_id', caller.id)
    .maybeSingle()
  if (!request || request.used_at || new Date(request.expires_at).getTime() < Date.now()) {
    throw new HttpError(400, 'This link has expired or was already used. Start again from your settings.')
  }

  const target = await deletionTarget(caller, request.kind)
  if (target.kind !== request.kind || (target.workspace?.id ?? null) !== (request.workspace_id ?? null)) {
    throw new HttpError(409, 'Your workspace changed since this link was sent. Start again from your settings.')
  }
  checkConfirmText(body.confirm, target.confirmText)

  // Single use, even if something below fails.
  await sb.from('deletion_requests').update({ used_at: new Date().toISOString() }).eq('id', request.id)

  if (target.kind === 'workspace') {
    const ws = target.workspace
    const { data: files } = await sb
      .from('task_attachments')
      .select('storage_path, tasks!inner(workspace_id)')
      .eq('tasks.workspace_id', ws.id)
      .not('storage_path', 'is', null)
    const paths = (files ?? []).map((f) => f.storage_path as string)
    for (let i = 0; i < paths.length; i += 100) {
      try {
        await sb.storage.from('attachments').remove(paths.slice(i, i + 100))
      } catch (err) {
        console.error('attachment cleanup', err)
      }
    }
    const { data: clients } = await sb.from('clients').select('id').eq('workspace_id', ws.id)
    await removeFolders(sb, 'avatars', [caller.id, ...(clients ?? []).map((c) => `clients/${c.id}`)])

    const { error: prepError } = await sb.rpc('prepare_workspace_deletion', { p_ws: ws.id })
    if (prepError) throw new HttpError(500, prepError.message)
    // The workspace belongs to this login: deleting it deletes the workspace and every row in it.
    const { error } = await sb.auth.admin.deleteUser(caller.id)
    if (error) throw new HttpError(500, error.message)
  } else {
    const { error: prepError } = await sb.rpc('prepare_member_removal', { p_user: caller.id })
    if (prepError) throw new HttpError(400, prepError.message)
    await removeFolders(sb, 'avatars', [caller.id])
    if (target.workspace) {
      await sb.from('activity_log').insert({
        workspace_id: target.workspace.id,
        owner_id: (target.workspace as { owner_id?: string }).owner_id ?? caller.id,
        actor_id: null,
        entity: 'member',
        entity_id: caller.id,
        action: 'removed',
        message: `${caller.email} deleted their account`,
      })
    }
    const { error } = await sb.auth.admin.deleteUser(caller.id)
    if (error) throw new HttpError(500, error.message)
  }

  // A receipt. The login is already gone, so a failure here doesn't matter.
  try {
    const isWs = target.kind === 'workspace'
    await sendEmail({
      to: caller.email,
      subject: isWs ? `${target.workspace!.name} was deleted` : 'Your MyDesk account was deleted',
      html: layout({
        heading: isWs ? 'Your workspace was deleted' : 'Your account was deleted',
        bodyHtml: isWs
          ? `<b>${esc(target.workspace!.name)}</b>, everything in it and your account have been permanently deleted.`
          : 'Your MyDesk account has been permanently deleted.',
        footer: 'This is the last email you’ll get from MyDesk about this account.',
      }),
      text: isWs ? `${target.workspace!.name}, everything in it and your account have been permanently deleted.` : 'Your MyDesk account has been permanently deleted.',
    })
  } catch (err) {
    console.error('deletion receipt', err)
  }
  return json({ ok: true })
})
