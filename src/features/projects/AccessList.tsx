import { useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { KeyRound, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useData } from '@/data/store'
import { listContainer, listItem } from '@/lib/motion'
import { accessStatus, options } from '@/lib/status'
import type { AccessItem, AccessStatus } from '@/types'

const statusOptions = options(accessStatus)

/** Per-project access/credentials checklist (lives inside the project panel). */
export function AccessList({ projectId }: { projectId: string }) {
  const accessItems = useData((s) => s.accessItems)
  const items = useMemo(
    () => accessItems.filter((a) => a.project_id === projectId),
    [accessItems, projectId],
  )
  const createRow = useData((s) => s.createRow)
  const updateRow = useData((s) => s.updateRow)
  const deleteRow = useData((s) => s.deleteRow)
  const [name, setName] = useState('')

  function add(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    createRow<AccessItem>(
      'access_items',
      { project_id: projectId, access_name: trimmed, status: 'needed', is_required: true },
      { entity: 'access_item', action: 'created', message: `Added access item "${trimmed}"` },
    )
    setName('')
  }

  function setStatus(item: AccessItem, status: AccessStatus) {
    if (status === item.status) return
    updateRow(
      'access_items',
      item.id,
      { status },
      {
        entity: 'access_item',
        entityId: item.id,
        action: 'status_changed',
        message:
          status === 'received'
            ? `Received access: ${item.access_name}`
            : status === 'requested'
              ? `Requested access: ${item.access_name}`
              : `Access "${item.access_name}" marked ${accessStatus[status].label.toLowerCase()}`,
      },
    )
  }

  return (
    <div>
      {items.length === 0 && (
        <div className="mb-4">
          <EmptyState
            icon={KeyRound}
            title="No access items yet"
            description="Track the credentials and access you still need from the client — GA4, ad accounts, hosting, DNS."
          />
        </div>
      )}
      {items.length > 0 && (
        <motion.ul
          variants={listContainer}
          initial="initial"
          animate="animate"
          className="mb-3 divide-y rounded-lg border"
        >
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.li
                key={item.id}
                layout="position"
                variants={listItem}
                exit="exit"
                className="flex items-center gap-3 px-3 py-2"
              >
                <KeyRound className="size-4 shrink-0 text-faint" strokeWidth={1.75} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">{item.access_name}</p>
                  {item.notes && <p className="truncate text-xs text-muted-foreground">{item.notes}</p>}
                </div>
                <Select
                  value={item.status}
                  onChange={(v) => setStatus(item, v)}
                  options={statusOptions}
                  aria-label={`Status for ${item.access_name}`}
                  className="h-8 w-32 shrink-0 text-[13px]"
                />
                <Button
                  variant="ghost"
                  size="iconSm"
                  aria-label={`Delete access item ${item.access_name}`}
                  onClick={() =>
                    deleteRow('access_items', item.id, {
                      entity: 'access_item',
                      entityId: item.id,
                      action: 'deleted',
                      message: `Removed access item "${item.access_name}"`,
                    })
                  }
                >
                  <Trash2 strokeWidth={1.75} />
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
      <form onSubmit={add} className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. GA4 property — Editor access"
          aria-label="New access item name"
        />
        <Button type="submit" variant="secondary" disabled={!name.trim()}>
          <Plus strokeWidth={1.75} />
          Add
        </Button>
      </form>
    </div>
  )
}
