import type { Assignment, CalendarEvent, Course } from './types'
import { inferDeadlineLink } from '../lib/deadlines'
import { iso, shift } from '../lib/dates'

/**
 * 闭环同步层：让日历事件成为「派生数据」。
 *
 * 约定：id 以 `course-` 开头的日历事件由课程数据托管，
 *       id 以 `deadline-` 开头的日历事件由作业数据托管。
 * 只要课程/作业变更，就调用对应同步函数重建托管事件，
 * 其余用户手动创建的日历事件（uid 生成的 id）一律保留。
 */

const COURSE_EVENT_PREFIX = 'course-'
const DEADLINE_EVENT_PREFIX = 'deadline-'

/** 节次 → times 索引：1-2节08:00 / 3-4节10:00 / 5-6节14:00 / 7-8节16:00 / 晚上19:00 */
const SECTION_TO_START = [0, 2, 6, 8, 9] as const

/** 由课程排课生成/更新日历中的课程事件（kind: course） */
export function syncCourseEvents(events: CalendarEvent[], courses: Course[], weekStart: string): CalendarEvent[] {
  const managed = events.filter((item) => !item.id.startsWith(COURSE_EVENT_PREFIX))
  const base = new Date(weekStart + 'T12:00:00')

  const generated: CalendarEvent[] = []
  for (const course of courses) {
    for (const session of course.sessions ?? []) {
      if (!Number.isFinite(session.day) || !Number.isFinite(session.section)) continue
      generated.push({
        id: `${COURSE_EVENT_PREFIX}${course.id}-${session.day}-${session.section}`,
        date: iso(shift(base, session.day)),
        start: SECTION_TO_START[Math.min(session.section, SECTION_TO_START.length - 1)] ?? 0,
        length: 2,
        title: course.name,
        detail: `${course.className} · ${session.room}`,
        kind: 'course',
        major: course.major ?? null,
      })
    }
  }

  // 同一时段只保留一门课，后写的课程覆盖先写的（课程页排课已保证唯一，这里兜底）
  const seen = new Set<string>()
  const unique = generated.filter((item) => {
    const key = `${item.date}-${item.start}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return [...managed, ...unique]
}

/** 由作业截止时间生成/更新日历中的截止事件（kind: deadline） */
export function syncAssignmentDeadlines(events: CalendarEvent[], assignments: Assignment[]): CalendarEvent[] {
  const managed = events.filter((item) => !item.id.startsWith(DEADLINE_EVENT_PREFIX))
  const previous = new Map(events.filter((item) => item.id.startsWith(DEADLINE_EVENT_PREFIX)).map((item) => [item.id, item]))

  const generated: CalendarEvent[] = []
  for (const assignment of assignments) {
    if (!assignment.due) continue
    const date = assignment.due.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const id = `${DEADLINE_EVENT_PREFIX}${assignment.id}`
    const prior = previous.get(id)
    generated.push({
      id,
      date,
      start: 0,
      length: 1,
      title: `${assignment.title}截止`,
      detail: assignment.description ? assignment.description.slice(0, 40) : '作业提交截止提醒',
      kind: 'deadline',
      major: assignment.major ?? null,
      linkTo: prior?.linkTo ?? inferDeadlineLink({ id, title: assignment.title, detail: assignment.description }, assignment),
      done: prior?.done,
    })
  }

  return [...managed, ...generated]
}
