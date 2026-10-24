import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Server-side config. All of these are set in Vercel → Project → Settings → Environment Variables. */
export const env = {
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
  // Supabase's new "secret" key (sb_secret_…) works here, as does the legacy service_role key.
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? '',
  resendKey: process.env.RESEND_API_KEY ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'MyDesk <onboarding@resend.dev>',
  appUrl: (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
  cronSecret: process.env.CRON_SECRET ?? '',
}

let admin: SupabaseClient | null = null

/** Service-role client: bypasses row-level security. Never expose this key to the browser. */
export function adminClient() {
  if (!env.supabaseUrl || !env.serviceKey) {
    throw new HttpError(500, 'Server is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }
  admin ??= createClient(env.supabaseUrl, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return admin
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Wraps a handler so thrown HttpErrors become JSON responses. */
export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await fn(req)
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status)
      console.error(err)
      return json({ error: err instanceof Error ? err.message : 'Server error' }, 500)
    }
  }
}

/** True when the request carries the shared secret (Vercel cron / Supabase trigger). */
export function hasSecret(req: Request) {
  const header = req.headers.get('authorization') ?? ''
  return Boolean(env.cronSecret) && header === `Bearer ${env.cronSecret}`
}

export interface Caller {
  id: string
  email: string
  role: 'owner' | 'admin' | 'member'
  name: string
}

/** Resolves the signed-in user from the browser's Supabase access token. */
export async function requireUser(req: Request): Promise<Caller> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Not signed in')
  const sb = adminClient()
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Session expired, sign in again')
  const { data: profile } = await sb
    .from('profiles')
    .select('id, email, role, display_name, full_name')
    .eq('id', data.user.id)
    .single()
  if (!profile) throw new HttpError(403, 'No profile for this user')
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    name: profile.display_name || profile.full_name || profile.email.split('@')[0],
  }
}

export async function requireAdmin(req: Request) {
  const caller = await requireUser(req)
  if (caller.role === 'member') throw new HttpError(403, 'Only owners and admins can do this')
  return caller
}
