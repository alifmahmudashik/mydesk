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

const InboxPage = lazy(() => import('@/features/inbox/InboxPage').then((m) => ({ default: m.InboxPage })))
const TasksPage = lazy(() => import('@/features/tasks/TasksPage').then((m) => ({ default: m.TasksPage })))
const TaskPage = lazy(() => import('@/features/tasks/TaskPage').then((m) => ({ default: m.TaskPage })))
const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage').then((m) => ({ default: m.ProjectsPage })))
const ProjectPage = lazy(() => import('@/features/projects/ProjectPage').then((m) => ({ default: m.ProjectPage })))
const ClientsPage = lazy(() => import('@/features/clients/ClientsPage').then((m) => ({ default: m.ClientsPage })))
const ClientPage = lazy(() => import('@/features/clients/ClientPage').then((m) => ({ default: m.ClientPage })))
const ClientSettingsPage = lazy(() => import('@/features/clients/ClientSettingsPage').then((m) => ({ default: m.ClientSettingsPage })))
const TeamPage = lazy(() => import('@/features/team/TeamPage').then((m) => ({ default: m.TeamPage })))
const MemberPage = lazy(() => import('@/features/team/MemberPage').then((m) => ({ default: m.MemberPage })))
const PaymentsPage = lazy(() => import('@/features/payments/PaymentsPage').then((m) => ({ default: m.PaymentsPage })))
const InvoicesPage = lazy(() => import('@/features/invoices/InvoicesPage').then((m) => ({ default: m.InvoicesPage })))
const InvoiceEditor = lazy(() => import('@/features/invoices/InvoiceEditor').then((m) => ({ default: m.InvoiceEditor })))
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })))
const AccountPage = lazy(() => import('@/features/settings/AccountPage').then((m) => ({ default: m.AccountPage })))
const WorkspaceSettingsPage = lazy(() => import('@/features/settings/WorkspaceSettingsPage').then((m) => ({ default: m.WorkspaceSettingsPage })))

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
      <div key={location.pathname}>
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
    if (authed) void init()
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
