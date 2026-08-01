import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface SelectOption<T extends string = string> {
  value: T
  label: string
}

interface SelectProps<T extends string> {
  value?: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  className?: string
  id?: string
  'aria-label'?: string
  disabled?: boolean
}

export const Select = forwardRef(function Select<T extends string>(
  { value, onChange, options, placeholder = 'Select…', className, disabled, ...aria }: SelectProps<T>,
  ref: React.Ref<HTMLButtonElement>,
) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <SelectPrimitive.Trigger
        ref={ref}
        {...aria}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-surface px-3 text-sm transition-colors duration-150 hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25 disabled:opacity-50 data-[placeholder]:text-faint',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="pop-in z-[70] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-surface shadow-lg"
        >
          <SelectPrimitive.Viewport className="max-h-72 p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors data-[highlighted]:bg-surface-hover"
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <Check className="size-3.5 text-primary" aria-hidden />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}) as <T extends string>(props: SelectProps<T> & { ref?: React.Ref<HTMLButtonElement> }) => React.ReactElement
