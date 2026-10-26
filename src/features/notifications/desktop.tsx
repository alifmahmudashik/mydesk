import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useData } from '@/data/store'

/**
 * Desktop notifications.
 * - While the app is open we ping the server every minute ("I'm online").
 * - If you're online and allowed desktop notifications, the server skips the email
 *   and we show a desktop pop-up (or an in-app toast if you're looking at MyDesk).
 * - Close the app and you're offline again, so emails go out as before.
 */

const supported = () => typeof window !== 'undefined' && 'Notification' in window
export const desktopPermission = (): NotificationPermission | 'unsupported' => (supported() ? Notification.permission : 'unsupported')

const BEAT_MS = 60_000
let lastToken = ''

async function beat(online = true) {
  if (!supabase) return true
  const { data } = await supabase.auth.getSession()
  lastToken = data.session?.access_token ?? ''
  if (!lastToken) return true
  const { error } = await supabase.rpc('heartbeat', { p_desktop: desktopPermission() === 'granted', p_online: online })
  // Function not installed yet (desktop-notifications.sql not run): stop pinging.
  return !(error && /heartbeat|function|schema cache/i.test(error.message))
}

/** Tab closing: tell the server we're gone (keepalive lets the request finish after unload). */
function beatOffline() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !key || !lastToken) return
  try {
    void fetch(`${url}/rest/v1/rpc/heartbeat`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${lastToken}` },
      body: JSON.stringify({ p_desktop: false, p_online: false }),
    })
  } catch {
    /* best effort */
  }
}

/** Sign-out: go offline first so emails resume right away. */
export async function goOffline() {
  if (!supabase) return
  try {
    await supabase.rpc('heartbeat', { p_desktop: false, p_online: false })
  } catch {
    /* ignore */
  }
}

/** Mount once inside the app shell. */
export function useDesktopNotifications() {
  const navigate = useNavigate()
  const { me, ready, notifications, demoMode } = useData()
  const seen = useRef<Set<string> | null>(null)

  // Online heartbeat.
  useEffect(() => {
    if (!me?.id || demoMode || !supabase) return
    let alive = true
    let timer: ReturnType<typeof setInterval> | undefined
    const tick = () => void beat().then((ok) => { if (!ok && timer) { clearInterval(timer); timer = undefined } })
    tick()
    timer = setInterval(() => { if (alive) tick() }, BEAT_MS)
    const onVisible = () => { if (document.visibilityState === 'visible' && timer) tick() }
    const onHide = () => beatOffline()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pagehide', onHide)
    return () => {
      alive = false
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pagehide', onHide)
    }
  }, [me?.id, demoMode])

  // Show new notifications as they arrive.
  useEffect(() => {
    if (!ready) return
    if (!seen.current) {
      seen.current = new Set(notifications.map((n) => n.id))
      return
    }
    const fresh = notifications.filter((n) => !seen.current!.has(n.id))
    for (const n of fresh) seen.current.add(n.id)
    const recent = fresh.filter((n) => !n.read_at && Date.now() - new Date(n.created_at).getTime() < 5 * 60_000)
    for (const n of recent) {
      const open = () => {
        window.focus()
        if (n.link) navigate(n.link)
      }
      const looking = document.visibilityState === 'visible' && document.hasFocus()
      if (!looking && desktopPermission() === 'granted') {
        try {
          // tag = id: several open tabs show one pop-up, not one each.
          const pop = new Notification(n.title, { body: n.excerpt ?? undefined, icon: '/mydesk-fire.png', tag: n.id })
          pop.onclick = () => { open(); pop.close() }
          continue
        } catch {
          /* fall through to toast */
        }
      }
      toast(n.title, { description: n.excerpt ?? undefined, action: n.link ? { label: 'Open', onClick: open } : undefined })
    }
  }, [ready, notifications, navigate])
}

const DISMISS_KEY = 'mydesk-desktop-ask-dismissed'

/** Banner asking to allow desktop notifications. Comes back each sign-in until answered. */
export function DesktopNotifPrompt() {
  const { me, demoMode } = useData()
  const [perm, setPerm] = useState(desktopPermission())
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  if (!me || demoMode || perm !== 'default' || hidden) return null
  const allow = async () => {
    const res = await Notification.requestPermission()
    setPerm(res)
    void beat()
    if (res === 'granted') {
      toast.success('Desktop notifications on', { description: 'While MyDesk is open you’ll get pop-ups instead of emails.' })
      try {
        new Notification('Notifications are on', { body: 'This is how MyDesk will tell you about mentions and new tasks.', icon: '/mydesk-fire.png' })
      } catch {
        /* ignore */
      }
    }
  }
  const later = () => {
    setHidden(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="dn-ask" role="region" aria-label="Desktop notifications">
      <span className="dn-ic"><Bell className="i" /></span>
      <div className="grow" style={{ minWidth: 0 }}>
        <b>Turn on desktop notifications</b>
        <small>Get mentions and new tasks as pop-ups while MyDesk is open, instead of emails.</small>
      </div>
      <button type="button" className="btn btn-sm btn-pri" onClick={() => void allow()}>Allow</button>
      <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label="Not now" title="Not now" onClick={later}><X className="i i-sm" /></button>
    </div>
  )
}

/** Account page row: current state + a button to turn it on. */
export function DesktopNotifSetting() {
  const [perm, setPerm] = useState(desktopPermission())
  const allow = async () => {
    const res = await Notification.requestPermission()
    setPerm(res)
    void beat()
  }
  const desc =
    perm === 'granted'
      ? 'On. While MyDesk is open you get pop-ups and no emails. When it’s closed, emails go out as usual.'
      : perm === 'denied'
        ? 'Blocked in this browser. Click the lock icon next to the address bar → Notifications → Allow, then reload.'
        : perm === 'unsupported'
          ? 'This browser doesn’t support desktop notifications. You’ll get emails.'
          : 'Off. Turn on to get pop-ups instead of emails while MyDesk is open.'
  return (
    <div className="toggle-row" style={{ cursor: 'default', alignItems: 'center' }}>
      <span className="grow" style={{ minWidth: 0 }}>
        <b>Desktop notifications</b>
        <small>{desc}</small>
      </span>
      {perm === 'default' && <button type="button" className="btn btn-sm btn-pri" onClick={() => void allow()}>Allow</button>}
      {perm === 'granted' && <span className="pill ok">On</span>}
      {perm === 'denied' && <span className="pill bad">Blocked</span>}
    </div>
  )
}
