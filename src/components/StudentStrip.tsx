import { LayoutGrid, List as ListIcon } from 'lucide-react'
import type { Semester } from '../types'
import { useStudentProfile, useSemesters } from '../core/api/hooks'
import { useAppStore } from '../core/store/useAppStore'
import { useLocation } from 'react-router-dom'

export function StudentStrip() {
  const { data: profile } = useStudentProfile()
  const { data: semesters = [] } = useSemesters()
  const location = useLocation()

  const {
    selectedSemester,
    setSelectedSemester,
    timetableViewMode,
    setTimetableViewMode,
  } = useAppStore()

  const isTimetable = location.pathname.startsWith('/app/timetable')

  if (!profile) return null

  return (
    <div className="student-strip">
      <div className="student-identity">
        <strong>{profile.id}</strong>
      </div>
      <div className="student-strip-controls">
        {isTimetable && (
          <div className="timetable-view-switch" role="group" aria-label="課表顯示方式">
            <button
              className={timetableViewMode === 'grid' ? 'active' : ''}
              type="button"
              aria-label="格狀課表"
              aria-pressed={timetableViewMode === 'grid'}
              title="格狀課表"
              onClick={() => setTimetableViewMode('grid')}
            >
              <LayoutGrid size={20} />
            </button>
            <button
              className={timetableViewMode === 'list' ? 'active' : ''}
              type="button"
              aria-label="條列課表"
              aria-pressed={timetableViewMode === 'list'}
              title="條列課表"
              onClick={() => setTimetableViewMode('list')}
            >
              <ListIcon size={21} />
            </button>
          </div>
        )}
        <label className="semester-select">
          <span className="sr-only">學期</span>
          <select
            value={selectedSemester ?? ''}
            onChange={(event) => setSelectedSemester(event.target.value)}
          >
            {semesters.map((semester: Semester) => (
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
