import { create } from 'zustand'

/** Which global "create" dialog is open, with optional pre-filled values. */
export type CreateKind = 'task' | 'project' | 'client' | 'payment' | 'invite' | null

interface UIState {
  create: CreateKind
  defaults: Record<string, unknown>
  searchOpen: boolean
  openCreate: (kind: Exclude<CreateKind, null>, defaults?: Record<string, unknown>) => void
  closeCreate: () => void
  setSearch: (open: boolean) => void
}

export const useUI = create<UIState>((set) => ({
  create: null,
  defaults: {},
  searchOpen: false,
  openCreate: (kind, defaults = {}) => set({ create: kind, defaults }),
  closeCreate: () => set({ create: null, defaults: {} }),
  setSearch: (open) => set({ searchOpen: open }),
}))
