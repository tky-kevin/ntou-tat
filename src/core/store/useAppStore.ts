import { create } from 'zustand'

interface AppState {
  // Navigation / UI
  headerMenuOpen: boolean
  setHeaderMenuOpen: (open: boolean) => void

  // Academic Info
  selectedSemester: string | undefined
  setSelectedSemester: (semesterId: string | undefined) => void

  // View Settings
  timetableViewMode: 'day' | 'grid' | 'list'
  setTimetableViewMode: (mode: 'day' | 'grid' | 'list') => void

  // Auth / Security
  isPinLocked: boolean
  setIsPinLocked: (locked: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  headerMenuOpen: false,
  setHeaderMenuOpen: (open) => set({ headerMenuOpen: open }),

  selectedSemester: undefined,
  setSelectedSemester: (id) => set({ selectedSemester: id }),

  timetableViewMode: 'grid',
  setTimetableViewMode: (mode) => set({ timetableViewMode: mode }),

  isPinLocked: false,
  setIsPinLocked: (locked) => set({ isPinLocked: locked }),
}))
