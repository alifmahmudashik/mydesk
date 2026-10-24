import { env } from './server.js'

export interface EmailAttachment {
  filename: string
  /** Base64 content. */
  content: string
}

export interface OutgoingEmail {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
  attachments?: EmailAttachment[]
}

/** Sends one email through Resend's HTTP API (no SDK needed). */
export async function sendEmail(mail: OutgoingEmail) {
  if (!env.resendKey) throw new Error('RESEND_API_KEY is not set')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      reply_to: mail.replyTo,
      attachments: mail.attachments,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`)
  }
  return (await res.json()) as { id: string }
}

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Shared email layout, matching MyDesk's look (indigo accent, Geist-like system font). */
export function layout(opts: {
  preheader?: string
  heading: string
  bodyHtml: string
  cta?: { label: string; url: string }
  footer?: string
}) {
  const cta = opts.cta
    ? `<tr><td style="padding:8px 0 4px"><a href="${esc(opts.cta.url)}" style="display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px">${esc(opts.cta.label)}</a></td></tr>`
    : ''
  return `<!doctype html><html><body style="margin:0;background:#F4F4F6;font-family:-apple-system,'Segoe UI',Geist,Roboto,sans-serif;color:#0F0F14">
<span style="display:none;max-height:0;overflow:hidden">${esc(opts.preheader ?? '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 16px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:28px;height:28px;border-radius:8px;background:#4F46E5;color:#fff;font-weight:700;font-size:14px;text-align:center;vertical-align:middle">M</td>
<td style="padding-left:10px;font-weight:600;font-size:14px">MyDesk</td></tr></table></td></tr>
<tr><td style="background:#fff;border:1px solid #ECECEF;border-radius:14px;padding:28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:18px;font-weight:600;letter-spacing:-.01em;padding-bottom:12px">${opts.heading}</td></tr>
<tr><td style="font-size:14px;line-height:1.6;color:#2A2A33;padding-bottom:16px">${opts.bodyHtml}</td></tr>
${cta}
</table></td></tr>
<tr><td style="padding:16px 4px;font-size:12px;color:#6B6B78;line-height:1.5">${esc(opts.footer ?? 'You get this because of your MyDesk notification settings.')} <a href="${esc(env.appUrl)}/account#notifications" style="color:#6B6B78">Notification settings</a></td></tr>
</table></td></tr></table></body></html>`
}

const quote = (text: string) =>
  `<div style="margin-top:12px;padding:12px 14px;border-left:3px solid #C7C9F5;background:#F7F7F9;border-radius:6px;color:#2A2A33">${esc(text)}</div>`

type Payload = Record<string, unknown>

/** Builds subject/html/text for a queued outbox email. */
export function renderTemplate(template: string, p: Payload): { subject: string; html: string; text: string } {
  const link = (path: unknown) => `${env.appUrl}${String(path ?? '/')}`
  const actor = esc(p.actor ?? 'Someone')
  const title = esc(p.title)
  const ref = p.ref ? `${esc(p.ref)} · ` : ''

  switch (template) {
    case 'assigned': {
      const due = p.due ? ` It's due ${esc(p.due)}.` : ''
      return {
        subject: `${p.actor ?? 'Someone'} assigned you: ${p.title}`,
        html: layout({
          preheader: `${p.project ?? ''}`,
          heading: `${actor} assigned you a task`,
          bodyHtml: `<b>${title}</b><br><span style="color:#5E5E6B">${ref}${esc(p.project)}</span><br><br>You're now the assignee.${due}`,
          cta: { label: 'Open task', url: link(p.link) },
        }),
        text: `${p.actor} assigned you "${p.title}" (${p.project}).${due}\n\n${link(p.link)}`,
      }
    }
    case 'mentioned':
    case 'mentioned_note': {
      const where = p.where === 'note' ? `a note on ${esc(p.project)}` : `<b>${title}</b>`
      return {
        subject: `${p.actor ?? 'Someone'} mentioned you${p.where === 'note' ? ` on ${p.project}` : `: ${p.title}`}`,
        html: layout({
          preheader: String(p.excerpt ?? ''),
          heading: `${actor} mentioned you`,
          bodyHtml: `In ${where}${quote(String(p.excerpt ?? ''))}`,
          cta: { label: 'Reply', url: link(p.link) },
        }),
        text: `${p.actor} mentioned you:\n\n"${p.excerpt}"\n\n${link(p.link)}`,
      }
    }
    case 'comment':
      return {
        subject: `New comment on ${p.title}`,
        html: layout({
          preheader: String(p.excerpt ?? ''),
          heading: `${actor} commented on ${title}`,
          bodyHtml: `<span style="color:#5E5E6B">${ref}${esc(p.project)}</span>${quote(String(p.excerpt ?? ''))}`,
          cta: { label: 'Open task', url: link(p.link) },
        }),
        text: `${p.actor} commented on "${p.title}":\n\n"${p.excerpt}"\n\n${link(p.link)}`,
      }
    case 'overdue':
      return {
        subject: `Payment overdue: ${p.client} · ${p.currency} ${p.amount}`,
        html: layout({
          heading: 'A payment is overdue',
          bodyHtml: `<b>${esc(p.client)}</b> owes <b>${esc(p.currency)} ${esc(p.amount)}</b>. It was due ${esc(p.due)}, ${esc(p.days)} days ago.<br><br>You can send a reminder straight from MyDesk.`,
          cta: { label: 'Open payment', url: link(p.link) },
          footer: 'Sent once per overdue payment, to owners and admins.',
        }),
        text: `${p.client} owes ${p.currency} ${p.amount}, due ${p.due} (${p.days} days ago).\n\n${link(p.link)}`,
      }
    case 'due_soon': {
      const isTask = p.kind === 'task'
      const detail = isTask
        ? `<span style="color:#5E5E6B">${ref}${esc(p.project)}</span><br><br>This task is due <b>tomorrow</b>.`
        : `<span style="color:#5E5E6B">${esc(p.client)}</span><br><br>This project is due <b>tomorrow</b> and has <b>${esc(p.open_tasks)}</b> open task${Number(p.open_tasks) === 1 ? '' : 's'}.`
      return {
        subject: `Due tomorrow: ${p.title}`,
        html: layout({
          preheader: isTask ? `Task due tomorrow · ${p.project ?? ''}` : `Project due tomorrow · ${p.client ?? ''}`,
          heading: `${isTask ? 'Task' : 'Project'} due tomorrow`,
          bodyHtml: `<b>${title}</b><br>${detail}`,
          cta: { label: isTask ? 'Open task' : 'Open project', url: link(p.link) },
          footer: 'One reminder per due date.',
        }),
        text: `${isTask ? 'Task' : 'Project'} due tomorrow: ${p.title}\n\n${link(p.link)}`,
      }
    }
    case 'access_granted': {
      const by = p.actor && p.actor !== 'Someone' ? `${esc(p.actor)} gave you access` : 'You were given access'
      return {
        subject: `You now have access to ${p.client ?? 'a client'} in MyDesk`,
        html: layout({
          heading: `${by} to ${esc(p.client)}`,
          bodyHtml: `You can now see and work on every project and task for <b>${esc(p.client)}</b>${Number(p.active) ? `: <b>${esc(p.active)}</b> active project${Number(p.active) === 1 ? '' : 's'} right now` : ''}.`,
          cta: { label: `Open ${String(p.client ?? 'client')}`, url: link(p.link) },
        }),
        text: `You now have access to ${p.client} in MyDesk.\n\n${link(p.link)}`,
      }
    }
    case 'invite': {
      const url = `${env.appUrl}/invite/${String(p.token ?? '')}`
      const role = p.role === 'admin' ? 'an admin' : 'a member'
      return {
        subject: `${p.inviter ?? 'Your team'} invited you to MyDesk`,
        html: layout({
          heading: `${esc(p.inviter ?? 'Your team')} invited you to MyDesk`,
          bodyHtml: `You've been invited as ${role}. MyDesk is where we keep clients, projects and tasks in one place.`,
          cta: { label: 'Accept invite', url },
          footer: "If you weren't expecting this, you can ignore it.",
        }),
        text: `${p.inviter} invited you to MyDesk as ${role}.\n\nAccept: ${url}`,
      }
    }
    default:
      return {
        subject: String(p.title ?? 'MyDesk notification'),
        html: layout({ heading: title || 'Notification', bodyHtml: esc(p.excerpt ?? ''), cta: p.link ? { label: 'Open MyDesk', url: link(p.link) } : undefined }),
        text: `${p.title ?? ''}\n\n${p.excerpt ?? ''}\n\n${link(p.link)}`,
      }
  }
}

export { esc, quote }
