import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App as CapApp } from '@capacitor/app'
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  Clock,
  Clock3,
  GraduationCap,
  LayoutGrid,
  List as ListIcon,
  Menu,
  MoreVertical,
  Plus,
  RefreshCw,
} from 'lucide-react'
import './App.css'
import { createNtouApi } from './core/api'
import { UnauthorizedError } from './core/api/errors'
import { emptyCredits } from './core/api/publicData'
import { clearPortalSession } from './core/api/portal'
import { readStoredAvatar, storeAvatar } from './avatar'
import { hasPassingResult, scoreToGpa } from './gpa'
import { authStore } from './core/storage/authStorage'
import {
  personalEventsForStudent,
  readPersonalCalendarStore,
  writePersonalCalendarStore,
  type PersonalCalendarStore,
} from './core/storage/calendarStorage'
import { semestersForStudent } from './semester'
import {
  clearSemesterCache,
  readSemesterCache,
  writeSemesterCache,
  type SemesterCacheEntry,
} from './core/storage/semesterCache'
import { PinSetupScreen } from './features/pin/PinSetupScreen'
import { PinUnlockScreen } from './features/pin/PinUnlockScreen'
import { TimetableScreen } from './features/timetable/TimetableScreen'
import { coursesFromTimetable, periods } from './features/timetable/utils'
import { CalendarScreen, isoDate } from './features/calendar/CalendarScreen'
import { GradesScreen } from './features/grades/GradesScreen'
import { creditSummaryFromGrades } from './features/grades/utils'
import { MoreScreen, MoreSubview } from './features/more/MoreScreen'
import { moreViewTitle } from './features/more/utils'
import { CourseSheet } from './features/course/CourseSheet'
import { AddCourseModal } from './features/course/AddCourseModal'
import { LoginScreen } from './features/auth/LoginScreen'
import { LoadingScreen } from './components/LoadingScreen'
import { ClockScreen } from './features/clock/ClockScreen'
import { AddCalendarEventModal } from './features/calendar/AddCalendarEventModal'
import { AddGradeModal } from './features/grades/AddGradeModal'
import type {
  Announcement,
  AuthSession,
  CalendarEvent,
  CampusLink,
  CourseFile,
  CourseSummary,
  CreditSummary,
  Grade,
  LoginChallenge,
  MoreView,
  Semester,
  StudentProfile,
  TabKey,
  TimetableResponse,
  TimetableSlot,
  TrafficInfo,
} from './types'

type AppData = {
  profile: StudentProfile
  semesters: Semester[]
  timetable: TimetableResponse
  grades: Grade[]
  credits: CreditSummary
  announcements: Announcement[]
  calendar: CalendarEvent[]
  campusLinks: CampusLink[]
  traffic: TrafficInfo[]
}

type SemesterData = Pick<AppData, 'timetable' | 'grades' | 'credits'>

type CalendarEventDraft = Pick<
  CalendarEvent,
  'title' | 'startsOn' | 'endsOn' | 'category' | 'time' | 'notes'
>

const tabs: Array<{ key: TabKey; label: string; icon: typeof CalendarDays }> = [
  { key: 'timetable', label: '課表', icon: Clock3 },
  { key: 'calendar', label: '行事曆', icon: CalendarDays },
  { key: 'grades', label: '成績', icon: GraduationCap },
  { key: 'clock', label: '鬧鐘', icon: Clock },
  { key: 'more', label: '其它', icon: Menu },
]

const tabTitles: Record<TabKey, string> = {
  timetable: '課表',
  calendar: '行事曆',
  grades: '成績',
  clock: '鬧鐘與計時',
  more: '其它',
}

const messageFromError = (error: unknown) =>
  error instanceof Error ? error.message : '發生未知錯誤'

const TIMETABLE_VIEW_STORAGE_KEY = 'ntou-timetable-view-v2'







const semesterDataFromCache = (entry: SemesterCacheEntry): SemesterData => ({
  timetable: entry.timetable,
  grades: entry.grades,
  credits: entry.credits,
})



