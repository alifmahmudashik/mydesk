import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { useData } from '@/data/store'
import { options, priorityMeta } from '@/lib/status'
import type { Priority, Task } from '@/types'

const priorityOptions = options(priorityMeta)

interface TaskFormModalProps {
  open: boolean
  onClose: () => void
  /** Pre-selects the project (when opened from a project context). */
  projectId?: string
}

export function TaskFormModal({ open, onClose, projectId }: TaskFormModalProps) {
  const projects = useData((s) => s.projects)
  const createRow = useData((s) => s.createRow)
  const [title, setTitle] = useState('')
  const [project, setProject] = useState(projectId ?? '')
  const [priority, setPriority] = useState<Priority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [errors, setErrors] = useState<{ title?: string; project?: string }>({})

  const activeProjects = projects.filter((p) => !['completed', 'cancelled'].includes(p.status))
  const projectOptions = (activeProjects.length ? activeProjects : projects).map((p) => ({
    value: p.id,
    label: p.title,
  }))

  function submit() {
    const next: typeof errors = {}
    if (!title.trim()) next.title = 'Give the task a title.'
    if (!project) next.project = 'Pick a project for this task.'
    setErrors(next)
    if (Object.keys(next).length) return
    createRow<Task>(
      'tasks',
      {
        project_id: project,
        title: title.trim(),
        status: 'todo',
        priority,
        due_date: dueDate || null,
      },
      { entity: 'task', action: 'created', message: `Added task "${title.trim()}"` },
    )
    setTitle('')
    setDueDate('')
    setPriority('medium')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New task"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Create task</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" required error={errors.title}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. QA purchase event dedup"
            autoFocus
          />
        </Field>
        <Field label="Project" required error={errors.project}>
          <Select
            value={project || undefined}
            onChange={setProject}
            options={projectOptions}
            placeholder="Select a project"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <Select value={priority} onChange={setPriority} options={priorityOptions} />
          </Field>
          <Field label="Due date">
            <DatePicker value={dueDate} onChange={setDueDate} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
