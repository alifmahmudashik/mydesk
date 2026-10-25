import { create } from 'zustand'
import { toast } from 'sonner'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { demoData, type DemoData } from '@/data/demo'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import { deriveProjectKey } from '@/lib/derive'
import type {
  AccessItem, ActivityAction, ActivityEntity, ActivityEvent, AppNotification, Client, ClientMember, Invite, Invoice, InvoiceSettings, Payment, PaymentReminder, Profile, Project, ProjectNote, Subtask, Task, TaskAttachment, TaskComment, TaskWatcher, TimeEntry, LearningGoal, LearningItem, LearningTopic, LearningLesson, LearningResource, LearningTopicMember, LearningProgress,
} from '@/types'

const LOCAL_KEY = 'mydesk-data-v3'
const LEGACY_LOCAL_KEY = 'mydesk-data-v2'

export type Table =
  | 'clients' | 'projects' | 'tasks' | 'access_items' | 'payments' | 'project_notes'
  | 'profiles' | 'client_members' | 'invoices'
  | 'subtasks' | 'task_comments' | 'task_attachments' | 'time_entries' | 'task_watchers'
  | 'notifications' | 'invites' | 'payment_reminders' | 'learning_items' | 'learning_goals'
  | 'learning_topics' | 'learning_lessons' | 'learning_resources' | 'learning_topic_members' | 'learning_progress'

type StateKey =
  | 'clients' | 'projects' | 'tasks' | 'accessItems' | 'payments' | 'notes' | 'profiles'
  | 'clientMembers' | 'invoices' | 'subtasks' | 'comments' | 'attachments' | 'timeEntries'
  | 'watchers' | 'notifications' | 'invites' | 'reminders' | 'learning' | 'goals'
  | 'topics' | 'lessons' | 'resources' | 'topicMembers' | 'progress'

const tableToKey: Record<Table, StateKey> = {
  clients: 'clients',
  projects: 'projects',
  tasks: 'tasks',
  access_items: 'accessItems',
  payments: 'payments',
  project_notes: 'notes',
  profiles: 'profiles',
  client_members: 'clientMembers',
  invoices: 'invoices',
  subtasks: 'subtasks',
  task_comments: 'comments',
  task_attachments: 'attachments',
  time_entries: 'timeEntries',
  task_watchers: 'watchers',
  notifications: 'notifications',
  invites: 'invites',
  payment_reminders: 'reminders',
  learning_items: 'learning',
  learning_goals: 'goals',
  learning_topics: 'topics',
  learning_lessons: 'lessons',
  learning_resources: 'resources',
  learning_topic_members: 'topicMembers',
  learning_progress: 'progress',
}

type AnyRow = { id: string; created_at: string }

export interface LogInput {
  entity: ActivityEntity
  entityId: string
  action: ActivityAction
  message: string
  projectId?: string | null
  meta?: Record<string, unknown>
}

interface DataState extends DemoData {
  ready: boolean
  /** False when the learning tables don't exist yet (SQL not run). */
  learningReady: boolean
  /** False when the topic tables don't exist yet (improvement-topics.sql not run). */
  topicsReady: boolean
  demoMode: boolean
  me: Profile | null
  /** Ids of teammates with the app open right now (realtime presence). */
  onlineIds: string[]
  init: () => Promise<void>
  /** Optimistic insert: shows instantly, syncs in the background, merges the saved row back. */
  createRow: <T extends AnyRow>(table: Table, data: Omit<T, 'id' | 'created_at'> & { id?: string }, log?: Omit<LogInput, 'entityId'>) => T
  /** Optimistic patch, reverted with a toast if the save fails. */
  updateRow: (table: Table, id: string, patch: Record<string, unknown>, log?: LogInput) => void
  deleteRow: (table: Table, id: string, log?: LogInput) => void
  saveInvoiceSettings: (patch: Partial<Omit<InvoiceSettings, 'id' | 'created_at'>>) => void
  logActivity: (log: LogInput) => void
  markNotificationsRead: (ids?: string[]) => void
  /** When this person last opened the Inbox (per device). The bell only lights up for newer items. */
  inboxSeenAt: string
  markInboxSeen: () => void
}

