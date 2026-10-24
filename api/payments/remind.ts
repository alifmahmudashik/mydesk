import { adminClient, handle, HttpError, json, requireAdmin } from '../_lib/server.js'
import { esc, layout, sendEmail } from '../_lib/email.js'

interface Body {
  payment_id: string
  to: string
  subject: string
  message: string
  /** Optional invoice PDF, base64 (rendered in the browser with the same code as "Export PDF"). */
  pdf_base64?: string
  pdf_filename?: string
}

/** "Send reminder" on an open payment. Emails the client directly, from the admin's name. */
export const POST = handle(async (req) => {
  const caller = await requireAdmin(req)
  const body = (await req.json()) as Body
  if (!body.payment_id || !body.to?.includes('@')) throw new HttpError(400, 'A payment and a valid email are required')
  if (!body.subject?.trim() || !body.message?.trim()) throw new HttpError(400, 'Subject and message are required')
  if (body.pdf_base64 && body.pdf_base64.length > 7_000_000) throw new HttpError(413, 'Invoice PDF is too large to attach')

  const sb = adminClient()
  const { data: payment } = await sb.from('payments').select('id, client_id, amount, currency').eq('id', body.payment_id).single()
  if (!payment) throw new HttpError(404, 'Payment not found')

  const html = layout({
    heading: esc(body.subject),
    bodyHtml: esc(body.message).replace(/\n/g, '<br>'),
    footer: `Sent by ${caller.name} via MyDesk. Reply to this email to reach them directly.`,
  }).replace(/<a href="[^"]*account#notifications"[^>]*>Notification settings<\/a>/, '')

  await sendEmail({
    to: body.to.trim(),
    subject: body.subject.trim(),
    html,
    text: body.message,
    replyTo: caller.email,
    attachments: body.pdf_base64 ? [{ filename: body.pdf_filename || 'invoice.pdf', content: body.pdf_base64 }] : undefined,
  })

  const now = new Date().toISOString()
  await sb.from('payment_reminders').insert({ payment_id: payment.id, sent_by: caller.id, to_email: body.to.trim(), subject: body.subject.trim() })
  await sb.from('payments').update({ last_reminded_at: now }).eq('id', payment.id)
  await sb.from('activity_log').insert({
    owner_id: caller.id,
    actor_id: caller.id,
    entity: 'payment',
    entity_id: payment.id,
    action: 'reminded',
    message: `Sent a payment reminder to ${body.to.trim()}`,
  })
  return json({ ok: true, sent_at: now })
})
