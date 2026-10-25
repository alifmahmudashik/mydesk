import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, ArrowRight, ChevronDown, Globe, Plus, Radio, X } from 'lucide-react'
import { useData } from '@/data/store'
import { useIsAdmin } from '@/hooks/usePermissions'
import { Topbar, Content, PageHead } from '@/components/ui/layout'
import { Menu, MenuItem, MenuSearch, MenuTitle } from '@/components/ui/menu'
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
  const [zones, setZones] = useSavedZones()

  return (
    <>
      <Topbar crumbs={[{ label: 'Clock' }]} />
      <Content>
        <PageHead title="Clock" sub="What time it is for every client, now or at any time you plan." />
        <Converter clients={withTz} zones={zones} setZones={setZones} myTz={myTz} />
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

function Converter({ clients, zones, setZones, myTz }: { clients: Client[]; zones: string[]; setZones: (z: string[]) => void; myTz: string }) {
  const now = useNow()
  const [live, setLive] = useState(true)
  const [dir, setDir] = useState<Dir>('mine')
  const targets: Target[] = [
    ...clients.map((c) => ({ id: c.id, name: clientDisplayName(c), tz: c.timezone!, mark: <ClientMark client={c} size="sm" />, client: c })),
    ...zones.map((z) => ({ id: `tz:${z}`, name: city(z), tz: z, mark: <span className="clk-globe"><Globe className="i i-sm" /></span> })),
  ]
  const fallback: Target = { id: 'tz:UTC', name: 'UTC', tz: 'UTC', mark: <span className="clk-globe"><Globe className="i i-sm" /></span> }
  const [targetId, setTargetId] = useState(targets[0]?.id ?? fallback.id)
  const client = targets.find((t) => t.id === targetId) ?? targets[0] ?? fallback
  const theirTz = client.tz
  const pickZone = (tz: string) => {
    if (!zones.includes(tz)) setZones([...zones, tz])
    setTargetId(`tz:${tz}`)
  }
  const removeZone = (tz: string) => {
    setZones(zones.filter((z) => z !== tz))
    if (targetId === `tz:${tz}`) setTargetId(targets[0]?.id ?? fallback.id)
  }
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
  const first = client.client ? client.name.split(' ')[0] : client.name

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
            { id: 'mine', label: 'My time → theirs' },
            { id: 'theirs', label: 'Their time → mine' },
          ]}
        />
      </div>

      <div className="conv-form">
        <div className="field">
          <span className="lbl">Client or time zone</span>
          <TargetPicker targets={targets} value={client} onPick={setTargetId} onPickZone={pickZone} />
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
          <span className="conv-who">{dir === 'mine' ? 'You' : client.name} · {city(fromTz)}</span>
          <span className="conv-time">{timeStr(instant, fromTz, live)}</span>
          <span className="conv-date">{longDate(instant, fromTz)}</span>
        </div>
        <button type="button" className="conv-swap" onClick={() => swap(dir === 'mine' ? 'theirs' : 'mine')} title="Swap direction" aria-label="Swap direction">
          <ArrowRight className="i conv-arrow" />
          <ArrowLeftRight className="i conv-swap-i" />
        </button>
        <div className="conv-side to">
          <span className="conv-who">{dir === 'mine' ? client.name : 'You'} · {city(toTz)}</span>
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
          <span className="row-sm">
            <span className="xs faint hide-sm">Click a row to convert for it</span>
            <ZoneAdder onPick={pickZone} exclude={zones} />
          </span>
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
          {targets.map((t) => (
            <Row
              key={t.id}
              mark={t.mark}
              name={t.name}
              sub={`${t.client ? city(t.tz) : region(t.tz)} · ${diffLabel(t.tz, myTz, instant)}`}
              instant={instant}
              tz={t.tz}
              baseTz={myTz}
              live={live}
              on={t.id === client.id}
              onClick={() => setTargetId(t.id)}
              onRemove={t.client ? undefined : () => removeZone(t.tz)}
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
  onRemove?: () => void
}

function Row({ mark, name, sub, instant, tz, baseTz, live, me, on, onClick, onRemove }: RowProps) {
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
      {onRemove && (
        <span role="button" tabIndex={0} className="conv-li-x" title="Remove this time zone" aria-label="Remove this time zone"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onRemove() } }}>
          <X className="i i-xs" />
        </span>
      )}
    </>
  )
  return onClick ? (
    <button type="button" className={cn('conv-li', on && 'on')} onClick={onClick}>{inner}</button>
  ) : (
    <div className={cn('conv-li', me && 'me')}>{inner}</div>
  )
}

interface Target {
  id: string
  name: string
  tz: string
  mark: ReactNode
  client?: Client
}

