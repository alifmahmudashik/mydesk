import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ClientMark } from '@/components/ui/avatar'
import { clientColor, clientDisplayName } from '@/lib/derive'
import type { Client } from '@/types'

/**
 * One client's block on list pages (payments, projects, tasks, invoices): a card with a
 * colour-coded header (client mark, name, summary) so each client's rows read as a group.
 */
export function ClientGroup({
  client,
  meta,
  right,
  children,
  defaultOpen = true,
  collapsible = true,
}: {
  client?: Client
  meta?: ReactNode
  right?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  collapsible?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const color = clientColor(client)
  return (
    <section className="card client-group" style={{ ['--cg' as string]: color }}>
      <div className="client-group-h">
        {collapsible && (
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={open ? 'Collapse' : 'Expand'} onClick={() => setOpen((o) => !o)}>
            {open ? <ChevronDown className="i i-sm" /> : <ChevronRight className="i i-sm" />}
          </button>
        )}
        <ClientMark client={client} size="md" />
        <div className="grow" style={{ minWidth: 0 }}>
          {client ? (
            <Link to={`/clients/${client.id}`} className="client-group-name trunc">{clientDisplayName(client)}</Link>
          ) : (
            <span className="client-group-name">No client</span>
          )}
          {meta && <div className="xs muted trunc">{meta}</div>}
        </div>
        {right && <div className="row-sm" style={{ flex: 'none' }}>{right}</div>}
      </div>
      {open && <div className="client-group-b">{children}</div>}
    </section>
  )
}

/** Small colour-tinted client tag used inside rows and board cards. */
export function ClientChip({ client, to = true }: { client?: Client | null; to?: boolean }) {
  if (!client) return null
  const color = clientColor(client)
  const inner = (
    <>
      <i style={{ background: color }} />
      {clientDisplayName(client)}
    </>
  )
  const style = { ['--cc' as string]: color }
  return to ? (
    <Link className="client-chip above" style={style} to={`/clients/${client.id}`} onClick={(e) => e.stopPropagation()}>{inner}</Link>
  ) : (
    <span className="client-chip" style={style}>{inner}</span>
  )
}

/** Groups rows by client id, keeping the first-seen order unless a sort is given. */
export function groupByClient<T>(rows: T[], clientIdOf: (r: T) => string, clients: Client[]) {
  const ids: string[] = []
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const id = clientIdOf(r)
    if (!map.has(id)) {
      map.set(id, [])
      ids.push(id)
    }
    map.get(id)!.push(r)
  }
  return ids.map((id) => ({ id, client: clients.find((c) => c.id === id), rows: map.get(id)! }))
}
