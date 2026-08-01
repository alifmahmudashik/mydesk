import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TaskCheckProps {
  checked: boolean
  onToggle: () => void
  label: string
}

/** Circular check-off control with an SVG draw + pop — the "satisfying" moment for tasks. */
export function TaskCheck({ checked, onToggle, label }: TaskCheckProps) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      whileTap={{ scale: 0.85 }}
      animate={checked ? { scale: [1, 1.25, 1] } : { scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      // 44px touch target around a 20px visual control
      className="group relative -m-3 grid size-11 shrink-0 cursor-pointer place-items-center"
    >
      <span
        className={cn(
          'grid size-5 place-items-center rounded-full border-2 transition-colors duration-150',
          checked
            ? 'border-primary bg-primary'
            : 'border-border-strong bg-transparent group-hover:border-primary',
        )}
      >
        <AnimatePresence>
          {checked && (
            <motion.svg
              viewBox="0 0 24 24"
              fill="none"
              className="size-3 text-primary-foreground"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              aria-hidden
            >
              <motion.path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.25, ease: 'easeOut', delay: 0.05 }}
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  )
}
