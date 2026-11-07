// Runs inside the window before the site loads.
// Marks the page as the desktop app (html.desktop) so the site can blend its layout
// into the frameless window, and keeps the window buttons' colour in step with the
// site's light/dark theme.

const { ipcRenderer } = require('electron')

const APP_ORIGIN = 'https://mydesk.alifmahmud.com'

if (location.origin === APP_ORIGIN || location.hostname === 'localhost' || location.protocol === 'file:') {
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
