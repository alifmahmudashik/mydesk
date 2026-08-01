import { create } from 'zustand'
import { toast } from 'sonner'
import { demoData, type DemoData } from '@/data/demo'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import type { ActivityAction, ActivityEntity, ActivityEvent, Profile, ProjectMember } from '@/types'
import type { AccessItem, Client, Payment, Project, ProjectNote, Task } from '@/types'

const LOCAL_KEY = 'mydesk-data-v2'

export type Table =
  | 'clients'
  | 'projects'
  | 'tasks'
  | 'access_items'
  | 'payments'
  | 'project_notes'
  | 'profiles'
  | 'project_members'

type StateKey =
  | 'clients'
  | 'projects'
  | 'tasks'
  | 'accessItems'
  | 'payments'
  | 'notes'
  | 'profiles'
  | 'projectMembers'

const tableToKey: Record<Table, StateKey> = {
  clients: 'clients',
  projects: 'projects',
  tasks: 'tasks',
  access_items: 'accessItems',
  payments: 'payments',
  project_notes: 'notes',
  profiles: 'profiles',
  project_members: 'projectMembers',
}

type AnyRow = { id: string; created_at: string }

export interface LogInput {
  entity: ActivityEntity
  entityId: string
  action: ActivityAction
  message: string
}

interface DataState {
  ready: boolean
  demoMode: boolean
  clients: Client[]
  projects: Project[]
  tasks: Task[]
  accessItems: AccessItem[]
  payments: Payment[]
  notes: ProjectNote[]
  activity: ActivityEvent[]
  profiles: Profile[]
  projectMembers: ProjectMember[]
  /** The signed-in user's profile (null until loaded / in demo before init). */
  me: Profile | null
  init: () => Promise<void>
  /** Optimistic insert — applied to UI immediately, synced in the background. */
  createRow: <T extends AnyRow>(table: Table, data: Omit<T, 'id' | 'created_at'>, log?: Omit<LogInput, 'entityId'>) => T
  /** Optimistic patch — reverted with a toast if the background sync fails. */
  updateRow: (table: Table, id: string, patch: Record<string, unknown>, log?: LogInput) => void
  deleteRow: (table: Table, id: string, log?: LogInput) => void
}

function snapshot(s: DataState): DemoData {
  return {
    clients: s.clients,
    projects: s.projects,
    tasks: s.tasks,
    accessItems: s.accessItems,
    payments: s.payments,
    notes: s.notes,
    activity: s.activity,
    profiles: s.profiles,
    projectMembers: s.projectMembers,
  }
}

function saveLocal(data: DemoData) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
  } catch {
    // localStorage full/unavailable — demo data simply won't persist
  }
}

function loadLocal(): DemoData | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as DemoData) : null
  } catch {
    return null
  }
}

export const useData = create<DataState>((set, get) => {
  /** Persist current state (demo → localStorage; supabase persistence happens per-op). */
  const persistLocal = () => {
    if (get().demoMode) saveLocal(snapshot(get()))
  }

  const revert = (prev: DemoData) => {
    set(prev)
    persistLocal()
    toast.error('Couldn’t save — change reverted', {
      description: 'Check your connection and try again.',
    })
  }

  const logActivity = (log: LogInput) => {
    const event: ActivityEvent = {
      id: uid(),
      entity: log.entity,
      entity_id: log.entityId,
      action: log.action,
      message: log.message,
      created_at: new Date().toISOString(),
    }
    set((s) => ({ activity: [event, ...s.activity].slice(0, 300) }))
    if (supabase) {
      void supabase.from('activity_log').insert({
        id: event.id,
        entity: event.entity,
        entity_id: event.entity_id,
        action: event.action,
        message: event.message,
      })
    }
  }

  return {
    ready: false,
    demoMode: !supabase,
    clients: [],
    projects: [],
    tasks: [],
    accessItems: [],
    payments: [],
    notes: [],
    activity: [],
    profiles: [],
    projectMembers: [],
    me: null,

    init: async () => {
      if (!supabase) {
        // Demo mode: localStorage or fresh seed (older saves may lack newer keys).
        const data = { ...demoData(), ...(loadLocal() ?? {}) }
        await new Promise((r) => setTimeout(r, 450))
        set({ ...data, me: data.profiles.find((p) => p.role === 'owner') ?? null, ready: true })
        return
      }
      const [clients, projects, tasks, accessItems, payments, notes, activity, profiles, members, user] =
        await Promise.all([
          supabase.from('clients').select('*').order('created_at', { ascending: false }),
          supabase.from('projects').select('*').order('created_at', { ascending: false }),
          supabase.from('tasks').select('*').order('created_at', { ascending: false }),
          supabase.from('access_items').select('*').order('created_at', { ascending: true }),
          supabase.from('payments').select('*').order('created_at', { ascending: false }),
          supabase.from('project_notes').select('*').order('created_at', { ascending: false }),
          supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(300),
          supabase.from('profiles').select('*').order('created_at', { ascending: true }),
          supabase.from('project_members').select('*'),
          supabase.auth.getUser(),
        ])
      // Members are denied on payments by RLS-less tables erroring is fine; only surface
      // failures on the core tables a member is allowed to read.
      const failed = [clients, projects, tasks, notes].find((r) => r.error)
      if (failed?.error) {
        toast.error('Failed to load data', { description: failed.error.message })
      }
      const profileRows = (profiles.data as Profile[]) ?? []
      set({
        clients: (clients.data as Client[]) ?? [],
        projects: (projects.data as Project[]) ?? [],
        tasks: (tasks.data as Task[]) ?? [],
        accessItems: (accessItems.data as AccessItem[]) ?? [],
        payments: (payments.data as Payment[]) ?? [],
        notes: (notes.data as ProjectNote[]) ?? [],
        activity: (activity.data as ActivityEvent[]) ?? [],
        profiles: profileRows,
        projectMembers: (members.data as ProjectMember[]) ?? [],
        me: profileRows.find((p) => p.id === user.data.user?.id) ?? null,
        ready: true,
      })
    },

    createRow: (table, data, log) => {
      const row = { id: uid(), created_at: new Date().toISOString(), ...data } as AnyRow
      const key = tableToKey[table]
      const prev = snapshot(get())
      set((s) => ({ [key]: [row, ...(s[key] as AnyRow[])] }) as Partial<DataState>)
      if (log) logActivity({ ...log, entityId: row.id })
      persistLocal()
      if (supabase) {
        void supabase
          .from(table)
          .insert(row)
          .then(({ error }) => {
            if (error) revert(prev)
          })
      }
      return row as never
    },

    updateRow: (table, id, patch, log) => {
      const key = tableToKey[table]
      const prev = snapshot(get())
      set(
        (s) =>
          ({
            [key]: (s[key] as AnyRow[]).map((r) => (r.id === id ? { ...r, ...patch } : r)),
          }) as Partial<DataState>,
      )
      if (log) logActivity(log)
      persistLocal()
      if (supabase) {
        void supabase
          .from(table)
          .update(patch)
          .eq('id', id)
          .then(({ error }) => {
            if (error) revert(prev)
          })
      }
    },

    deleteRow: (table, id, log) => {
      const key = tableToKey[table]
      const prev = snapshot(get())
      set((s) => ({ [key]: (s[key] as AnyRow[]).filter((r) => r.id !== id) }) as Partial<DataState>)
      if (log) logActivity(log)
      persistLocal()
      if (supabase) {
        void supabase
          .from(table)
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (error) revert(prev)
          })
      }
    },
  }
})
