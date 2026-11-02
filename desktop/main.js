// MyDesk for Windows.
// The window shows the live site, so every deploy from GitHub (via Vercel)
// appears here automatically. The desktop app itself only needs rebuilding
// if this folder changes.

const { app, BrowserWindow, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const APP_URL = 'https://mydesk.alifmahmud.com/'
const APP_ORIGIN = new URL(APP_URL).origin

// Sign-in pages (Supabase + Google) must load inside the window so the login
// comes back to the app. Any other site opens in the normal browser.
const SIGN_IN_HOSTS = [/\.supabase\.co$/, /(^|\.)google\.com$/, /\.googleusercontent\.com$/, /\.gstatic\.com$/, /^accounts\.youtube\.com$/]

const staysInApp = (url) => {
  try {
    const u = new URL(url)
    if (u.origin === APP_ORIGIN || u.protocol === 'file:' || url === 'about:blank') return true
    return u.protocol === 'https:' && SIGN_IN_HOSTS.some((re) => re.test(u.hostname))
  } catch {
    return false
  }
}

const openOutside = (url) => {
  if (/^(https?|mailto|tel):/i.test(url)) void shell.openExternal(url)
}

// Google refuses sign-in from browsers that say "Electron", so look like plain Chrome.
app.userAgentFallback = app.userAgentFallback.replace(/\s(Electron|MyDesk|mydesk-desktop)\/\S+/gi, '')

// Windows needs this for desktop notifications to show with the MyDesk name.
app.setAppUserModelId('com.alifmahmud.mydesk')

// ---- remember window size --------------------------------------------------
const stateFile = () => path.join(app.getPath('userData'), 'window.json')
const loadState = () => {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8'))
  } catch {
    return { width: 1360, height: 860 }
  }
}
const saveState = (win) => {
  try {
    const b = win.getNormalBounds()
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }))
  } catch {
    /* not important */
  }
}

// ---- one window only ---------------------------------------------------------
if (!app.requestSingleInstanceLock()) app.quit()

let win = null

function createWindow() {
  const state = loadState()
  let closing = false
  win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 380,
    minHeight: 500,
    title: 'MyDesk',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#ffffff',
    autoHideMenuBar: true, // Alt shows it; Ctrl+R / F5 still reload
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true },
  })
  if (state.maximized) win.maximize()
  win.once('ready-to-show', () => win.show())

  // Links that open a new tab: app pages stay here, everything else goes to the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(url, APP_URL).origin === APP_ORIGIN) void win.loadURL(url)
    else openOutside(url)
    return { action: 'deny' }
  })

  // Normal link clicks that would leave the app.
  win.webContents.on('will-navigate', (e, url) => {
    if (!staysInApp(url)) {
      e.preventDefault()
      openOutside(url)
    }
  })

  // No internet / site down: show a friendly page with a retry button.
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || closing) return // -3 = cancelled, not a real failure
    void win.loadFile(path.join(__dirname, 'offline.html'), { query: { url: url || APP_URL } })
  })

  // Closing: unload the page first so MyDesk can tell the server you're offline
  // (then emails resume right away), then close for real.
  win.on('close', (e) => {
    saveState(win)
    if (closing) return
    closing = true
    e.preventDefault()
    win.hide()
    win.webContents
      .loadURL('about:blank')
      .catch(() => {})
      .finally(() => setTimeout(() => win.destroy(), 1200))
  })

  void win.loadURL(APP_URL)
}

app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
