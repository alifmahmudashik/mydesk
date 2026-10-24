import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, ArrowRight, ChevronDown, Radio } from 'lucide-react'
import { useData } from '@/data/store'
import { useIsAdmin } from '@/hooks/usePermissions'
import { Topbar, Content, PageHead, Empty } from '@/components/ui/layout'
import { Menu, MenuItem } from '@/components/ui/menu'
import { ClientMark } from '@/components/ui/avatar'
import { DateInput } from '@/components/ui/date-picker'
import { TimeInput } from '@/components/ui/time-picker'
import { Tabs } from '@/components/ui/tabs'
import { clientDisplayName } from '@/lib/derive'
import { cn } from '@/lib/utils'
import type { Client } from '@/types'

/* ---------- timezone helpers (Intl only, no extra library) ---------- */

const BROWSER_TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
})()

function validTz(tz?: string | null) {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Wall-clock parts of an instant in a timezone. */
function partsIn(date: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  )
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second }
}

/** Minutes the timezone is ahead of UTC at that instant. */
function offsetMin(tz: string, date: Date) {
  const p = partsIn(date, tz)
  const asUTC = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s)
  return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000)
}

/** The instant when the clock in `tz` reads `day` (yyyy-mm-dd) at `time` (HH:mm). */
function wallToInstant(day: string, time: string, tz: string) {
  const [y, m, d] = day.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, h, mi)
  const off1 = offsetMin(tz, new Date(guess))
  let t = guess - off1 * 60000
  const off2 = offsetMin(tz, new Date(t))
  if (off2 !== off1) t = guess - off2 * 60000
  return new Date(t)
}

const dayKey = (date: Date, tz: string) => {
  const p = partsIn(date, tz)
  return Date.UTC(p.y, p.m - 1, p.d) / 86400000
}
const fmt = (date: Date, tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...o }).format(date)
const timeStr = (date: Date, tz: string, sec = false) => fmt(date, tz, { hour: 'numeric', minute: '2-digit', ...(sec ? { second: '2-digit' as const } : {}) })
const dateStr = (date: Date, tz: string) => fmt(date, tz, { weekday: 'short', month: 'short', day: 'numeric' })
const isoDay = (date: Date, tz: string) => {
  const p = partsIn(date, tz)
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}
const hhmm = (date: Date, tz: string) => {
  const p = partsIn(date, tz)
  return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`
}
const city = (tz: string) => tz.split('/').pop()!.replace(/_/g, ' ')

/** "+5h", "−2h 30m", "Same time" — how far `tz` is from `base`. */
function diffLabel(tz: string, base: string, at: Date) {
  const diff = offsetMin(tz, at) - offsetMin(base, at)
  if (diff === 0) return 'Same time as you'
  const a = Math.abs(diff)
  const s = `${Math.floor(a / 60)}h${a % 60 ? ` ${a % 60}m` : ''}`
  return diff > 0 ? `${s} ahead` : `${s} behind`
}

function dayTag(date: Date, tz: string, base: string) {
  const d = dayKey(date, tz) - dayKey(date, base)
  return d === 0 ? null : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : d > 0 ? `+${d} days` : `${d} days`
}

/** Rough "can I message them now?" signal from their local hour. */
function hoursState(date: Date, tz: string) {
  const h = partsIn(date, tz).h
  if (h >= 9 && h < 18) return { cls: 'ok', label: 'Working hours' }
  if ((h >= 7 && h < 9) || (h >= 18 && h < 22)) return { cls: 'warn', label: h < 9 ? 'Early morning' : 'Evening' }
  return { cls: 'off', label: 'Night' }
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/* ---------- page ---------- */

type Dir = 'mine' | 'theirs'

export function ClockPage() {
  const { clients, me } = useData()
  const isAdmin = useIsAdmin()
  const myTz = validTz(me?.timezone) ? me!.timezone! : BROWSER_TZ
  const active = clients.filter((c) => c.status !== 'archived')
  const withTz = useMemo(
    () =>
      active
        .filter((c) => validTz(c.timezone))
        .sort((a, b) => offsetMin(a.timezone!, new Date()) - offsetMin(b.timezone!, new Date()) || clientDisplayName(a).localeCompare(clientDisplayName(b))),
    [clients], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const missing = active.filter((c) => !validTz(c.timezone))

  return (
    <>
      <Topbar crumbs={[{ label: 'Clock' }]} />
      <Content>
        <PageHead title="Clock" sub="What time it is for every client, now or at any time you plan." />
        {withTz.length === 0 ? (
          <div className="card"><Empty title="No client timezones yet">Set a country or timezone in a client’s settings to see their local time.</Empty></div>
        ) : (
          <Converter clients={withTz} myTz={myTz} />
        )}
        {missing.length > 0 && (
          <p className="xs muted" style={{ marginTop: -8 }}>
            Not shown (no timezone):{' '}
            {missing.map((c, i) => (
              <span key={c.id}>{i > 0 && ', '}{isAdmin ? <Link className="clk-link" to={`/clients/${c.id}/settings#contact`}>{clientDisplayName(c)}</Link> : clientDisplayName(c)}</span>
            ))}
          </p>
        )}
      </Content>
    </>
  )
}

