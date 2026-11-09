import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Folder,
  ListChecks,
  Monitor,
  Shield,
  Users,
} from 'lucide-react'
import { BrandLogo } from '@/features/auth/AuthLayout'
import '@/features/home/HomePage.css'

const LATEST_RELEASE_URL = 'https://github.com/alifmahmudashik/mydesk/releases/latest'
const WINDOWS_EXE_URL = 'https://github.com/alifmahmudashik/mydesk/releases/latest/download/MyDesk-Setup-1.2.0.exe'
const GITHUB_REPO_URL = 'https://github.com/alifmahmudashik/mydesk'

type PreviewTab = 'tasks' | 'billing' | 'clients' | 'clock'

export function HomePage() {
  const [activeTab, setActiveTab] = useState<PreviewTab>('tasks')

  return (
    <div className="home-root">
      {/* Top Navigation */}
      <header className="home-nav">
        <div className="home-nav-inner">
          <Link to="/" className="home-brand">
            <BrandLogo size={32} />
            <span className="home-brand-name">MyDesk</span>
          </Link>

          <nav className="home-nav-links">
            <a href="#features">Features</a>
            <a href="#desktop">Desktop app</a>
            <a href="#architecture">Privacy</a>
            <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" className="row-sm">
              <span>GitHub</span>
              <ExternalLink className="i i-xs" />
            </a>
          </nav>

          <div className="home-nav-actions">
            <a
              href={WINDOWS_EXE_URL}
              className="btn btn-sm hide-sm"
              title="Download Windows installer"
            >
              <Download className="i i-xs" />
              <span>Download (.exe)</span>
            </a>
            <Link to="/login" className="btn btn-sm btn-ghost">
              Sign in
            </Link>
            <Link to="/login" className="btn btn-sm btn-pri">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="home-hero">
        <div className="home-pill-badge">
          <span className="home-badge-dot" />
          <span>Web app and native Windows desktop client</span>
        </div>

        <h1 className="home-headline">
          Client and project management for freelancers and small teams.
        </h1>

        <p className="home-subhead">
          Organize client tasks with checklists and comments, track billable time, send itemized
          invoices, and record payments. Private to your workspace, with zero subscription fees.
        </p>

        <div className="home-cta-row">
          <Link to="/login" className="btn btn-pri btn-lg">
            <span>Open your workspace</span>
          </Link>
          <a
            href={LATEST_RELEASE_URL}
            target="_blank"
            rel="noreferrer"
            className="btn btn-lg home-download-btn"
          >
            <Monitor className="i i-sm" />
            <span>Download for Windows (v1.2.0)</span>
          </a>
        </div>
        <p className="home-hero-meta">
          Windows 10 / 11 · 64-bit installer · Self-hosted with Supabase &amp; Vercel
        </p>
      </section>

      {/* Interactive App Preview */}
      <section className="home-preview-section">
        <div className="home-preview-shell">
          <div className="home-preview-topbar">
            <div className="home-window-dots">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>
            <div className="home-preview-tabs">
              <button
                type="button"
                className={`preview-tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
                onClick={() => setActiveTab('tasks')}
              >
                <ListChecks className="i i-xs" />
                <span>Projects &amp; Tasks</span>
              </button>
              <button
                type="button"
                className={`preview-tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
                onClick={() => setActiveTab('billing')}
              >
                <FileText className="i i-xs" />
                <span>Billing &amp; Invoices</span>
              </button>
              <button
                type="button"
                className={`preview-tab-btn ${activeTab === 'clients' ? 'active' : ''}`}
                onClick={() => setActiveTab('clients')}
              >
                <Briefcase className="i i-xs" />
                <span>Clients</span>
              </button>
              <button
                type="button"
                className={`preview-tab-btn ${activeTab === 'clock' ? 'active' : ''}`}
                onClick={() => setActiveTab('clock')}
              >
                <Clock className="i i-xs" />
                <span>Time Clock</span>
              </button>
            </div>
            <span className="home-preview-tag hide-sm">Live preview</span>
          </div>

          <div className="home-preview-body">
            {activeTab === 'tasks' && (
              <div className="preview-pane">
                <div className="preview-row-head">
                  <div>
                    <h3 className="preview-pane-title">Brand Identity &amp; Web Platform</h3>
                    <p className="preview-pane-sub">Acme Studios · Due next Friday · 8 of 12 tasks done</p>
                  </div>
                  <span className="pill pri">In progress</span>
                </div>
                <div className="preview-task-list">
                  <div className="preview-task-item done">
                    <span className="preview-check checked"><CheckCircle2 className="i i-xs" /></span>
                    <span className="preview-task-title">Design system components &amp; color tokens</span>
                    <span className="preview-assignee">Alif M.</span>
                  </div>
                  <div className="preview-task-item done">
                    <span className="preview-check checked"><CheckCircle2 className="i i-xs" /></span>
                    <span className="preview-task-title">Draft client invoice NW-014 for milestone 1</span>
                    <span className="preview-assignee">Alif M.</span>
                  </div>
                  <div className="preview-task-item">
                    <span className="preview-check" />
                    <span className="preview-task-title">Implement dataLayer events for lead widget</span>
                    <span className="badge">Code block</span>
                    <span className="preview-assignee">Sarah K.</span>
                  </div>
                  <div className="preview-task-item">
                    <span className="preview-check" />
                    <span className="preview-task-title">Final review with client stakeholders</span>
                    <span className="preview-assignee">Unassigned</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="preview-pane">
                <div className="preview-kstrip">
                  <div className="preview-kpi">
                    <span className="kpi-label">Earned this month</span>
                    <span className="kpi-val">$8,450</span>
                    <span className="kpi-sub t-ok">3 paid invoices</span>
                  </div>
                  <div className="preview-kpi">
                    <span className="kpi-label">Outstanding balance</span>
                    <span className="kpi-val">$2,100</span>
                    <span className="kpi-sub">1 invoice pending</span>
                  </div>
                  <div className="preview-kpi">
                    <span className="kpi-label">Overdue</span>
                    <span className="kpi-val">$0</span>
                    <span className="kpi-sub t-ok">All payments on track</span>
                  </div>
                </div>
                <div className="preview-table">
                  <div className="preview-table-row header">
                    <span>Invoice</span>
                    <span>Client</span>
                    <span>Amount</span>
                    <span>Due Date</span>
                    <span className="r">Status</span>
                  </div>
                  <div className="preview-table-row">
                    <span className="mono">INV-2026-004</span>
                    <span>Acme Studios</span>
                    <span className="num">$4,200.00</span>
                    <span>Nov 15, 2026</span>
                    <span className="r"><span className="pill ok">Paid</span></span>
                  </div>
                  <div className="preview-table-row">
                    <span className="mono">INV-2026-005</span>
                    <span>Northwind Labs</span>
                    <span className="num">$2,100.00</span>
                    <span>Nov 28, 2026</span>
                    <span className="r"><span className="pill warn">Due in 18d</span></span>
                  </div>
                  <div className="preview-table-row">
                    <span className="mono">INV-2026-003</span>
                    <span>Starlight Media</span>
                    <span className="num">$2,150.00</span>
                    <span>Oct 30, 2026</span>
                    <span className="r"><span className="pill ok">Paid</span></span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'clients' && (
              <div className="preview-pane">
                <div className="preview-clients-grid">
                  <div className="preview-client-card">
                    <div className="client-card-top">
                      <span className="sq cc" style={{ background: '#4F46E5' }} />
                      <div>
                        <b>Acme Studios</b>
                        <small>Monthly retainer · USD</small>
                      </div>
                    </div>
                    <div className="client-card-stats">
                      <div><span>Active projects</span><b>2</b></div>
                      <div><span>Total billed</span><b>$14,800</b></div>
                    </div>
                  </div>
                  <div className="preview-client-card">
                    <div className="client-card-top">
                      <span className="sq cc" style={{ background: '#0EA5E9' }} />
                      <div>
                        <b>Northwind Labs</b>
                        <small>Hourly billing ($120/hr) · AUD</small>
                      </div>
                    </div>
                    <div className="client-card-stats">
                      <div><span>Active projects</span><b>1</b></div>
                      <div><span>Total billed</span><b>$8,400</b></div>
                    </div>
                  </div>
                  <div className="preview-client-card">
                    <div className="client-card-top">
                      <span className="sq cc" style={{ background: '#10B981' }} />
                      <div>
                        <b>Starlight Media</b>
                        <small>Fixed quote · EUR</small>
                      </div>
                    </div>
                    <div className="client-card-stats">
                      <div><span>Active projects</span><b>1</b></div>
                      <div><span>Total billed</span><b>$6,250</b></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'clock' && (
              <div className="preview-pane">
                <div className="preview-timer-box">
                  <div className="timer-display">
                    <span className="timer-digits">02:44:18</span>
                    <span className="pill ok timer-status">Timer running</span>
                  </div>
                  <div className="timer-meta">
                    <b>Acme Studios</b> · Web Platform API Integration
                  </div>
                </div>
                <div className="preview-table" style={{ marginTop: 16 }}>
                  <div className="preview-table-row header">
                    <span>Date</span>
                    <span>Project</span>
                    <span>Task</span>
                    <span className="r">Duration</span>
                  </div>
                  <div className="preview-table-row">
                    <span>Today</span>
                    <span>Web Platform</span>
                    <span>Auth webhook verification</span>
                    <span className="r num">1h 45m</span>
                  </div>
                  <div className="preview-table-row">
                    <span>Yesterday</span>
                    <span>Northwind Labs</span>
                    <span>Schema migration script</span>
                    <span className="r num">3h 10m</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="home-section">
        <div className="home-section-head">
          <span className="home-section-eyebrow">Everything you need</span>
          <h2 className="home-section-title">Built for how independent developers and agencies work</h2>
          <p className="home-section-sub">
            No bloated enterprise workflows or mandatory subscriptions. Just clear records of your
            clients, projects, and finances.
          </p>
        </div>

        <div className="home-features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrap" style={{ color: '#6366F1' }}>
              <Folder className="i" />
            </div>
            <h3>Project &amp; Task Tracking</h3>
            <p>
              Organize engagements by client. Write structured task descriptions, attach deliverables,
              track due dates, and format code blocks automatically with syntax detection.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap" style={{ color: '#22C55E' }}>
              <FileText className="i" />
            </div>
            <h3>Invoices &amp; Billing</h3>
            <p>
              Generate clean, branded PDF invoices with custom line items. Track payment due dates,
              record partial or full payments, and keep an accurate record of monthly revenue.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap" style={{ color: '#0EA5E9' }}>
              <Briefcase className="i" />
            </div>
            <h3>Client Directory</h3>
            <p>
              Store hourly rates, default currencies, retainers, contact details, and contracts. Keep
              all context in one client profile instead of scattered across emails and spreadsheets.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap" style={{ color: '#F59E0B' }}>
              <Clock className="i" />
            </div>
            <h3>Live Time Clock</h3>
            <p>
              Start and stop timers while you work or log sessions manually. Summarize billable hours by
              project before drafting an invoice.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap" style={{ color: '#8B5CF6' }}>
              <Users className="i" />
            </div>
            <h3>Team Roles &amp; Privacy</h3>
            <p>
              Invite collaborators with explicit permissions. Members can access assigned client tasks
              without viewing invoices, balances, or private financial records.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap" style={{ color: '#EC4899' }}>
              <Shield className="i" />
            </div>
            <h3>Your Database, Your Data</h3>
            <p>
              Powered by your own Supabase instance. You retain complete ownership of your database
              without third-party lock-in or telemetry tracking.
            </p>
          </div>
        </div>
      </section>

      {/* Desktop App Callout */}
      <section id="desktop" className="home-desktop-section">
        <div className="home-desktop-card">
          <div className="desktop-card-content">
            <span className="home-section-eyebrow">Windows App</span>
            <h2>Prefer a dedicated desktop window?</h2>
            <p>
              MyDesk includes a standalone Windows client built with Electron. It matches the
              frameless Windows 11 style, runs quietly in your taskbar, starts on boot, and keeps
              you signed in without browser tab clutter.
            </p>
            <ul className="desktop-feature-list">
              <li>Frameless dark interface blending with your desktop theme</li>
              <li>Always stays up to date with the latest web deployments</li>
              <li>Runs in background with native Windows notifications</li>
            </ul>
            <div className="row wrap" style={{ gap: 12, marginTop: 24 }}>
              <a href={WINDOWS_EXE_URL} className="btn btn-pri btn-lg">
                <Download className="i i-sm" />
                <span>Download MyDesk Setup 1.2.0 (.exe)</span>
              </a>
              <a
                href={LATEST_RELEASE_URL}
                target="_blank"
                rel="noreferrer"
                className="btn btn-lg btn-ghost"
              >
                <span>Release notes</span>
                <ExternalLink className="i i-xs" />
              </a>
            </div>
          </div>
          <div className="desktop-card-visual hide-sm">
            <div className="desktop-mockup">
              <div className="mockup-header">
                <BrandLogo size={20} />
                <span className="mockup-title">MyDesk for Windows</span>
                <div className="mockup-controls">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <div className="mockup-content">
                <div className="mockup-sidebar">
                  <div className="mockup-nav-item active">Dashboard</div>
                  <div className="mockup-nav-item">Projects</div>
                  <div className="mockup-nav-item">Billing</div>
                  <div className="mockup-nav-item">Analytics</div>
                </div>
                <div className="mockup-main">
                  <div className="mockup-card" />
                  <div className="mockup-card" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture / Privacy Section */}
      <section id="architecture" className="home-section">
        <div className="home-section-head">
          <span className="home-section-eyebrow">Architecture</span>
          <h2 className="home-section-title">Clean, transparent technology stack</h2>
          <p className="home-section-sub">
            Built on proven open-source foundations. Run it directly or deploy your own instance in
            minutes.
          </p>
        </div>

        <div className="home-arch-grid">
          <div className="arch-card">
            <b>Frontend</b>
            <p>React 19, TypeScript, and Vite. Fast load times, responsive layouts, and zero heavy UI framework overhead.</p>
          </div>
          <div className="arch-card">
            <b>Database &amp; Auth</b>
            <p>Supabase PostgreSQL with Row Level Security (RLS). Direct real-time updates and secure multi-user permissions.</p>
          </div>
          <div className="arch-card">
            <b>Email Notifications</b>
            <p>Resend integration for clean transactional emails when team members are assigned tasks or mentioned in comments.</p>
          </div>
          <div className="arch-card">
            <b>Desktop Wrapper</b>
            <p>Lightweight Electron shell supporting auto-updates via GitHub releases and persistent window sizing.</p>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="home-bottom-cta">
        <h2>Start organizing your client work today</h2>
        <p>Sign in to your existing workspace or set up a new instance.</p>
        <div className="row wrap justify-center" style={{ gap: 14, marginTop: 24 }}>
          <Link to="/login" className="btn btn-pri btn-lg">
            <span>Sign in to MyDesk</span>
          </Link>
          <a href={WINDOWS_EXE_URL} className="btn btn-lg">
            <Download className="i i-sm" />
            <span>Download for Windows</span>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="footer-brand">
            <div className="row-sm">
              <BrandLogo size={24} />
              <b>MyDesk</b>
            </div>
            <p className="footer-desc">
              Client and project workspace for independent professionals and small studios.
            </p>
          </div>

          <div className="footer-links-group">
            <div className="footer-col">
              <span className="footer-heading">Product</span>
              <a href="#features">Features</a>
              <a href="#desktop">Desktop app</a>
              <a href="#architecture">Architecture</a>
            </div>

            <div className="footer-col">
              <span className="footer-heading">Access</span>
              <Link to="/login">Sign in</Link>
              <Link to="/login">Create account</Link>
              <a href={WINDOWS_EXE_URL}>Windows download</a>
            </div>

            <div className="footer-col">
              <span className="footer-heading">Open Source</span>
              <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
                GitHub Repository
              </a>
              <a href={LATEST_RELEASE_URL} target="_blank" rel="noreferrer">
                Releases &amp; Changelog
              </a>
            </div>
          </div>
        </div>

        <div className="home-footer-bottom">
          <span>&copy; {new Date().getFullYear()} MyDesk. Open source under the MIT License.</span>
          <span>Crafted by Alif Mahmud</span>
        </div>
      </footer>
    </div>
  )
}