function App() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [data, setData] = useState<AppData | null>(null)
  const [selectedTab, setSelectedTab] = useState<TabKey>('timetable')
  const [timetableViewMode, setTimetableViewMode] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem(TIMETABLE_VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid'
    } catch {
      return 'grid'
    }
  })
  const [selectedSemester, setSelectedSemester] = useState('')
  const [moreView, setMoreView] = useState<MoreView | null>(null)
  const [customAvatar, setCustomAvatar] = useState(readStoredAvatar)
  const [activeCourse, setActiveCourse] = useState<CourseSummary | null>(null)
  const [courseFiles, setCourseFiles] = useState<Record<string, CourseFile[]>>({})
  const [fileLoadingId, setFileLoadingId] = useState<string | null>(null)
  const [isBooting, setIsBooting] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [appError, setAppError] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginChallenge, setLoginChallenge] = useState<LoginChallenge | null>(null)
  const [challengeBusy, setChallengeBusy] = useState(false)
  const [autoCaptchaFailed, setAutoCaptchaFailed] = useState(false)
  const [isPinLocked, setIsPinLocked] = useState(false)
  const [showPinSetup, setShowPinSetup] = useState(false)
  const [showPinVerifyForDisable, setShowPinVerifyForDisable] = useState(false)
  const [hasPin, setHasPin] = useState(false)

  // --- NTOU TAT Heavy 重構合併新增之狀態 ---
  const [customCourses, setCustomCourses] = useState<Record<string, TimetableSlot[]>>(() => {
    return JSON.parse(localStorage.getItem('ntou_custom_courses_v9') || '{}')
  })
  const [deletedCourses, setDeletedCourses] = useState<Record<string, string[]>>(() => {
    return JSON.parse(localStorage.getItem('ntou_deleted_courses_v9') || '{}')
  })
  const [customGrades, setCustomGrades] = useState<Record<string, Grade[]>>(() => {
    return JSON.parse(localStorage.getItem('ntou_custom_grades_v9') || '{}')
  })
  const [deletedGrades, setDeletedGrades] = useState<Record<string, string[]>>(() => {
    return JSON.parse(localStorage.getItem('ntou_deleted_grades_v9') || '{}')
  })
  const [alarms, setAlarms] = useState<Array<{ id: string; time: string; label: string; active: boolean }>>(() => {
    return JSON.parse(localStorage.getItem('ntou_alarms_v9') || '[]')
  })
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false)
  const [isAddGradeOpen, setIsAddGradeOpen] = useState(false)
  const [isAddCalendarEventOpen, setIsAddCalendarEventOpen] = useState(false)
  const [calendarEventDate, setCalendarEventDate] = useState(() => isoDate(new Date()))
  const [personalCalendarStore, setPersonalCalendarStore] = useState<PersonalCalendarStore>(
    readPersonalCalendarStore,
  )
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)

  const saveCustomCourses = (newCourses: Record<string, TimetableSlot[]>) => {
    setCustomCourses(newCourses)
    localStorage.setItem('ntou_custom_courses_v9', JSON.stringify(newCourses))
  }
  const saveDeletedCourses = (newDeleted: Record<string, string[]>) => {
    setDeletedCourses(newDeleted)
    localStorage.setItem('ntou_deleted_courses_v9', JSON.stringify(newDeleted))
  }
  const saveCustomGrades = (newGrades: Record<string, Grade[]>) => {
    setCustomGrades(newGrades)
    localStorage.setItem('ntou_custom_grades_v9', JSON.stringify(newGrades))
  }
  const saveDeletedGrades = (newDeleted: Record<string, string[]>) => {
    setDeletedGrades(newDeleted)
    localStorage.setItem('ntou_deleted_grades_v9', JSON.stringify(newDeleted))
  }
  const saveAlarms = (newAlarms: Array<{ id: string; time: string; label: string; active: boolean }>) => {
    setAlarms(newAlarms)
    localStorage.setItem('ntou_alarms_v9', JSON.stringify(newAlarms))
  }
  const savePersonalCalendarStore = (nextStore: PersonalCalendarStore) => {
    setPersonalCalendarStore(nextStore)
    writePersonalCalendarStore(nextStore)
  }
  const saveCustomAvatar = (dataUrl: string) => {
    storeAvatar(dataUrl)
    setCustomAvatar(dataUrl)
  }
  const dataRef = useRef<AppData | null>(null)
  const semesterCacheRef = useRef(new Map<string, SemesterData>())
  const dataRequestRef = useRef(0)

  const applyData = useCallback((nextData: AppData | null) => {
    dataRef.current = nextData
    setData(nextData)
  }, [])

  const handleUnauthorized = useCallback(async () => {
    dataRequestRef.current += 1
    await authStore.clearSession()
    setSession(null)
    applyData(null)
    setSelectedTab('timetable')
    setMoreView(null)
    setActiveCourse(null)
  }, [applyData])

  const api = useMemo(() => createNtouApi(handleUnauthorized), [handleUnauthorized])

  const loadLoginChallenge = useCallback(async (preserveError?: string) => {
    if (!api.getLoginChallenge) {
      return
    }

    setChallengeBusy(true)
    if (!preserveError) {
      setLoginError(null)
    }
    try {
      setLoginChallenge(await api.getLoginChallenge())
    } catch (error) {
      setLoginError(`${messageFromError(error)}。瀏覽器預覽可能受跨網域限制。`)
    } finally {
      if (preserveError) {
        setLoginError(preserveError)
      }
      setChallengeBusy(false)
    }
  }, [api])

  const loadAppData = useCallback(async (semesterOverride?: string, force = false) => {
    const requestId = ++dataRequestRef.current
    setAppError(null)
    const existing = dataRef.current
    const rawSemesters = existing?.semesters ?? await api.getSemesters()
    const storedSession = await authStore.getSession()
    const profile = existing?.profile ?? storedSession?.profile ?? await api.getMe()
    const semesters = semestersForStudent(rawSemesters, profile.id)
    const readCachedSemester = async (semesterId: string) => {
      const memory = semesterCacheRef.current.get(semesterId)
      if (memory) return memory
      const stored = await readSemesterCache(profile.id, semesterId)
      if (stored) {
        const cachedSemester = semesterDataFromCache(stored)
        semesterCacheRef.current.set(semesterId, cachedSemester)
        return cachedSemester
      }
      return undefined
    }

    let semesterId =
      semesterOverride && semesters.some((semester) => semester.id === semesterOverride)
        ? semesterOverride
        : semesters.find((semester) => semester.current)?.id || semesters[0]?.id || ''
    let cached: SemesterData | undefined
    if (semesterOverride) {
      cached = await readCachedSemester(semesterId)
    } else {
      for (const semester of semesters) {
        const candidate = await readCachedSemester(semester.id)
        if (candidate?.timetable.slots.length) {
          semesterId = semester.id
          cached = candidate
          break
        }
      }
      cached ??= await readCachedSemester(semesterId)
    }
    setSelectedSemester(semesterId)

    const today = new Date()
    const from = isoDate(today)
    const to = isoDate(new Date(today.getFullYear(), today.getMonth() + 5, today.getDate()))

    const loadErrors: string[] = []
    const loadOptional = async <T,>(label: string, request: Promise<T>, fallback: T) => {
      try {
        return await request
      } catch (error) {
        if (error instanceof UnauthorizedError) throw error
        loadErrors.push(`${label}：${messageFromError(error)}`)
        return fallback
      }
    }

    // Prepare initial empty or cached semester data
    const emptySemester: SemesterData = {
      timetable: { semesterId, updatedAt: new Date().toISOString(), slots: [] },
      grades: [],
      credits: emptyCredits,
    }
    const initialSemester = cached ?? emptySemester

    // Apply initial profile and cached timetable/grades immediately to render UI instantly
    applyData({
      profile,
      semesters,
      ...initialSemester,
      announcements: existing?.announcements ?? [],
      calendar: existing?.calendar ?? [],
      campusLinks: existing?.campusLinks ?? [],
      traffic: existing?.traffic ?? [],
    })

    // Fetch public data (announcements, calendar, campus links, traffic) in background
    if (!existing) {
      void Promise.all([
        loadOptional('公告', api.getAnnouncements(), []),
        loadOptional('行事曆', api.getCalendar(from, to), []),
        loadOptional('校園連結', api.getCampusLinks(), []),
        loadOptional('交通資訊', api.getTraffic(), []),
      ]).then(([ann, cal, links, traf]) => {
        if (requestId !== dataRequestRef.current) return
        const current = dataRef.current
        if (current) {
          applyData({
            ...current,
            announcements: ann,
            calendar: cal,
            campusLinks: links,
            traffic: traf,
          })
        }
      }).catch(() => {})
    }

    if (cached && !force) {
      if (loadErrors.length) {
        setAppError(`部分資料讀取失敗：${loadErrors.join('；')}`)
      }
      return
    }

    const loadSemesterPart = async <T,>(
      label: string,
      fetchFn: () => Promise<T>,
    ): Promise<{ value: T | null; error: unknown | null }> => {
      try {
        return { value: await fetchFn(), error: null }
      } catch (error) {
        loadErrors.push(`${label}：${messageFromError(error)}`)
        return { value: null, error }
      }
    }

    let activeSemesterId = semesterId
    let activeInitialSemester = initialSemester
    let timetableResult = await loadSemesterPart('課表', () => api.getTimetable(activeSemesterId))

    if (
      !semesterOverride &&
      !(timetableResult.value?.slots.length || activeInitialSemester.timetable.slots.length)
    ) {
      const currentIndex = semesters.findIndex((semester) => semester.id === activeSemesterId)
      for (const semester of semesters.slice(currentIndex + 1)) {
        const candidateCached = await readCachedSemester(semester.id)
        const candidateResult = await loadSemesterPart('課表', () => api.getTimetable(semester.id))
        const candidateTimetable = candidateResult.value ?? candidateCached?.timetable
        if (!candidateTimetable?.slots.length) continue

        activeSemesterId = semester.id
        activeInitialSemester = candidateCached ?? {
          timetable: candidateTimetable,
          grades: [],
          credits: emptyCredits,
        }
        timetableResult = {
          value: candidateTimetable,
          error: candidateResult.error,
        }
        setSelectedSemester(activeSemesterId)
        break
      }
    }

    const gradesResult = await loadSemesterPart('成績', () => api.getGrades(activeSemesterId))
    if (requestId !== dataRequestRef.current) return

    const timetable = timetableResult.value ?? activeInitialSemester.timetable
    const grades = gradesResult.value ?? activeInitialSemester.grades
    const credits = gradesResult.value
      ? creditSummaryFromGrades(gradesResult.value)
      : activeInitialSemester.credits
    const semesterData = { timetable, grades, credits }
    semesterCacheRef.current.set(activeSemesterId, semesterData)

    const current = dataRef.current
    applyData({
      profile,
      semesters,
      ...semesterData,
      announcements: current?.announcements ?? existing?.announcements ?? [],
      calendar: current?.calendar ?? existing?.calendar ?? [],
      campusLinks: current?.campusLinks ?? existing?.campusLinks ?? [],
      traffic: current?.traffic ?? existing?.traffic ?? [],
    })
    try {
      await writeSemesterCache(profile.id, activeSemesterId, {
        savedAt: new Date().toISOString(),
        ...semesterData,
      })
    } catch {
      // Data remains available in memory when encrypted cache storage is unavailable.
    }
    if (loadErrors.length) {
      setAppError(`部分資料讀取失敗：${loadErrors.join('；')}`)
    }
  }, [api, applyData])

  useEffect(() => {
    let mounted = true
    const boot = async () => {
      try {
        const { credentialsStore } = await import('./core/storage/credentialsStorage')
        if (credentialsStore.hasPin()) {
          setIsPinLocked(true)
          if (mounted) setIsBooting(false)
          return
        }

        const savedSession = await authStore.getSession()
        if (!mounted) return
        setSession(savedSession)
        if (savedSession) {
          await loadAppData()
        } else {
          await loadLoginChallenge()
        }
      } catch (error) {
        if (!mounted) return
        if (error instanceof UnauthorizedError) {
          if (error.message === 'CAPTCHA_FAILED') {
            setAutoCaptchaFailed(true)
            await loadLoginChallenge('驗證碼自動辨識連續失敗，請手動登入')
          } else {
            await loadLoginChallenge(error.message)
          }
        } else {
          setAppError(messageFromError(error))
        }
      } finally {
        if (mounted) setIsBooting(false)
      }
    }
    void boot()
    return () => {
      mounted = false
    }
  }, [loadAppData, loadLoginChallenge])

  useEffect(() => {
    import('./core/storage/credentialsStorage').then(({ credentialsStore }) => {
      setHasPin(credentialsStore.hasPin())
    })
  }, [showPinSetup, showPinVerifyForDisable])

  useEffect(() => {
    const handleBackButton = CapApp.addListener('backButton', () => {
      if (isAddCalendarEventOpen) {
        setIsAddCalendarEventOpen(false)
      } else if (isAddCourseOpen) {
        setIsAddCourseOpen(false)
      } else if (isAddGradeOpen) {
        setIsAddGradeOpen(false)
      } else if (activeCourse) {
        setActiveCourse(null)
      } else if (moreView) {
        setMoreView(null)
      } else {
        void CapApp.minimizeApp()
      }
    })
    return () => {
      void handleBackButton.then((h: { remove: () => void }) => h.remove())
    }
  }, [activeCourse, moreView, isAddCalendarEventOpen, isAddCourseOpen, isAddGradeOpen])

  const handleLogin = async (studentId: string, password: string, providedCaptchaCode?: string, rememberMe?: boolean) => {
    setLoginBusy(true)
    setLoginError(null)
    try {
      const { recognizeCaptcha } = await import('./utils/ocr')
      let maxRetries = providedCaptchaCode ? 1 : 3
      let nextSession = null
      let currentChallenge = loginChallenge

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (!currentChallenge && api.getLoginChallenge) {
            currentChallenge = await api.getLoginChallenge()
          }
          
          let solvedCaptchaCode = providedCaptchaCode
          if (!solvedCaptchaCode && currentChallenge && currentChallenge.captchaDataUrl) {
             try {
               solvedCaptchaCode = await recognizeCaptcha(currentChallenge!.captchaDataUrl!)
             } catch (ocrError) {
               setAutoCaptchaFailed(true)
               throw ocrError
             }
          }

          nextSession = await api.login({
            studentId,
            password,
            captchaCode: solvedCaptchaCode,
            challenge: currentChallenge ?? undefined,
          })
          
          setAutoCaptchaFailed(false)
          break // Success
        } catch (error: any) {
          currentChallenge = null // Force new challenge on retry
          const errorMessage = messageFromError(error)
          
          // Only retry if it's a captcha error, otherwise throw immediately
          if (!errorMessage.includes('驗證碼') && !errorMessage.includes('captcha') && !errorMessage.includes('重複登入')) {
            throw error
          }
          if (attempt === maxRetries - 1) {
            if (!providedCaptchaCode) {
              setAutoCaptchaFailed(true)
            }
            throw error
          }
        }
      }

      await authStore.saveSession(nextSession!)
      
      if (rememberMe) {
        const { credentialsStore } = await import('./core/storage/credentialsStorage')
        await credentialsStore.saveCredentials({ studentId, password })
      } else {
        const { credentialsStore } = await import('./core/storage/credentialsStorage')
        await credentialsStore.clearCredentials()
      }
      
      setSession(nextSession!)
      await loadAppData(undefined, true)
    } catch (error) {
      const message = messageFromError(error)
      setLoginError(message)
      if (api.getLoginChallenge) {
        await loadLoginChallenge(message)
      }
    } finally {
      setLoginBusy(false)
    }
  }

  const refresh = async () => {
    setIsRefreshing(true)
    try {
      await loadAppData(selectedSemester, true)
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        if (error.message === 'CAPTCHA_FAILED') {
          setAutoCaptchaFailed(true)
          await loadLoginChallenge('驗證碼自動辨識連續失敗，請手動登入')
        } else {
          await loadLoginChallenge(error.message)
        }
      } else {
        setAppError(messageFromError(error))
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  const changeSemester = async (semesterId: string) => {
    setSelectedSemester(semesterId)
    setIsRefreshing(true)
    try {
      await loadAppData(semesterId, true)
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        if (error.message === 'CAPTCHA_FAILED') {
          setAutoCaptchaFailed(true)
          await loadLoginChallenge('驗證碼自動辨識連續失敗，請手動登入')
        } else {
          await loadLoginChallenge(error.message)
        }
      } else {
        setAppError(messageFromError(error))
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  const openCourse = async (course: CourseSummary) => {
    setActiveCourse(course)
    if (courseFiles[course.id]) return
    setFileLoadingId(course.id)
    try {
      const files = await api.getCourseFiles(course.id)
      setCourseFiles((current) => ({ ...current, [course.id]: files }))
    } catch (error) {
      setAppError(messageFromError(error))
    } finally {
      setFileLoadingId(null)
    }
  }

  const logout = async () => {
    dataRequestRef.current += 1
    await authStore.clearSession()
    const { credentialsStore } = await import('./core/storage/credentialsStorage')
    await credentialsStore.clearCredentials()
    await clearPortalSession()
    await clearSemesterCache()
    semesterCacheRef.current.clear()
    setSession(null)
    applyData(null)
    setSelectedTab('timetable')
    setMoreView(null)
    setActiveCourse(null)
    await loadLoginChallenge()
  }

  const beginPortalReauthentication = async () => {
    dataRequestRef.current += 1
    await authStore.clearSession()
    await clearPortalSession()
    setSession(null)
    setMoreView(null)
    setLoginError(null)
    await loadLoginChallenge('海大 AIS 登入已過期，請重新登入')
  }

  const mergedSlots = useMemo(() => {
    if (!data?.timetable) return []
    const presets = data.timetable.slots || []
    const customs = customCourses[selectedSemester] || []
    const fullList = [...presets, ...customs]
    const deletedForSem = deletedCourses[selectedSemester] || []
    return fullList.filter((c) => {
      const key = `${c.day}_${c.section}_${c.courseTitle}`
      return !deletedForSem.includes(key)
    })
  }, [data?.timetable, customCourses, deletedCourses, selectedSemester])

  const mergedGrades = useMemo(() => {
    if (!data?.grades) return []
    const presets = data.grades || []
    const customs = customGrades[selectedSemester] || []
    const fullList = [...presets, ...customs]
    const deletedForSem = deletedGrades[selectedSemester] || []
    return fullList.filter((g) => {
      return !deletedForSem.includes(g.id)
    })
  }, [data?.grades, customGrades, deletedGrades, selectedSemester])

  const personalCalendarEvents = useMemo(
    () => data ? personalEventsForStudent(personalCalendarStore, data.profile.id) : [],
    [data, personalCalendarStore],
  )

  const mergedCalendarEvents = useMemo(
    () => [...(data?.calendar ?? []), ...personalCalendarEvents].sort((a, b) =>
      `${a.startsOn}-${a.time ?? ''}-${a.title}`.localeCompare(
        `${b.startsOn}-${b.time ?? ''}-${b.title}`,
      ),
    ),
    [data?.calendar, personalCalendarEvents],
  )

  const calculatedCreditsAndGpa = useMemo(() => {
    const passed = mergedGrades.filter((grade) =>
      hasPassingResult(grade.score, grade.letter),
    )
    const totalEarned = passed.reduce((total, grade) => total + grade.credits, 0)
    const requiredEarned = passed
      .filter((grade) => grade.required)
      .reduce((total, grade) => total + grade.credits, 0)

    let gpaSum = 0
    let gpaCredits = 0
    mergedGrades.forEach((g) => {
      const pts = scoreToGpa(g.score, g.letter)
      if (pts !== null) {
        gpaSum += pts * g.credits
        gpaCredits += g.credits
      }
    })

    const gpa = gpaCredits > 0 ? (gpaSum / gpaCredits) : 0.0
    return {
      totalEarned,
      requiredEarned,
      electiveEarned: totalEarned - requiredEarned,
      gpa,
    }
  }, [mergedGrades])

  if (isPinLocked) {
    return (
      <PinUnlockScreen 
        onUnlocked={async () => {
          setIsPinLocked(false)
          setIsBooting(true)
          const savedSession = await authStore.getSession()
          setSession(savedSession)
          if (savedSession) {
            await loadAppData()
          } else {
            await loadLoginChallenge()
          }
          setIsBooting(false)
        }} 
        onForgotPin={() => {
          setIsPinLocked(false)
          authStore.clearSession()
          setSession(null)
          import('./core/storage/credentialsStorage').then(({ credentialsStore }) => {
            credentialsStore.clearCredentials()
          })
          loadLoginChallenge()
        }}
      />
    )
  }

  if (showPinSetup) {
    return (
      <PinSetupScreen 
        onSetupComplete={() => setShowPinSetup(false)} 
        onCancel={() => setShowPinSetup(false)} 
      />
    )
  }

  if (showPinVerifyForDisable) {
    return (
      <PinUnlockScreen 
        onUnlocked={async (pin) => {
          const { credentialsStore } = await import('./core/storage/credentialsStorage')
          await credentialsStore.removePin(pin)
          setShowPinVerifyForDisable(false)
        }} 
        onForgotPin={() => {
          setShowPinVerifyForDisable(false)
          alert('請先登出並清除資料再重設 PIN 碼')
        }}
      />
    )
  }

  if (isBooting) return <LoadingScreen />

  if (!session || !data) {
    return (
      <LoginScreen
        busy={loginBusy}
        challengeBusy={challengeBusy}
        error={loginError || appError}
        challenge={loginChallenge}
        autoCaptchaFailed={autoCaptchaFailed}
        onRefreshChallenge={() => void loadLoginChallenge()}
        onLogin={handleLogin}
      />
    )
  }

  const title = moreView ? moreViewTitle(moreView) : tabTitles[selectedTab]

  return (
    <div className="app app-dark">
      <div className="app-shell">
        <header className="app-header">
          <div className="header-main">
            {moreView ? (
              <button className="header-icon" type="button" aria-label="返回" onClick={() => setMoreView(null)}>
                <ChevronLeft size={24} />
              </button>
            ) : null}
            <h1>{title}</h1>
          </div>
          <div className="header-actions">
            <button
              className="header-icon"
              type="button"
              aria-label="重新整理"
              disabled={isRefreshing}
              onClick={() => void refresh()}
            >
              <RefreshCw className={isRefreshing ? 'spin' : ''} size={22} />
            </button>
            {!moreView ? (
              <div className="header-overflow">
                <button
                  className="header-icon"
                  type="button"
                  aria-label="更多操作"
                  aria-expanded={headerMenuOpen}
                  onClick={() => setHeaderMenuOpen((open) => !open)}
                >
                  <MoreVertical size={24} />
                </button>
                {headerMenuOpen ? (
                  <div className="header-menu" role="menu">
                    {selectedTab === 'timetable' ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setHeaderMenuOpen(false)
                          setIsAddCourseOpen(true)
                        }}
                      >
                        <Plus size={17} />
                        <span>新增自訂課程</span>
                      </button>
                    ) : null}
                    {selectedTab === 'grades' ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setHeaderMenuOpen(false)
                          setIsAddGradeOpen(true)
                        }}
                      >
                        <Plus size={17} />
                        <span>新增模擬成績</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setHeaderMenuOpen(false)
                        setSelectedTab('more')
                      }}
                    >
                      <Menu size={17} />
                      <span>開啟其它功能</span>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </header>

        {(selectedTab === 'timetable' || selectedTab === 'grades') && !moreView ? (
          <StudentStrip
            profile={data.profile}
            semesters={data.semesters}
            selectedSemester={selectedSemester}
            onSemesterChange={changeSemester}
            timetableViewMode={selectedTab === 'timetable' ? timetableViewMode : undefined}
            onTimetableViewModeChange={
              selectedTab === 'timetable'
                ? (mode) => {
                    setTimetableViewMode(mode)
                    try {
                      localStorage.setItem(TIMETABLE_VIEW_STORAGE_KEY, mode)
                    } catch {
                      // The timetable still works when storage is unavailable.
                    }
                  }
                : undefined
            }
          />
        ) : null}

        <main className="main-content">
          {appError ? (
            <div className="error-banner">
              <AlertCircle size={18} />
              <span>{appError}</span>
            </div>
          ) : null}

          <div className="view-transition" key={moreView ? `more-${moreView}` : selectedTab}>
            {moreView ? (
              <MoreSubview
                data={data}
                view={moreView}
                onLogout={logout}
                onReauthenticate={beginPortalReauthentication}
                loadPortalMenu={api.getPortalSystemMenu}
                onOpenPortalPage={api.openPortalSystemPage}
                onEnablePin={() => setShowPinSetup(true)}
                onDisablePin={() => setShowPinVerifyForDisable(true)}
                hasPin={hasPin}
              />
            ) : selectedTab === 'timetable' ? (
              <TimetableScreen
                slots={mergedSlots}
                viewMode={timetableViewMode}
                onOpenCourse={(slot) => void openCourse(coursesFromTimetable([slot])[0])}
              />
            ) : selectedTab === 'calendar' ? (
              <CalendarScreen
                events={mergedCalendarEvents}
                onDeleteEvent={(id) => {
                  const event = personalCalendarEvents.find((candidate) => candidate.id === id)
                  if (!event || !confirm(`確定要刪除「${event.title}」嗎？`)) return
                  const nextEvents = personalCalendarEvents.filter((candidate) => candidate.id !== id)
                  const nextStore = { ...personalCalendarStore }
                  if (nextEvents.length) {
                    nextStore[data.profile.id] = nextEvents
                  } else {
                    delete nextStore[data.profile.id]
                  }
                  savePersonalCalendarStore(nextStore)
                }}
                onRequestAdd={(date) => {
                  setCalendarEventDate(date)
                  setIsAddCalendarEventOpen(true)
                }}
              />
            ) : selectedTab === 'grades' ? (
              <GradesScreen
                credits={calculatedCreditsAndGpa}
                grades={mergedGrades}
                onDeleteGrade={(id) => {
                  if (!confirm('確定要刪除這筆模擬成績嗎？')) return
                  const currentDeleted = deletedGrades[selectedSemester] || []
                  const nextDeleted = [...currentDeleted, id]
                  const nextCustom = (customGrades[selectedSemester] || []).filter((g) => g.id !== id)
                  saveDeletedGrades({ ...deletedGrades, [selectedSemester]: nextDeleted })
                  saveCustomGrades({ ...customGrades, [selectedSemester]: nextCustom })
                }}
              />
            ) : selectedTab === 'clock' ? (
              <ClockScreen
                alarms={alarms}
                onSaveAlarms={saveAlarms}
              />
            ) : (
              <MoreScreen
                avatarUrl={customAvatar}
                data={data}
                onAvatarChange={saveCustomAvatar}
                onLogout={logout}
                onOpen={setMoreView}
              />
            )}
          </div>
        </main>

        {!moreView ? (
          <nav className="bottom-nav" aria-label="主功能">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  className={`nav-button ${selectedTab === tab.key ? 'active' : ''}`}
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setHeaderMenuOpen(false)
                    setSelectedTab(tab.key)
                    setActiveCourse(null)
                  }}
                >
                  <Icon size={24} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        ) : null}

        {activeCourse ? (
          <CourseSheet
            course={activeCourse}
            files={courseFiles[activeCourse.id] ?? []}
            loading={fileLoadingId === activeCourse.id}
            onClose={() => setActiveCourse(null)}
            onDeleteCourse={(courseTitle) => {
              if (!confirm(`確定要從課表中刪除「${courseTitle}」嗎？`)) return
              const currentDeleted = deletedCourses[selectedSemester] || []
              const targetSlot = mergedSlots.find((s) => s.courseTitle === courseTitle)
              if (targetSlot) {
                const key = `${targetSlot.day}_${targetSlot.section}_${courseTitle}`
                const nextDeleted = [...currentDeleted, key]
                saveDeletedCourses({ ...deletedCourses, [selectedSemester]: nextDeleted })
                const nextCustom = (customCourses[selectedSemester] || []).filter((s) => s.courseTitle !== courseTitle)
                saveCustomCourses({ ...customCourses, [selectedSemester]: nextCustom })
              }
              setActiveCourse(null)
            }}
          />
        ) : null}

        {isAddCourseOpen ? (
          <AddCourseModal
            onClose={() => setIsAddCourseOpen(false)}
            onSave={(name, code, teacher, room, day, period) => {
              const newSlot: TimetableSlot = {
                id: `custom-${Date.now()}`,
                courseId: `custom-${Date.now()}`,
                courseCode: code || 'CUSTOM',
                courseTitle: name,
                instructor: teacher,
                classroom: room,
                day,
                startsAt: periods[period]?.time || '08:20',
                endsAt: '',
                section: String(period),
                credits: 2,
                color: ['#176db9', '#0a8f68', '#7c3aed', '#c45616', '#d81b4e'][Math.floor(Math.random() * 5)],
              }
              const currentCustom = customCourses[selectedSemester] || []
              saveCustomCourses({ ...customCourses, [selectedSemester]: [...currentCustom, newSlot] })
              setIsAddCourseOpen(false)
            }}
          />
        ) : null}

        {isAddGradeOpen ? (
          <AddGradeModal
            onClose={() => setIsAddGradeOpen(false)}
            onSave={(name, credits, score, required, category) => {
              const newGrade: Grade = {
                id: `custom-grade-${Date.now()}`,
                courseId: `custom-grade-${Date.now()}`,
                courseTitle: name,
                semester: selectedSemester,
                credits,
                score,
                required,
                category,
              }
              const currentCustom = customGrades[selectedSemester] || []
              saveCustomGrades({ ...customGrades, [selectedSemester]: [...currentCustom, newGrade] })
              setIsAddGradeOpen(false)
            }}
          />
        ) : null}

        {isAddCalendarEventOpen ? (
          <AddCalendarEventModal
            initialDate={calendarEventDate}
            onClose={() => setIsAddCalendarEventOpen(false)}
            onSave={(draft) => {
              const event: CalendarEvent = {
                id: `personal-calendar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                ...draft,
                source: 'personal',
              }
              const currentEvents = personalEventsForStudent(personalCalendarStore, data.profile.id)
              savePersonalCalendarStore({
                ...personalCalendarStore,
                [data.profile.id]: [...currentEvents, event],
              })
              setIsAddCalendarEventOpen(false)
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

function StudentStrip({
  onSemesterChange,
  onTimetableViewModeChange,
  profile,
  selectedSemester,
  semesters,
  timetableViewMode,
}: {
  onSemesterChange: (semesterId: string) => Promise<void>
  onTimetableViewModeChange?: (mode: 'grid' | 'list') => void
  profile: StudentProfile
  selectedSemester: string
  semesters: Semester[]
  timetableViewMode?: 'grid' | 'list'
}) {
  return (
    <div className="student-strip">
      <div className="student-identity">
        <strong>{profile.id}</strong>
      </div>
      <div className="student-strip-controls">
        {timetableViewMode && onTimetableViewModeChange ? (
          <div className="timetable-view-switch" role="group" aria-label="課表顯示方式">
            <button
              className={timetableViewMode === 'grid' ? 'active' : ''}
              type="button"
              aria-label="格狀課表"
              aria-pressed={timetableViewMode === 'grid'}
              title="格狀課表"
              onClick={() => onTimetableViewModeChange('grid')}
            >
              <LayoutGrid size={20} />
            </button>
            <button
              className={timetableViewMode === 'list' ? 'active' : ''}
              type="button"
              aria-label="條列課表"
              aria-pressed={timetableViewMode === 'list'}
              title="條列課表"
              onClick={() => onTimetableViewModeChange('list')}
            >
              <ListIcon size={21} />
            </button>
          </div>
        ) : null}
        <label className="semester-select">
          <span className="sr-only">學期</span>
          <select
            value={selectedSemester}
            onChange={(event) => void onSemesterChange(event.target.value)}
          >
            {semesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.id}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}






export default App
