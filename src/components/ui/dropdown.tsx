import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DropdownItem {
  label: string
  icon?: LucideIcon
  onSelect: () => void
  danger?: boolean
}

interface DropdownProps {
  trigger: React.ReactNode
  items: DropdownItem[]
  align?: 'start' | 'end'
}

export function Dropdown({ trigger, items, align = 'end' }: DropdownProps) {
  return (
    <DropdownPrimitive.Root>
      <DropdownPrimitive.Trigger asChild>{trigger}</DropdownPrimitive.Trigger>
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content
          align={align}
          sideOffset={4}
          className="pop-in z-[70] min-w-40 rounded-lg border bg-surface p-1 shadow-lg"
        >
          {items.map((item) => (
            <DropdownPrimitive.Item
              key={item.label}
              onSelect={item.onSelect}
              className={cn(
                'flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors data-[highlighted]:bg-surface-hover',
                item.danger && 'text-danger data-[highlighted]:bg-danger/10',
              )}
            >
              {item.icon && <item.icon className="size-4" strokeWidth={1.75} aria-hidden />}
              {item.label}
            </DropdownPrimitive.Item>
          ))}
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  )
}
