import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Image, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { signOut } from '@/hooks/useAuth'
import { useData } from '@/data/store'
import { Field } from '@/components/ui/field'
import { CurrencySelect } from '@/components/ui/currency-picker'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { ColorPicker, WorkspaceLogo, readableOn } from '@/features/workspace/brand'

interface PendingInvite {
  id: string
  workspace: string
  inviter: string
  role: string
}

/** Uploads an image to the person's own folder in the avatars bucket and returns its URL. */
export async function uploadLogo(file: File, userId: string): Promise<string | null> {
  if (!file.type.startsWith('image/')) {
    toast.error('Pick a PNG, JPG, WebP or SVG image')
    return null
  }
  if (file.size > 2 * 1024 * 1024) {
    toast.error('Logos must be under 2 MB')
    return null
  }
  if (!supabase) {
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.readAsDataURL(file)
    })
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${userId}/workspace-logo-${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (error) {
    toast.error('Upload failed', { description: error.message })
    return null
  }
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

/** Shown after sign-up to anyone who isn't in a workspace yet: create one, or join an invite. */
export function CreateWorkspacePage() {
  const { me, init } = useData()
  const [name, setName] = useState('')
  const [business, setBusiness] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [logoColor, setLogoColor] = useState('#4F46E5')
  const [accent, setAccent] = useState('#4F46E5')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [invite, setInvite] = useState<PendingInvite | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!supabase) return
    void supabase.rpc('my_pending_invite').then(({ data }) => setInvite((data as PendingInvite[] | null)?.[0] ?? null))
  }, [])

  const pickLogo = async (file: File) => {
    if (!me) return
    setUploading(true)
    const url = await uploadLogo(file, me.id)
    setUploading(false)
    if (url) setLogoUrl(url)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !name.trim()) return
    setBusy(true)
    const { error } = await supabase.rpc('create_workspace', {
      p_name: name.trim(),
      p_business_name: business.trim() || null,
      p_currency: currency,
      p_logo_color: logoColor,
      p_accent_color: accent,
      p_logo_url: logoUrl,
    })
    if (error) {
      setBusy(false)
      return toast.error('Couldn’t create the workspace', { description: error.message })
    }
    toast.success(`Welcome to ${name.trim()}`)
    await init()
  }

  async function join() {
    if (!supabase || !invite) return
    setBusy(true)
    const { error } = await supabase.rpc('accept_invite', { p_invite: invite.id })
    if (error) {
      setBusy(false)
      return toast.error('Couldn’t join', { description: error.message })
    }
    toast.success(`You joined ${invite.workspace}`)
    await init()
  }

  const previewName = name.trim() || 'Your workspace'

  return (
    <AuthLayout>
      {/* The form's own buttons preview the accent colour as you pick it. */}
      <div className="ws-setup" style={{ ['--pri' as string]: accent, ['--pri-h' as string]: `color-mix(in oklab, ${accent} 82%, black)` }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.025em' }}>Set up your workspace</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Your clients, projects and invoices live here. You can change all of this later in Workspace settings.
        </p>

        {invite && (
          <div className="ws-invite">
            <div className="grow">
              <b>{invite.inviter} invited you to {invite.workspace}</b>
              <span className="small muted">Join as {invite.role === 'admin' ? 'an admin' : 'a member'} instead of creating your own.</span>
            </div>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void join()}>Join</button>
          </div>
        )}

        <form className="stack" style={{ marginTop: 24 }} onSubmit={submit}>
          <Field label="Workspace name" required hint="Shown in the sidebar, e.g. your studio or agency name.">
            <input className="inp" required maxLength={80} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Northwind Studio" />
          </Field>
          <Field label="Business name" hint="The legal or trading name on your invoices.">
            <input className="inp" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="e.g. Northwind Studio LLC" />
          </Field>
          <Field label="Business currency" hint="The default for new projects and invoices.">
            <CurrencySelect value={currency} onChange={setCurrency} currencies={[...SUPPORTED_CURRENCIES]} />
          </Field>

          <Field label="Logo">
            <div className="row" style={{ gap: 12 }}>
              <WorkspaceLogo workspace={{ name: previewName, logo_url: logoUrl, logo_color: logoColor }} size={44} />
              <button type="button" className="btn btn-sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Image className="i i-sm" />
                {uploading ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
              </button>
              {logoUrl && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLogoUrl(null)}>Remove</button>}
              <input ref={fileRef} type="file" className="sr" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { const file = e.target.files?.[0]; if (file) void pickLogo(file); e.target.value = '' }} />
            </div>
          </Field>
          <Field label="Logo colour" hint={logoUrl ? 'Shows behind your logo.' : 'Your logo is the first letter of the workspace name on this colour.'}>
            <ColorPicker label="Logo colour" value={logoColor} onChange={setLogoColor} />
          </Field>
          <Field label="Accent colour" hint="Used for buttons, links and highlights across the app.">
            <ColorPicker label="Accent colour" value={accent} onChange={setAccent} />
          </Field>

          <div className="ws-preview" aria-hidden>
            <WorkspaceLogo workspace={{ name: previewName, logo_url: logoUrl, logo_color: logoColor }} size={28} />
            <div className="grow" style={{ minWidth: 0 }}>
              <b className="trunc" style={{ display: 'block' }}>{previewName}</b>
              <small className="muted">{business.trim() || 'Preview'}</small>
            </div>
            <span className="ws-preview-btn" style={{ background: accent, color: readableOn(accent) }}>Button</span>
          </div>

          <button type="submit" className="btn btn-pri btn-lg btn-block" disabled={busy || uploading || !name.trim()}>
            {busy ? 'Creating…' : 'Create workspace'}
          </button>
        </form>

        <p className="small muted" style={{ marginTop: 20 }}>
          Signed in as {me?.email}.{' '}
          <button type="button" className="link-btn small" onClick={() => void signOut()}>
            <LogOut className="i i-xs" /> Sign out
          </button>
        </p>
      </div>
    </AuthLayout>
  )
}
