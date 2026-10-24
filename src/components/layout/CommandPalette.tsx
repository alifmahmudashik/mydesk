import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChartColumn, CreditCard, FileText, Folder, Home, ListChecks, Plus, Search, Users } from 'lucide-react'
import { useData } from '@/data/store'
import { useUI } from '@/data/ui'
import { useIsAdmin } from '@/hooks/usePermissions'
import { Modal } from '@/components/ui/modal'
import { ClientMark } from '@/components/ui/avatar'
import { StatusRing } from '@/components/ui/pill'
import { clientDisplayName, taskRef } from '@/lib/derive'
import { cn } from '@/lib/utils'

interface Item {
  id: string
  group: string
  label: ReactNode
  text: string
  icon: ReactNode
  hint?: ReactNode
  run: () => void
}

const RECENT_KEY = 'mydesk-recent'

export function pushRecent(path: string) {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
    localStorage.setItem(RECENT_KEY, JSON.stringify([path, ...list.filter((p) => p !== path)].slice(0, 6)))
  } catch {
    // ignore
  }
}

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function CommandPalette() {
  const { searchOpen, setSearch, openCreate } = useUI()
  const { tasks, projects, clients, invoices } = useData()
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)

  useEffect(() => {
    if (searchOpen) {
      setQ('')
      setSel(0)
    }
  }, [searchOpen])

  const close = () => setSearch(false)
  const go = (path: string) => {
    pushRecent(path)
    navigate(path)
    close()
  }

  const items = useMemo<Item[]>(() => {
    const jump: Item[] = [
      { id: 'j-d', group: 'Jump to', label: 'Dashboard', text: 'dashboard home', icon: <Home className="i" />, hint: 'G D', run: () => go('/') },
      { id: 'j-t', group: 'Jump to', label: 'My tasks', text: 'my tasks', icon: <ListChecks className="i" />, hint: 'G T', run: () => go('/tasks') },
      { id: 'j-p', group: 'Jump to', label: 'Projects', text: 'projects', icon: <Folder className="i" />, hint: 'G P', run: () => go('/projects') },
      { id: 'j-c', group: 'Jump to', label: 'Clients', text: 'clients', icon: <Users className="i" />, hint: 'G C', run: () => go('/clients') },
      ...(isAdmin
        ? [
            { id: 'j-$', group: 'Jump to', label: 'Payments', text: 'payments money', icon: <CreditCard className="i" />, hint: 'G $', run: () => go('/payments') },
            { id: 'j-a', group: 'Jump to', label: 'Analytics', text: 'analytics revenue', icon: <ChartColumn className="i" />, hint: 'G A', run: () => go('/analytics') },
          ]
        : []),
    ]
    const create: Item[] = [
      { id: 'c-t', group: 'Create', label: 'New task', text: 'new task create', icon: <Plus className="i" />, hint: 'T', run: () => { close(); openCreate('task') } },
      { id: 'c-p', group: 'Create', label: 'New project', text: 'new project create', icon: <Plus className="i" />, hint: 'P', run: () => { close(); openCreate('project') } },
      ...(isAdmin ? [{ id: 'c-c', group: 'Create', label: 'New client', text: 'new client create add', icon: <Plus className="i" />, run: () => { close(); openCreate('client') } }] : []),
    ]
    const taskItems: Item[] = tasks.map((t) => {
      const p = projects.find((x) => x.id === t.project_id)
      const ref = taskRef(t, p)
      return { id: `t-${t.id}`, group: 'Tasks', label: t.title, text: `${t.title} ${ref}`.toLowerCase(), icon: <StatusRing status={t.status} />, hint: ref, run: () => go(`/tasks/${t.id}`) }
    })
    const projectItems: Item[] = projects.map((p) => {
      const c = clients.find((x) => x.id === p.client_id)
      return { id: `p-${p.id}`, group: 'Projects', label: p.title, text: `${p.title} ${clientDisplayName(c)}`.toLowerCase(), icon: <ClientMark client={c} size="xs" />, run: () => go(`/projects/${p.id}`) }
    })
    const clientItems: Item[] = clients.map((c) => ({ id: `c-${c.id}`, group: 'Clients', label: clientDisplayName(c), text: `${c.name} ${c.company_name ?? ''}`.toLowerCase(), icon: <ClientMark client={c} size="xs" />, run: () => go(`/clients/${c.id}`) }))
    const invoiceItems: Item[] = isAdmin
      ? invoices.map((i) => ({ id: `i-${i.id}`, group: 'Invoices', label: `Invoice ${i.number}`, text: `invoice ${i.number}`.toLowerCase(), icon: <FileText className="i" />, run: () => go(`/invoices/${i.id}`) }))
      : []
    return [...jump, ...create, ...taskItems, ...projectItems, ...clientItems, ...invoiceItems]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, projects, clients, invoices, isAdmin])

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) {
      const recent = readRecent()
        .map((path) => {
          const [, kind, id] = path.split('/')
          const key = kind === 'tasks' ? `t-${id}` : kind === 'projects' ? `p-${id}` : kind === 'clients' ? `c-${id}` : kind === 'invoices' ? `i-${id}` : ''
          const it = items.find((i) => i.id === key)
          return it ? { ...it, group: 'Recent' } : null
        })
        .filter(Boolean) as Item[]
      return [...items.filter((i) => i.group === 'Jump to'), ...recent.slice(0, 4), ...items.filter((i) => i.group === 'Create')]
    }
    const words = query.split(/\s+/)
    return items.filter((i) => words.every((w) => i.text.includes(w))).slice(0, 30)
  }, [q, items])

  useEffect(() => setSel(0), [q])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(s + 1, shown.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      shown[sel]?.run()
    }
  }

  const groups = [...new Set(shown.map((i) => i.group))]

  return (
    <Modal open={searchOpen} onClose={close} bare className="palette">
      <div className="inp-wrap lg">
        <Search className="i" />
        <input data-autofocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search tasks, projects, clients…" aria-label="Search" />
        <kbd>Esc</kbd>
      </div>
      <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
        {shown.length === 0 && <div className="empty sm"><b>No matches</b><p>Try a client name, project or task ref like CPS-12.</p></div>}
        {groups.map((g) => (
          <div className="pal-group" key={g}>
            <div className="menu-title">{g}</div>
            {shown
              .map((it, idx) => ({ it, idx }))
              .filter(({ it }) => it.group === g)
              .map(({ it, idx }) => (
                <button key={it.id + g} type="button" className={cn('mi', idx === sel && 'on')} onMouseEnter={() => setSel(idx)} onClick={it.run}>
                  {it.icon}
                  <span className="grow trunc">{it.label}</span>
                  {it.hint && <kbd>{it.hint}</kbd>}
                </button>
              ))}
          </div>
        ))}
      </div>
      <div className="pal-foot">
        <span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>Esc</kbd> close</span>
      </div>
    </Modal>
  )
}
