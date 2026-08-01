import { useMemo } from 'react'
import { GraduationCap, Trash2 } from 'lucide-react'

import { useGrades } from '../../core/api/hooks'
import { useAppStore } from '../../core/store/useAppStore'
import { useLocalDataStore } from '../../core/store/useLocalDataStore'
import { StudentStrip } from '../../components/StudentStrip'
import { creditSummaryFromGrades } from './utils'

export function GradesScreen() {
  const { selectedSemester } = useAppStore()
  const { data: gradesData, isLoading } = useGrades(selectedSemester)

  const customGradesMap = useLocalDataStore(s => s.customGrades)
  const deletedGradesMap = useLocalDataStore(s => s.deletedGrades)
  const setDeletedGrades = useLocalDataStore(s => s.setDeletedGrades)

  const customGrades = selectedSemester ? (customGradesMap[selectedSemester] ?? []) : []
  const deletedGrades = selectedSemester ? (deletedGradesMap[selectedSemester] ?? []) : []

  const mergedGrades = useMemo(() => {
    const fetched = gradesData ?? []
    const all = [...fetched, ...customGrades]
    return all.filter(g => !deletedGrades.includes(g.id))
  }, [gradesData, customGrades, deletedGrades])

  const credits = useMemo(() => creditSummaryFromGrades(mergedGrades), [mergedGrades])



  const handleDeleteGrade = (id: string) => {
    if (!selectedSemester) return
    if (!confirm('確定要刪除這筆模擬成績嗎？')) return
    setDeletedGrades((prev) => ({
      ...prev,
      [selectedSemester]: [...(prev[selectedSemester] || []), id]
    }))
  }

  return (
    <>
      <StudentStrip />
      <section className="grades-screen" style={{ padding: '12px' }}>
        {/* Dynamic Glassmorphic GPA Dashboard Card */}
        <div
          className="gpa-dashboard-card"
          style={{
            background: 'rgba(23, 26, 31, 0.65)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div style={{ display: 'grid', gap: '6px' }}>
            <span style={{ color: 'var(--muted)', fontSize: '12px', fontWeight: 700 }}>學分統計</span>
            <div className="grades-summary">
              <div>
                <span>實得學分</span>
                <strong>{credits.totalEarned}</strong>
              </div>
            </div>
            <div style={{ color: 'var(--ink)', fontSize: '13px', display: 'flex', gap: '10px' }}>
              <span>必修：<strong>{credits.requiredEarned}</strong></span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="section-label" style={{ margin: 0 }}>學期成績清單</span>
        </div>

        {mergedGrades.length ? (
          <div className="grade-list" style={{ borderTop: '1px solid var(--line)', background: '#111419', borderRadius: '8px', overflow: 'hidden' }}>
            {mergedGrades.map((grade) => (
              <div className="grade-row" key={grade.id} style={{ borderBottom: '1px solid var(--line)', padding: '12px 14px' }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ display: 'block', fontSize: '14px', marginBottom: '3px' }}>{grade.courseTitle}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {grade.credits} 學分 · {grade.category} {grade.required ? '(必修)' : '(選修)'}
                    {grade.id.startsWith('custom-') ? ' · [模擬]' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <b style={{ fontSize: '20px', color: '#65c5ff' }}>{grade.score ?? grade.letter ?? '—'}</b>
                  {grade.id.startsWith('custom-') ? (
                    <button
                      type="button"
                      style={{
                        background: 'transparent',
                        color: 'var(--danger)',
                        padding: '6px',
                        borderRadius: '4px',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                      onClick={() => handleDeleteGrade(grade.id)}
                      aria-label="刪除模擬成績"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="inline-empty" style={{ background: '#111419', borderRadius: '8px' }}>
            <GraduationCap size={26} />
            <strong>尚未取得 AIS 成績</strong>
            <span>{isLoading ? '載入中...' : '沒有這學期的成績'}</span>
          </div>
        )}
      </section>
    </>
  )
}
