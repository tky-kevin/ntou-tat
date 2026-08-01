import React, { useState, useRef, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays } from 'lucide-react'

import { useStudentProfile, useAppData } from '../../core/api/hooks'
import { useLocalDataStore } from '../../core/store/useLocalDataStore'
import { AddCalendarEventModal } from './AddCalendarEventModal'

export const monthLabel = (date: Date) =>
  `${date.getFullYear()}年${date.getMonth() + 1}月`

export const isoDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function CalendarScreen() {
  const { data: appData } = useAppData()
  const { data: profile } = useStudentProfile()
  
  const personalCalendarStore = useLocalDataStore(s => s.personalCalendarStore)
  const setPersonalCalendarStore = useLocalDataStore(s => s.setPersonalCalendarStore)
  
  const studentId = profile?.id ?? ''
  const personalEvents = studentId ? (personalCalendarStore[studentId] ?? []) : []
  
  const officialEvents = useMemo(() => appData?.calendar || [], [appData?.calendar])
  const events = useMemo(() => [...officialEvents, ...personalEvents], [officialEvents, personalEvents])

  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()))
  
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addDate, setAddDate] = useState(() => isoDate(new Date()))

  const swipeStart = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const suppressCalendarClick = useRef(false)
  const firstDayOffset = (cursor.getDay() + 6) % 7
  const totalDays = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstDayOffset + 1
    return day >= 1 && day <= totalDays ? day : null
  })
  const selectedEvents = events
    .filter((event) => {
      const end = event.endsOn || event.startsOn
      return selectedDate >= event.startsOn && selectedDate <= end
    })
    .sort((a, b) =>
      `${a.time ?? '99:99'}-${a.title}`.localeCompare(`${b.time ?? '99:99'}-${b.title}`),
    )

  const shiftMonth = (offset: number) => {
    setCursor((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + offset, 1)
      setSelectedDate(isoDate(next))
      return next
    })
  }

  const startMonthSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    swipeStart.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    }
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      // Synthetic pointer events and older WebViews may not expose an active pointer.
    }
  }
  const finishMonthSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start || start.pointerId !== event.pointerId) return

    const horizontal = event.clientX - start.x
    const vertical = event.clientY - start.y
    if (Math.abs(horizontal) < 48 || Math.abs(horizontal) <= Math.abs(vertical) * 1.2) return

    suppressCalendarClick.current = true
    window.setTimeout(() => {
      suppressCalendarClick.current = false
    }, 0)
    shiftMonth(horizontal < 0 ? 1 : -1)
  }

  const handleDeleteEvent = (id: string) => {
    const event = personalEvents.find((candidate) => candidate.id === id)
    if (!event || !confirm(`確定要刪除「${event.title}」嗎？`)) return
    const nextEvents = personalEvents.filter((candidate) => candidate.id !== id)
    
    setPersonalCalendarStore((prev) => {
      const nextStore = { ...prev }
      if (nextEvents.length) {
        nextStore[studentId] = nextEvents
      } else {
        delete nextStore[studentId]
      }
      return nextStore
    })
  }

  return (
    <section className="calendar-screen">
      <div
        className="calendar-swipe-area"
        onClickCapture={(event) => {
          if (!suppressCalendarClick.current) return
          event.preventDefault()
          event.stopPropagation()
        }}
        onPointerCancel={() => {
          swipeStart.current = null
        }}
        onPointerDown={startMonthSwipe}
        onPointerUp={finishMonthSwipe}
      >
        <div className="calendar-toolbar">
          <button
            className="plain-icon"
            type="button"
            aria-label="上個月"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft size={22} />
          </button>
          <strong>{monthLabel(cursor)}</strong>
          <div className="calendar-toolbar-actions">
            <button
              className="plain-icon"
              type="button"
              aria-label="下個月"
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight size={22} />
            </button>
            <button
              className="plain-icon calendar-add"
              type="button"
              aria-label="新增個人事件"
              title="新增個人事件"
              onClick={() => {
                setAddDate(selectedDate)
                setIsAddOpen(true)
              }}
            >
              <Plus size={21} />
            </button>
          </div>
        </div>
        <div className="calendar-weekdays">
          {['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="calendar-grid" key={`${cursor.getFullYear()}-${cursor.getMonth()}`}>
          {cells.map((day, index) => {
            if (!day) return <span className="calendar-blank" key={`blank-${index}`} />
            const date = isoDate(new Date(cursor.getFullYear(), cursor.getMonth(), day))
            const dateEvents = events.filter((event) => {
              const end = event.endsOn || event.startsOn
              return date >= event.startsOn && date <= end
            })
            const hasOfficialEvent = dateEvents.some((event) => event.source !== 'personal')
            const hasPersonalEvent = dateEvents.some((event) => event.source === 'personal')
            return (
              <button
                className={`calendar-day ${selectedDate === date ? 'selected' : ''}`}
                key={date}
                type="button"
                onClick={() => setSelectedDate(date)}
              >
                <span>{day}</span>
                {hasOfficialEvent || hasPersonalEvent ? (
                  <span className="calendar-markers" aria-hidden="true">
                    {hasOfficialEvent ? <i className="official" /> : null}
                    {hasPersonalEvent ? <i className="personal" /> : null}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
      <div className="agenda">
        <div className="section-label">{selectedDate}</div>
        {selectedEvents.length ? (
          selectedEvents.map((event) => (
            <div className={`agenda-row ${event.source === 'personal' ? 'personal' : 'official'}`} key={event.id}>
              <span className="agenda-dot" />
              <div className="agenda-copy">
                <strong>{event.title}</strong>
                <span>
                  {event.category}
                  {event.time ? ` · ${event.time}` : ''}
                  {event.endsOn && event.endsOn !== event.startsOn ? ` · 至 ${event.endsOn}` : ''}
                </span>
                {event.notes ? <p>{event.notes}</p> : null}
              </div>
              {event.source === 'personal' ? (
                <button
                  className="agenda-delete"
                  type="button"
                  aria-label={`刪除${event.title}`}
                  title="刪除個人事件"
                  onClick={() => handleDeleteEvent(event.id)}
                >
                  <Trash2 size={17} />
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <div className="inline-empty compact">
            <CalendarDays size={22} />
            <span>此日期沒有行事</span>
          </div>
        )}
      </div>

      {isAddOpen && (
        <AddCalendarEventModal
          initialDate={addDate}
          onClose={() => setIsAddOpen(false)}
          onSave={(event) => {
            setPersonalCalendarStore((prev) => {
              const prevStore = prev[studentId] || []
              return {
                ...prev,
                [studentId]: [...prevStore, { ...event, id: crypto.randomUUID(), source: 'personal' }],
              }
            })
            setIsAddOpen(false)
          }}
        />
      )}
    </section>
  )
}
