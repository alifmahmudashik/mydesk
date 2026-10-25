import { useEffect, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, Briefcase, ChartColumn, ChevronsUpDown, Clock, CreditCard, FileText, Folder, Home, Inbox, ListChecks,
  LogOut, Moon, Search, Settings, Sprout, Sun, User, Users,
} from 'lucide-react'
import { useData } from '@/data/store'
import { useUI } from '@/data/ui'
import { useIsAdmin } from '@/hooks/usePermissions'
import { isDarkNow, usePrefs } from '@/hooks/usePrefs'
import { signOut } from '@/hooks/useAuth'
import { Avatar } from '@/components/ui/avatar'
import { Menu, MenuItem, MenuSep, MenuTitle } from '@/components/ui/menu'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { CreateHost } from '@/features/create/CreateHost'
import { clientColor, clientDisplayName, effectivePaymentStatus, OPEN_PROJECT, OPEN_TASK, profileFullName } from '@/lib/derive'

const roleLabel = { owner: 'Owner', admin: 'Admin', member: 'Member' } as const

function NavItem({ to, icon, children, end, extra }: { to: string; icon: ReactNode; children: ReactNode; end?: boolean; extra?: ReactNode }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
      {icon}
      {children}
      {extra}
    </NavLink>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin()
  const { me, notifications, tasks, projects, clients, payments, invoiceSettings, demoMode, learning } = useData()
  const { openCreate, setSearch } = useUI()
  const navigate = useNavigate()
  const location = useLocation()

  const unread = notifications.filter((n) => !n.read_at).length
  const myOpen = tasks.filter((t) => t.assignee_id === me?.id && OPEN_TASK(t)).length
  const activeProjects = projects.filter(OPEN_PROJECT).length
  const activeClients = clients.filter((c) => c.status !== 'archived').length
  const overdue = payments.filter((p) => effectivePaymentStatus(p) === 'overdue').length
  // Every active client, pinned ones first, then A–Z.
  const sideClients = clients
    .filter((c) => c.status !== 'archived')
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || clientDisplayName(a).localeCompare(clientDisplayName(b)))

  // Global keyboard shortcuts: ⌘K search, T/P new task/project, G+D/T/P/$ jump.
  useEffect(() => {
    let g = false
    let gTimer: ReturnType<typeof setTimeout> | undefined
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target.closest('input, textarea, select, [contenteditable="true"]')
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearch(true)
        return
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || document.body.classList.contains('modal-open')) return
      const k = e.key.toLowerCase()
      if (g) {
        g = false
        const dest: Record<string, string> = { d: '/', t: '/tasks', p: '/projects', $: '/payments', '4': '/payments', c: '/clients', i: '/inbox', a: '/analytics' }
        if (dest[k]) {
          e.preventDefault()
          navigate(dest[k])
        }
        return
      }
      if (k === 'g') {
        g = true
        clearTimeout(gTimer)
        gTimer = setTimeout(() => (g = false), 1200)
      } else if (k === 't') {
        e.preventDefault()
        openCreate('task')
      } else if (k === 'p') {
        e.preventDefault()
        openCreate('project')
      } else if (k === '/') {
        e.preventDefault()
        setSearch(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, openCreate, setSearch])

  // Scroll to top on page change (not on tab/search-param changes).
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0 })
  }, [location.pathname, location.hash])

  const toLearn = learning.filter((i) => i.assignee_id === me?.id && i.status !== 'done').length

  return (
    <div className="app">
      <aside className="side" aria-label="Sidebar">
        <div className="brand">
          <div className="logo"><img src="/mydesk-fire.png" alt="" /></div>
          <div className="name">
            <b>MyDesk</b>
            <small>{invoiceSettings?.workspace_name || (demoMode ? 'Demo workspace' : 'Workspace')}</small>
          </div>
          <ThemeToggle />
          <button type="button" className={`bell${unread ? ' has-unread' : ''}`} aria-label={`Inbox, ${unread} unread`} onClick={() => navigate('/inbox')}>
            <Bell className="i" />
          </button>
        </div>
        <button type="button" className="searchbtn" onClick={() => setSearch(true)}>
          <Search className="i i-sm" />
          <span>Search or jump to…</span>
          <kbd>Ctrl K</kbd>
        </button>
        <nav className="nav" aria-label="Main">
          <NavItem to="/" end icon={<Home className="i" />}>Dashboard</NavItem>
          <NavItem to="/inbox" icon={<Inbox className="i" />} extra={unread ? <span className="badge">{unread}</span> : null}>Inbox</NavItem>
          <NavItem to="/tasks" icon={<ListChecks className="i" />} extra={myOpen ? <span className="cnt">{myOpen}</span> : null}>My tasks</NavItem>
          <div className="nav-label">WORK</div>
          <NavItem to="/projects" icon={<Folder className="i" />} extra={<span className="cnt">{activeProjects}</span>}>Projects</NavItem>
          <NavItem to="/clients" icon={<Briefcase className="i" />} extra={<span className="cnt">{activeClients}</span>}>Clients</NavItem>
          <NavItem to="/clock" icon={<Clock className="i" />}>Clock</NavItem>
          <NavItem to="/team" icon={<Users className="i" />}>Team</NavItem>
          <NavItem to="/improvement" icon={<Sprout className="i" />} extra={toLearn ? <span className="cnt">{toLearn}</span> : null}>Improvement</NavItem>
        </nav>
        {sideClients.length > 0 && (
          <div className="nav pins">
            <div className="nav-label">CLIENTS</div>
            {sideClients.map((c) => (
              <NavLink key={c.id} to={`/clients/${c.id}`} className={({ isActive }) => (isActive ? 'active' : undefined)} title={clientDisplayName(c)}>
                <span className="sq cc" style={{ ['--cc' as string]: clientColor(c) }} />
                <span className="trunc">{clientDisplayName(c)}</span>
                <span className="cnt">{projects.filter((p) => p.client_id === c.id && OPEN_PROJECT(p)).length || ''}</span>
              </NavLink>
            ))}
          </div>
        )}
        {isAdmin && (
          <nav className="nav" aria-label="Money">
              <div className="nav-label">MONEY</div>
              <NavItem to="/payments" icon={<CreditCard className="i" />} extra={overdue ? <span className="badge red">{overdue}</span> : null}>Payments</NavItem>
              <NavItem to="/invoices" icon={<FileText className="i" />}>Invoices</NavItem>
              <NavItem to="/analytics" icon={<ChartColumn className="i" />}>Analytics</NavItem>
          </nav>
        )}
        <div className="side-foot">
          <Menu
            align="up"
            trigger={({ toggle }) => (
              <button type="button" className="me" onClick={toggle}>
                <Avatar profile={me} size="md" />
                <span className="who">
                  <b className="trunc">{me ? profileFullName(me) : 'Demo user'}</b>
                  <small>{me ? roleLabel[me.role] : 'Owner'}</small>
                </span>
                <ChevronsUpDown className="i i-sm faint" />
              </button>
            )}
          >
            <MenuTitle>{me?.email ?? 'demo mode'}</MenuTitle>
            <MenuItem icon={<User className="i" />} onSelect={() => navigate('/account')}>Profile &amp; preferences</MenuItem>
            {isAdmin && <MenuItem icon={<Settings className="i" />} onSelect={() => navigate('/settings')}>Workspace settings</MenuItem>}
            <MenuItem icon={<Users className="i" />} onSelect={() => navigate('/team')}>Team &amp; access</MenuItem>
            <MenuSep />
            <MenuItem icon={<LogOut className="i" />} onSelect={() => void signOut()}>Sign out</MenuItem>
          </Menu>
        </div>
      </aside>
      <main className="main">{children}</main>
      <CommandPalette />
      <CreateHost />
    </div>
  )
}

/** Sun/moon button: flips between light and dark in one click. */
function ThemeToggle() {
  const { theme, setTheme } = usePrefs()
  const dark = theme === 'dark' || (theme === 'system' && isDarkNow())
  return (
    <button type="button" className="bell theme-tg" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'} onClick={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? <Sun className="i" /> : <Moon className="i" />}
    </button>
  )
}
