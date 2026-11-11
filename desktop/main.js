// MyDesk for Windows.
// The window shows the live site, so every deploy from GitHub (via Vercel)
// appears here automatically. The desktop app itself only needs rebuilding
// if this folder changes.

const { app, BrowserWindow, dialog, ipcMain, powerMonitor, safeStorage, session, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const fs = require('node:fs')
const path = require('node:path')

// MYDESK_URL lets you try the app against a local dev server, e.g. http://localhost:5173/
const APP_URL = process.env.MYDESK_URL || 'https://mydesk.alifmahmud.com/'
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

// ---- frameless window --------------------------------------------------------
// Matches the site's dark frame (--bg). The site adds a strip this tall above its
// main panel when it runs here (html.desktop), so the buttons never cover content.
const FRAME_COLOR = '#26262B'
const TITLEBAR_HEIGHT = 40

// The page reports its frame colour (light/dark theme); repaint the button strip to match.
ipcMain.on('titlebar-color', (e, color) => {
  if (!win || e.sender !== win.webContents || typeof color !== 'string' || color.length > 40) return
  try {
    win.setTitleBarOverlay({ color: cssToHex(color), symbolColor: '#E4E4EA', height: TITLEBAR_HEIGHT })
    win.setBackgroundColor(cssToHex(color))
  } catch {
    /* older Windows builds without overlay support */
  }
})

// "rgb(38, 38, 43)" -> "#26262B"
function cssToHex(color) {
  const m = color.match(/\d+(\.\d+)?/g)
  if (!m || m.length < 3) return FRAME_COLOR
  return '#' + m.slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, '0')).join('').toUpperCase()
}

// ---- app settings (Account → Desktop app in MyDesk) ---------------------------
// autoStart: open MyDesk when you sign in to Windows.
// notifications: allow Windows pop-ups. Off = the site falls back to emails.
const DEFAULTS = { autoStart: true, notifications: true }
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json')
let settings = { ...DEFAULTS }
const loadSettings = () => {
  try {
    settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }
  } catch {
    settings = { ...DEFAULTS }
  }
}
const saveSettings = () => {
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify(settings))
  } catch {
    /* not important */
  }
}
// Only the installed app registers itself; running from source would register electron.exe.
const applyAutoStart = () => {
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: settings.autoStart })
}

ipcMain.handle('settings:get', (e) => (fromApp(e) ? { ...settings } : null))
ipcMain.handle('settings:set', (e, key, value) => {
  if (!fromApp(e) || !(key in DEFAULTS) || typeof value !== 'boolean') return { ...settings }
  settings[key] = value
  saveSettings()
  if (key === 'autoStart') applyAutoStart()
  // The site reads notification permission when it loads; reload so it switches
  // between pop-ups and emails straight away.
  if (key === 'notifications') setTimeout(() => win?.webContents.reload(), 300)
  return { ...settings }
})
ipcMain.handle('app:version', (e) => (fromApp(e) ? app.getVersion() : null))

const fromApp = (e) => Boolean(win) && e.sender === win.webContents

// ---- sign-in storage -----------------------------------------------------------
// The site's login (Supabase session) is saved here instead of only in the window's
// localStorage. Chromium writes localStorage to disk a few seconds late, and a Windows
// restart can kill the app before that. The session's refresh token changes every hour
// and an old one is rejected, so a lost write meant being signed out after a restart.
// This file is written (and synced to disk) the moment the value changes, encrypted
// with Windows' own user encryption when available.
const authFile = () => path.join(app.getPath('userData'), 'auth.json')
let authStore = null

const loadAuth = () => {
  if (authStore) return authStore
  try {
    const raw = JSON.parse(fs.readFileSync(authFile(), 'utf8'))
    authStore = raw.enc ? JSON.parse(safeStorage.decryptString(Buffer.from(raw.data, 'base64'))) : raw.data || {}
  } catch {
    authStore = {}
  }
  return authStore
}

const saveAuth = () => {
  try {
    const json = JSON.stringify(authStore || {})
    const enc = safeStorage.isEncryptionAvailable()
    const body = JSON.stringify(enc ? { enc: true, data: safeStorage.encryptString(json).toString('base64') } : { enc: false, data: authStore })
    // Write a temp file, flush it to disk, then swap it in, so a crash never leaves half a file.
    const tmp = authFile() + '.tmp'
    const fd = fs.openSync(tmp, 'w')
    try {
      fs.writeSync(fd, body)
      fs.fsyncSync(fd)
    } finally {
      fs.closeSync(fd)
    }
    fs.renameSync(tmp, authFile())
  } catch {
    /* fall back to the page's own localStorage copy */
  }
}

