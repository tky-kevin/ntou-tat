import type { TimetableSlot, CourseSummary } from '../../types'

export const weekdays = [
  { value: 1, short: '一' },
  { value: 2, short: '二' },
  { value: 3, short: '三' },
  { value: 4, short: '四' },
  { value: 5, short: '五' },
]

export const periods = [
  { value: 0, time: '06:20' },
  { value: 1, time: '08:20' },
  { value: 2, time: '09:20' },
  { value: 3, time: '10:20' },
  { value: 4, time: '11:15' },
  { value: 5, time: '12:10' },
  { value: 6, time: '13:10' },
  { value: 7, time: '14:10' },
  { value: 8, time: '15:10' },
  { value: 9, time: '16:05' },
  { value: 10, time: '17:30' },
  { value: 11, time: '18:30' },
  { value: 12, time: '19:25' },
  { value: 13, time: '20:20' },
  { value: 14, time: '21:15' },
]

export const getPeriodLabel = (val: number) => {
  if (val === 0) return '0'
  if (val >= 1 && val <= 4) return String(val)
  if (val === 5) return '中午'
  if (val >= 6 && val <= 10) return String(val - 1) // 6->5, 7->6, 8->7, 9->8, 10->9
  if (val >= 11 && val <= 15) return String(val - 1)
  return String(val)
}

export const coursesFromTimetable = (slots: TimetableSlot[]): CourseSummary[] => {
  const courses = new Map<string, CourseSummary>()
  slots.forEach((slot) => {
    if (!courses.has(slot.courseId)) {
      courses.set(slot.courseId, {
        id: slot.courseId,
        code: slot.courseCode,
        title: slot.courseTitle,
        instructor: slot.instructor,
        classroom: slot.classroom,
        credits: slot.credits,
        color: slot.color,
      })
    }
  })
  return [...courses.values()]
}

export const periodsForSlot = (slot: TimetableSlot) => {
  const parsed = slot.section.match(/\d+/g)?.map(Number).filter((value) => value >= 0 && value <= 14)
  if (parsed?.length) {
    const first = Math.min(...parsed)
    const last = Math.max(...parsed)
    return Array.from({ length: last - first + 1 }, (_, index) => first + index)
  }

  const start = periods.find((period) => period.time === slot.startsAt)?.value
  return start === undefined ? [] : [start]
}

const coursePalette = ['#acd6f4', '#eef0b3', '#b9dfc4', '#f1bcc8', '#cdbfee', '#b9dedc']

export const courseColor = (slot: TimetableSlot) => {
  const key = slot.courseId || slot.courseTitle
  const hash = [...key].reduce((total, character) => total + character.charCodeAt(0), 0)
  return coursePalette[hash % coursePalette.length]
}

export type TimetableBlock = {
  slot: TimetableSlot
  startPeriod: number
  endPeriod: number
}

export const timetableBlocks = (slots: TimetableSlot[]): TimetableBlock[] => {
  const expanded = new Map<string, { slot: TimetableSlot; period: number }>()
  slots.forEach((slot) => {
    periodsForSlot(slot).forEach((period) => {
      expanded.set(`${slot.day}-${slot.courseId}-${slot.classroom}-${period}`, { slot, period })
    })
  })

  const blocks: TimetableBlock[] = []
  ;[...expanded.values()]
    .sort((left, right) => left.slot.day - right.slot.day || left.period - right.period)
    .forEach(({ slot, period }) => {
      const previous = blocks.at(-1)
      if (
        previous &&
        previous.slot.day === slot.day &&
        previous.slot.courseId === slot.courseId &&
        previous.slot.classroom === slot.classroom &&
        previous.endPeriod + 1 === period
      ) {
        previous.endPeriod = period
        return
      }
      blocks.push({ slot, startPeriod: period, endPeriod: period })
    })
  return blocks
}

export const visibleTimetablePeriods = (blocks: TimetableBlock[]) => {
  if (!blocks.length) {
    return periods.filter((period) =>
      period.value >= 1 && period.value <= 10 && period.value !== 5,
    )
  }
  const first = Math.min(1, ...blocks.map((block) => block.startPeriod))
  const last = Math.max(10, ...blocks.map((block) => block.endPeriod))
  return periods.filter((period) =>
    period.value >= first && period.value <= last && period.value !== 5,
  )
}
