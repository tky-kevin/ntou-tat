import React, { useState } from 'react'
import { X } from 'lucide-react'
import { periods, getPeriodLabel } from '../timetable/utils'

export function AddCourseModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (name: string, code: string, teacher: string, room: string, day: number, period: number) => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [teacher, setTeacher] = useState('')
  const [room, setRoom] = useState('')
  const [day, setDay] = useState(1)
  const [period, setPeriod] = useState(1)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      alert('請輸入課程名稱！')
      return
    }
    onSave(name.trim(), code.trim(), teacher.trim(), room.trim(), day, period)
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="course-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <button className="sheet-close" type="button" aria-label="關閉" onClick={onClose}>
          <X size={21} />
        </button>
        <h2>新增自訂課程</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px', marginTop: '14px' }}>
          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>課程名稱</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ padding: '8px 10px', background: '#252a30', border: '1px solid var(--line-strong)', borderRadius: '6px', color: '#fff' }}
              placeholder="例如：熱力學（一）"
            />
          </label>
          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>課號 (選填)</span>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ padding: '8px 10px', background: '#252a30', border: '1px solid var(--line-strong)', borderRadius: '6px', color: '#fff' }}
              placeholder="例如：B7202S42"
            />
          </label>
          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>授守教師 (選填)</span>
            <input
              type="text"
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              style={{ padding: '8px 10px', background: '#252a30', border: '1px solid var(--line-strong)', borderRadius: '6px', color: '#fff' }}
              placeholder="例如：莊程媐 助理教授"
            />
          </label>
          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>教室地點 (選填)</span>
            <input
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              style={{ padding: '8px 10px', background: '#252a30', border: '1px solid var(--line-strong)', borderRadius: '6px', color: '#fff' }}
              placeholder="例如：MEB429"
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <label style={{ display: 'grid', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>星期</span>
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                style={{ padding: '8px', background: '#252a30', border: '1px solid var(--line-strong)', borderRadius: '6px', color: '#fff' }}
              >
                <option value={1}>週一</option>
                <option value={2}>週二</option>
                <option value={3}>週三</option>
                <option value={4}>週四</option>
                <option value={5}>週五</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>節數</span>
              <select
                value={period}
                onChange={(e) => setPeriod(Number(e.target.value))}
                style={{ padding: '8px', background: '#252a30', border: '1px solid var(--line-strong)', borderRadius: '6px', color: '#fff' }}
              >
                {periods.map((p) => (
                  <option key={p.value} value={p.value}>
                    第 {getPeriodLabel(p.value)} 節 ({p.time})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="submit"
            style={{
              padding: '10px 20px',
              background: 'var(--brand)',
              color: '#fff',
              fontWeight: 800,
              borderRadius: '6px',
              marginTop: '8px',
            }}
          >
            儲存自訂課程
          </button>
        </form>
      </section>
    </div>
  )
}