/** All IANA zones (falls back to a short list on old browsers). */
const ALL_ZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')
  } catch {
    return ['UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney']
  }
})()
/** Shown before you type, grouped by region. */
const POPULAR: { region: string; zones: string[] }[] = [
  { region: 'Americas', zones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'America/Mexico_City', 'America/Sao_Paulo'] },
  { region: 'Europe', zones: ['Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam', 'Europe/Madrid', 'Europe/Stockholm', 'Europe/Istanbul'] },
  { region: 'Middle East & Africa', zones: ['Asia/Dubai', 'Asia/Riyadh', 'Asia/Jerusalem', 'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg'] },
  { region: 'Asia & Pacific', zones: ['Asia/Dhaka', 'Asia/Kolkata', 'Asia/Karachi', 'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'] },
]

/** Countries, abbreviations and nicknames people actually type. */
const ALIASES: Record<string, string[]> = {
  'America/New_York': ['usa', 'us', 'united states', 'east coast', 'est', 'edt', 'eastern', 'nyc', 'miami', 'boston', 'washington'],
  'America/Chicago': ['central', 'cst', 'cdt', 'texas', 'dallas', 'houston'],
  'America/Denver': ['mountain', 'mst', 'mdt', 'colorado', 'utah'],
  'America/Phoenix': ['arizona'],
  'America/Los_Angeles': ['west coast', 'pacific', 'pst', 'pdt', 'california', 'san francisco', 'la', 'seattle'],
  'America/Toronto': ['canada', 'ontario'],
  'America/Vancouver': ['british columbia'],
  'America/Mexico_City': ['mexico'],
  'America/Sao_Paulo': ['brazil', 'brasil'],
  'America/Argentina/Buenos_Aires': ['argentina'],
  'Europe/London': ['uk', 'united kingdom', 'england', 'britain', 'gmt', 'bst', 'scotland', 'wales'],
  'Europe/Dublin': ['ireland'],
  'Europe/Paris': ['france', 'cet', 'cest'],
  'Europe/Berlin': ['germany', 'deutschland', 'cet', 'cest'],
  'Europe/Amsterdam': ['netherlands', 'holland'],
  'Europe/Madrid': ['spain'],
  'Europe/Rome': ['italy'],
  'Europe/Stockholm': ['sweden'],
  'Europe/Oslo': ['norway'],
  'Europe/Copenhagen': ['denmark'],
  'Europe/Helsinki': ['finland'],
  'Europe/Warsaw': ['poland'],
  'Europe/Zurich': ['switzerland'],
  'Europe/Istanbul': ['turkey', 'turkiye'],
  'Europe/Kyiv': ['ukraine', 'kiev'],
  'Asia/Dubai': ['uae', 'emirates', 'abu dhabi', 'gst'],
  'Asia/Riyadh': ['saudi', 'saudi arabia', 'ksa'],
  'Asia/Qatar': ['qatar', 'doha'],
  'Asia/Jerusalem': ['israel', 'tel aviv', 'idt'],
  'Africa/Cairo': ['egypt'],
  'Africa/Lagos': ['nigeria'],
  'Africa/Nairobi': ['kenya'],
  'Africa/Johannesburg': ['south africa', 'sast'],
  'Asia/Dhaka': ['bangladesh', 'bd', 'bst'],
  'Asia/Kolkata': ['india', 'ist', 'delhi', 'mumbai', 'bangalore', 'calcutta'],
  'Asia/Karachi': ['pakistan', 'pkt', 'lahore'],
  'Asia/Kathmandu': ['nepal'],
  'Asia/Colombo': ['sri lanka'],
  'Asia/Singapore': ['sgt'],
  'Asia/Kuala_Lumpur': ['malaysia'],
  'Asia/Bangkok': ['thailand'],
  'Asia/Jakarta': ['indonesia'],
  'Asia/Manila': ['philippines'],
  'Asia/Ho_Chi_Minh': ['vietnam', 'saigon'],
  'Asia/Hong_Kong': ['hk', 'hkt'],
  'Asia/Shanghai': ['china', 'beijing'],
  'Asia/Tokyo': ['japan', 'jst'],
  'Asia/Seoul': ['korea', 'south korea', 'kst'],
  'Australia/Sydney': ['australia', 'aest', 'aedt', 'nsw'],
  'Australia/Melbourne': ['victoria'],
  'Australia/Perth': ['western australia', 'awst'],
  'Pacific/Auckland': ['new zealand', 'nz', 'nzst'],
}

