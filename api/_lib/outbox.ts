import { adminClient, env } from './server.js'
import { esc, layout, renderTemplate, sendEmail } from './email.js'

interface OutboxRow {
  id: string
  dedupe_key: string
  user_id: string | null
  to_email: string
  template: string
  payload: Record<string, unknown>
  attempts: number
}

const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}

/** Monday summary: the person's open tasks, plus money in/overdue for owners and admins. */
async function renderWeekly(userId: string) {
  const sb = adminClient()
  const { data: me } = await sb.from('profiles').select('role, display_name, email').eq('id', userId).single()
  const name = me?.display_name || me?.email?.split('@')[0] || 'there'
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

  const { data: tasks } = await sb
    .from('tasks')
    .select('id, title, due_date, status, projects(title)')
    .eq('assignee_id', userId)
    .not('status', 'in', '(done,cancelled)')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(15)

  const rows = (tasks ?? [])
    .map((t) => {
      const proj = (t.projects as unknown as { title: string } | null)?.title ?? ''
      const late = t.due_date && t.due_date < today
      const due = t.due_date ? `<span style="color:${late ? '#B42318' : '#5E5E6B'}">${esc(t.due_date)}</span>` : ''
      return `<tr><td style="padding:8px 0;border-top:1px solid #F1F1F4"><a href="${env.appUrl}/tasks/${t.id}" style="color:#0F0F14;text-decoration:none;font-weight:500">${esc(t.title)}</a><br><span style="font-size:12px;color:#5E5E6B">${esc(proj)}</span></td><td style="padding:8px 0;border-top:1px solid #F1F1F4;text-align:right;font-size:12px;white-space:nowrap">${due}</td></tr>`
    })
    .join('')

  let money_html = ''
  let money_text = ''
  if (me && me.role !== 'member') {
    const { data: paid } = await sb.from('payments').select('amount, currency').eq('status', 'paid').gte('payment_date', weekAgo)
    const { data: late } = await sb
      .from('payments')
      .select('amount, currency')
      .in('status', ['unpaid', 'partial', 'overdue'])
      .lt('due_date', today)
    const fmt = (list: { amount: number; currency: string }[] | null) => {
      const by = new Map<string, number>()
      for (const p of list ?? []) by.set(p.currency, (by.get(p.currency) ?? 0) + Number(p.amount))
      return [...by].map(([c, a]) => money(a, c)).join(' · ') || money(0, 'USD')
    }
    money_html = `<table role="presentation" width="100%" style="margin-top:18px;border-collapse:collapse"><tr>
<td style="padding:12px;background:#E7F6EE;border-radius:8px"><div style="font-size:12px;color:#0B6B3F">Money in this week</div><div style="font-size:18px;font-weight:600;color:#0B6B3F">${esc(fmt(paid))}</div></td>
<td style="width:10px"></td>
<td style="padding:12px;background:#FDECEA;border-radius:8px"><div style="font-size:12px;color:#B42318">Overdue · ${(late ?? []).length}</div><div style="font-size:18px;font-weight:600;color:#B42318">${esc(fmt(late))}</div></td>
</tr></table>`
    money_text = `\nMoney in this week: ${fmt(paid)}\nOverdue: ${fmt(late)}\n`
  }

  const count = (tasks ?? []).length
  return {
    subject: `Your week: ${count} open task${count === 1 ? '' : 's'}`,
    html: layout({
      heading: `Good morning, ${esc(name)}`,
      bodyHtml: `${count ? `You have <b>${count}</b> open task${count === 1 ? '' : 's'}.` : 'Nothing open on your plate. Nice.'}
${count ? `<table role="presentation" width="100%" style="margin-top:10px;border-collapse:collapse">${rows}</table>` : ''}${money_html}`,
      cta: { label: 'Open MyDesk', url: env.appUrl },
      footer: 'Weekly summary, every Monday at 9:00.',
    }),
    text: `You have ${count} open tasks.\n${(tasks ?? []).map((t) => `- ${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}`).join('\n')}\n${money_text}\n${env.appUrl}`,
  }
}

/** Sends pending outbox emails. Each row is claimed atomically, so concurrent runs never double-send. */
export async function flushOutbox(opts: { id?: string; limit?: number } = {}) {
  const sb = adminClient()
  const { data, error } = await sb.rpc('claim_outbox', { p_limit: opts.limit ?? 25, p_id: opts.id ?? null })
  if (error) throw new Error(`claim_outbox: ${error.message}`)
  const rows = (data ?? []) as OutboxRow[]
  let sent = 0
  let failed = 0

  for (const row of rows) {
    try {
      const mail =
        row.template === 'weekly' && row.user_id ? await renderWeekly(row.user_id) : renderTemplate(row.template, row.payload)
      await sendEmail({ to: row.to_email, ...mail })
      await sb.from('email_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', row.id)
      sent++
    } catch (err) {
      failed++
      await sb
        .from('email_outbox')
        .update({ status: 'failed', last_error: err instanceof Error ? err.message.slice(0, 500) : 'unknown' })
        .eq('id', row.id)
    }
  }
  return { claimed: rows.length, sent, failed }
}
