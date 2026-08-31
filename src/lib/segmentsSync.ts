import type { Client, Project, ProjectNote, ProjectStatus } from '@/types'
import type { LogInput, Table } from '@/data/store'
import { toast } from 'sonner'

export const SEGMENTS_API_URL =
  'https://script.google.com/macros/s/AKfycbx395GqBvwdlBmtixk-3twyMpo173tPLZx6tCjiTHNVyMqmi7T3KWjUKoBqinQ-ogq8jA/exec'

export interface SegmentsSheetTask {
  id?: number | string
  project?: string
  task?: string
  owners?: string[]
  status?: string
  notes?: string
}

/** Check if the client is the Segments client */
export function isSegmentsClient(client?: Client | null): boolean {
  if (!client) return false
  const name = (client.name || '').trim().toLowerCase()
  const company = (client.company_name || '').trim().toLowerCase()
  return name === 'segments' || company === 'segments'
}

/** Map Google Sheet status string to MyDesk ProjectStatus */
export function mapSheetStatus(rawStatus?: string): ProjectStatus {
  if (!rawStatus) return 'not_started'
  const s = rawStatus.trim().toLowerCase()
  if (s === 'in progress' || s === 'in_progress' || s === 'active' || s === 'working') return 'in_progress'
  if (s === 'blocked') return 'blocked'
  if (s === 'waiting for client' || s === 'waiting' || s.includes('waiting')) return 'waiting_for_client'
  if (s === 'completed' || s === 'done' || s === 'complete') return 'completed'
  if (s === 'finished') return 'finished'
  if (s === 'cancelled' || s === 'canceled') return 'cancelled'
  return 'not_started'
}

/** Format project title as: project + task => "Vistra - Audit tracking" */
export function formatProjectTitle(project?: string, task?: string): string {
  const p = project?.trim()
  const t = task?.trim()
  if (p && t) return `${p} - ${t}`
  return p || t || 'Untitled Project'
}

/** Format notes string into rich text HTML description if valid */
export function formatNotesDescription(rawNotes?: string): string | null {
  const n = rawNotes?.trim()
  if (!n) return null
  if (n.startsWith('http://') || n.startsWith('https://')) {
    return `<p><a href="${n}" target="_blank" rel="noopener noreferrer">${n}</a></p>`
  }
  return `<p>${n}</p>`
}

