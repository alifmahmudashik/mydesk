import { motion } from 'framer-motion'
import { pageVariants } from '@/lib/motion'

/** Wraps every routed page: consistent fade+rise entrance, quick fade exit. */
export function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  )
}