function Converter({ clients, myTz }: { clients: Client[]; myTz: string }) {
  const now = useNow()
  const [live, setLive] = useState(true)
  const [dir, setDir] = useState<Dir>('mine')
  const [clientId, setClientId] = useState(clients[0].id)
  const client = clients.find((c) => c.id === clientId) ?? clients[0]
  const theirTz = client.timezone!
  const fromTz = dir === 'mine' ? myTz : theirTz
  const toTz = dir === 'mine' ? theirTz : myTz

  const [day, setDay] = useState(() => isoDay(now, fromTz))
  const [time, setTime] = useState(() => hhmm(now, fromTz))
  // While live, the fields show the current moment.
  const shownDay = live ? isoDay(now, fromTz) : day
  const shownTime = live ? hhmm(now, fromTz) : time
  const instant = live ? now : wallToInstant(day, time, fromTz)

  const plan = (d: string, t: string) => {
    setLive(false)
    setDay(d)
    setTime(t)
  }
  const swap = (next: Dir) => {
    if (next === dir) return
    if (!live) {
      setDay(isoDay(instant, toTz))
      setTime(hhmm(instant, toTz))
    }
    setDir(next)
  }

  const tag = dayTag(instant, toTz, fromTz)
  const st = hoursState(instant, theirTz)
  const first = clientDisplayName(client).split(' ')[0]

  return (
    <section className="card conv">
      <div className="conv-h">
        <div className="row-sm">
          {live ? <span className="conv-live"><i />Live</span> : <span className="conv-plan">Planning</span>}
          <span className="small muted">{live ? 'Showing the current time. Pick a date or time to plan ahead.' : 'Showing the moment you picked.'}</span>
        </div>
        <Tabs
          variant="seg"
          value={dir}
          onChange={swap}
          tabs={[
            { id: 'mine', label: 'My time → client' },
            { id: 'theirs', label: 'Client time → mine' },
          ]}
        />
      </div>

      <div className="conv-form">
        <div className="field">
          <span className="lbl">Client</span>
          <ClientPicker clients={clients} value={client} onChange={setClientId} />
        </div>
        <div className="field">
          <span className="lbl">Date</span>
          <DateInput value={shownDay} onChange={(v) => v && plan(v, shownTime)} clearable={false} />
        </div>
        <div className="field">
          <span className="lbl">Time <span className="faint">· {dir === 'mine' ? 'yours' : city(theirTz)}</span></span>
          <TimeInput value={shownTime} onChange={(v) => plan(shownDay, v)} />
        </div>
        <div className="field conv-now">
          <span className="lbl">&nbsp;</span>
          <button type="button" className="btn" disabled={live} onClick={() => setLive(true)} title="Back to the current time">
            <Radio className="i i-sm" />Now
          </button>
        </div>
      </div>

      <div className="conv-result">
        <div className="conv-side">
          <span className="conv-who">{dir === 'mine' ? 'You' : clientDisplayName(client)} · {city(fromTz)}</span>
          <span className="conv-time">{timeStr(instant, fromTz, live)}</span>
          <span className="conv-date">{longDate(instant, fromTz)}</span>
        </div>
        <button type="button" className="conv-swap" onClick={() => swap(dir === 'mine' ? 'theirs' : 'mine')} title="Swap direction" aria-label="Swap direction">
          <ArrowRight className="i conv-arrow" />
          <ArrowLeftRight className="i conv-swap-i" />
        </button>
        <div className="conv-side to">
          <span className="conv-who">{dir === 'mine' ? clientDisplayName(client) : 'You'} · {city(toTz)}</span>
          <span className="conv-time">{timeStr(instant, toTz, live)}</span>
          <span className="conv-date">
            {longDate(instant, toTz)}
            {tag && <span className="clk-tag">{tag}</span>}
          </span>
          <span className={cn('clk-state', st.cls)}><i />{st.label} for {first}</span>
        </div>
      </div>

      <div className="conv-all">
        <div className="conv-all-h">
          <span className="menu-title" style={{ padding: 0 }}>Everyone {live ? 'right now' : 'at this time'}</span>
          <span className="xs faint">Click a client to convert for them</span>
        </div>
        <div className="conv-list">
          <Row
            mark={<span className="clk-you">You</span>}
            name="You"
            sub={`${city(myTz)} · ${fmt(instant, myTz, { timeZoneName: 'short' }).split(' ').pop()}`}
            instant={instant}
            tz={myTz}
            baseTz={myTz}
            live={live}
            me
          />
          {clients.map((c) => (
            <Row
              key={c.id}
              mark={<ClientMark client={c} size="sm" />}
              name={clientDisplayName(c)}
              sub={`${city(c.timezone!)} · ${diffLabel(c.timezone!, myTz, instant)}`}
              instant={instant}
              tz={c.timezone!}
              baseTz={myTz}
              live={live}
              on={c.id === client.id}
              onClick={() => setClientId(c.id)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

const longDate = (d: Date, tz: string) => fmt(d, tz, { weekday: 'long', month: 'short', day: 'numeric' })

interface RowProps {
  mark: ReactNode
  name: string
  sub: string
  instant: Date
  tz: string
  baseTz: string
  live: boolean
  me?: boolean
  on?: boolean
  onClick?: () => void
}

function Row({ mark, name, sub, instant, tz, baseTz, live, me, on, onClick }: RowProps) {
  const st = hoursState(instant, tz)
  const tag = me ? null : dayTag(instant, tz, baseTz)
  const inner = (
    <>
      {mark}
      <span className="conv-li-who">
        <b className="trunc">{name}</b>
        <small className="trunc">{sub}</small>
      </span>
      <span className={cn('clk-state conv-li-st', st.cls)}><i />{st.label}</span>
      <span className="conv-li-when">
        <b>{timeStr(instant, tz, live)}</b>
        <small>
          {tag && <span className="clk-tag">{tag}</span>}
          {dateStr(instant, tz)}
        </small>
      </span>
    </>
  )
  return onClick ? (
    <button type="button" className={cn('conv-li', on && 'on')} onClick={onClick}>{inner}</button>
  ) : (
    <div className={cn('conv-li', me && 'me')}>{inner}</div>
  )
}

function ClientPicker({ clients, value, onChange }: { clients: Client[]; value: Client; onChange: (id: string) => void }) {
  return (
    <Menu
      align="left"
      className="conv-pick"
      matchWidth
      trigger={({ open, toggle }) => (
        <button type="button" className={cn('inp cur-inp', open && 'focus')} onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
          <ClientMark client={value} size="xs" />
          <span className="grow trunc">{clientDisplayName(value)}</span>
          <ChevronDown className="i i-xs" />
        </button>
      )}
    >
      {clients.map((c) => (
        <MenuItem key={c.id} icon={<ClientMark client={c} size="xs" />} on={c.id === value.id} onSelect={() => onChange(c.id)} hint={city(c.timezone!)}>
          {clientDisplayName(c)}
        </MenuItem>
      ))}
    </Menu>
  )
}
