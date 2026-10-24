import { useEffect, useState } from 'react'
import { Bell, Lock, Monitor, Moon, Palette, Settings, Sun, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { useIsAdmin } from '@/hooks/usePermissions'
import { usePrefs, type ThemePref } from '@/hooks/usePrefs'
import { Topbar, Content, PageHead, Section, SaveBar } from '@/components/ui/layout'
import { SettingsLayout, useUnsavedGuard } from '@/components/ui/settings-layout'
import { Field, RadioCard, ToggleRow } from '@/components/ui/field'
import { ProfileFields, draftPatch, profileDraft, type ProfileDraft } from '@/features/team/ProfileFields'
import { supabase } from '@/lib/supabase'
import type { NotificationPrefs } from '@/types'

const DEFAULT_PREFS: Required<NotificationPrefs> = { assigned: true, mentioned: true, comment: false, overdue: true, weekly: true, due_soon: true, access: true }

export function AccountPage() {
  const isAdmin = useIsAdmin()
  const { me, updateRow } = useData()
  const { theme, setTheme, motion, setMotion } = usePrefs()
  const [draft, setDraft] = useState<ProfileDraft | null>(me ? profileDraft(me) : null)
  const [prefs, setPrefs] = useState<Required<NotificationPrefs>>({ ...DEFAULT_PREFS, ...(me?.notification_prefs ?? {}) })
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwBusy, setPwBusy] = useState(false)

  useEffect(() => {
    if (me) {
      setDraft(profileDraft(me))
      setPrefs({ ...DEFAULT_PREFS, ...(me.notification_prefs ?? {}) })
    }
  }, [me?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const profileDirty = me && draft ? JSON.stringify(draftPatch(draft)) !== JSON.stringify(draftPatch(profileDraft(me))) : false
  const prefsDirty = me ? JSON.stringify(prefs) !== JSON.stringify({ ...DEFAULT_PREFS, ...(me.notification_prefs ?? {}) }) : false
  const dirty = profileDirty || prefsDirty
  useUnsavedGuard(dirty)

  if (!me || !draft) {
    return (
      <>
        <Topbar crumbs={[{ label: 'Profile & preferences' }]} />
        <Content><PageHead title="Profile & preferences" sub="Sign in to edit your profile. In demo mode there is no signed-in user." /></Content>
      </>
    )
  }

  const save = () => {
    updateRow('profiles', me.id, { ...draftPatch(draft), notification_prefs: prefs })
    toast.success('Profile saved')
  }

  const changePassword = async () => {
    if (pw.next.length < 8) return toast.error('Use at least 8 characters')
    if (pw.next !== pw.confirm) return toast.error('New passwords don’t match')
    if (!supabase) return toast('Not available in demo mode')
    setPwBusy(true)
    // Supabase doesn't check the old password on update, so verify it first.
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: me.email, password: pw.current })
    if (authErr) {
      setPwBusy(false)
      return toast.error('Current password is wrong')
    }
    const { error } = await supabase.auth.updateUser({ password: pw.next })
    setPwBusy(false)
    if (error) return toast.error(error.message)
    setPw({ current: '', next: '', confirm: '' })
    toast.success('Password updated')
  }

  const togglePref = (k: keyof NotificationPrefs) => (v: boolean) => setPrefs((p) => ({ ...p, [k]: v }))
  const themes: { id: ThemePref; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'light', label: 'Light', desc: 'Bright and clean.', icon: <Sun className="i i-sm" /> },
    { id: 'dark', label: 'Dark', desc: 'Easier at night.', icon: <Moon className="i i-sm" /> },
    { id: 'system', label: 'System', desc: 'Follows your device.', icon: <Monitor className="i i-sm" /> },
  ]

  return (
    <>
      <Topbar crumbs={[{ label: 'Profile & preferences' }]}>
        <button type="button" className="btn btn-pri" disabled={!dirty} onClick={save}>Save changes</button>
      </Topbar>
      <Content>
        <PageHead title="Profile & preferences" sub="Your personal details, notifications and sign-in." />
        <SettingsLayout
          nav={[
            { id: 'info', label: 'Personal info', icon: <User className="i i-sm" /> },
            { id: 'notifications', label: 'Notifications', icon: <Bell className="i i-sm" /> },
            { id: 'appearance', label: 'Appearance', icon: <Palette className="i i-sm" /> },
            { id: 'security', label: 'Password', icon: <Lock className="i i-sm" /> },
          ]}
        >
          <Section id="info" title="Personal info" desc="Shown to teammates on tasks and comments.">
            <ProfileFields profile={me} draft={draft} onChange={setDraft} />
          </Section>
          <section id="notifications" className="sec">
            <div className="sec-h"><h2>Email notifications</h2><p>We never send the same email twice for one event.</p></div>
            <div className="sec-b" style={{ gap: 0 }}>
              <ToggleRow title="A task is assigned to me" desc="Once per assignment. Editing the task never re-sends." checked={prefs.assigned} onChange={togglePref('assigned')} />
              <ToggleRow title="Someone @mentions me" desc="Once per comment or note." checked={prefs.mentioned} onChange={togglePref('mentioned')} />
              <ToggleRow title="New comment on my tasks" desc={prefs.comment ? 'One email per comment on tasks you’re assigned, created or watch.' : 'Off. These show in Inbox only.'} checked={prefs.comment} onChange={togglePref('comment')} />
              <ToggleRow title="A task or project is due tomorrow" desc="One reminder the day before: your tasks, and projects you have access to." checked={prefs.due_soon} onChange={togglePref('due_soon')} />
              {!isAdmin && <ToggleRow title="I'm given access to a client" desc="Once, when someone shares a client and its projects with you." checked={prefs.access} onChange={togglePref('access')} />}
              {isAdmin && <ToggleRow title="A payment becomes overdue" desc="Owner and admins only. Once per payment." checked={prefs.overdue} onChange={togglePref('overdue')} />}
              <ToggleRow title="Weekly summary" desc="Monday 9:00. Open tasks, money in, what's overdue." checked={prefs.weekly} onChange={togglePref('weekly')} />
            </div>
          </section>
          <Section id="appearance" title="Appearance">
            <div className="grid-3">
              {themes.map((t) => (
                <RadioCard key={t.id} name="theme" checked={theme === t.id} onChange={() => setTheme(t.id)} title={<span className="row-sm">{t.icon}{t.label}</span>} desc={t.desc} />
              ))}
            </div>
            <ToggleRow title="Animations" desc="Page transitions and chart motion. Saved on this device." checked={motion} onChange={setMotion} />
          </Section>
          <Section id="security" title="Password" desc="If you sign in with Google, you don’t need a password.">
            <div className="f2">
              <Field label="Current password"><input className="inp" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
              <span className="hide-sm" />
              <Field label="New password"><input className="inp" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
              <Field label="Confirm new password"><input className="inp" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
            </div>
            <button className="btn" type="button" style={{ alignSelf: 'flex-start' }} disabled={pwBusy || !pw.current || !pw.next} onClick={() => void changePassword()}>
              {pwBusy ? 'Updating…' : 'Update password'}
            </button>
          </Section>
          {isAdmin && (
            <Link to="/settings" className="card card-b row lift">
              <Settings className="i faint" />
              <span className="grow"><b className="m">Workspace settings</b><span className="small muted" style={{ display: 'block' }}>Business details, payment methods and invoice defaults.</span></span>
            </Link>
          )}
        </SettingsLayout>
      </Content>
      {dirty && <SaveBar note="Changes apply to your account only" onCancel={() => { setDraft(profileDraft(me)); setPrefs({ ...DEFAULT_PREFS, ...(me.notification_prefs ?? {}) }) }} onSave={save} />}
    </>
  )
}
