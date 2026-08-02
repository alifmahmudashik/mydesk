import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronRight,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Moon,
  Plus,
  Receipt,
  Sun,
  Users,
  X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useIsAdmin } from '@/hooks/usePermissions'
import { useTheme } from '@/hooks/useTheme'
import { useData } from '@/data/store'
import { clientDisplayName } from '@/lib/derive'
import { EASE_OUT_EXPO, overlayVariants, panelSpring } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { ClientFormModal } from '@/features/clients/ClientFormModal'
import type { Client } from '@/types'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/tasks', label: 'My Tasks', icon: ListTodo },
  { to: '/payments', label: 'Payments', icon: CreditCard, adminOnly: true },
  { to: '/invoices', label: 'Invoices', icon: Receipt, adminOnly: true },
  { to: '/team', label: 'Team', icon: Users },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-3">
      <div className="grid size-7 place-items-center rounded-lg bg-primary shadow-sm">
        <img src="/mydesk-fire.png" alt="" className="size-4.5" />
      </div>
      <span className="text-[15px] font-semibold tracking-tight">MyDesk</span>
    </div>
  )
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const isAdmin = useIsAdmin()
  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Main navigation">
      {NAV.filter((item) => isAdmin || !item.adminOnly).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  transition={panelSpring}
                  className="absolute inset-0 rounded-lg bg-primary-soft"
                  aria-hidden
                />
              )}
              <Icon className="relative size-4" strokeWidth={1.75} aria-hidden />
              <span className="relative">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function ClientLink({ client, onNavigate }: { client: Client; onNavigate?: () => void }) {
  return (
    <NavLink
      to={`/clients/${client.id}`}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex h-9 items-center gap-2.5 rounded-lg px-2 text-[13px] font-medium transition-colors duration-150',
          isActive
            ? 'bg-primary-soft text-foreground'
            : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
          client.status === 'archived' && 'opacity-70',
        )
      }
    >
      <Avatar name={clientDisplayName(client)} size="sm" className="size-6 rounded-md text-[10px]" />
      <span className="min-w-0 truncate">{clientDisplayName(client)}</span>
    </NavLink>
  )
}

