import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AppShell } from '@/components/layout/app-shell'
import { Page } from '@/components/layout/page'
import { useData } from '@/data/store'
import { useAuth } from '@/hooks/useAuth'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ClientsPage } from '@/features/clients/ClientsPage'
import { ClientWorkspace } from '@/features/clients/ClientWorkspace'
import { ProjectsPage } from '@/features/projects/ProjectsPage'
import { TasksPage } from '@/features/tasks/TasksPage'
import { PaymentsPage } from '@/features/payments/PaymentsPage'
import { TeamPage } from '@/features/team/TeamPage'
import { InvoicesPage } from '@/features/invoices/InvoicesPage'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      {/* Keyed on pathname only — search-param changes (slide-over panels) don't retrigger transitions */}
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Page><DashboardPage /></Page>} />
        <Route path="/clients" element={<Page><ClientsPage /></Page>} />
        <Route path="/clients/:id" element={<Page><ClientWorkspace /></Page>} />
        <Route path="/projects" element={<Page><ProjectsPage /></Page>} />
        <Route path="/tasks" element={<Page><TasksPage /></Page>} />
        <Route path="/payments" element={<Page><PaymentsPage /></Page>} />
        <Route path="/invoices" element={<Page><InvoicesPage /></Page>} />
        <Route path="/team" element={<Page><TeamPage /></Page>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  const { session, loading, authRequired } = useAuth()
  const init = useData((s) => s.init)
  const authed = !authRequired || Boolean(session)

  useEffect(() => {
    if (authed) void init()
  }, [authed, init])

  if (loading) return <div className="min-h-dvh bg-background" />
  if (!authed) return <LoginPage />

  return (
    <AppShell>
      <AnimatedRoutes />
    </AppShell>
  )
}
