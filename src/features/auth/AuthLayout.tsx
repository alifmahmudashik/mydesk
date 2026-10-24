import type { ReactNode } from 'react'

/** Split auth screen from the design: form on the left, dark brand panel on the right. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-screen">
      <div className="login-l">
        <div className="row" style={{ marginBottom: 40 }}>
          <div className="logo"><img src="/mydesk-fire.png" alt="" /></div>
          <b style={{ fontSize: 15 }}>MyDesk</b>
        </div>
        <div style={{ maxWidth: 380, width: '100%' }}>{children}</div>
      </div>
      <div className="login-r">
        <div className="row">
          <div className="logo"><img src="/mydesk-fire.png" alt="" /></div>
          <b>MyDesk</b>
        </div>
        <div>
          <p style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.25, maxWidth: 420 }}>
            Clients, projects, tasks and money. One calm place for freelance work.
          </p>
          <div className="stack" style={{ marginTop: 28, maxWidth: 380 }}>
            <div className="row" style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.06)' }}>
              <span className="av sm av-c2">MA</span>
              <span className="small grow">Mahedi completed <b>Review search terms</b></span>
              <span className="xs" style={{ opacity: 0.6 }}>2m</span>
            </div>
            <div className="row" style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.06)' }}>
              <span className="av sm" style={{ background: '#16A34A', color: '#fff' }}>$</span>
              <span className="small grow"><b>$200</b> received from Yamin Khan</span>
              <span className="xs" style={{ opacity: 0.6 }}>1h</span>
            </div>
          </div>
        </div>
        <span className="xs" style={{ opacity: 0.5 }}>Your data stays in your workspace.</span>
      </div>
    </div>
  )
}

export function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