/** Asana-style sidebar section: clients listed directly, archived collapsed, Add client at the end. */
function ClientsSection({ onNavigate, onAddClient }: { onNavigate?: () => void; onAddClient: () => void }) {
  const clients = useData((s) => s.clients)
  const isAdmin = useIsAdmin()
  const [archivedOpen, setArchivedOpen] = useState(false)

  const visible = clients.filter((c) => c.status !== 'archived')
  const archived = clients.filter((c) => c.status === 'archived')

  return (
    <div className="mt-6 flex min-h-0 flex-1 flex-col">
      <div className="mb-1.5 flex items-center justify-between px-6">
        <NavLink
          to="/clients"
          end
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'text-xs font-semibold uppercase tracking-wider transition-colors duration-150 hover:text-foreground',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )
          }
        >
          Clients
        </NavLink>
        {isAdmin && (
          <button
            type="button"
            onClick={onAddClient}
            aria-label="Add client"
            className="grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-foreground"
          >
            <Plus className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-2">
        {archived.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setArchivedOpen((v) => !v)}
              aria-expanded={archivedOpen}
              className="flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-faint transition-colors duration-150 hover:bg-surface-hover hover:text-muted-foreground"
            >
              <ChevronRight
                className={cn('size-3.5 transition-transform duration-200', archivedOpen && 'rotate-90')}
                strokeWidth={1.75}
                aria-hidden
              />
              {archived.length} archived
            </button>
            <AnimatePresence initial={false}>
              {archivedOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1, transition: { duration: 0.2, ease: EASE_OUT_EXPO } }}
                  exit={{ height: 0, opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } }}
                  className="space-y-0.5 overflow-hidden"
                >
                  {archived.map((c) => (
                    <ClientLink key={c.id} client={c} onNavigate={onNavigate} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
        {visible.map((c) => (
          <ClientLink key={c.id} client={c} onNavigate={onNavigate} />
        ))}
        {clients.length === 0 && (
          <p className="px-2 py-2 text-xs text-faint">No clients yet.</p>
        )}
      </div>

      {isAdmin && (
        <div className="px-3 pt-1">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={onAddClient}>
            <Plus strokeWidth={1.75} />
            Add client
          </Button>
        </div>
      )}
    </div>
  )
}

/** Bottom user card: identity, theme toggle, sign out. */
function UserCard() {
  const { dark, toggle } = useTheme()
  const { session, authRequired, signOut } = useAuth()
  const demoMode = useData((s) => s.demoMode)
  const me = useData((s) => s.me)

  const email = session?.user?.email
  const name = me?.display_name || (email ? email.split('@')[0] : 'MyDesk')
  const role = demoMode ? 'Demo data' : (me?.role ?? 'owner')

  return (
    <div className="mt-2 flex items-center gap-2.5 border-t px-4 py-3">
      <Avatar name={name} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{name}</p>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{role}</p>
      </div>
      <Button
        variant="ghost"
        size="iconSm"
        onClick={toggle}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={dark ? 'moon' : 'sun'}
            initial={{ rotate: -30, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 30, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="grid place-items-center"
          >
            {dark ? <Moon strokeWidth={1.75} /> : <Sun strokeWidth={1.75} />}
          </motion.span>
        </AnimatePresence>
      </Button>
      {authRequired && (
        <Button variant="ghost" size="iconSm" onClick={() => void signOut()} aria-label="Sign out">
          <LogOut strokeWidth={1.75} />
        </Button>
      )}
    </div>
  )
}

function SidebarContent({ onNavigate, onAddClient }: { onNavigate?: () => void; onAddClient: () => void }) {
  return (
    <>
      <div className="px-3 pb-6 pt-5">
        <Logo />
      </div>
      <NavItems onNavigate={onNavigate} />
      <ClientsSection onNavigate={onNavigate} onAddClient={onAddClient} />
      <UserCard />
    </>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [addClientOpen, setAddClientOpen] = useState(false)
  const { pathname } = useLocation()
  // The client workspace is a full-bleed master-detail view; list pages stay centered.
  const fullBleed = /^\/clients\/.+/.test(pathname)

  const openAddClient = () => {
    setMobileOpen(false)
    setAddClientOpen(true)
  }

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-background lg:flex">
        <SidebarContent onAddClient={openAddClient} />
      </aside>

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur lg:hidden">
        <Logo />
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
          <Menu strokeWidth={1.75} />
        </Button>
      </header>

      {/* Mobile drawer */}
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <AnimatePresence>
          {mobileOpen && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  variants={overlayVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] lg:hidden"
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0, transition: panelSpring }}
                  exit={{ x: '-100%', transition: { duration: 0.2, ease: 'easeIn' } }}
                  className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-background lg:hidden"
                >
                  <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                  <div className="absolute right-2 top-4">
                    <Dialog.Close asChild>
                      <Button variant="ghost" size="iconSm" aria-label="Close navigation">
                        <X strokeWidth={1.75} />
                      </Button>
                    </Dialog.Close>
                  </div>
                  <SidebarContent onNavigate={() => setMobileOpen(false)} onAddClient={openAddClient} />
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>

      {/* Main content */}
      <main className="min-w-0 flex-1 px-4 pb-16 pt-20 sm:px-6 lg:ml-60 lg:px-8 lg:pt-8">
        <div className={cn('mx-auto', fullBleed ? 'max-w-none' : 'max-w-6xl')}>{children}</div>
      </main>

      <ClientFormModal
        key={addClientOpen ? 'open' : 'closed'}
        open={addClientOpen}
        onClose={() => setAddClientOpen(false)}
      />
    </div>
  )
}
