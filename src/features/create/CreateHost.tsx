import { useUI } from '@/data/ui'
import { TaskCreateModal } from '@/features/create/TaskCreateModal'
import { ProjectFormModal } from '@/features/create/ProjectFormModal'
import { ClientCreateModal } from '@/features/create/ClientCreateModal'
import { PaymentModal } from '@/features/payments/PaymentModal'
import { InviteModal } from '@/features/team/InviteModal'

/** Mounts the global "create" dialogs (opened from anywhere via useUI().openCreate). */
export function CreateHost() {
  const { create, defaults, closeCreate } = useUI()
  return (
    <>
      <TaskCreateModal open={create === 'task'} onClose={closeCreate} defaults={defaults} />
      <ProjectFormModal open={create === 'project'} onClose={closeCreate} defaults={defaults} />
      <ClientCreateModal open={create === 'client'} onClose={closeCreate} />
      <PaymentModal open={create === 'payment'} onClose={closeCreate} defaults={defaults} />
      <InviteModal open={create === 'invite'} onClose={closeCreate} />
    </>
  )
}
