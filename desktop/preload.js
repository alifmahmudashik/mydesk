// Runs inside the window before the site loads.
// - Marks the page as the desktop app (html.desktop) so the site can blend its layout
//   into the frameless window, and keeps the window buttons' colour in step with the
//   site's light/dark theme.
// - Gives the site a small, safe bridge (window.mydeskDesktop) for the desktop-only
//   settings and updates shown under Account → Desktop app.

const { contextBridge, ipcRenderer } = require('electron')

const APP_ORIGIN = 'https://mydesk.alifmahmud.com'
const isApp = location.origin === APP_ORIGIN || location.hostname === 'localhost'

if (isApp || location.protocol === 'file:') {
  let last = ''
  const sync = () => {
    const html = document.documentElement
    if (!html.classList.contains('desktop')) html.classList.add('desktop')
    const bg = document.body ? getComputedStyle(document.body).backgroundColor : ''
    if (bg && bg !== last && bg !== 'rgba(0, 0, 0, 0)') {
      last = bg
      ipcRenderer.send('titlebar-color', bg)
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    sync()
    // Theme switches change classes on <html>; the app also re-renders <body>.
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
    // Fonts/styles can land after DOMContentLoaded; check again once loaded.
    window.addEventListener('load', sync)
  })
}

// Only MyDesk itself gets the bridge (never the Google / Supabase sign-in pages).
if (isApp) {
  contextBridge.exposeInMainWorld('mydeskDesktop', {
    getVersion: () => ipcRenderer.invoke('app:version'),
    getSettings: () => ipcRenderer.invoke('settings:get'),
    setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getUpdate: () => ipcRenderer.invoke('update:get'),
    checkForUpdates: () => ipcRenderer.invoke('update:check'),
    downloadUpdate: () => ipcRenderer.invoke('update:download'),
    onUpdate: (cb) => {
      const listener = (_e, state) => cb(state)
      ipcRenderer.on('update', listener)
      return () => ipcRenderer.removeListener('update', listener)
    },
  })
}
