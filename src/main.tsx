import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import App from '@/App'
import '@/styles/tokens.css'
import '@/styles/design.css'
import '@/styles/app.css'
import '@/lib/privacy'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      {/* Window drag handle, shown only in the desktop app (html.desktop). */}
      <div className="drag-strip" aria-hidden />

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: 'var(--panel)', color: 'var(--ink)', border: '1px solid var(--line2)', fontFamily: 'Geist, system-ui, sans-serif' },
        }}
      />
    </BrowserRouter>
  </StrictMode>,
)
