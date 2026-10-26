import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { ToggleRow } from '@/components/ui/field'
import { useData } from '@/data/store'
import { profileDisplayName, shortProjectTitle, splitMentions } from '@/lib/derive'
import type { AppNotification, Profile } from '@/types'

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

// ---- MyDesk's own notification sound --------------------------------------
// Chrome won't let a site pick the pop-up's sound, so pop-ups are silent and we
// play a short two-note chime ourselves (Web Audio, no file to download).
const SOUND_KEY = 'mydesk-notif-sound'
export const soundOn = () => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}
export const setSoundOn = (on: boolean) => {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    /* ignore */
  }
}

let audio: AudioContext | null = null
const ctx = () => {
  if (!audio) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    audio = new AC()
  }
  return audio
}
// Browsers only allow sound after you've clicked the page once; unlock on the first click/key.
if (typeof window !== 'undefined') {
  const unlock = () => {
    void ctx()?.resume()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

export function playChime(force = false) {
  if (!force && !soundOn()) return
  const ac = ctx()
  if (!ac) return
  void ac.resume()
  const t0 = ac.currentTime + 0.02
  // Two bright notes (E6 → A6), soft attack, quick fade.
  for (const [freq, at] of [[1318.5, 0], [1760, 0.12]] as const) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t0 + at)
    gain.gain.exponentialRampToValueAtTime(0.18, t0 + at + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.45)
    osc.connect(gain).connect(ac.destination)
    osc.start(t0 + at)
    osc.stop(t0 + at + 0.5)
  }
}

/** A desktop pop-up with MyDesk's chime instead of the system sound. */
function popUp(title: string, opts: { body?: string; tag?: string; onClick?: () => void }) {
  const pop = new Notification(title, { body: opts.body, icon: '/mydesk-fire.png', tag: opts.tag, silent: soundOn() })
  playChime()
  pop.onclick = () => {
    window.focus()
    opts.onClick?.()
    pop.close()
  }
  return pop
}
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

/** "@[Alif](uuid) can you check" → "@Alif can you check", on one line, trimmed. */
const plain = (text?: string | null, max = 140) => {
  const t = splitMentions(text ?? '')
    .map((p) => (p.kind === 'text' ? p.text : `@${p.name}`))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

const headline: Record<string, string> = {
  assigned: 'assigned you a task',
  mentioned: 'mentioned you',
  mentioned_note: 'mentioned you in a note',
  comment: 'commented on your task',
  completed: 'completed a task',
  learning_shared: 'shared something for you to learn',
  learning_done: 'finished learning',
  topic_added: 'added you to a learning topic',
}

/** Who did what as the heading, then the task, then the message itself. */
export function notificationText(n: AppNotification, profiles: Profile[]) {
  const actor = profiles.find((p) => p.id === n.actor_id)
  const what = n.type === 'mentioned_note' ? shortProjectTitle(n.title) : plain(n.title, 80)
  const quote = plain(n.excerpt)
  if (headline[n.type]) {
    return { title: `${actor ? profileDisplayName(actor) : 'Someone'} ${headline[n.type]}`, body: quote ? `${what}\n“${quote}”` : what }
  }
  if (n.type === 'due_soon') return { title: 'Due tomorrow', body: what }
  return { title: plain(n.title, 80), body: quote }
}

/** Mount once inside the app shell. */
export function useDesktopNotifications() {
  const navigate = useNavigate()
  const { me, ready, notifications, profiles, demoMode } = useData()
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
      const text = notificationText(n, profiles)
      const looking = document.visibilityState === 'visible' && document.hasFocus()
      if (!looking && desktopPermission() === 'granted') {
        try {
          // tag = id: several open tabs show one pop-up, not one each.
          popUp(text.title, { body: text.body || undefined, tag: n.id, onClick: open })
          continue
        } catch {
          /* fall through to toast */
        }
      }
      playChime()
      toast(text.title, { description: text.body.replace('\n', ' · ') || undefined, action: n.link ? { label: 'Open', onClick: open } : undefined })
    }
  }, [ready, notifications, profiles, navigate])
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
        popUp('Notifications are on', { body: 'This is how MyDesk will tell you about mentions and new tasks.' })
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

/** Account page rows: desktop pop-ups (state + Allow + Test) and the notification sound. */
export function DesktopNotifSetting() {
  const [perm, setPerm] = useState(desktopPermission())
  const [sound, setSound] = useState(soundOn())
  const allow = async () => {
    const res = await Notification.requestPermission()
    setPerm(res)
    void beat()
  }
  const test = () => {
    if (desktopPermission() !== 'granted') return
    try {
      popUp('Test notification', { body: 'Pop-ups work. You’ll see these for mentions, new tasks and comments.' })
      toast.success('Test sent', { description: 'No pop-up? Check Windows Settings → System → Notifications: Google Chrome must be on, and Do not disturb off.' })
    } catch {
      toast.error('This browser blocked the pop-up')
    }
  }
  const desc =
    perm === 'granted'
      ? 'On. While MyDesk is open you get pop-ups and no emails. When it’s closed, emails go out as usual.'
      : perm === 'denied'
        ? 'Blocked in this browser. Click the icon left of the address bar → Notifications → Allow, then reload.'
        : perm === 'unsupported'
          ? 'This browser doesn’t support desktop notifications. You’ll get emails.'
          : 'Off. Turn on to get pop-ups instead of emails while MyDesk is open.'
  return (
    <>
      <div className="toggle-row" style={{ cursor: 'default', alignItems: 'center' }}>
        <span className="grow" style={{ minWidth: 0 }}>
          <b>Desktop notifications</b>
          <small>{desc}</small>
        </span>
        {perm === 'default' && <button type="button" className="btn btn-sm btn-pri" onClick={() => void allow()}>Allow</button>}
        {perm === 'granted' && <button type="button" className="btn btn-sm" onClick={test}>Send test</button>}
        {perm === 'denied' && <span className="pill bad">Blocked</span>}
      </div>
      <ToggleRow
        title="MyDesk notification sound"
        desc={sound ? 'A short chime, different from other apps. Saved on this device.' : 'Off. Pop-ups use your computer’s normal sound.'}
        checked={sound}
        onChange={(v) => { setSound(v); setSoundOn(v); if (v) playChime(true) }}
      />
    </>
  )
}
