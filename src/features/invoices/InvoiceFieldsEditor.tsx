import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { InvoiceField } from '@/types'

interface InvoiceFieldsEditorProps {
  value: InvoiceField[]
  onChange: (fields: InvoiceField[]) => void
}

/** Freeform label/value rows shown on an invoice (e.g. "VAT Number" / "BSB code"). */
export function InvoiceFieldsEditor({ value, onChange }: InvoiceFieldsEditorProps) {
  const set = (i: number, patch: Partial<InvoiceField>) =>
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const add = () => onChange([...value, { label: '', value: '' }])

  return (
    <div className="space-y-2">
      {value.map((field, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={field.label}
            onChange={(e) => set(i, { label: e.target.value })}
            placeholder="Label, e.g. VAT Number"
            className="w-2/5"
          />
          <Input
            value={field.value}
            onChange={(e) => set(i, { value: e.target.value })}
            placeholder="Value"
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            aria-label="Remove field"
            onClick={() => remove(i)}
          >
            <X strokeWidth={1.75} />
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={add}>
        <Plus strokeWidth={1.75} />
        Add field
      </Button>
    </div>
  )
}
