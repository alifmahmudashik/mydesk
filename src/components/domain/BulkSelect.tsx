import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Archive, ArchiveRestore, Calendar, CheckSquare, Flag, Trash2, UserPlus, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { archiveProject, deleteProject, deleteTask, setProjectStatus, setTaskAssignees, setTaskStatus, updateProject, updateTask } from '@/data/actions'
import { Menu, MenuItem, MenuSep, MenuTitle } from '@/components/ui/menu'
import { ConfirmDialog } from '@/components/ui/modal'
import { CalendarPopover } from '@/components/ui/date-picker'
import { Avatar } from '@/components/ui/avatar'
import { PrioBars } from '@/components/ui/pill'
import { eligibleAssignees, hasClientAccess, profileFullName, taskAssigneeIds } from '@/lib/derive'
import { formatDate } from '@/lib/format'
import { priorityMeta, projectStatus, taskRing, taskStatus } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { Priority, ProjectMember, ProjectStatus, TaskStatus } from '@/types'

// ---------------------------------------------------------------- selection state

export interface Selection {
  ids: Set<string>
  has: (id: string) => boolean
  toggle: (id: string) => void
  set: (ids: string[]) => void
  clear: () => void
  isSelecting: boolean
  toggleSelecting: () => void
  setIsSelecting: (v: boolean | ((prev: boolean) => boolean)) => void
}

const SelectionContext = createContext<Selection | null>(null)

