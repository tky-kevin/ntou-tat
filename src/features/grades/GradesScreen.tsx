import React from 'react'
import { GraduationCap, Trash2 } from 'lucide-react'
import type { Grade } from '../../types'
import { GPA_MAX } from '../../gpa'

export function GradesScreen({
  credits,
  grades,
  onDeleteGrade,
}: {
  credits: { totalEarned: number; requiredEarned: number; electiveEarned: number; gpa: number }
  grades: Grade[]
  onDeleteGrade: (id: string) => void
}) {
  const gpaPercent = Math.min(100, Math.max(0, (credits.gpa / GPA_MAX) * 100))

  return (
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
          <span style={{ color: 'var(--muted)', fontSize: '12px', fontWeight: 700 }}>GPA 試算與學分統計</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--active)' }}>{credits.gpa.toFixed(2)}</span>
            <span style={{ color: 'var(--muted)', fontSize: '14px' }}>/ 4.00</span>
          </div>
          <div style={{ color: 'var(--ink)', fontSize: '13px', display: 'flex', gap: '10px' }}>
            <span>已得：<strong>{credits.totalEarned}</strong> 學分</span>
            <span>必修：<strong>{credits.requiredEarned}</strong></span>
          </div>
        </div>

        {/* Conic progress circle wrapper */}
        <div
          className="gpa-circle-progress"
          style={{
            position: 'relative',
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background: `conic-gradient(var(--active) ${gpaPercent}%, #252a30 0)`,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: '#171a1f',
              display: 'grid',
              placeItems: 'center',
              fontSize: '11px',
              fontWeight: 800,
              color: 'var(--ink)',
            }}
          >
            {Math.round(gpaPercent)}%
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span className="section-label" style={{ margin: 0 }}>學期成績清單</span>
      </div>

      {grades.length ? (
        <div className="grade-list" style={{ borderTop: '1px solid var(--line)', background: '#111419', borderRadius: '8px', overflow: 'hidden' }}>
          {grades.map((grade) => (
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
                    onClick={() => onDeleteGrade(grade.id)}
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
          <span>請按右上角重新整理；模擬成績已移到三點選單</span>
        </div>
      )}
    </section>
  )
}
