import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useData } from '@/data/store'
import { useAuth } from '@/hooks/useAuth'
import { usePrefs } from '@/hooks/usePrefs'
import { useIsAdmin } from '@/hooks/usePermissions'
import { AppShell } from '@/components/layout/AppShell'
import { PageSkeleton } from '@/components/ui/layout'
import { LoginPage } from '@/features/auth/LoginPage'
import { InviteAcceptPage } from '@/features/auth/InviteAcceptPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'

const loadInboxPage = () => import('@/features/inbox/InboxPage')
const InboxPage = lazy(() => loadInboxPage().then((m) => ({ default: m.InboxPage })))
const loadTasksPage = () => import('@/features/tasks/TasksPage')
const TasksPage = lazy(() => loadTasksPage().then((m) => ({ default: m.TasksPage })))
const loadTaskPage = () => import('@/features/tasks/TaskPage')
const TaskPage = lazy(() => loadTaskPage().then((m) => ({ default: m.TaskPage })))
const loadProjectsPage = () => import('@/features/projects/ProjectsPage')
const ProjectsPage = lazy(() => loadProjectsPage().then((m) => ({ default: m.ProjectsPage })))
const loadProjectPage = () => import('@/features/projects/ProjectPage')
const ProjectPage = lazy(() => loadProjectPage().then((m) => ({ default: m.ProjectPage })))
const loadClientsPage = () => import('@/features/clients/ClientsPage')
const ClientsPage = lazy(() => loadClientsPage().then((m) => ({ default: m.ClientsPage })))
const loadClientPage = () => import('@/features/clients/ClientPage')
const ClientPage = lazy(() => loadClientPage().then((m) => ({ default: m.ClientPage })))
const loadClientSettingsPage = () => import('@/features/clients/ClientSettingsPage')
const ClientSettingsPage = lazy(() => loadClientSettingsPage().then((m) => ({ default: m.ClientSettingsPage })))
const loadClockPage = () => import('@/features/clock/ClockPage')
const ClockPage = lazy(() => loadClockPage().then((m) => ({ default: m.ClockPage })))
const loadImprovementPage = () => import('@/features/improvement/ImprovementPage')
const loadTopicsModule = () => import('@/features/improvement/topics')
const TopicPage = lazy(() => loadTopicsModule().then((m) => ({ default: m.TopicPage })))
const ImprovementPage = lazy(() => loadImprovementPage().then((m) => ({ default: m.ImprovementPage })))
const loadTeamPage = () => import('@/features/team/TeamPage')
const TeamPage = lazy(() => loadTeamPage().then((m) => ({ default: m.TeamPage })))
const loadMemberPage = () => import('@/features/team/MemberPage')
const MemberPage = lazy(() => loadMemberPage().then((m) => ({ default: m.MemberPage })))
const loadPaymentsPage = () => import('@/features/payments/PaymentsPage')
const PaymentsPage = lazy(() => loadPaymentsPage().then((m) => ({ default: m.PaymentsPage })))
const loadInvoicesPage = () => import('@/features/invoices/InvoicesPage')
const InvoicesPage = lazy(() => loadInvoicesPage().then((m) => ({ default: m.InvoicesPage })))
const loadInvoiceEditor = () => import('@/features/invoices/InvoiceEditor')
const InvoiceEditor = lazy(() => loadInvoiceEditor().then((m) => ({ default: m.InvoiceEditor })))
const loadAnalyticsPage = () => import('@/features/analytics/AnalyticsPage')
const AnalyticsPage = lazy(() => loadAnalyticsPage().then((m) => ({ default: m.AnalyticsPage })))
const loadAccountPage = () => import('@/features/settings/AccountPage')
const AccountPage = lazy(() => loadAccountPage().then((m) => ({ default: m.AccountPage })))
const loadWorkspaceSettingsPage = () => import('@/features/settings/WorkspaceSettingsPage')
const WorkspaceSettingsPage = lazy(() => loadWorkspaceSettingsPage().then((m) => ({ default: m.WorkspaceSettingsPage })))

/** Download every page's code in the background once the app is idle, so
 *  switching pages never waits on the network. */
function prefetchPages() {
  const all = [loadImprovementPage, loadTopicsModule, loadInboxPage, loadTasksPage, loadTaskPage, loadProjectsPage, loadProjectPage, loadClientsPage, loadClientPage, loadClientSettingsPage, loadClockPage, loadTeamPage, loadMemberPage, loadPaymentsPage, loadInvoicesPage, loadInvoiceEditor, loadAnalyticsPage, loadAccountPage, loadWorkspaceSettingsPage]
  const run = () => all.forEach((load) => void load().catch(() => {}))
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 3000 })
  else setTimeout(run, 1500)
}

/** Money pages are owner/admin only (the database enforces it too). */
function AdminOnly({ children }: { children: ReactNode }) {
  return useIsAdmin() ? <>{children}</> : <Navigate to="/" replace />
}

function Routed() {
  const ready = useData((s) => s.ready)
  const location = useLocation()
  if (!ready) return <PageSkeleton />
  return (
    // Keyed by path so each page plays its entrance animation.
    <Suspense fallback={<PageSkeleton />}>
      <div key={location.pathname} className="page">
        <Routes location={location}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:id" element={<TaskPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientPage />} />
          <Route path="/clients/:id/settings" element={<AdminOnly><ClientSettingsPage /></AdminOnly>} />
          <Route path="/clock" element={<ClockPage />} />
          <Route path="/improvement" element={<ImprovementPage />} />
          <Route path="/improvement/topics/:id" element={<TopicPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/team/:id" element={<MemberPage />} />
          <Route path="/payments" element={<AdminOnly><PaymentsPage /></AdminOnly>} />
          <Route path="/invoices" element={<AdminOnly><InvoicesPage /></AdminOnly>} />
          <Route path="/invoices/:id" element={<AdminOnly><InvoiceEditor /></AdminOnly>} />
          <Route path="/analytics" element={<AdminOnly><AnalyticsPage /></AdminOnly>} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/settings" element={<AdminOnly><WorkspaceSettingsPage /></AdminOnly>} />
          <Route path="/invite/:token" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Suspense>
  )
}

export default function App() {
  usePrefs()
  const { session, loading, authRequired, recovery, clearRecovery } = useAuth()
  const init = useData((s) => s.init)
  const location = useLocation()
  const authed = !authRequired || Boolean(session)

  useEffect(() => {
    if (authed) {
      void init()
      prefetchPages()
    }
  }, [authed, init])

  if (loading) return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />
  if (recovery) return <ResetPasswordPage onDone={clearRecovery} />
  if (location.pathname.startsWith('/invite/') && authRequired && !session) return <InviteAcceptPage />
  if (!authed) return <LoginPage />

  return (
    <AppShell>
      <Routed />
    </AppShell>
  )
}
