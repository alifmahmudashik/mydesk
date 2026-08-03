import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { uid } from '@/lib/utils'
import type { PaymentProfile } from '@/types'
import { InvoiceFieldsEditor } from '@/features/invoices/InvoiceFieldsEditor'

interface PaymentProfilesEditorProps {
  value: PaymentProfile[]
  onChange: (profiles: PaymentProfile[]) => void
}

/** Named payment methods (Wise, Payoneer, Bank transfer…), each with its own custom fields —
 *  picked by name on each invoice instead of re-typing bank details every time. */
export function PaymentProfilesEditor({ value, onChange }: PaymentProfilesEditorProps) {
  const setProfile = (i: number, patch: Partial<PaymentProfile>) =>
    onChange(value.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  const removeProfile = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const addProfile = () => onChange([...value, { id: uid(), name: '', fields: [] }])

  return (
    <div className="space-y-3">
      {value.map((profile, i) => (
        <div key={profile.id} className="rounded-lg border bg-surface-hover/50 p-3">
          <div className="mb-3 flex items-center gap-2">
            <Input
              value={profile.name}
              onChange={(e) => setProfile(i, { name: e.target.value })}
              placeholder="e.g. Wise, Payoneer, Bank transfer"
              className="flex-1 bg-surface font-medium"
            />
            <Button
              type="button"
              variant="ghost"
              size="iconSm"
              aria-label="Remove payment method"
              onClick={() => removeProfile(i)}
            >
              <Trash2 strokeWidth={1.75} />
            </Button>
          </div>
          <InvoiceFieldsEditor value={profile.fields} onChange={(fields) => setProfile(i, { fields })} />
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={addProfile}>
        <Plus strokeWidth={1.75} />
        Add payment method
      </Button>
    </div>
  )
}
