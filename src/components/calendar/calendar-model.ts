import type { CalendarKind } from '../../data/types'

export const CALENDAR_KIND_LABELS: Record<CalendarKind, string> = {
  course: '课程',
  duty: '值班',
  meeting: '会议',
  patrol: '巡视',
  deadline: '截止',
  journal: '随手记',
}

export function isAllDayCalendarKind(kind: CalendarKind) {
  return kind === 'deadline' || kind === 'journal'
}
