import type { CalendarEvent, Course, DutySlot } from '../data/types'
import { times } from './dates'

export const DUTY_EVENT_PREFIX = 'duty-'

export function isWeeklyDutySlot(slot: DutySlot) {
  return /值班|坐班/.test(`${slot.type}${slot.note}`)
}

export function dutyEventId(slotId: string, week: number) {
  return `${DUTY_EVENT_PREFIX}${slotId}-w${week}`
}

export function parseDutyEventId(id: string) {
  const matched = id.match(/^duty-(.+)-w(\d+)$/)
  if (!matched) return null
  return { slotId: matched[1], week: Number(matched[2]) }
}

export function isDutyEventId(id: string) {
  return parseDutyEventId(id) !== null
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function periodFromStart(start: number): DutySlot['period'] {
  if (start >= 9) return '晚上'
  if (start >= 6) return '下午'
  return '上午'
}

export function timeFromRange(start: number, length: number) {
  const from = times[Math.max(0, Math.min(start, times.length - 1))] ?? '08:00'
  const [hour, minute] = from.split(':').map(Number)
  const endTotal = hour * 60 + minute + Math.max(1, length) * 60
  return `${from}-${pad(Math.floor(endTotal / 60))}:${pad(endTotal % 60)}`
}

function nearestTimeIndex(hour: number, minute: number) {
  const value = hour * 60 + minute
  let best = 0
  let bestDiff = Infinity
  times.forEach((stamp, index) => {
    const [stampHour, stampMinute] = stamp.split(':').map(Number)
    const diff = Math.abs(stampHour * 60 + stampMinute - value)
    if (diff < bestDiff) {
      best = index
      bestDiff = diff
    }
  })
  return best
}

export function slotToStartLength(slot: DutySlot) {
  const matched = slot.time.match(/(\d{1,2}):(\d{2})\s*[-–~至到]\s*(\d{1,2}):(\d{2})/)
  if (matched) {
    const startHour = Number(matched[1])
    const startMinute = Number(matched[2])
    const endHour = Number(matched[3])
    const endMinute = Number(matched[4])
    const durationHours = Math.max(1, Math.round((endHour * 60 + endMinute - startHour * 60 - startMinute) / 60))
    return { start: nearestTimeIndex(startHour, startMinute), length: durationHours }
  }
  if (slot.period === '晚上') return { start: 9, length: 2 }
  if (slot.period === '下午') return { start: 6, length: 2 }
  return { start: 0, length: 4 }
}

export function weekdayToDutyDay(dateStr: string) {
  const day = new Date(`${dateStr}T12:00:00`).getDay()
  if (day < 1 || day > 5) return null
  return day
}

export function dutySlotFromEvent(event: CalendarEvent, slotId: string): DutySlot | null {
  const day = weekdayToDutyDay(event.date)
  if (day == null) return null
  return {
    id: slotId,
    day,
    period: periodFromStart(event.start),
    time: timeFromRange(event.start, event.length || 1),
    type: '办公室值班',
    location: event.detail.trim(),
    note: event.title.trim(),
  }
}

export function termDutyWeeks(courses: Course[]) {
  return Math.max(16, 1, ...courses.map((course) => course.totalWeeks || 0))
}
