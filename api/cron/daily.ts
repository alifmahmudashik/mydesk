import { adminClient, handle, hasSecret, HttpError, json } from '../_lib/server.js'
import { flushOutbox } from '../_lib/outbox.js'

/**
 * Vercel Cron, once a day at 03:00 UTC (09:00 Dhaka) — see vercel.json.
 * 1. Queues overdue-payment alerts (once per payment) and, on Mondays, weekly summaries.
 * 2. Sends everything waiting in the outbox (also retries anything that failed).
 */
async function run(req: Request) {
  if (!hasSecret(req)) throw new HttpError(401, 'Unauthorized')
  const sb = adminClient()
  const { data, error } = await sb.rpc('run_daily')
  if (error) throw new Error(`run_daily: ${error.message}`)

  let totals = { claimed: 0, sent: 0, failed: 0 }
  // Drain in batches, capped so one run stays well inside the function time limit.
  for (let i = 0; i < 8; i++) {
    const r = await flushOutbox({ limit: 25 })
    totals = { claimed: totals.claimed + r.claimed, sent: totals.sent + r.sent, failed: totals.failed + r.failed }
    if (r.claimed < 25) break
  }
  return json({ ok: true, daily: data, email: totals })
}

export const GET = handle(run)
export const POST = handle(run)
