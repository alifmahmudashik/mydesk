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
  Palette,
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
            <a href="#setup">Setup</a>
            <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" className="row-sm">
              <span>GitHub</span>
              <ExternalLink className="i i-xs" />
            </a>
          </nav>

          <div className="home-nav-actions">
            <a
              href={WINDOWS_EXE_URL}
              className="btn btn-sm hide-sm"
              title="Download the Windows app"
            >
              <Download className="i i-xs" />
              <span>Download</span>
            </a>
            <Link to="/login" className="btn btn-sm btn-ghost">
              Sign in
            </Link>
            <Link to="/signup" className="btn btn-sm home-cta-primary">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="home-hero">
        <div className="home-pill-badge">
          <span className="home-badge-dot" />
          <span>Web app &amp; Windows desktop client</span>
        </div>

        <h1 className="home-headline">
          Manage your freelance clients, projects, and invoices in one place.
        </h1>

        <p className="home-subhead">
          MyDesk keeps your project tasks, client notes, timers, and PDF invoices together.
          Private to your workspace, with no monthly per-seat subscription.
        </p>

        <div className="home-cta-row">
          <Link to="/signup" className="btn btn-lg home-cta-primary">
            <span>Create your workspace</span>
          </Link>
          <a
            href={WINDOWS_EXE_URL}
            className="btn btn-lg home-download-btn"
          >
            <Monitor className="i i-sm" />
            <span>Download</span>
          </a>
        </div>
        <p className="home-hero-meta">
          Works in your browser · Windows app for Windows 10 &amp; 11
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
            <span className="home-preview-tag hide-sm">Interactive preview</span>
          </div>

          <div className="home-preview-body">
            {activeTab === 'tasks' && (
              <div className="preview-pane">
                <div className="preview-row-head">
                  <div>
                    <h3 className="preview-pane-title">Brand Identity &amp; Web Platform</h3>
                    <p className="preview-pane-sub">Acme Studios · 8 of 12 tasks completed</p>
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
                    <span className="preview-task-title">Send milestone invoice INV-014 to client</span>
                    <span className="preview-assignee">Alif M.</span>
                  </div>
                  <div className="preview-task-item">
                    <span className="preview-check" />
                    <span className="preview-task-title">Implement dataLayer events with code auto-format</span>
                    <span className="badge">Code block</span>
                    <span className="preview-assignee">Sarah K.</span>
                  </div>
                  <div className="preview-task-item">
                    <span className="preview-check" />
                    <span className="preview-task-title">Deliver final handoff assets to client</span>
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
                    <span className="kpi-sub" style={{ color: 'var(--h-green)' }}>3 paid invoices</span>
                  </div>
                  <div className="preview-kpi">
                    <span className="kpi-label">Outstanding balance</span>
                    <span className="kpi-val">$2,100</span>
                    <span className="kpi-sub">1 invoice pending</span>
                  </div>
                  <div className="preview-kpi">
                    <span className="kpi-label">Overdue</span>
                    <span className="kpi-val">$0</span>
                    <span className="kpi-sub" style={{ color: 'var(--h-green)' }}>All payments current</span>
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
                    <span className="pill ok timer-status">Running</span>
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
                    <span>Database schema migration</span>
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
          <h2 className="home-section-title">Built for daily client work</h2>
          <p className="home-section-sub">
            Track tasks, billable hours, and payments without switching between four separate tools.
          </p>
        </div>

        <div className="home-features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrap" style={{ color: '#4F46E5' }}>
              <Folder className="i" />
            </div>
            <h3>Tasks &amp; Milestones</h3>
            <p>
              Group work by client and project. Write structured descriptions, attach deliverables,
              check off subtasks, and paste code snippets with auto-formatting.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap" style={{ color: '#059669' }}>
              <FileText className="i" />
            </div>
            <h3>PDF Invoicing</h3>
            <p>
              Generate itemized invoices in any currency. Send them directly, record payments when
              they land, and keep track of what clients still owe.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap" style={{ color: '#0284C7' }}>
              <Briefcase className="i" />
            </div>
            <h3>Client Records</h3>
            <p>
              Store hourly rates, default currencies, retainers, contact details, and project histories
              together in one client profile.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap" style={{ color: '#D97706' }}>
              <Clock className="i" />
            </div>
            <h3>Built-in Timer</h3>
            <p>
              Start and stop timers while you work, or log sessions after the fact. Review billable
              hours by project before generating an invoice.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap" style={{ color: '#7C3AED' }}>
              <Users className="i" />
            </div>
            <h3>Team &amp; Contractor Access</h3>
            <p>
              Invite collaborators to specific clients. Teammates can manage assigned tasks without
              seeing your invoices, rates, or revenue.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrap" style={{ color: '#DB2777' }}>
              <Palette className="i" />
            </div>
            <h3>Your Brand, Your Workspace</h3>
            <p>
              Set your workspace name, logo, accent colour and business currency. Each workspace is
              private: other businesses never see your clients, invoices or team.
            </p>
          </div>
        </div>
      </section>

      {/* Desktop App Callout */}
      <section id="desktop" className="home-desktop-section">
        <div className="home-desktop-card">
          <div className="desktop-card-content">
            <h2>Prefer a dedicated desktop window?</h2>
            <p>
              MyDesk includes a standalone Windows client built with Electron. It matches Windows 11,
              runs quietly in your taskbar, starts on boot, and keeps you signed in without browser tab clutter.
            </p>
            <ul className="desktop-feature-list">
              <li>Light and dark themes that follow your Windows setting</li>
              <li>Always stays up to date with the latest web deployments</li>
              <li>Runs in background with native Windows notifications</li>
            </ul>
            <div className="row wrap" style={{ gap: 12, marginTop: 24 }}>
              <a href={WINDOWS_EXE_URL} className="btn btn-lg home-cta-primary">
                <Download className="i i-sm" />
                <span>Download</span>
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

      {/* How to run / setup */}
      <section id="setup" className="home-section">
        <div className="home-section-head">
          <h2 className="home-section-title">Three steps to your own workspace</h2>
          <p className="home-section-sub">
            Sign up, make the workspace yours, and bring your team in.
          </p>
        </div>

        <div className="home-steps-grid">
          <div className="step-card">
            <div className="step-number">Step 1</div>
            <h3>Create your account</h3>
            <p>Sign up with your email or Google account. It takes less than a minute.</p>
          </div>
          <div className="step-card">
            <div className="step-number">Step 2</div>
            <h3>Set up your workspace</h3>
            <p>Add your workspace and business name, pick your currency, upload a logo and choose your colours.</p>
          </div>
          <div className="step-card">
            <div className="step-number">Step 3</div>
            <h3>Invite your team</h3>
            <p>You're the owner. Invite teammates to the clients they work on, and download the desktop app if you like.</p>
          </div>
        </div>
      </section>

      {/* Bottom CTA (Always Dark Surface) */}
      <section className="home-bottom-cta">
        <h2>Start organizing your client work today</h2>
        <p>Create a workspace for your business, or sign in to the one you already have.</p>
        <div className="row wrap" style={{ gap: 14, marginTop: 24, justifyContent: 'center' }}>
          <Link to="/signup" className="btn btn-lg home-cta-primary">
            <span>Create your workspace</span>
          </Link>
          <Link to="/login" className="btn btn-lg home-download-btn">
            <span>Sign in</span>
          </Link>
          <a href={WINDOWS_EXE_URL} className="btn btn-lg home-download-btn">
            <Download className="i i-sm" />
            <span>Download</span>
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
              Client and project workspace for independent developers, designers, and studios.
            </p>
          </div>

          <div className="footer-links-group">
            <div className="footer-col">
              <span className="footer-heading">Product</span>
              <a href="#features">Features</a>
              <a href="#desktop">Desktop app</a>
              <a href="#setup">Setup</a>
            </div>

            <div className="footer-col">
              <span className="footer-heading">Access</span>
              <Link to="/login">Sign in</Link>
              <Link to="/signup">Create account</Link>
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
