import { useEffect, useState } from 'react'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import { ToggleRow } from '@/components/ui/field'

// Settings that only exist in the Windows app. The app's preload script exposes
// window.mydeskDesktop; in a normal browser it's missing and this section is hidden.

interface DesktopSettings {
  autoStart: boolean
  notifications: boolean
}
type UpdateState = {
  state: 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error'
  version?: string
  percent?: number
  message?: string
}
interface DesktopBridge {
  getVersion(): Promise<string | null>
  getSettings(): Promise<DesktopSettings | null>
  setSetting<K extends keyof DesktopSettings>(key: K, value: DesktopSettings[K]): Promise<DesktopSettings>
  getUpdate(): Promise<UpdateState | null>
  checkForUpdates(): Promise<void>
  downloadUpdate(): Promise<void>
  onUpdate(cb: (s: UpdateState) => void): () => void
}

export const desktopBridge = (window as unknown as { mydeskDesktop?: DesktopBridge }).mydeskDesktop

export function DesktopAppSettings() {
  const bridge = desktopBridge
  const [settings, setSettings] = useState<DesktopSettings | null>(null)
  const [version, setVersion] = useState<string | null>(null)
  const [update, setUpdate] = useState<UpdateState>({ state: 'idle' })

  useEffect(() => {
    if (!bridge) return
    void bridge.getSettings().then(setSettings)
    void bridge.getVersion().then(setVersion)
    void bridge.getUpdate().then((u) => u && setUpdate(u))
    return bridge.onUpdate(setUpdate)
  }, [bridge])

  if (!bridge || !settings) return null

  const set = <K extends keyof DesktopSettings>(key: K, value: DesktopSettings[K]) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s))
    void bridge.setSetting(key, value).then(setSettings)
  }

  const updateText = {
    idle: 'MyDesk checks for updates when it opens and every few hours.',
    checking: 'Checking for updates…',
    none: update.message ?? 'You have the latest version.',
    available: `Version ${update.version} is available.`,
    downloading: `Downloading the update… ${update.percent ?? 0}%`,
    ready: 'Installing. MyDesk will restart in a moment.',
    error: `Couldn’t check for updates${update.message ? `: ${update.message}` : '.'}`,
  }[update.state]

  return (
    <section id="desktop" className="sec">
      <div className="sec-h"><h2>Desktop app</h2><p>Settings for MyDesk on this computer.</p></div>
      <div className="sec-b" style={{ gap: 0 }}>
        <ToggleRow title="Open MyDesk when Windows starts" desc="MyDesk opens by itself when you sign in to Windows." checked={settings.autoStart} onChange={(v) => set('autoStart', v)} />
        <ToggleRow
          title="Show desktop notifications"
          desc={settings.notifications ? 'Windows pop-ups while MyDesk is open. Emails only when it’s closed.' : 'Off. You’ll get emails instead, even while MyDesk is open.'}
          checked={settings.notifications}
          onChange={(v) => set('notifications', v)}
        />
        <div className="toggle-row" style={{ cursor: 'default' }}>
          <span className="grow">
            <b>Updates{version ? ` · version ${version}` : ''}</b>
            <small className={update.state === 'error' ? 't-bad' : undefined}>{updateText}</small>
            {update.state === 'downloading' && <div className="bar" style={{ marginTop: 8, maxWidth: 280 }}><i style={{ width: `${update.percent ?? 0}%`, animation: 'none' }} /></div>}
          </span>
          {update.state === 'available' ? (
            <button type="button" className="btn btn-pri btn-sm" onClick={() => void bridge.downloadUpdate()}><Download className="i i-sm" />Download and install</button>
          ) : (
            <button type="button" className="btn btn-sm" disabled={update.state === 'checking' || update.state === 'downloading' || update.state === 'ready'} onClick={() => void bridge.checkForUpdates()}>
              {update.state === 'checking' ? <Loader2 className="i i-sm" style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw className="i i-sm" />}
              Check for updates
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
