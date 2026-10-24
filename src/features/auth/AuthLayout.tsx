import { useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, DollarSign, FileText, ListChecks } from 'lucide-react'

/** Phrases typed out on the brand panel, one after another. */
const PHRASES = ['every client.', 'every project.', 'every invoice.', 'every deadline.']

/** Illustrative, made-up activity (never real workspace data: this screen is public). */
const FEED = [
  { icon: <CheckCircle2 className="i i-sm" />, tone: '#22C55E', text: <><b>Website redesign</b> marked complete</>, when: '2m' },
  { icon: <DollarSign className="i i-sm" />, tone: '#4F46E5', text: <><b>$2,400</b> received from Northwind Studio</>, when: '1h' },
  { icon: <FileText className="i i-sm" />, tone: '#0EA5E9', text: <>Invoice <b>NW-014</b> sent to Acme Co.</>, when: '3h' },
  { icon: <ListChecks className="i i-sm" />, tone: '#F59E0B', text: <><b>3 tasks</b> due this week across 2 clients</>, when: 'today' },
]

function useTyping(words: string[]) {
  const [i, setI] = useState(0)
  const [text, setText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setText(words[0])
      return
    }
    const word = words[i % words.length]
    const done = !deleting && text === word
    const empty = deleting && text === ''
    const delay = done ? 1600 : empty ? 300 : deleting ? 35 : 70
    const t = setTimeout(() => {
      if (done) setDeleting(true)
      else if (empty) {
        setDeleting(false)
        setI((n) => n + 1)
      } else setText(deleting ? word.slice(0, text.length - 1) : word.slice(0, text.length + 1))
    }, delay)
    return () => clearTimeout(t)
  }, [text, deleting, i, words])

  return text
}

export function BrandLogo({ size = 32 }: { size?: number }) {
  return (
    <div className="logo" style={{ width: size, height: size }}>
      <img src="/mydesk-fire.png" alt="" style={{ width: size * 0.7, height: size * 0.7 }} />
    </div>
  )
}

/** Split auth screen: form on the left, animated brand panel on the right. */
export function AuthLayout({ children }: { children: ReactNode }) {
  const typed = useTyping(PHRASES)
  const [shown, setShown] = useState(1)

  // Reveal the sample activity one card at a time.
  useEffect(() => {
    if (shown >= FEED.length) return
    const t = setTimeout(() => setShown((n) => n + 1), 900)
    return () => clearTimeout(t)
  }, [shown])

  return (
    <div className="auth-screen">
      <div className="login-l">
        <div className="row" style={{ marginBottom: 40 }}>
          <BrandLogo />
          <b style={{ fontSize: 15 }}>MyDesk</b>
        </div>
        <div style={{ maxWidth: 380, width: '100%' }}>{children}</div>
      </div>
      <div className="login-r auth-brand">
        <div className="row">
          <BrandLogo />
          <b>MyDesk</b>
        </div>
        <div>
          <p className="auth-headline">
            One calm place for
            <br />
            <span className="auth-typed">{typed}</span>
            <span className="auth-caret" aria-hidden />
          </p>
          <p className="auth-sub">Clients, projects, tasks, invoices and payments for freelancers and small agencies, all in one workspace.</p>
          <div className="stack" style={{ marginTop: 28, maxWidth: 400 }}>
            {FEED.slice(0, shown).map((f, idx) => (
              <div key={idx} className="auth-feed">
                <span className="auth-feed-ico" style={{ background: `${f.tone}26`, color: f.tone }}>{f.icon}</span>
                <span className="small grow">{f.text}</span>
                <span className="xs" style={{ opacity: 0.55 }}>{f.when}</span>
              </div>
            ))}
          </div>
        </div>
        <span className="xs" style={{ opacity: 0.5 }}>Example activity shown. Your data stays private to your workspace.</span>
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
