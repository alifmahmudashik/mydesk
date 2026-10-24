import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useData } from '@/data/store'
import { createProject, updateProject } from '@/data/actions'
import { useIsAdmin } from '@/hooks/usePermissions'
import { Modal } from '@/components/ui/modal'
import { Field, MoneyInput, Select } from '@/components/ui/field'
import { Avatar } from '@/components/ui/avatar'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { clientDisplayName, deriveProjectKey, profileDisplayName } from '@/lib/derive'
import { options, priorityMeta, projectStatus } from '@/lib/status'
import type { BillingType, ClientMember, Priority, Project, ProjectStatus } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  project?: Project
  defaults?: { client_id?: string }
}

export function ProjectFormModal({ open, onClose, project, defaults = {} }: Props) {
  const { clients, profiles, clientMembers, invoiceSettings, createRow, deleteRow } = useData()
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()
  const activeClients = clients.filter((c) => c.status !== 'archived' || c.id === project?.client_id)

  const blank = () => {
    const client = clients.find((c) => c.id === (project?.client_id ?? defaults.client_id)) ?? activeClients[0]
    return {
      title: project?.title ?? '',
      key: project?.key ?? '',
      client_id: project?.client_id ?? client?.id ?? '',
      billing_type: (project?.billing_type ?? 'retainer') as BillingType,
      project_type: project?.project_type ?? '',
      start_date: project?.start_date ?? '',
      due_date: project?.due_date ?? '',
      amount: project ? String(project.amount || '') : '',
      currency: project?.currency ?? client?.default_currency ?? invoiceSettings?.default_currency ?? 'USD',
      priority: (project?.priority ?? 'medium') as Priority,
      status: (project?.status ?? 'not_started') as ProjectStatus,
      description: project?.description?.replace(/<[^>]+>/g, '') ?? '',
      link_url: project?.link_url ?? '',
      link_label: project?.link_label ?? '',
    }
  }
  const [f, setF] = useState(blank)
  const [team, setTeam] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    const b = blank()
    setF(b)
    setTeam(new Set(clientMembers.filter((m) => m.client_id === b.client_id).map((m) => m.user_id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))
  const members = profiles.filter((p) => p.role === 'member')

  const pickClient = (id: string) => {
    const c = clients.find((x) => x.id === id)
    setF((s) => ({ ...s, client_id: id, currency: project ? s.currency : c?.default_currency ?? s.currency }))
    setTeam(new Set(clientMembers.filter((m) => m.client_id === id).map((m) => m.user_id)))
  }

  const submit = () => {
    if (!f.title.trim()) return toast.error('Give the project a name')
    if (!f.client_id) return toast.error('Pick a client (add one first if you have none)')
    const amount = Number(f.amount) || 0
    // Descriptions are rich text elsewhere; keep existing HTML if the plain text didn't change.
    const plainBefore = project?.description?.replace(/<[^>]+>/g, '') ?? ''
    const description = f.description.trim() === plainBefore.trim() ? project?.description ?? null : f.description.trim() ? `<p>${f.description.trim().replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!).replace(/\n/g, '</p><p>')}</p>` : null
    const data = {
      title: f.title.trim(),
      key: (f.key.trim() || deriveProjectKey(f.title)).toUpperCase().slice(0, 6),
      client_id: f.client_id,
      billing_type: f.billing_type,
      project_type: f.project_type.trim() || null,
      start_date: f.start_date || null,
      due_date: f.due_date || null,
      amount,
      currency: f.currency,
      priority: f.priority,
      description,
      link_url: f.link_url.trim() || null,
      link_label: f.link_label.trim() || null,
    }
    let id = project?.id
    if (project) {
      updateProject(project, { ...data, status: f.status })
      toast.success('Project updated')
    } else {
      const created = createProject({ ...data, status: 'not_started', payment_status: 'unpaid', tags: [] })
      id = created.id
      toast.success('Project created')
    }
    // Team checkboxes grant/revoke client-level access (admins only, matches the database rules).
    if (isAdmin) {
      const current = clientMembers.filter((m) => m.client_id === f.client_id)
      for (const p of members) {
        const has = current.find((m) => m.user_id === p.id)
        if (team.has(p.id) && !has) createRow<ClientMember>('client_members', { client_id: f.client_id, user_id: p.id })
        if (!team.has(p.id) && has) deleteRow('client_members', has.id)
      }
    }
    onClose()
    if (!project && id) navigate(`/projects/${id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? 'Edit project' : 'New project'}
      size="wide"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-pri" onClick={submit}>{project ? 'Save project' : 'Create project'}</button>
        </>
      }
    >
      <form className="dlg-b" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <div className="f2" style={{ gridTemplateColumns: 'minmax(0,1fr) 110px' }}>
          <Field label="Project name" required>
            <input data-autofocus className="inp" placeholder="e.g. Nov: CPC Vending — Google Ads Management" value={f.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Task key" hint={`${(f.key || deriveProjectKey(f.title)).toUpperCase()}-1`}>
            <input className="inp mono" placeholder={deriveProjectKey(f.title)} value={f.key} maxLength={6} onChange={(e) => set('key', e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase())} />
          </Field>
        </div>
        <div className="f2">
          <Field label="Client">
            <Select value={f.client_id} onChange={(e) => pickClient(e.target.value)} options={activeClients.length ? activeClients.map((c) => ({ value: c.id, label: clientDisplayName(c) })) : [{ value: '', label: 'No clients yet' }]} />
          </Field>
          <Field label="Type">
            <Select value={f.billing_type} onChange={(e) => set('billing_type', e.target.value as BillingType)} options={[{ value: 'retainer', label: 'Monthly retainer' }, { value: 'fixed', label: 'Fixed price' }, { value: 'hourly', label: 'Hourly' }]} />
          </Field>
          <Field label="Start date">
            <input className="inp" type="date" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} />
          </Field>
          <Field label="Due date">
            <input className="inp" type="date" value={f.due_date} onChange={(e) => set('due_date', e.target.value)} />
          </Field>
          {isAdmin && (
            <Field label="Budget" hint={!project ? 'A payment is created automatically when you set a budget.' : undefined}>
              <MoneyInput amount={f.amount} currency={f.currency} onAmount={(v) => set('amount', v)} onCurrency={(v) => set('currency', v)} currencies={[...SUPPORTED_CURRENCIES]} />
            </Field>
          )}
          <Field label="Priority">
            <Select value={f.priority} onChange={(e) => set('priority', e.target.value as Priority)} options={options(priorityMeta)} />
          </Field>
          <Field label="Category">
            <input className="inp" placeholder="e.g. Google Ads" value={f.project_type} onChange={(e) => set('project_type', e.target.value)} />
          </Field>
          {project && (
            <Field label="Status">
              <Select value={f.status} onChange={(e) => set('status', e.target.value as ProjectStatus)} options={options(projectStatus)} />
            </Field>
          )}
        </div>
        <Field label="Description">
          <textarea className="inp" rows={3} placeholder="What is this project about?" value={f.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="f2">
          <Field label="Link">
            <input className="inp" placeholder="https://ads.google.com/…" value={f.link_url} onChange={(e) => set('link_url', e.target.value)} />
          </Field>
          <Field label="Link label">
            <input className="inp" placeholder="Google Ads account" value={f.link_label} onChange={(e) => set('link_label', e.target.value)} />
          </Field>
        </div>
        {isAdmin && members.length > 0 && (
          <div className="field">
            <span className="lbl">Team</span>
            <div className="row wrap">
              {members.map((p) => (
                <label key={p.id} className="chip">
                  <input
                    className="cb"
                    type="checkbox"
                    checked={team.has(p.id)}
                    onChange={(e) =>
                      setTeam((s) => {
                        const n = new Set(s)
                        if (e.target.checked) n.add(p.id)
                        else n.delete(p.id)
                        return n
                      })
                    }
                  />
                  <Avatar profile={p} size="xs" />
                  {profileDisplayName(p)}
                </label>
              ))}
            </div>
            <span className="hint">Checked teammates get access to every project under this client.</span>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
