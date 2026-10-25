export type ClientStatus = 'active' | 'paused' | 'completed' | 'archived'
export type ProjectStatus =
  | 'not_started'
  | 'in_progress'
  | 'waiting_for_client'
  | 'blocked'
  | 'completed'
  | 'finished'
  | 'cancelled'
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
export type AccessStatus = 'needed' | 'requested' | 'received' | 'not_needed'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded' | 'overdue'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type BillingType = 'retainer' | 'fixed' | 'hourly'

/** Freeform extra field shown on invoices (e.g. VAT Number, Account manager). */
export interface InvoiceField {
  label: string
  value: string
}

export interface Client {
  id: string
  name: string
  company_name?: string | null
  /** Show the company name (not the contact name) as this client's identity across the app. */
  use_company_name?: boolean
  email?: string | null
  phone?: string | null
  website?: string | null
  country?: string | null
  timezone?: string | null
  status: ClientStatus
  notes?: string | null
  /** Full postal address shown as "Invoice to" on this client's invoices. */
  company_address?: string | null
  /** Accent color (hex) used on this client's invoices. */
  brand_color?: string | null
  /** Public URL of the client's logo (stored in the avatars bucket under clients/). */
  logo_url?: string | null
  /** Extra label/value rows shown on this client's invoices, e.g. VAT Number. */
  invoice_fields?: InvoiceField[]
  pinned?: boolean
  default_currency?: string | null
  /** 'receipt' | 'net_7' | 'net_14' | 'net_30' */
  payment_terms?: string | null
  created_at: string
}

export interface Project {
  id: string
  client_id: string
  title: string
  project_type?: string | null
  description?: string | null
  amount: number
  currency: string
  start_date?: string | null
  due_date?: string | null
  /** Month the work was done, stored as the 1st of that month ("2026-10-01"). */
  work_month?: string | null
  status: ProjectStatus
  priority: Priority
  payment_status: PaymentStatus
  tags: string[]
  /** Short prefix for task refs, e.g. "CPS" → CPS-12. */
  key?: string | null
  billing_type?: BillingType | null
  link_url?: string | null
  link_label?: string | null
  archived_at?: string | null
  completed_at?: string | null
  created_at: string
}

export interface Task {
  id: string
  project_id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: Priority
  due_date?: string | null
  assignee_id?: string | null
  /** Everyone on the task (assignee_id is the first of them). */
  assignee_ids?: string[]
  notes?: string | null
  /** Per-project sequence number (CPS-12). Assigned by the database if missing. */
  number?: number | null
  labels?: string[]
  estimate_minutes?: number | null
  created_by?: string | null
  completed_at?: string | null
  created_at: string
}

export interface AccessItem {
  id: string
  project_id: string
  access_name: string
  description?: string | null
  status: AccessStatus
  is_required: boolean
  notes?: string | null
  created_at: string
}

export interface Payment {
  id: string
  client_id: string
  /** One invoice can cover multiple projects. */
  project_ids: string[]
  amount: number
  currency: string
  status: PaymentStatus
  payment_method?: string | null
  invoice_url?: string | null
  payment_date?: string | null
  due_date?: string | null
  notes?: string | null
  invoice_id?: string | null
  last_reminded_at?: string | null
  created_at: string
}

export interface InvoiceLineItem {
  description: string
  price: number
  qty: number
}

/** A generated, exportable invoice — separate from Payments (which track what's owed/settled). */
export interface Invoice {
  id: string
  client_id: string
  number: string
  issue_date?: string | null
  due_date?: string | null
  currency: string
  line_items: InvoiceLineItem[]
  tax_rate: number
  notes?: string | null
  brand_color?: string | null
  /** Snapshot of whichever payment profile was picked when this invoice was made — stays
   *  accurate even if the profile is later renamed/edited/deleted in Business settings. */
  payment_fields?: InvoiceField[]
  payment_profile_id?: string | null
  created_at: string
}

/** A named set of payment details (e.g. "Wise", "Payoneer") — pick one per invoice instead of
 *  re-typing/re-editing bank details every time. */
export interface PaymentProfile {
  id: string
  name: string
  fields: InvoiceField[]
}

/** The sender's own business/payment details — reused as the default on every invoice. */
export interface InvoiceSettings {
  id: string
  business_name?: string | null
  business_address?: string | null
  email?: string | null
  brand_color?: string | null
  payment_profiles: PaymentProfile[]
  default_note?: string | null
  default_currency?: string
  default_due_days?: number
  default_tax?: number
  workspace_name?: string | null
  created_at: string
}

export interface ProjectNote {
  id: string
  project_id: string
  note: string
  created_by?: string | null
  pinned?: boolean
  author_id?: string | null
  mentions?: string[]
  created_at: string
}

export type Role = 'owner' | 'admin' | 'member'

export interface Profile {
  id: string
  email: string
  display_name?: string | null
  role: Role
  full_name?: string | null
  avatar_url?: string | null
  phone?: string | null
  job_title?: string | null
  timezone?: string | null
  last_active_at?: string | null
  notification_prefs?: NotificationPrefs
  created_at: string
}

