import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { modalVariants, overlayVariants } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  /** Sticky footer area, usually action buttons. */
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-xl' }

/** The one centered-dialog pattern (forms, confirmations). Detail views use SlideOverPanel instead. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                variants={overlayVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount onOpenAutoFocus={(e) => e.preventDefault()}>
              <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
                <motion.div
                  variants={modalVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className={cn(
                    'flex max-h-[85dvh] w-full flex-col rounded-xl border bg-surface shadow-xl',
                    sizes[size],
                  )}
                >
                  <div className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4">
                    <div>
                      <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
                      {description ? (
                        <Dialog.Description className="mt-0.5 text-[13px] text-muted-foreground">
                          {description}
                        </Dialog.Description>
                      ) : (
                        <Dialog.Description className="sr-only">{title}</Dialog.Description>
                      )}
                    </div>
                    <Dialog.Close asChild>
                      <Button variant="ghost" size="iconSm" aria-label="Close dialog">
                        <X strokeWidth={1.75} />
                      </Button>
                    </Dialog.Close>
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
                  {footer && (
                    <div className="flex shrink-0 justify-end gap-2 border-t px-5 py-3.5">{footer}</div>
                  )}
                </motion.div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

interface ConfirmProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
}

/** Standard destructive-action confirmation. */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Delete' }: ConfirmProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
