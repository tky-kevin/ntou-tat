import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TimetableSlot, Grade, CalendarEvent } from '../../types'

export type Alarm = {
  id: string
  time: string
  label: string
  active: boolean
}

export type PersonalCalendarStore = Record<string, CalendarEvent[]>

interface LocalDataState {
  customCourses: Record<string, TimetableSlot[]>
  deletedCourses: Record<string, string[]>
  customGrades: Record<string, Grade[]>
  deletedGrades: Record<string, string[]>
  alarms: Alarm[]
  personalCalendarStore: PersonalCalendarStore
  avatarUrl: string | null

  // Actions
  setCustomCourses: (updater: (prev: Record<string, TimetableSlot[]>) => Record<string, TimetableSlot[]>) => void
  setDeletedCourses: (updater: (prev: Record<string, string[]>) => Record<string, string[]>) => void
  setCustomGrades: (updater: (prev: Record<string, Grade[]>) => Record<string, Grade[]>) => void
  setDeletedGrades: (updater: (prev: Record<string, string[]>) => Record<string, string[]>) => void
  setAlarms: (updater: (prev: Alarm[]) => Alarm[]) => void
  setPersonalCalendarStore: (updater: (prev: PersonalCalendarStore) => PersonalCalendarStore) => void
  setAvatarUrl: (url: string | null) => void
}

export const useLocalDataStore = create<LocalDataState>()(
  persist(
    (set) => ({
      customCourses: {},
      deletedCourses: {},
      customGrades: {},
      deletedGrades: {},
      alarms: [],
      personalCalendarStore: {},
      avatarUrl: null,

      setCustomCourses: (updater) =>
        set((state) => ({ customCourses: updater(state.customCourses) })),
      setDeletedCourses: (updater) =>
        set((state) => ({ deletedCourses: updater(state.deletedCourses) })),
      setCustomGrades: (updater) =>
        set((state) => ({ customGrades: updater(state.customGrades) })),
      setDeletedGrades: (updater) =>
        set((state) => ({ deletedGrades: updater(state.deletedGrades) })),
      setAlarms: (updater) => set((state) => ({ alarms: updater(state.alarms) })),
      setPersonalCalendarStore: (updater) =>
        set((state) => ({ personalCalendarStore: updater(state.personalCalendarStore) })),
      setAvatarUrl: (url) => set({ avatarUrl: url }),
    }),
    {
      name: 'ntou-tat-local-data', // The localStorage key
    }
  )
)