export interface NotificationPrefs {
  assigned?: boolean
  mentioned?: boolean
  comment?: boolean
  overdue?: boolean
  weekly?: boolean
  due_soon?: boolean
  access?: boolean
}

/** Grants a user every project (and task) under this client — see migration-005. */
export interface ClientMember {
  id: string
  client_id: string
  user_id: string
  created_at: string
}

export type ActivityEntity =
  | 'client' | 'project' | 'task' | 'access_item' | 'payment' | 'note'
  | 'comment' | 'subtask' | 'invoice' | 'member' | 'attachment' | 'time'
export type ActivityAction =
  | 'created' | 'updated' | 'status_changed' | 'completed' | 'paid' | 'deleted'
  | 'commented' | 'assigned' | 'mentioned' | 'invited' | 'removed' | 'logged' | 'reminded'

export interface ActivityEvent {
  id: string
  entity: ActivityEntity
  entity_id: string
  action: ActivityAction
  message: string
  actor_id?: string | null
  project_id?: string | null
  meta?: Record<string, unknown>
  created_at: string
}

export interface Subtask {
  id: string
  task_id: string
  title: string
  done: boolean
  assignee_id?: string | null
  position: number
  created_at: string
}

export interface TaskComment {
  id: string
  task_id: string
  author_id?: string | null
  /** Plain text with @[Name](user-id) mention tokens. */
  body: string
  mentions: string[]
  edited_at?: string | null
  created_at: string
}

export interface TaskAttachment {
  id: string
  task_id: string
  kind: 'file' | 'link'
  name: string
  url?: string | null
  storage_path?: string | null
  size_bytes?: number | null
  uploaded_by?: string | null
  created_at: string
}

export interface TimeEntry {
  id: string
  task_id: string
  user_id?: string | null
  minutes: number
  note?: string | null
  logged_on: string
  created_at: string
}

export interface TaskWatcher {
  id: string
  task_id: string
  user_id: string
  created_at: string
}

export type NotificationType =
  | 'assigned' | 'mentioned' | 'mentioned_note' | 'comment' | 'completed'
  | 'overdue' | 'paid' | 'invite_accepted' | 'due_soon' | 'access_granted'
  | 'learning_shared' | 'learning_done' | 'topic_added'

export interface AppNotification {
  id: string
  user_id: string
  type: NotificationType
  actor_id?: string | null
  entity?: string | null
  entity_id?: string | null
  project_id?: string | null
  title: string
  excerpt?: string | null
  link?: string | null
  emailed: boolean
  read_at?: string | null
  created_at: string
}

export interface Invite {
  id: string
  email: string
  role: 'admin' | 'member'
  client_ids: string[]
  token: string
  invited_by?: string | null
  accepted_at?: string | null
  revoked_at?: string | null
  created_at: string
}

export interface PaymentReminder {
  id: string
  payment_id: string
  sent_by?: string | null
  to_email: string
  subject?: string | null
  created_at: string
}

// ---------------------------------------------------------------- improvement (team learning)

export type LearningKind = 'article' | 'video' | 'course' | 'book' | 'podcast' | 'tool' | 'other'
export type LearningStatus = 'todo' | 'learning' | 'done'

/** One resource for one person to learn (sharing with several people makes one row each). */
export interface LearningItem {
  id: string
  created_by?: string | null
  assignee_id: string
  goal_id?: string | null
  title: string
  url?: string | null
  kind: LearningKind
  /** Why it's worth learning (from whoever shared it). */
  note?: string | null
  status: LearningStatus
  /** What the learner took away from it. */
  takeaway?: string | null
  started_at?: string | null
  completed_at?: string | null
  created_at: string
}

export interface LearningGoal {
  id: string
  user_id: string
  created_by?: string | null
  title: string
  target_date?: string | null
  status: 'active' | 'done'
  created_at: string
}

/** A shared learning path, e.g. "Google Tag Manager". */
export interface LearningTopic {
  id: string
  created_by?: string | null
  title: string
  description?: string | null
  color?: string | null
  archived_at?: string | null
  created_at: string
}

/** A step inside a topic, e.g. "How to set it up". */
export interface LearningLesson {
  id: string
  topic_id: string
  created_by?: string | null
  title: string
  details?: string | null
  position: number
  created_at: string
}

/** A link / video / doc attached to a lesson. */
export interface LearningResource {
  id: string
  lesson_id: string
  created_by?: string | null
  title: string
  url?: string | null
  kind: LearningKind
  note?: string | null
  created_at: string
}

export interface LearningTopicMember {
  id: string
  topic_id: string
  user_id: string
  added_by?: string | null
  created_at: string
}

/** One person's progress on one lesson. */
export interface LearningProgress {
  id: string
  lesson_id: string
  user_id: string
  status: 'learning' | 'done'
  takeaway?: string | null
  completed_at?: string | null
  created_at: string
}