// Only the MyDesk site itself may read or write it (not sign-in pages or the offline page).
const fromAppSite = (e) => {
  if (!fromApp(e)) return false
  try {
    const origin = new URL(e.senderFrame?.url || '').origin
    return origin === APP_ORIGIN || /^http:\/\/localhost(:\d+)?$/.test(origin)
  } catch {
    return false
  }
}
const validKey = (key) => typeof key === 'string' && key.length > 0 && key.length < 200

ipcMain.on('auth:get', (e, key) => {
  e.returnValue = fromAppSite(e) && validKey(key) ? (loadAuth()[key] ?? null) : null
})
ipcMain.on('auth:set', (e, key, value) => {
  if (fromAppSite(e) && validKey(key) && typeof value === 'string' && value.length < 100000 && loadAuth()[key] !== value) {
    authStore[key] = value
    saveAuth()
  }
  e.returnValue = true
})
ipcMain.on('auth:remove', (e, key) => {
  if (fromAppSite(e) && validKey(key) && key in loadAuth()) {
    delete authStore[key]
    saveAuth()
  }
  e.returnValue = true
})

// Also push the window's own storage to disk before Windows shuts down, sleeps or we quit.
const flushStorage = () => {
  try {
    session.defaultSession.flushStorageData()
  } catch {
    /* not important */
  }
}

// ---- updates (from GitHub releases) ------------------------------------------
// Checks on start and every 6 hours. A new version asks first; "Download and
// install" downloads it (progress on the taskbar icon), then reinstalls and restarts.
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true
let update = { state: 'idle' }
let installing = false
const prompted = new Set()

const sendUpdate = (patch) => {
  update = { ...update, ...patch }
  win?.webContents.send('update', update)
}

autoUpdater.on('checking-for-update', () => sendUpdate({ state: 'checking', message: undefined }))
autoUpdater.on('update-not-available', () => sendUpdate({ state: 'none' }))
autoUpdater.on('update-available', (info) => {
  sendUpdate({ state: 'available', version: info.version })
  if (!prompted.has(info.version)) {
    prompted.add(info.version)
    void askToUpdate(info.version)
  }
})
autoUpdater.on('download-progress', (p) => {
  sendUpdate({ state: 'downloading', percent: Math.round(p.percent) })
  win?.setProgressBar(p.percent / 100)
})
autoUpdater.on('update-downloaded', (info) => {
  win?.setProgressBar(-1)
  sendUpdate({ state: 'ready', version: info.version })
  installing = true
  // Silent reinstall, then open MyDesk again.
  setTimeout(() => autoUpdater.quitAndInstall(true, true), 800)
})
autoUpdater.on('error', (err) => {
  win?.setProgressBar(-1)
  sendUpdate({ state: 'error', message: String(err?.message || err).split('\n')[0].slice(0, 200) })
})

async function askToUpdate(version) {
  if (!win) return
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    title: 'Update available',
    message: `MyDesk ${version} is available`,
    detail: `You have ${app.getVersion()}. Download it now? MyDesk restarts by itself to finish installing.`,
    buttons: ['Download and install', 'Later'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  })
  if (response === 0) void downloadUpdate()
}

function checkForUpdates() {
  if (!app.isPackaged) return sendUpdate({ state: 'none', message: 'Updates only work in the installed app.' })
  autoUpdater.checkForUpdates().catch(() => {})
}
function downloadUpdate() {
  if (update.state !== 'available') return
  sendUpdate({ state: 'downloading', percent: 0 })
  autoUpdater.downloadUpdate().catch(() => {})
}

ipcMain.handle('update:get', (e) => (fromApp(e) ? update : null))
ipcMain.handle('update:check', (e) => fromApp(e) && checkForUpdates())
ipcMain.handle('update:download', (e) => fromApp(e) && downloadUpdate())

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
    // No white Windows title bar: the page fills the window and the minimise /
    // maximise / close buttons sit on top of the site's dark frame.
    backgroundColor: FRAME_COLOR,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: FRAME_COLOR, symbolColor: '#E4E4EA', height: TITLEBAR_HEIGHT },
    autoHideMenuBar: true, // Alt shows it; Ctrl+R / F5 still reload
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true, preload: path.join(__dirname, 'preload.js') },
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
  // Windows is signing out / restarting: save everything now, it may not wait for us.
  win.on('session-end', flushStorage)

  win.on('close', (e) => {
    saveState(win)
    flushStorage()
    if (closing || installing) return // the updater is closing us to reinstall
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

app.whenReady().then(() => {
  loadSettings()
  applyAutoStart()
  // Desktop notifications follow the "Show desktop notifications" setting.
  const allowed = (permission) => permission !== 'notifications' || settings.notifications
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed(permission)))
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed(permission))
  createWindow()
  powerMonitor.on('shutdown', flushStorage)
  powerMonitor.on('suspend', flushStorage)
  app.on('before-quit', flushStorage)
  setTimeout(checkForUpdates, 8000)
  setInterval(checkForUpdates, 6 * 60 * 60 * 1000)
})
app.on('window-all-closed', () => app.quit())
