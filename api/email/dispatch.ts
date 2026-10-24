import { handle, hasSecret, HttpError, json } from '../_lib/server.js'
import { flushOutbox } from '../_lib/outbox.js'

/**
 * Called by the database (pg_net) the moment an email is queued, so notification
 * emails go out within seconds. Protected by the shared CRON_SECRET.
 */
export const POST = handle(async (req) => {
  if (!hasSecret(req)) throw new HttpError(401, 'Unauthorized')
  const body = (await req.json().catch(() => ({}))) as { id?: string }
  // Send the specific email first, then sweep anything else still waiting.
  const first = body.id ? await flushOutbox({ id: body.id, limit: 1 }) : { claimed: 0, sent: 0, failed: 0 }
  const rest = await flushOutbox({ limit: 10 })
  return json({ ok: true, sent: first.sent + rest.sent, failed: first.failed + rest.failed })
})
