import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckboxRow } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { useData } from '@/data/store'
import { clientStatus, options } from '@/lib/status'
import type { Client, ClientStatus } from '@/types'

const statusOptions = options(clientStatus)

interface ClientFormModalProps {
  open: boolean
  onClose: () => void
  /** When set, the modal edits this client instead of creating one. */
  client?: Client
}

/** Mount with key={client?.id ?? 'new'} so fields re-initialize per client. */
export function ClientFormModal({ open, onClose, client }: ClientFormModalProps) {
  const createRow = useData((s) => s.createRow)
  const updateRow = useData((s) => s.updateRow)
  const [form, setForm] = useState({
    name: client?.name ?? '',
    company_name: client?.company_name ?? '',
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    website: client?.website ?? '',
    country: client?.country ?? '',
    timezone: client?.timezone ?? '',
    status: client?.status ?? ('active' as ClientStatus),
    notes: client?.notes ?? '',
    use_company_name: client?.use_company_name ?? false,
  })
  const [nameError, setNameError] = useState<string>()

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  function submit() {
    if (!form.name.trim()) {
      setNameError('Client name is required.')
      return
    }
    const data = {
      ...form,
      name: form.name.trim(),
      company_name: form.company_name.trim() || null,
      use_company_name: form.use_company_name && Boolean(form.company_name.trim()),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      website: form.website.trim() || null,
      country: form.country.trim() || null,
      timezone: form.timezone.trim() || null,
      notes: form.notes.trim() || null,
    }
    if (client) {
      updateRow('clients', client.id, data, {
        entity: 'client',
        entityId: client.id,
        action: 'updated',
        message: `Updated client "${data.name}"`,
      })
    } else {
      createRow<Client>('clients', data, {
        entity: 'client',
        action: 'created',
        message: `Added client "${data.name}"`,
      })
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? 'Edit client' : 'New client'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{client ? 'Save changes' : 'Create client'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" required error={nameError}>
          <Input
            value={form.name}
            onChange={(e) => {
              set('name', e.target.value)
              if (nameError) setNameError(undefined)
            }}
            placeholder="e.g. Sarah Chen"
            autoFocus
          />
        </Field>
        <Field label="Company">
          <Input
            value={form.company_name}
            onChange={(e) => set('company_name', e.target.value)}
            placeholder="e.g. Northwind Outfitters"
          />
        </Field>
        <div className="sm:col-span-2">
          <CheckboxRow
            checked={form.use_company_name && Boolean(form.company_name.trim())}
            onChange={(on) => set('use_company_name', on)}
            label="Display as company"
            sublabel={
              form.company_name.trim()
                ? `Show "${form.company_name.trim()}" instead of the contact name across the app.`
                : 'Add a company name to enable this.'
            }
            className={!form.company_name.trim() ? 'pointer-events-none opacity-50' : undefined}
          />
        </div>
        <Field label="Email">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="name@company.com"
          />
        </Field>
        <Field label="Phone">
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+1 …"
          />
        </Field>
        <Field label="Website">
          <Input
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
            placeholder="company.com"
          />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(v) => set('status', v)} options={statusOptions} />
        </Field>
        <Field label="Country">
          <Input value={form.country} onChange={(e) => set('country', e.target.value)} />
        </Field>
        <Field label="Timezone" hint="e.g. Europe/Berlin — handy across regions.">
          <Input value={form.timezone} onChange={(e) => set('timezone', e.target.value)} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Preferences, context, anything worth remembering…"
          />
        </Field>
      </div>
    </Modal>
  )
}
