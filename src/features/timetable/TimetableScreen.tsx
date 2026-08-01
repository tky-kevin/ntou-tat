import React, { useState, useMemo, CSSProperties } from 'react'
import { ChevronRight, Clock3 } from 'lucide-react'
import type { TimetableSlot } from '../../types'
import { 
  weekdays, 
  timetableBlocks, 
  visibleTimetablePeriods, 
  courseColor, 
  getPeriodLabel,
  periodsForSlot,
  type TimetableBlock
} from './utils'

export function TimetableScreen({
  onOpenCourse,
  slots,
  viewMode,
}: {
  onOpenCourse: (slot: TimetableSlot) => void
  slots: TimetableSlot[]
  viewMode: 'grid' | 'list'
}) {
  const today = new Date().getDay()
  const [listDay, setListDay] = useState(() => (today >= 1 && today <= 5 ? today : 1))
  const blocks = useMemo(() => timetableBlocks(slots), [slots])
  const visiblePeriods = useMemo(() => visibleTimetablePeriods(blocks), [blocks])
  const periodRows = new Map(visiblePeriods.map((period, index) => [period.value, index + 2]))
  const cells = useMemo(() => {
    const expanded = new Map<string, { slot: TimetableSlot; period: number }>()
    slots.forEach((slot) => {
      periodsForSlot(slot).forEach((period) => {
        if (slot.day < 1 || slot.day > 5) return
        expanded.set(`${slot.day}-${period}-${slot.courseId}`, { slot, period })
      })
    })
    return [...expanded.values()]
  }, [slots])
  const listGroups = useMemo(() => {
    const grouped = new Map<number, TimetableBlock[]>()
    blocks
      .filter((block) => block.slot.day >= 1 && block.slot.day <= 7)
      .sort(
        (left, right) =>
          left.slot.day - right.slot.day ||
          left.startPeriod - right.startPeriod ||
          left.slot.courseTitle.localeCompare(right.slot.courseTitle, 'zh-TW'),
      )
      .forEach((block) => {
        const dayBlocks = grouped.get(block.slot.day) ?? []
        dayBlocks.push(block)
        grouped.set(block.slot.day, dayBlocks)
      })
    return [...grouped.entries()]
  }, [blocks])
  const selectedListBlocks = listGroups.find(([day]) => day === listDay)?.[1] ?? []

  return (
    <section className="timetable-screen">
      {viewMode === 'grid' ? (
        <div
          className="timetable-grid"
          role="grid"
          aria-label="每週課表"
          style={{ '--period-count': visiblePeriods.length } as CSSProperties}
        >
          <div className="grid-corner" role="columnheader" aria-label="節次" />
          {weekdays.map((day, dayIndex) => (
            <div
              className={`day-header ${today === day.value ? 'today' : ''}`}
              key={day.value}
              role="columnheader"
              style={{ gridColumn: dayIndex + 2 }}
            >
              {day.short}
            </div>
          ))}
          {visiblePeriods.map((period, periodIndex) => (
            <div
              className={`period-band ${periodIndex % 2 ? 'alternate' : ''}`}
              key={`band-${period.value}`}
              style={{ gridColumn: '1 / -1', gridRow: periodIndex + 2 }}
            />
          ))}
          {visiblePeriods.map((period, periodIndex) => (
            <div
              className="period-label"
              key={period.value}
              role="rowheader"
              style={{ gridColumn: 1, gridRow: periodIndex + 2 }}
            >
              <strong>{getPeriodLabel(period.value)}</strong>
              <span>{period.time}</span>
            </div>
          ))}
          {cells.map(({ slot, period }) => {
            const row = periodRows.get(period)
            if (!row) return null
            return (
              <button
                className="course-cell"
                key={`${slot.day}-${slot.courseId}-${period}`}
                style={{
                  '--course-color': courseColor(slot),
                  gridColumn: slot.day + 1,
                  gridRow: row,
                } as CSSProperties}
                type="button"
                onClick={() => onOpenCourse(slot)}
              >
                <strong>{slot.courseTitle}</strong>
                {slot.classroom ? <span>{slot.classroom}</span> : null}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="timetable-list" aria-label="條列課表">
          <div className="day-picker" role="tablist" aria-label="選擇星期">
            {weekdays.map((day) => (
              <button
                className={listDay === day.value ? 'active' : ''}
                key={day.value}
                type="button"
                role="tab"
                aria-selected={listDay === day.value}
                onClick={() => setListDay(day.value)}
              >
                {day.short}
              </button>
            ))}
          </div>
          <section className="timetable-list-day">
            <div className={`timetable-list-day-label ${today === listDay ? 'today' : ''}`}>
              <span>星期{weekdays.find((day) => day.value === listDay)?.short}</span>
              <small>{selectedListBlocks.length} 堂</small>
            </div>
            {selectedListBlocks.length ? (
              <div className="timetable-list-rows">
                {selectedListBlocks.map((block) => {
                  const periodLabel =
                    block.startPeriod === block.endPeriod
                      ? `第 ${getPeriodLabel(block.startPeriod)} 節`
                      : `第 ${getPeriodLabel(block.startPeriod)}-${getPeriodLabel(block.endPeriod)} 節`
                  const timeLabel = [block.slot.startsAt, block.slot.endsAt]
                    .filter(Boolean)
                    .join(' - ')
                  const locationLabel = [block.slot.instructor, block.slot.classroom]
                    .filter(Boolean)
                    .join(' · ')

                  return (
                    <button
                      className="timetable-list-row"
                      key={`${listDay}-${block.slot.courseId}-${block.startPeriod}`}
                      type="button"
                      onClick={() => onOpenCourse(block.slot)}
                    >
                      <span
                        className="timetable-list-color"
                        style={{ '--course-color': courseColor(block.slot) } as CSSProperties}
                        aria-hidden="true"
                      />
                      <span className="timetable-list-time">
                        <strong>{periodLabel}</strong>
                        {timeLabel ? <small>{timeLabel}</small> : null}
                      </span>
                      <span className="timetable-list-course">
                        <strong>{block.slot.courseTitle}</strong>
                        {locationLabel ? <small>{locationLabel}</small> : null}
                      </span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="inline-empty compact timetable-day-empty">
                <Clock3 size={22} />
                <span>星期{weekdays.find((day) => day.value === listDay)?.short}沒有課程</span>
              </div>
            )}
          </section>
        </div>
      )}
      {!slots.length ? (
        <div className="inline-empty timetable-empty">
          <Clock3 size={24} />
          <strong>尚未取得 AIS 課表</strong>
          <span>這個學期沒有課程，或 AIS 暫時沒有回傳選課課表</span>
        </div>
      ) : null}
    </section>
  )
}