/** Fetch all tasks from Segments Google Sheet endpoint */
export async function fetchSegmentsTasks(): Promise<SegmentsSheetTask[]> {
  const res = await fetch(SEGMENTS_API_URL, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch Segments tasks: ${res.statusText} (${res.status})`)
  }
  const data = (await res.json()) as SegmentsSheetTask[]
  return Array.isArray(data) ? data : []
}

/** Filter tasks that apply to Alif */
export function isTaskForAlif(task: SegmentsSheetTask): boolean {
  if (!Array.isArray(task.owners)) return false
  return task.owners.some(
    (owner) => typeof owner === 'string' && owner.trim().toLowerCase().includes('alif'),
  )
}

export interface SyncSegmentsOptions {
  client: Client
  projects: Project[]
  notes: ProjectNote[]
  createRow: <T extends { id: string; created_at: string }>(
    table: Table,
    data: Omit<T, 'id' | 'created_at'>,
    log?: Omit<LogInput, 'entityId'>,
  ) => T
  updateRow: (table: Table, id: string, patch: Record<string, unknown>, log?: LogInput) => void
  deleteRow: (table: Table, id: string, log?: LogInput) => void
  showToast?: boolean
}

/**
 * Main sync routine for Segments client:
 * Fetches the Google Sheet tasks, filters for Alif, creates missing projects, updates status/notes on existing ones,
 * and removes projects that were deleted from the sheet.
 */
export async function syncSegmentsClient({
  client,
  projects,
  notes,
  createRow,
  updateRow,
  deleteRow,
  showToast = false,
}: SyncSegmentsOptions): Promise<{ created: number; updated: number; deleted: number; total: number }> {
  try {
    const sheetTasks = await fetchSegmentsTasks()
    const alifTasks = sheetTasks.filter(isTaskForAlif)

    const clientProjects = projects.filter((p) => p.client_id === client.id)

    let created = 0
    let updated = 0
    let deleted = 0

    // Set of normalized project titles currently on the sheet for Alif
    const currentSheetTitles = new Set(
      alifTasks.map((t) => formatProjectTitle(t.project, t.task).trim().toLowerCase()),
    )

    // 1. Delete projects that are no longer present on the sheet
    for (const p of clientProjects) {
      const normalizedTitle = p.title.trim().toLowerCase()
      if (!currentSheetTitles.has(normalizedTitle)) {
        // Clean up any notes for this project
        notes
          .filter((n) => n.project_id === p.id)
          .forEach((n) => {
            deleteRow('project_notes', n.id)
          })

        deleteRow('projects', p.id, {
          entity: 'project',
          entityId: p.id,
          action: 'deleted',
          message: `Removed project "${p.title}" (removed from Segments sheet)`,
        })
        deleted++
      }
    }

    // 2. Create or update projects from the sheet
    for (const item of alifTasks) {
      const title = formatProjectTitle(item.project, item.task)
      const targetStatus = mapSheetStatus(item.status)
      const rawNotes = item.notes?.trim() || ''
      const description = formatNotesDescription(rawNotes)

      // Check if project is already created by title matching
      const existing = clientProjects.find(
        (p) => p.title.trim().toLowerCase() === title.toLowerCase(),
      )

      if (existing) {
        // Project exists: check if status or description needs update
        const patch: Partial<Project> = {}
        let hasChanges = false

        if (existing.status !== targetStatus) {
          patch.status = targetStatus
          hasChanges = true
        }

        // If sheet has notes and existing project description doesn't have it or is empty
        if (description && existing.description !== description) {
          patch.description = description
          hasChanges = true
        }

        if (hasChanges) {
          updateRow('projects', existing.id, patch, {
            entity: 'project',
            entityId: existing.id,
            action: 'updated',
            message: `Synced "${existing.title}" from Segments sheet (${targetStatus})`,
          })
          updated++
        }

        // Also ensure project note exists if note is present
        if (rawNotes) {
          const hasNote = notes.some(
            (n) => n.project_id === existing.id && n.note.trim() === rawNotes,
          )
          if (!hasNote) {
            createRow<ProjectNote>(
              'project_notes',
              {
                project_id: existing.id,
                note: rawNotes,
                created_by: 'Segments Sheet',
              },
              {
                entity: 'note',
                action: 'created',
                message: `Added note from Segments sheet for "${title}"`,
              },
            )
          }
        }
      } else {
        // Create new project for this task
        const newProject = createRow<Project>(
          'projects',
          {
            client_id: client.id,
            title,
            project_type: item.project?.trim() || 'Segments Task',
            description,
            amount: 0,
            currency: 'USD',
            status: targetStatus,
            priority: 'medium',
            payment_status: 'unpaid',
            tags: ['Segments', item.project?.trim()].filter(Boolean) as string[],
          },
          {
            entity: 'project',
            action: 'created',
            message: `Created project "${title}" from Segments sheet`,
          },
        )
        created++

        if (rawNotes) {
          createRow<ProjectNote>(
            'project_notes',
            {
              project_id: newProject.id,
              note: rawNotes,
              created_by: 'Segments Sheet',
            },
            {
              entity: 'note',
              action: 'created',
              message: `Added note from Segments sheet for "${title}"`,
            },
          )
        }
      }
    }

    if (showToast) {
      const parts: string[] = []
      if (created > 0) parts.push(`${created} added`)
      if (updated > 0) parts.push(`${updated} updated`)
      if (deleted > 0) parts.push(`${deleted} removed`)

      if (parts.length > 0) {
        toast.success(`Segments synced: ${parts.join(', ')}`)
      } else {
        toast.info('Segments projects are up to date')
      }
    }

    return { created, updated, deleted, total: alifTasks.length }
  } catch (err) {
    console.error('Segments sheet sync error:', err)
    if (showToast) {
      toast.error('Failed to sync with Segments sheet', {
        description: err instanceof Error ? err.message : 'Network error',
      })
    }
    throw err
  }
}
