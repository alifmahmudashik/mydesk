export type ClientStatus = 'active' | 'paused' | 'completed' | 'archived'
export type ProjectStatus =
  | 'not_started'
  | 'in_progress'
  | 'waiting_for_client'
  | 'blocked'
  | 'completed'
  | 'cancelled'
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
export type AccessStatus = 'needed' | 'requested' | 'received' | 'not_needed'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded' | 'overdue'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

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
  status: ProjectStatus
  priority: Priority
  payment_status: PaymentStatus
  tags: string[]
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
  notes?: string | null
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
  created_at: string
}

export interface ProjectNote {
  id: string
  project_id: string
  note: string
  created_by?: string | null
  created_at: string
}

export type Role = 'owner' | 'admin' | 'member'

export interface Profile {
  id: string
  email: string
  display_name?: string | null
  role: Role
  created_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  created_at: string
}

export type ActivityEntity = 'client' | 'project' | 'task' | 'access_item' | 'payment' | 'note'
export type ActivityAction = 'created' | 'updated' | 'status_changed' | 'completed' | 'paid' | 'deleted'

export interface ActivityEvent {
  id: string
  entity: ActivityEntity
  entity_id: string
  action: ActivityAction
  message: string
  created_at: string
}
