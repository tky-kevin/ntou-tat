import { createContext, useContext } from 'react'
import type { NtouApi } from './contract'
import { useQuery } from '@tanstack/react-query'

// 1. Context for the API client
export const ApiContext = createContext<NtouApi | null>(null)

export const useApi = () => {
  const api = useContext(ApiContext)
  if (!api) throw new Error('useApi must be used within an ApiProvider')
  return api
}

// 2. React Query Hooks for specific data endpoints

export const useSemesters = () => {
  const api = useApi()
  return useQuery({
    queryKey: ['semesters'],
    queryFn: () => api.getSemesters(),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  })
}

export const useTimetable = (semester: string | undefined) => {
  const api = useApi()
  return useQuery({
    queryKey: ['timetable', semester],
    queryFn: () => api.getTimetable(semester!),
    enabled: !!semester,
    staleTime: 1000 * 60 * 60, // 1 hour
  })
}

export const useGrades = (semester: string | undefined) => {
  const api = useApi()
  return useQuery({
    queryKey: ['grades', semester],
    queryFn: () => api.getGrades(semester!),
    enabled: !!semester,
    staleTime: 1000 * 60 * 60, // 1 hour
  })
}

export const useCredits = () => {
  const api = useApi()
  return useQuery({
    queryKey: ['credits'],
    queryFn: () => api.getCredits(),
    staleTime: 1000 * 60 * 60, // 1 hour
  })
}

export const useAnnouncements = () => {
  const api = useApi()
  return useQuery({
    queryKey: ['announcements'],
    queryFn: () => api.getAnnouncements(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export const useCampusLinks = () => {
  const api = useApi()
  return useQuery({
    queryKey: ['campusLinks'],
    queryFn: () => api.getCampusLinks(),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  })
}

export const useTraffic = () => {
  const api = useApi()
  return useQuery({
    queryKey: ['traffic'],
    queryFn: () => api.getTraffic(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export const useStudentProfile = () => {
  const api = useApi()
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => api.getMe(),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  })
}

export const useAppData = () => {
  const api = useApi()
  return useQuery({
    queryKey: ['appData'],
    queryFn: async () => {
      const [announcements, calendar, campusLinks, traffic] = await Promise.all([
        api.getAnnouncements(),
        api.getCalendar('', ''), // TODO: proper dates if needed
        api.getCampusLinks(),
        api.getTraffic(),
      ])
      return { announcements, calendar, campusLinks, traffic }
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  })
}

export const useCourseFiles = (courseId: string | null) => {
  const api = useApi()
  return useQuery({
    queryKey: ['courseFiles', courseId],
    queryFn: () => api.getCourseFiles(courseId!),
    enabled: !!courseId,
    staleTime: 1000 * 60 * 60, // 1 hour
  })
}
