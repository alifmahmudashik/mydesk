import { cn } from '@/lib/utils'

/** Deterministic pastel pairs — same name always gets the same color, readable in both themes. */
const PALETTES = [
  'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
]

function hash(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/)
  const init =
    parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.trim().slice(0, 2)
  return init.toUpperCase()
}

interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: 'size-7 rounded-lg text-[11px]',
  md: 'size-9 rounded-lg text-xs',
  lg: 'size-12 rounded-xl text-sm',
}

/** Client identity mark: colored initials tile, deterministic per name. */
export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 select-none place-items-center font-semibold',
        SIZES[size],
        PALETTES[hash(name) % PALETTES.length],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  )
}
