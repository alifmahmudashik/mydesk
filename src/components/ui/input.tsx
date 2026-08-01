import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const baseField =
  'w-full rounded-lg border bg-surface px-3 text-sm text-foreground transition-colors duration-150 placeholder:text-faint hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25 disabled:opacity-50 aria-invalid:border-danger aria-invalid:focus:ring-danger/25'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(baseField, 'h-9', className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(baseField, 'min-h-20 py-2 leading-relaxed', className)} {...props} />
  ),
)
Textarea.displayName = 'Textarea'
