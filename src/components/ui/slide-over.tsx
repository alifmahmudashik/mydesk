import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { overlayVariants, slideOverVariants } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface SlideOverPanelProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  /** Small line under the title (e.g. client name, meta). */
  subtitle?: React.ReactNode
  /** Actions rendered in the header next to the close button. */
  headerActions?: React.ReactNode
  children: React.ReactNode
  wide?: boolean
}

/** THE detail-view pattern app-wide (projects, payments): spring slide-in from the right. */
export function SlideOverPanel({
  open,
  onClose,
  title,
  subtitle,
  headerActions,
  children,
  wide,
}: SlideOverPanelProps) {
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
              <motion.div
                variants={slideOverVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className={cn(
                  'fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-surface shadow-xl',
                  wide ? 'sm:max-w-2xl' : 'sm:max-w-xl',
                )}
              >
                <div className="flex items-start justify-between gap-3 border-b px-6 py-4">
                  <div className="min-w-0">
                    <Dialog.Title className="truncate text-base font-semibold">{title}</Dialog.Title>
                    <Dialog.Description asChild>
                      <div className="mt-0.5 text-[13px] text-muted-foreground">
                        {subtitle ?? <span className="sr-only">Details</span>}
                      </div>
                    </Dialog.Description>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {headerActions}
                    <Dialog.Close asChild>
                      <Button variant="ghost" size="iconSm" aria-label="Close panel">
                        <X strokeWidth={1.75} />
                      </Button>
                    </Dialog.Close>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

/** Consistent section block inside slide-over panels. */
export function PanelSection({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('mb-7 last:mb-0', className)}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}
