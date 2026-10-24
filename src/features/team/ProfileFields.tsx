import { useRef, useState } from 'react'
import { Image } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Avatar } from '@/components/ui/avatar'
import { Field } from '@/components/ui/field'
import type { Profile } from '@/types'

export interface ProfileDraft {
  full_name: string
  display_name: string
  phone: string
  job_title: string
  timezone: string
  avatar_url: string | null
}

export function profileDraft(p: Profile): ProfileDraft {
  return {
    full_name: p.full_name ?? '',
    display_name: p.display_name ?? '',
    phone: p.phone ?? '',
    job_title: p.job_title ?? '',
    timezone: p.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    avatar_url: p.avatar_url ?? null,
  }
}

export function draftPatch(d: ProfileDraft) {
  return {
    full_name: d.full_name.trim() || null,
    display_name: d.display_name.trim() || null,
    phone: d.phone.trim() || null,
    job_title: d.job_title.trim() || null,
    timezone: d.timezone || null,
    avatar_url: d.avatar_url,
  }
}

const TIMEZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')
  } catch {
    return ['Asia/Dhaka', 'Europe/London', 'America/New_York', 'Australia/Sydney', 'UTC']
  }
})()

function tzLabel(tz: string) {
  try {
    const off = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value
    return off ? `${tz} (${off.replace('GMT', 'UTC')})` : tz
  } catch {
    return tz
  }
}

/** Photo + name/phone/title/timezone fields, shared by "My profile" and the member page. */
export function ProfileFields({ profile, draft, onChange, phoneLabel = 'Phone' }: { profile: Profile; draft: ProfileDraft; onChange: (d: ProfileDraft) => void; phoneLabel?: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => onChange({ ...draft, [k]: v })

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return toast.error('Pick a PNG or JPG image')
    if (file.size > 4 * 1024 * 1024) return toast.error('Images must be under 4 MB')
    if (!supabase) {
      // Demo: keep it in memory as a data URL.
      const reader = new FileReader()
      reader.onload = () => set('avatar_url', String(reader.result))
      reader.readAsDataURL(file)
      return
    }
    setBusy(true)
    const path = `${profile.id}/${crypto.randomUUID()}.${file.name.split('.').pop() ?? 'png'}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    setBusy(false)
    if (error) return toast.error('Upload failed', { description: error.message })
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    set('avatar_url', data.publicUrl)
  }

  return (
    <>
      <div className="upload">
        <Avatar profile={{ ...profile, avatar_url: draft.avatar_url, full_name: draft.full_name || profile.full_name }} size="xl" />
        <div className="stack-sm">
          <div className="row-sm">
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Image className="i i-sm" />{busy ? 'Uploading…' : 'Upload photo'}
            </button>
            <input ref={fileRef} type="file" className="sr" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }} />
            {draft.avatar_url && <button className="btn btn-ghost btn-sm" type="button" onClick={() => set('avatar_url', null)}>Remove</button>}
          </div>
          <span className="hint">PNG or JPG, at least 256 × 256.</span>
        </div>
      </div>
      <div className="f2">
        <Field label="Full name"><input className="inp" value={draft.full_name} onChange={(e) => set('full_name', e.target.value)} /></Field>
        <Field label="Display name" hint="Shown on tasks and comments."><input className="inp" value={draft.display_name} onChange={(e) => set('display_name', e.target.value)} /></Field>
        <Field label="Email" hint="Sign-in email can’t be changed here."><input className="inp" type="email" value={profile.email} disabled /></Field>
        <Field label={phoneLabel}><input className="inp" type="tel" placeholder="+880 1XXX-XXXXXX" value={draft.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Job title"><input className="inp" placeholder="e.g. Google Ads specialist" value={draft.job_title} onChange={(e) => set('job_title', e.target.value)} /></Field>
        <Field label="Timezone">
          <select className="inp" value={draft.timezone} onChange={(e) => set('timezone', e.target.value)}>
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tzLabel(tz)}</option>)}
          </select>
        </Field>
      </div>
    </>
  )
}