/** "gmt+6", "+5:30", "utc-4" → offset in minutes, or null. */
function parseOffset(q: string): number | null {
  const m = /^(?:gmt|utc)?\s*([+\-−])\s*(\d{1,2})(?::?(\d{2}))?$/i.exec(q.trim())
  if (!m) return null
  const mins = Number(m[2]) * 60 + Number(m[3] ?? 0)
  return m[1] === '+' ? mins : -mins
}
const region = (tz: string) => tz.split('/').slice(0, -1).join(' / ').replace(/_/g, ' ') || tz
const gmt = (tz: string) => {
  const m = offsetMin(tz, new Date())
  const a = Math.abs(m)
  return `GMT${m >= 0 ? '+' : '−'}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, '0')}` : ''}`
}
const zoneMatches = (q: string, exclude: string[] = []) => {
  const raw = q.trim().toLowerCase()
  if (!raw) return []
  const now = new Date()
  const off = parseOffset(raw)
  if (off !== null) return ALL_ZONES.filter((z) => !exclude.includes(z) && offsetMin(z, now) === off).slice(0, 40)
  const s = raw.replace(/\s+/g, '_')
  const score = (z: string) => {
    const lc = z.toLowerCase()
    const cityLc = lc.split('/').pop()!
    const alias = ALIASES[z]?.some((a) => a === raw) ? 0 : ALIASES[z]?.some((a) => a.startsWith(raw)) ? 1 : null
    if (cityLc === s) return 0
    if (alias !== null) return alias
    if (cityLc.startsWith(s)) return 2
    if (lc.includes(s)) return 3
    return null
  }
  return ALL_ZONES.map((z) => ({ z, sc: exclude.includes(z) ? null : score(z) }))
    .filter((x): x is { z: string; sc: number } => x.sc !== null)
    .sort((a, b) => a.sc - b.sc || a.z.localeCompare(b.z))
    .slice(0, 40)
    .map((x) => x.z)
}

/** Time zones you added yourself, remembered on this device. */
function useSavedZones(): [string[], (z: string[]) => void] {
  const KEY = 'mydesk-clock-zones'
  const [zones, setState] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
      return Array.isArray(v) ? v.filter(validTz) : []
    } catch {
      return []
    }
  })
  const set = (z: string[]) => {
    setState(z)
    try {
      localStorage.setItem(KEY, JSON.stringify(z))
    } catch {
      // not saved; fine for this visit
    }
  }
  return [zones, set]
}

function ZoneItems({ q, onPick, exclude = [] }: { q: string; onPick: (tz: string) => void; exclude?: string[] }) {
  const item = (z: string) => (
    <MenuItem key={z} icon={<Globe className="i" />} hint={gmt(z)} onSelect={() => onPick(z)}>
      {city(z)} <span className="faint">· {region(z)}</span>
    </MenuItem>
  )
  if (q.trim()) {
    const list = zoneMatches(q, exclude)
    return (
      <>
        <MenuTitle>Time zones</MenuTitle>
        {list.length === 0 ? <div className="xs faint" style={{ padding: '4px 10px 8px' }}>No time zone matches “{q}”. Try a city, country, or “gmt+6”.</div> : list.map(item)}
      </>
    )
  }
  return (
    <>
      <div className="xs faint" style={{ padding: '6px 10px 2px' }}>Search {ALL_ZONES.length}+ time zones by city, country (Bangladesh, UK), code (EST, CET) or offset (gmt+6).</div>
      {POPULAR.map((g) => {
        const zs = g.zones.filter((z) => !exclude.includes(z) && ALL_ZONES.includes(z))
        return zs.length ? (
          <div key={g.region}>
            <MenuTitle>{g.region}</MenuTitle>
            {zs.map(item)}
          </div>
        ) : null
      })}
    </>
  )
}

function TargetPicker({ targets, value, onPick, onPickZone }: { targets: Target[]; value: Target; onPick: (id: string) => void; onPickZone: (tz: string) => void }) {
  const [q, setQ] = useState('')
  const s = q.trim().toLowerCase()
  const shown = s ? targets.filter((t) => `${t.name} ${t.tz}`.toLowerCase().includes(s)) : targets
  return (
    <Menu
      align="left"
      className="conv-pick"
      matchWidth
      wide
      trigger={({ open, toggle }) => (
        <button type="button" className={cn('inp cur-inp', open && 'focus')} onClick={() => { setQ(''); toggle() }} aria-haspopup="menu" aria-expanded={open}>
          <span className="clk-mark-xs">{value.mark}</span>
          <span className="grow trunc">{value.name}</span>
          <span className="xs faint">{gmt(value.tz)}</span>
          <ChevronDown className="i i-xs" />
        </button>
      )}
    >
      <MenuSearch value={q} onChange={setQ} placeholder="Search a client, city, country or GMT offset…" />
      {shown.length > 0 && <MenuTitle>Yours</MenuTitle>}
      {shown.map((t) => (
        <MenuItem key={t.id} icon={<span className="clk-mark-xs">{t.mark}</span>} on={t.id === value.id} hint={city(t.tz)} onSelect={() => onPick(t.id)}>
          {t.name}
        </MenuItem>
      ))}
      <ZoneItems q={q} onPick={onPickZone} exclude={targets.filter((t) => !t.client).map((t) => t.tz)} />
    </Menu>
  )
}

function ZoneAdder({ onPick, exclude }: { onPick: (tz: string) => void; exclude: string[] }) {
  const [q, setQ] = useState('')
  return (
    <Menu
      align="right"
      wide
      trigger={({ toggle }) => <button type="button" className="btn btn-sm" onClick={() => { setQ(''); toggle() }}><Plus className="i i-sm" />Add time zone</button>}
    >
      <MenuSearch value={q} onChange={setQ} placeholder="City, country, EST, gmt+6…" />
      <ZoneItems q={q} onPick={onPick} exclude={exclude} />
    </Menu>
  )
}
