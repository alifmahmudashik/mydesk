import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Field({ label, required, hint, children, className }: { label?: ReactNode; required?: boolean; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('field', className)}>
      {label && (
        <span className="lbl">
          {label}
          {required && <span className="req"> *</span>}
        </span>
      )}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

export function Input({ className, sm, ...props }: InputHTMLAttributes<HTMLInputElement> & { sm?: boolean }) {
  return <input className={cn('inp', sm && 'sm', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('inp', className)} rows={3} {...props} />
}

export function Select({ className, sm, options, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { sm?: boolean; options: { value: string; label: string }[] }) {
  return (
    <select className={cn('inp', sm && 'sm', className)} {...props}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <span className="sw">
      <input type="checkbox" checked={checked} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </span>
  )
}

export function ToggleRow({ title, desc, checked, onChange, disabled }: { title: ReactNode; desc?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="toggle-row" style={disabled ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
      <span>
        <b>{title}</b>
        {desc && <small>{desc}</small>}
      </span>
    </label>
  )
}

export function Checkbox({ checked, onChange, round, lg, label, className }: { checked: boolean; onChange: (v: boolean) => void; round?: boolean; lg?: boolean; label?: string; className?: string }) {
  return (
    <input
      type="checkbox"
      className={cn('cb', round && 'round', lg && 'lg', className)}
      checked={checked}
      aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

export function RadioCard({ name, checked, onChange, title, desc, disabled }: { name: string; checked: boolean; onChange: () => void; title: ReactNode; desc?: ReactNode; disabled?: boolean }) {
  return (
    <label className="radio-card">
      <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} />
      <span>
        <b>{title}</b>
        {desc && <small>{desc}</small>}
      </span>
    </label>
  )
}

/** Money input with a currency prefix select. */
export function MoneyInput({ amount, currency, onAmount, onCurrency, currencies }: { amount: string; currency: string; onAmount: (v: string) => void; onCurrency: (v: string) => void; currencies: string[] }) {
  return (
    <div className="prefix">
      <span style={{ padding: 0 }}>
        <select value={currency} onChange={(e) => onCurrency(e.target.value)} aria-label="Currency" style={{ border: 0, background: 'transparent', height: '100%', padding: '0 8px', fontSize: 13, color: 'var(--mute)', cursor: 'pointer', outline: 0 }}>
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </span>
      <input className="inp num" inputMode="decimal" value={amount} onChange={(e) => onAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" />
    </div>
  )
}
