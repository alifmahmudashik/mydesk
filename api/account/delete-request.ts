import { adminClient, env, handle, HttpError, json, requireUser } from '../_lib/server.js'
import { esc, layout, sendEmail } from '../_lib/email.js'
import { checkConfirmText, deletionTarget, hashToken, LINK_MINUTES, newToken, type DeletionKind } from '../_lib/deletion.js'

interface Body {
  kind: DeletionKind
  /** The workspace name (owners) or the person's email (everyone else), typed by hand. */
  confirm: string
  /** The data export the browser just downloaded, attached to the email as a backup copy. */
  export_base64?: string
  export_filename?: string
}

/** Step 1 of deleting: emails a single-use confirmation link. Nothing is deleted yet. */
export const POST = handle(async (req) => {
  const caller = await requireUser(req)
  const body = (await req.json()) as Body
  if (body.kind !== 'account' && body.kind !== 'workspace') throw new HttpError(400, 'Unknown delete type')
  const target = await deletionTarget(caller, body.kind)
  checkConfirmText(body.confirm, target.confirmText)

  const sb = adminClient()
  const { data: recent } = await sb
    .from('deletion_requests')
    .select('created_at')
    .eq('user_id', caller.id)
    .gte('created_at', new Date(Date.now() - 60_000).toISOString())
    .limit(1)
  if (recent?.length) throw new HttpError(429, 'We just sent a link. Wait a minute before asking for another.')

  // Only the newest link works.
  await sb.from('deletion_requests').update({ used_at: new Date().toISOString() }).eq('user_id', caller.id).is('used_at', null)

  const token = newToken()
  const { error } = await sb.from('deletion_requests').insert({
    user_id: caller.id,
    kind: target.kind,
    workspace_id: target.workspace?.id ?? null,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + LINK_MINUTES * 60_000).toISOString(),
  })
  if (error) throw new HttpError(500, error.message)

  const url = `${env.appUrl}/confirm-delete?token=${token}`
  const isWs = target.kind === 'workspace'
  const what = isWs
    ? `the workspace <b>${esc(target.workspace!.name)}</b>, everything in it (clients, projects, tasks, invoices, payments, files) and your account`
    : 'your MyDesk account'
  const attach = body.export_base64 && body.export_base64.length <= 7_000_000
  const html = layout({
    preheader: 'Confirm that you want to delete this permanently.',
    heading: isWs ? 'Confirm deleting your workspace' : 'Confirm deleting your account',
    bodyHtml: `You asked to permanently delete ${what}.<br><br>
This can’t be undone. ${isWs ? 'Your teammates will lose access to it straight away.' : ''}<br><br>
${attach ? 'A copy of your data export is attached to this email.<br><br>' : ''}
The link works once and expires in ${LINK_MINUTES} minutes. You’ll be asked to type the ${isWs ? 'workspace name' : 'email address'} one more time.`,
    cta: { label: isWs ? 'Delete workspace' : 'Delete account', url },
    footer: 'Didn’t ask for this? Ignore this email and nothing will be deleted. Consider changing your password.',
  })
  await sendEmail({
    to: caller.email,
    subject: isWs ? `Confirm: delete ${target.workspace!.name} permanently` : 'Confirm: delete your MyDesk account',
    html,
    text: `You asked to permanently delete ${isWs ? `the workspace ${target.workspace!.name} and your account` : 'your MyDesk account'}. This can't be undone.\n\nConfirm here (works once, expires in ${LINK_MINUTES} minutes):\n${url}\n\nDidn't ask for this? Ignore this email.`,
    attachments: attach ? [{ filename: body.export_filename || 'mydesk-export.json', content: body.export_base64! }] : undefined,
  })
  return json({ ok: true, email: caller.email, attached: Boolean(attach) })
})