function snapshot(s: DataState): DemoData {
  return {
    clients: s.clients, projects: s.projects, tasks: s.tasks, accessItems: s.accessItems,
    payments: s.payments, notes: s.notes, activity: s.activity, profiles: s.profiles,
    clientMembers: s.clientMembers, invoices: s.invoices, invoiceSettings: s.invoiceSettings,
    subtasks: s.subtasks, comments: s.comments, attachments: s.attachments, timeEntries: s.timeEntries,
    watchers: s.watchers, notifications: s.notifications, invites: s.invites, reminders: s.reminders,
    learning: s.learning, goals: s.goals, topics: s.topics, lessons: s.lessons, resources: s.resources,
    topicMembers: s.topicMembers, progress: s.progress,
  }
}

/** Demo mode has no row-level security, so previewing a member (?as=) mimics what Postgres would return. */
function scopedToMember(data: DemoData, me: Profile): DemoData {
  const clientIds = new Set(data.clientMembers.filter((m) => m.user_id === me.id).map((m) => m.client_id))
  const projects = data.projects.filter((p) => clientIds.has(p.client_id))
  const projectIds = new Set(projects.map((p) => p.id))
  const tasks = data.tasks.filter((t) => projectIds.has(t.project_id))
  const taskIds = new Set(tasks.map((t) => t.id))
  const byTask = <T extends { task_id: string }>(rows: T[]) => rows.filter((r) => taskIds.has(r.task_id))
  return {
    ...data,
    clients: data.clients.filter((c) => clientIds.has(c.id)),
    projects,
    tasks,
    accessItems: data.accessItems.filter((a) => projectIds.has(a.project_id)),
    notes: data.notes.filter((n) => projectIds.has(n.project_id)),
    clientMembers: data.clientMembers.filter((m) => clientIds.has(m.client_id)),
    subtasks: byTask(data.subtasks),
    comments: byTask(data.comments),
    attachments: byTask(data.attachments),
    timeEntries: byTask(data.timeEntries),
    watchers: byTask(data.watchers),
    notifications: data.notifications.filter((n) => n.user_id === me.id),
    payments: [],
    activity: [],
    invoices: [],
    invites: [],
    reminders: [],
    invoiceSettings: null,
  }
}

function saveLocal(data: DemoData) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
  } catch {
    // storage full/unavailable: demo data just won't persist
  }
}

function loadLocal(): Partial<DemoData> | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) return JSON.parse(raw) as DemoData
    // An older v2 demo save: keep the user's demo edits, new tables start from the seed.
    const legacy = localStorage.getItem(LEGACY_LOCAL_KEY)
    return legacy ? (JSON.parse(legacy) as Partial<DemoData>) : null
  } catch {
    return null
  }
}

let channels: RealtimeChannel[] = []

function readSeen(userId?: string | null) {
  try {
    return (userId && localStorage.getItem(`mydesk-inbox-seen:${userId}`)) || ''
  } catch {
    return ''
  }
}

