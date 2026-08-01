import type { Transition, Variants } from 'framer-motion'

/** Shared motion vocabulary (MASTER.md §6). Entrances expo-out, exits shorter ease-in, springs for surfaces. */

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

export const panelSpring: Transition = { type: 'spring', stiffness: 380, damping: 34 }

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: 'easeIn' } },
}

export const listContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.03 } },
}

export const listItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } },
}

export const overlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } },
}

export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.13, ease: 'easeIn' } },
}

export const slideOverVariants: Variants = {
  initial: { x: '100%' },
  animate: { x: 0, transition: panelSpring },
  exit: { x: '100%', transition: { duration: 0.2, ease: 'easeIn' } },
}
