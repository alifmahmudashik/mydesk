import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { createTask } from '@/data/actions'
import { Modal } from '@/components/ui/modal'
import { Field, Select } from '@/components/ui/field'
import { eligibleAssignees, OPEN_PROJECT, profileDisplayName, shortProjectTitle } from '@/lib/derive'
import { parseDuration } from '@/lib/format'
import { options, priorityMeta, taskStatus } from '@/lib/status'
import type { Priority, TaskStatus } from '@/types'
import { DateInput } from '@/components/ui/date-picker'

interface Props {
  open: boolean
  onClose: () => void
  defaults?: { project_id?: string; assignee_id?: string | null; status?: TaskStatus; due_date?: string }
}

export function TaskCreateModal({ open, onClose, defaults = {} }: Props) {
  const { projects, profiles, clientMembers, me, clients } = useData()
  const navigate = useNavigate()
  const openProjects = useMemo(() => projects.filter(OPEN_PROJECT), [projects])

  const blank = () => ({
    title: '',
    description: '',
    project_id: defaults.project_id ?? openProjects[0]?.id ?? '',
    assignee_id: defaults.assignee_id === undefined ? (me?.id ?? '') : (defaults.assignee_id ?? ''),
    status: defaults.status ?? ('todo' as TaskStatus),
    priority: 'medium' as Priority,
    due_date: defaults.due_date ?? '',
    estimate: '',
    labels: '',
  })
  const [f, setF] = useState(blank)
  const [another, setAnother] = useState(false)

  useEffect(() => {
    if (open) setF(blank())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))
  const project = projects.find((p) => p.id === f.project_id)
  const people = eligibleAssignees(project?.client_id, profiles, clientMembers)
  const assignee = profiles.find((p) => p.id === f.assignee_id)
  const emailsAssignee = assignee && assignee.id !== me?.id && assignee.notification_prefs?.assigned !== false

  // Options include the current project even if it's closed (opened from a finished project).
  const projectOptions = [...openProjects, ...(project && !openProjects.includes(project) ? [project] : [])].map((p) => {
    const c = clients.find((x) => x.id === p.client_id)
    return { value: p.id, label: `${shortProjectTitle(p.title)}${c ? ` · ${c.name}` : ''}` }
  })

  const submit = () => {
    if (!f.title.trim()) return toast.error('Give the task a title')
    if (!f.project_id) return toast.error('Pick a project (create one first if you have none)')
    const estimate = f.estimate ? parseDuration(f.estimate) : null
    if (f.estimate && !estimate) return toast.error('Estimate looks off. Try “3h” or “90m”.')
    const task = createTask({
      project_id: f.project_id,
      title: f.title,
      description: f.description.trim() ? `<p>${f.description.trim().replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!).replace(/\n/g, '<br>')}</p>` : null,
      assignee_id: f.assignee_id || null,
      status: f.status,
      priority: f.priority,
      due_date: f.due_date || null,
      estimate_minutes: estimate,
      labels: f.labels.split(',').map((l) => l.trim()).filter(Boolean),
    })
    toast.success('Task created', { action: { label: 'Open', onClick: () => navigate(`/tasks/${task.id}`) } })
    if (another) setF({ ...blank(), project_id: f.project_id, assignee_id: f.assignee_id })
    else onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New task"
      size="wide"
      note={emailsAssignee ? <><Mail className="i i-sm" />{profileDisplayName(assignee)} gets one email when this is created</> : <label className="row-sm" style={{ cursor: 'pointer' }}><input type="checkbox" className="cb" checked={another} onChange={(e) => setAnother(e.target.checked)} /> Create another</label>}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-pri" onClick={submit}>Create task</button>
        </>
      }
    >
      <form className="dlg-b" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <input data-autofocus className="inp" style={{ height: 44, fontSize: 16, fontWeight: 500 }} placeholder="Task title" aria-label="Task title" value={f.title} onChange={(e) => set('title', e.target.value)} />
        <textarea className="inp" rows={4} placeholder="Add a description. What does done look like?" aria-label="Description" value={f.description} onChange={(e) => set('description', e.target.value)} />
        <div className="f3">
          <Field label="Project">
            <Select value={f.project_id} onChange={(e) => set('project_id', e.target.value)} options={projectOptions.length ? projectOptions : [{ value: '', label: 'No open projects' }]} />
          </Field>
          <Field label="Assignee">
            <Select
              value={f.assignee_id}
              onChange={(e) => set('assignee_id', e.target.value)}
              options={[...people.map((p) => ({ value: p.id, label: p.id === me?.id ? `Me (${profileDisplayName(p)})` : profileDisplayName(p) })), { value: '', label: 'Unassigned' }]}
            />
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => set('status', e.target.value as TaskStatus)} options={options(taskStatus).filter((o) => o.value !== 'cancelled')} />
          </Field>
          <Field label="Priority">
            <Select value={f.priority} onChange={(e) => set('priority', e.target.value as Priority)} options={options(priorityMeta)} />
          </Field>
          <Field label="Due date">
            <DateInput value={f.due_date} onChange={(v) => set('due_date', v ?? '')} placeholder="No due date" />
          </Field>
          <Field label="Estimate">
            <input className="inp" placeholder="e.g. 3h" value={f.estimate} onChange={(e) => set('estimate', e.target.value)} />
          </Field>
        </div>
        <Field label="Labels" hint="Comma separated">
          <input className="inp" placeholder="Google Ads, Audit" value={f.labels} onChange={(e) => set('labels', e.target.value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