export const useData = create<DataState>((set, get) => {
  const persistLocal = () => {
    const previewing = new URLSearchParams(window.location.search).has('as')
    if (get().demoMode && !previewing) saveLocal(snapshot(get()))
  }

  const revert = (prev: DemoData, message?: string) => {
    set(prev)
    persistLocal()
    toast.error('Couldn’t save, change reverted', {
      description: message || 'Check your connection and try again.',
    })
  }

  /** Inserts or replaces a row in local state (used by realtime + server merges). */
  const upsertLocal = (table: Table, row: AnyRow) => {
    const key = tableToKey[table]
    set((s) => {
      const list = s[key] as unknown as AnyRow[]
      const exists = list.some((r) => r.id === row.id)
      return {
        [key]: exists ? list.map((r) => (r.id === row.id ? { ...r, ...row } : r)) : [row, ...list],
      } as Partial<DataState>
    })
  }

  const removeLocal = (table: Table, id: string) => {
    const key = tableToKey[table]
    set((s) => ({ [key]: (s[key] as unknown as AnyRow[]).filter((r) => r.id !== id) }) as Partial<DataState>)
  }

  const logActivity = (log: LogInput) => {
    const event: ActivityEvent = {
      id: uid(),
      entity: log.entity,
      entity_id: log.entityId,
      action: log.action,
      message: log.message,
      actor_id: get().me?.id ?? null,
      project_id: log.projectId ?? null,
      meta: log.meta ?? {},
      created_at: new Date().toISOString(),
    }
    set((s) => ({ activity: [event, ...s.activity].slice(0, 500) }))
    persistLocal()
    if (supabase) {
      void supabase
        .from('activity_log')
        .insert({
          id: event.id, entity: event.entity, entity_id: event.entity_id, action: event.action,
          message: event.message, project_id: event.project_id, meta: event.meta,
        })
        .then(({ error }) => {
          // Activity is best-effort; never block the user over it.
          if (error) console.warn('activity log failed', error.message)
        })
    }
  }

  /** Fill in what the database would (task numbers, project keys) so it shows instantly. */
  const withLocalDefaults = (table: Table, row: Record<string, unknown>) => {
    if (table === 'tasks' && row.number == null) {
      const max = get().tasks.filter((t) => t.project_id === row.project_id).reduce((m, t) => Math.max(m, t.number ?? 0), 0)
      row.number = max + 1
      row.created_by ??= get().me?.id ?? null
      row.labels ??= []
    }
    if (table === 'projects' && !row.key) row.key = deriveProjectKey(String(row.title ?? ''))
    if (table === 'task_comments') row.author_id ??= get().me?.id ?? null
    if (table === 'project_notes') row.author_id ??= get().me?.id ?? null
    if (table === 'time_entries') row.user_id ??= get().me?.id ?? null
    if (table === 'task_attachments') row.uploaded_by ??= get().me?.id ?? null
    return row
  }

  const subscribeRealtime = (meId: string | undefined) => {
    const sb = supabase
    if (!sb || !meId) return
    for (const ch of channels) void sb.removeChannel(ch)
    channels = []

    const live = (table: Table, filter?: string) =>
      sb
        .channel(`rt-${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
          (payload) => {
            if (payload.eventType === 'DELETE') removeLocal(table, (payload.old as AnyRow).id)
            else upsertLocal(table, payload.new as AnyRow)
          },
        )
        .subscribe()

    channels.push(
      live('notifications', `user_id=eq.${meId}`),
      live('task_comments'),
      live('tasks'),
      live('subtasks'),
      sb
        .channel('rt-activity')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, (payload) => {
          const row = payload.new as ActivityEvent
          set((s) => (s.activity.some((a) => a.id === row.id) ? s : { activity: [row, ...s.activity].slice(0, 500) }))
        })
        .subscribe(),
    )

    const presence = sb.channel('online', { config: { presence: { key: meId } } })
    presence
      .on('presence', { event: 'sync' }, () => set({ onlineIds: Object.keys(presence.presenceState()) }))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void presence.track({ at: Date.now() })
      })
    channels.push(presence)
  }

  return {
    ...demoData(true),
    ready: false,
    learningReady: true,
    topicsReady: true,
    inboxSeenAt: '',
    markInboxSeen: () => {
      const id = get().me?.id
      const now = new Date().toISOString()
      set({ inboxSeenAt: now })
      try {
        if (id) localStorage.setItem(`mydesk-inbox-seen:${id}`, now)
      } catch {
        // storage unavailable: the dot just comes back next visit
      }
    },
    demoMode: !supabase,
    me: null,
    onlineIds: [],
    logActivity,

    init: async () => {
      if (!supabase) {
        const seed = demoData()
        const saved = loadLocal() ?? {}
        const data = { ...seed, ...saved } as DemoData
        await new Promise((r) => setTimeout(r, 350))
        const as = new URLSearchParams(window.location.search).get('as')
        const me =
          (as && data.profiles.find((p) => p.id === as || p.role === as)) ||
          data.profiles.find((p) => p.role === 'owner') ||
          null
        const view = me && me.role === 'member' ? scopedToMember(data, me) : data
        set({ ...view, me, ready: true, inboxSeenAt: readSeen(me?.id), onlineIds: data.profiles.slice(1, 2).map((p) => p.id) })
        return
      }
      const sb = supabase
      const all = <T,>(table: string, order = 'created_at', ascending = false, limit?: number) => {
        let q = sb.from(table).select('*').order(order, { ascending })
        if (limit) q = q.limit(limit)
        return q as unknown as Promise<{ data: T[] | null; error: { message: string } | null }>
      }
      const fetchAll = () =>
        Promise.all([
          all<Client>('clients'),
          all<Project>('projects'),
          all<Task>('tasks'),
          all<AccessItem>('access_items', 'created_at', true),
          all<Payment>('payments'),
          all<ProjectNote>('project_notes'),
          all<ActivityEvent>('activity_log', 'created_at', false, 500),
          all<Profile>('profiles', 'created_at', true),
          all<ClientMember>('client_members'),
          all<Invoice>('invoices'),
          sb.from('invoice_settings').select('*').limit(1).maybeSingle(),
          all<Subtask>('subtasks', 'position', true),
          all<TaskComment>('task_comments', 'created_at', true),
          all<TaskAttachment>('task_attachments'),
          all<TimeEntry>('time_entries'),
          all<TaskWatcher>('task_watchers'),
          all<AppNotification>('notifications', 'created_at', false, 300),
          all<Invite>('invites'),
          all<PaymentReminder>('payment_reminders'),
          sb.auth.getUser(),
          all<LearningItem>('learning_items'),
          all<LearningGoal>('learning_goals', 'created_at', true),
          all<LearningTopic>('learning_topics', 'created_at', false),
          all<LearningLesson>('learning_lessons', 'position', true),
          all<LearningResource>('learning_resources', 'created_at', true),
          all<LearningTopicMember>('learning_topic_members', 'created_at', true),
          all<LearningProgress>('learning_progress', 'created_at', true),
        ] as const)

      let res = await fetchAll()
      const core = () => [res[0], res[1], res[2], res[5]]
      if (core().some((r) => r.error)) {
        // Right after sign-in the auth token can still be settling; one retry clears it.
        await new Promise((r) => setTimeout(r, 900))
        res = await fetchAll()
      }
      const failed = core().find((r) => r.error)
      if (failed?.error) toast.error('Failed to load data', { description: failed.error.message })

      const [
        clients, projects, tasks, accessItems, payments, notes, activity, profiles, members, invoices,
        invoiceSettings, subtasks, comments, attachments, timeEntries, watchers, notifications, invites,
        reminders, user, learning, goals, topics, lessons, resources, topicMembers, progress,
      ] = res
      const profileRows = profiles.data ?? []
      const meId = user.data.user?.id
      set({
        clients: clients.data ?? [],
        projects: projects.data ?? [],
        tasks: tasks.data ?? [],
        accessItems: accessItems.data ?? [],
        payments: payments.data ?? [],
        notes: notes.data ?? [],
        activity: activity.data ?? [],
        profiles: profileRows,
        clientMembers: members.data ?? [],
        invoices: invoices.data ?? [],
        invoiceSettings: (invoiceSettings.data as InvoiceSettings | null) ?? null,
        // New v3 tables: if the v3 SQL hasn't been run yet these error; the app still works.
        subtasks: subtasks.data ?? [],
        comments: comments.data ?? [],
        attachments: attachments.data ?? [],
        timeEntries: timeEntries.data ?? [],
        watchers: watchers.data ?? [],
        notifications: notifications.data ?? [],
        invites: invites.data ?? [],
        reminders: reminders.data ?? [],
        // Improvement tables: empty until improvement.sql has been run.
        learning: learning.data ?? [],
        goals: goals.data ?? [],
        learningReady: !learning.error,
        topics: topics.data ?? [],
        lessons: lessons.data ?? [],
        resources: resources.data ?? [],
        topicMembers: topicMembers.data ?? [],
        progress: progress.data ?? [],
        topicsReady: !topics.error,
        me: profileRows.find((p) => p.id === meId) ?? null,
        inboxSeenAt: readSeen(meId),
        ready: true,
      })

      subscribeRealtime(meId)
      // "Last active" for the Team page, at most every 5 minutes.
      if (meId) {
        const k = 'mydesk-last-active'
        const last = Number(localStorage.getItem(k) ?? 0)
        if (Date.now() - last > 5 * 60 * 1000) {
          localStorage.setItem(k, String(Date.now()))
          void sb.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', meId)
        }
      }
    },

    createRow: (table, data, log) => {
      const row = withLocalDefaults(table, { id: uid(), created_at: new Date().toISOString(), ...data }) as AnyRow
      const key = tableToKey[table]
      const prev = snapshot(get())
      set((s) => ({ [key]: [row, ...(s[key] as unknown as AnyRow[])] }) as Partial<DataState>)
      if (log) logActivity({ ...log, entityId: row.id })
      persistLocal()
      if (supabase) {
        void supabase
          .from(table)
          .insert(row)
          .select()
          .single()
          .then(({ data: saved, error }) => {
            if (error) revert(prev, error.message)
            else if (saved) upsertLocal(table, saved as AnyRow)
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
            [key]: (s[key] as unknown as AnyRow[]).map((r) => (r.id === id ? { ...r, ...patch } : r)),
          }) as Partial<DataState>,
      )
      if (table === 'profiles' && get().me?.id === id) set((s) => ({ me: s.me ? { ...s.me, ...patch } : s.me }))
      if (log) logActivity(log)
      persistLocal()
      if (supabase) {
        void supabase
          .from(table)
          .update(patch)
          .eq('id', id)
          .select()
          .maybeSingle()
          .then(({ data: saved, error }) => {
            if (error) revert(prev, error.message)
            else if (saved) upsertLocal(table, saved as AnyRow)
          })
      }
    },

    deleteRow: (table, id, log) => {
      const prev = snapshot(get())
      removeLocal(table, id)
      if (log) logActivity(log)
      persistLocal()
      if (supabase) {
        void supabase
          .from(table)
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (error) revert(prev, error.message)
          })
      }
    },

    saveInvoiceSettings: (patch) => {
      const prev = snapshot(get())
      const existing = get().invoiceSettings
      const next: InvoiceSettings = existing
        ? { ...existing, ...patch }
        : { id: uid(), created_at: new Date().toISOString(), payment_profiles: [], ...patch }
      set({ invoiceSettings: next })
      persistLocal()
      if (supabase) {
        void supabase
          .from('invoice_settings')
          .upsert(next)
          .then(({ error }) => {
            if (error) revert(prev, error.message)
          })
      }
    },

    markNotificationsRead: (ids) => {
      const now = new Date().toISOString()
      const targets = get().notifications.filter((n) => !n.read_at && (!ids || ids.includes(n.id)))
      if (targets.length === 0) return
      const set_ = new Set(targets.map((n) => n.id))
      set((s) => ({ notifications: s.notifications.map((n) => (set_.has(n.id) ? { ...n, read_at: now } : n)) }))
      persistLocal()
      if (supabase) {
        void supabase.from('notifications').update({ read_at: now }).in('id', [...set_]).then(({ error }) => {
          if (error) toast.error('Couldn’t mark as read', { description: error.message })
        })
      }
    },
  }
})

/** Calls one of the Vercel API functions with the signed-in user's token. */
export async function api<T = unknown>(path: string, body: unknown): Promise<T> {
  if (!supabase) throw new Error('This needs the live backend (not available in demo mode)')
  const { data } = await supabase.auth.getSession()
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string } & T
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
  return json
}
