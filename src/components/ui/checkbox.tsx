import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { useId } from 'react'
import { cn } from '@/lib/utils'

interface CheckboxRowProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  sublabel?: string
  className?: string
}

/** Labeled checkbox row for pick-lists (e.g. linking projects to an invoice). */
export function CheckboxRow({ checked, onChange, label, sublabel, className }: CheckboxRowProps) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors duration-150 hover:bg-surface-hover',
        checked && 'border-primary/40 bg-primary-soft',
        className,
      )}
    >
      <CheckboxPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className={cn(
          'grid size-4.5 shrink-0 place-items-center rounded border transition-colors duration-150',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong bg-surface',
        )}
      >
        <CheckboxPrimitive.Indicator>
          <Check className="size-3" strokeWidth={3} aria-hidden />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{label}</span>
        {sublabel && <span className="block truncate text-xs text-muted-foreground">{sublabel}</span>}
      </span>
    </label>
  )
}
