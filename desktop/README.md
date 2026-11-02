# MyDesk for Windows

A desktop window that shows the live site at https://mydesk.alifmahmud.com.

## How updates work

The app loads the live site every time it opens. When you push to GitHub, Vercel
redeploys, and the desktop app shows the new version the next time it opens (or
press **Ctrl+R** to reload right away). You don't need to rebuild or reinstall.

Rebuild the installer only if you change something in this `desktop/` folder,
for example the site address in `main.js` or the icon.

## Build the installer

```powershell
cd desktop
npm install
npm run build
```

The installer is `desktop/release/MyDesk-Setup-<version>.exe`. Upload it to a
GitHub Release (or share the file directly);
double-clicking it installs MyDesk and adds Start menu and desktop shortcuts.

- Running `npm run start` from a VS Code terminal fails because VS Code sets
  `ELECTRON_RUN_AS_NODE`. Run `Remove-Item Env:ELECTRON_RUN_AS_NODE` first, or
  use a normal PowerShell window.
- Windows SmartScreen shows "Windows protected your PC" the first time because
  the installer isn't code-signed. Click **More info → Run anyway**.

## What the app does

- Sign-in pages (Supabase, Google) open inside the window; other links open in your
  normal browser.
- If there's no internet, it shows a "Can't reach MyDesk" page and retries on its own.
- Desktop notifications use the regular MyDesk setting (Account page).
- Remembers the window size and position.
