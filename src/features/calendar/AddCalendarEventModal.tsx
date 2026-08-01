import React, { useState } from 'react'
import { X, Plus } from 'lucide-react'
import type { CalendarEventDraft } from '../../types'

export function AddCalendarEventModal({
  initialDate,
  onClose,
  onSave,
}: {
  initialDate: string
  onClose: () => void
  onSave: (event: CalendarEventDraft) => void
}) {
  const [title, setTitle] = useState('')
  const [startsOn, setStartsOn] = useState(initialDate)
  const [endsOn, setEndsOn] = useState(initialDate)
  const [time, setTime] = useState('')
  const [category, setCategory] = useState('個人')
  const [notes, setNotes] = useState('')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) {
      alert('請輸入事件名稱！')
      return
    }
    if (!startsOn || !endsOn) {
      alert('請選擇事件日期！')
      return
    }
    if (endsOn < startsOn) {
      alert('結束日期不能早於開始日期！')
      return
    }

    onSave({
      title: title.trim(),
      startsOn,
      endsOn,
      category,
      time: time || undefined,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section
        className="course-sheet calendar-event-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-event-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <button className="sheet-close" type="button" aria-label="關閉" onClick={onClose}>
          <X size={21} />
        </button>
        <h2 id="calendar-event-title">新增個人事件</h2>
        <form className="calendar-event-form" onSubmit={handleSubmit}>
          <label>
            <span>事件名稱</span>
            <input
              autoFocus
              maxLength={80}
              placeholder="例如：繳交期末報告"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <div className="calendar-form-pair">
            <label>
              <span>開始日期</span>
              <input
                type="date"
                value={startsOn}
                onChange={(event) => {
                  const nextStart = event.target.value
                  setStartsOn(nextStart)
                  if (endsOn < nextStart) setEndsOn(nextStart)
                }}
              />
            </label>
            <label>
              <span>結束日期</span>
              <input
                min={startsOn}
                type="date"
                value={endsOn}
                onChange={(event) => setEndsOn(event.target.value)}
              />
            </label>
          </div>

          <div className="calendar-form-pair">
            <label>
              <span>時間（選填）</span>
              <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </label>
            <label>
              <span>分類</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="個人">個人</option>
                <option value="課業">課業</option>
                <option value="社團">社團</option>
                <option value="生活">生活</option>
              </select>
            </label>
          </div>

          <label>
            <span>備註（選填）</span>
            <textarea
              maxLength={300}
              placeholder="地點、攜帶物品或其他提醒"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          <button className="calendar-event-save" type="submit">
            <Plus size={18} />
            <span>儲存事件</span>
          </button>
        </form>
      </section>
    </div>
  )
}