/** Ticked rows on a page. Esc clears. Rows that disappear drop out of the selection. */
export function useSelection(visibleIds: string[]): Selection {
  const [ids, setIds] = useState<Set<string>>(new Set())
  const [isSelectingMode, setIsSelectingMode] = useState(false)
  const key = visibleIds.join()
  useEffect(() => {
    setIds((s) => {
      const keep = new Set([...s].filter((id) => visibleIds.includes(id)))
      return keep.size === s.size ? s : keep
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => {
    if (ids.size === 0 && !isSelectingMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.dlg, .menu-pop, .date-pop')) {
        setIds(new Set())
        setIsSelectingMode(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ids.size, isSelectingMode])

  const isSelecting = isSelectingMode || ids.size > 0

  return useMemo(
    () => ({
      ids,
      has: (id: string) => ids.has(id),
      toggle: (id: string) =>
        setIds((s) => {
          const n = new Set(s)
          if (n.has(id)) n.delete(id)
          else n.add(id)
          return n
        }),
      set: (list: string[]) => {
        setIds(new Set(list))
        if (list.length > 0) setIsSelectingMode(true)
      },
      clear: () => {
        setIds(new Set())
        setIsSelectingMode(false)
      },
      isSelecting,
      setIsSelecting: setIsSelectingMode,
      toggleSelecting: () => {
        if (isSelecting) {
          setIds(new Set())
          setIsSelectingMode(false)
        } else {
          setIsSelectingMode(true)
        }
      },
    }),
    [ids, isSelecting],
  )
}

export function SelectionProvider({ value, children }: { value: Selection; children: ReactNode }) {
  return (
    <SelectionContext.Provider value={value}>
      <div className={value.isSelecting ? 'sel-on' : undefined} style={{ display: 'contents' }}>{children}</div>
    </SelectionContext.Provider>
  )
}

export function useRowSelection() {
  return useContext(SelectionContext)
}

/** The square tick box on a row (shows on hover, or always once something is ticked / in selection mode). */
export function SelectBox({ id, label }: { id: string; label: string }) {
  const sel = useContext(SelectionContext)
  if (!sel) return null
  return (
    <input
      type="checkbox"
      className="cb sel-box above"
      checked={sel.has(id)}
      aria-label={`Select ${label}`}
      title="Select (then act on several at once)"
      onChange={() => sel.toggle(id)}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

/** Dedicated Select toggle button to enter or exit selection mode. */
export function SelectButton({ sel, className }: { sel: Selection; className?: string }) {
  const active = sel.isSelecting
  return (
    <button
      type="button"
      className={cn('chip select-btn', active && 'on', className)}
      onClick={sel.toggleSelecting}
      title={active ? 'Exit selection mode' : 'Select items'}
      aria-pressed={active}
    >
      <CheckSquare className="i i-sm" />
      <span>{active ? 'Done' : 'Select'}</span>
      {active && sel.ids.size > 0 && <span className="n" style={{ marginLeft: 3 }}>{sel.ids.size}</span>}
    </button>
  )
}

// ---------------------------------------------------------------- bars

function Bar({ count, total, onAll, onClear, children }: { count: number; total: number; onAll: () => void; onClear: () => void; children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="bulk-bar" role="toolbar" aria-label="Actions for selected">
      <span className="bulk-count"><CheckSquare className="i i-sm" />{count} selected</span>
      {count < total && <button type="button" className="link-btn small" onClick={onAll}>Select all {total}</button>}
      <span className="bulk-sep" />
      {children}
      <span className="bulk-sep" />
      <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label="Clear selection" title="Clear (Esc)" onClick={onClear}><X className="i i-sm" /></button>
    </div>,
    document.body,
  )
}

const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'waiting_for_client', 'blocked', 'review', 'done', 'cancelled']

/** Change status, priority, due date or people on many tasks at once, or delete them. */
export function TaskBulkBar({ sel, allIds }: { sel: Selection; allIds: string[] }) {
  const { tasks, projects, profiles, clientMembers, projectMembers, me } = useData()
  const [dateOpen, setDateOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const dateBtn = useRef<HTMLButtonElement>(null)
  const picked = tasks.filter((t) => sel.ids.has(t.id))
  if (picked.length === 0) return null
  const n = picked.length
  const s = n === 1 ? '' : 's'

  // People who can work on every selected task's project.
  const projectIds = [...new Set(picked.map((t) => t.project_id))]
  const people = projectIds.reduce((list, pid) => {
    const p = projects.find((x) => x.id === pid)
    const ok = new Set(eligibleAssignees(p?.client_id, profiles, clientMembers, pid, projectMembers).map((x) => x.id))
    return list.filter((x) => ok.has(x.id))
  }, profiles)

  const togglePerson = (id: string) => {
    const everyone = picked.every((t) => taskAssigneeIds(t).includes(id))
    for (const t of picked) {
      const ids = taskAssigneeIds(t)
      if (everyone) setTaskAssignees(t, ids.filter((x) => x !== id))
      else if (!ids.includes(id)) setTaskAssignees(t, [...ids, id])
    }
  }

  return (
    <>
      <Bar count={n} total={allIds.length} onAll={() => sel.set(allIds)} onClear={sel.clear}>
        <Menu align="left" trigger={({ toggle }) => <button type="button" className="btn btn-sm" onClick={toggle}><span className="st" />Status</button>}>
          <MenuTitle>Set status for {n} task{s}</MenuTitle>
          {TASK_STATUSES.map((st) => (
            <MenuItem key={st} icon={<span className={`st ${taskRing[st]}`} />} onSelect={() => { for (const t of picked) setTaskStatus(t, st); toast.success(`${n} task${s} → ${taskStatus[st].label}`) }}>
              {taskStatus[st].label}
            </MenuItem>
          ))}
        </Menu>
        <Menu align="left" trigger={({ toggle }) => <button type="button" className="btn btn-sm" onClick={toggle}><Flag className="i i-sm" />Priority</button>}>
          {(Object.keys(priorityMeta) as Priority[]).map((p) => (
            <MenuItem key={p} icon={<PrioBars priority={p} />} onSelect={() => { for (const t of picked) if (t.priority !== p) updateTask(t, { priority: p }, `set priority to ${priorityMeta[p].label}`); toast.success(`Priority set on ${n} task${s}`) }}>
              {priorityMeta[p].label}
            </MenuItem>
          ))}
        </Menu>
        <button ref={dateBtn} type="button" className="btn btn-sm" onClick={() => setDateOpen((o) => !o)}><Calendar className="i i-sm" />Due date</button>
        <Menu
          align="left"
          wide
          trigger={({ toggle }) => <button type="button" className="btn btn-sm" onClick={toggle}><UserPlus className="i i-sm" />Assign</button>}
        >
          <MenuTitle>Click to add to all {n} · again to remove</MenuTitle>
          {people.map((p) => {
            const all = picked.every((t) => taskAssigneeIds(t).includes(p.id))
            const some = !all && picked.some((t) => taskAssigneeIds(t).includes(p.id))
            return (
              <MenuItem key={p.id} keepOpen on={all} icon={<Avatar profile={p} size="xs" />} onSelect={() => togglePerson(p.id)}>
                {p.id === me?.id ? `Me (${profileFullName(p)})` : profileFullName(p)}
                {some && <span className="xs faint"> · on some</span>}
              </MenuItem>
            )
          })}
          <MenuSep />
          <MenuItem icon={<Users className="i" />} onSelect={() => { for (const t of picked) if (taskAssigneeIds(t).length) setTaskAssignees(t, []) }}>Unassign all</MenuItem>
        </Menu>
        <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirm(true)}><Trash2 className="i i-sm" />Delete</button>
      </Bar>
      {dateOpen && (
        <CalendarPopover
          anchor={dateBtn.current}
          value={null}
          clearable
          onClose={() => setDateOpen(false)}
          onChange={(v) => {
            for (const t of picked) if (t.due_date !== v) updateTask(t, { due_date: v }, v ? `set due date to ${formatDate(v)}` : 'removed the due date')
            toast.success(v ? `Due ${formatDate(v)} on ${n} task${s}` : `Due date removed from ${n} task${s}`)
          }}
        />
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete ${n} task${s}?`}
        description="Their subtasks, comments, files and time entries go too. This can’t be undone."
        onConfirm={() => {
          for (const t of picked) deleteTask(t)
          sel.clear()
          toast.success(`Deleted ${n} task${s}`)
        }}
      />
    </>
  )
}

const PROJECT_STATUSES: ProjectStatus[] = ['not_started', 'in_progress', 'waiting_for_client', 'blocked', 'completed', 'finished', 'cancelled']
const RING: Record<ProjectStatus, string> = { not_started: '', in_progress: 'prog', waiting_for_client: 'wait', blocked: 'block', completed: 'done', finished: 'done', cancelled: 'cancel' }

/** Change status or due date on many projects, share them, archive or delete them. */
export function ProjectBulkBar({ sel, allIds, extra }: { sel: Selection; allIds: string[]; extra?: ReactNode }) {
  const { projects, profiles, clientMembers, projectMembers, me, createRow } = useData()
  const [dateOpen, setDateOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const dateBtn = useRef<HTMLButtonElement>(null)
  const picked = projects.filter((p) => sel.ids.has(p.id))
  if (picked.length === 0) return null
  const n = picked.length
  const s = n === 1 ? '' : 's'
  // Only projects you hold in full can be deleted or shared (owners/admins: all).
  const manageable = picked.filter((p) => hasClientAccess(me, p.client_id, clientMembers))
  const allArchived = picked.every((p) => p.archived_at)
  const members = profiles.filter((p) => p.role === 'member')

  const share = (userId: string) => {
    let added = 0
    for (const p of manageable) {
      const has = clientMembers.some((m) => m.client_id === p.client_id && m.user_id === userId) || projectMembers.some((m) => m.project_id === p.id && m.user_id === userId)
      if (!has) {
        createRow<ProjectMember>('project_members', { project_id: p.id, user_id: userId })
        added++
      }
    }
    const who = profiles.find((p) => p.id === userId)
    toast.success(added ? `Shared ${added} project${added === 1 ? '' : 's'} with ${profileFullName(who)}` : `${profileFullName(who)} already has access`)
  }

  return (
    <>
      <Bar count={n} total={allIds.length} onAll={() => sel.set(allIds)} onClear={sel.clear}>
        <Menu align="left" trigger={({ toggle }) => <button type="button" className="btn btn-sm" onClick={toggle}><span className="st" />Status</button>}>
          <MenuTitle>Set status for {n} project{s}</MenuTitle>
          {PROJECT_STATUSES.map((st) => (
            <MenuItem key={st} icon={<span className={`st ${RING[st]}`} />} onSelect={() => { for (const p of picked) setProjectStatus(p, st); toast.success(`${n} project${s} → ${projectStatus[st].label}`) }}>
              {projectStatus[st].label}
            </MenuItem>
          ))}
        </Menu>
        <button ref={dateBtn} type="button" className="btn btn-sm" onClick={() => setDateOpen((o) => !o)}><Calendar className="i i-sm" />Due date</button>
        {members.length > 0 && manageable.length > 0 && (
          <Menu align="left" wide trigger={({ toggle }) => <button type="button" className="btn btn-sm" onClick={toggle}><UserPlus className="i i-sm" />Share</button>}>
            <MenuTitle>Give access to {manageable.length === 1 ? 'this project' : `these ${manageable.length} projects`}</MenuTitle>
            {members.map((p) => (
              <MenuItem key={p.id} icon={<Avatar profile={p} size="xs" />} onSelect={() => share(p.id)}>{profileFullName(p)}</MenuItem>
            ))}
          </Menu>
        )}
        <button type="button" className="btn btn-sm" onClick={() => { for (const p of picked) archiveProject(p, !allArchived); toast.success(`${allArchived ? 'Restored' : 'Archived'} ${n} project${s}`); sel.clear() }}>
          {allArchived ? <ArchiveRestore className="i i-sm" /> : <Archive className="i i-sm" />}{allArchived ? 'Restore' : 'Archive'}
        </button>
        {extra}
        {manageable.length > 0 && <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirm(true)}><Trash2 className="i i-sm" />Delete</button>}
      </Bar>
      {dateOpen && (
        <CalendarPopover
          anchor={dateBtn.current}
          value={null}
          clearable
          onClose={() => setDateOpen(false)}
          onChange={(v) => {
            for (const p of picked) if (p.due_date !== v) updateProject(p, { due_date: v })
            toast.success(v ? `Due ${formatDate(v)} on ${n} project${s}` : `Due date removed from ${n} project${s}`)
          }}
        />
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete ${manageable.length} project${manageable.length === 1 ? '' : 's'}?`}
        description={`Their tasks, notes, checklists and time go too${me?.role !== 'member' ? ', plus payments that only covered them' : ''}. This can’t be undone.${manageable.length < n ? ` (${n - manageable.length} you can’t delete are skipped.)` : ''}`}
        onConfirm={() => {
          for (const p of manageable) deleteProject(p)
          sel.clear()
          toast.success(`Deleted ${manageable.length} project${manageable.length === 1 ? '' : 's'}`)
        }}
      />
    </>
  )
}
