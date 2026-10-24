import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

let openCount = 0

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  size?: 'narrow' | 'wide' | ''
  footer?: ReactNode
  /** Small note on the left of the footer (e.g. "Mahedi gets one email"). */
  note?: ReactNode
  children: ReactNode
  className?: string
  /** Hide the header entirely (e.g. command palette). */
  bare?: boolean
}

export function Modal({ open, onClose, title, size = '', footer, note, children, className, bare }: ModalProps) {
  const titleId = useId()
  const dlgRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    openCount++
    document.body.classList.add('modal-open')
    const prevFocus = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    // Focus the first field (or the dialog) for keyboard users.
    requestAnimationFrame(() => {
      const el = dlgRef.current?.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select')
      ;(el ?? dlgRef.current)?.focus()
    })
    return () => {
      window.removeEventListener('keydown', onKey)
      openCount--
      if (openCount === 0) document.body.classList.remove('modal-open')
      prevFocus?.focus?.()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined}>
      <div className="scrim" onClick={onClose} />
      <div ref={dlgRef} tabIndex={-1} className={cn('dlg', size, className)}>
        {!bare && (
          <div className="dlg-h">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Close">
              <X className="i" />
            </button>
          </div>
        )}
        {children}
        {footer && (
          <div className="dlg-f">
            {note && <span className="note">{note}</span>}
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

interface ConfirmProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: ReactNode
  confirmLabel?: string
  /** If set, the user must type this exactly to enable the button. */
  typeToConfirm?: string
  danger?: boolean
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Delete', typeToConfirm, danger = true }: ConfirmProps) {
  const [typed, setTyped] = useState('')
  useEffect(() => {
    if (open) setTyped('')
  }, [open])
  const ok = !typeToConfirm || typed.trim() === typeToConfirm.trim()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="narrow"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={cn('btn', danger ? 'btn-danger' : 'btn-pri')}
            style={danger ? { background: 'var(--bad)', color: '#fff', borderColor: 'var(--bad)' } : undefined}
            disabled={!ok}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="dlg-b">
        {description && <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55 }}>{description}</p>}
        {typeToConfirm && (
          <label className="field">
            <span className="lbl">
              Type <b>{typeToConfirm}</b> to confirm
            </span>
            <input className="inp" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
        )}
      </div>
    </Modal>
  )
}
