import type { Assignment, CalendarEvent, Course, WorkbenchData, WorkJournalNote } from './types'
import { inferDeadlineLink } from '../lib/deadlines'
import { iso, shift } from '../lib/dates'

/**
 * 闭环同步层：让日历事件成为「派生数据」。
 *
 * 约定：id 以 `course-` 开头的日历事件由课程数据托管，
 *       id 以 `deadline-` 开头的日历事件由作业数据托管，
 *       id 以 `journal-` 开头的日历事件由随手记托管。
 * 调课：删除某一节课后，id 记入 hiddenCourseEventIds，本学期不再自动生成该节。
 */

export const COURSE_EVENT_PREFIX = 'course-'
export const DEADLINE_EVENT_PREFIX = 'deadline-'
export const JOURNAL_EVENT_PREFIX = 'journal-'

/** 节次 → times 索引：1-2节08:00 / 3-4节10:00 / 5-6节14:00 / 7-8节16:00 / 晚上19:00 */
const SECTION_TO_START = [0, 2, 6, 8, 9] as const

export function termStartMonday(weekStart: string, weekNumber: number) {
  const week = Math.max(1, weekNumber || 1)
  return shift(new Date(`${weekStart}T12:00:00`), -(week - 1) * 7)
}

/** 由课程排课生成整学期每周重复的课程事件 */
export function syncCourseEvents(
  events: CalendarEvent[],
  courses: Course[],
  weekStart: string,
  weekNumber = 1,
  hiddenIds: string[] = [],
): CalendarEvent[] {
  const managed = events.filter((item) => !item.id.startsWith(COURSE_EVENT_PREFIX))
  const hidden = new Set(hiddenIds)
  const previous = new Map(events.filter((item) => item.id.startsWith(COURSE_EVENT_PREFIX)).map((item) => [item.id, item]))
  const termMonday = termStartMonday(weekStart, weekNumber)

  const generated: CalendarEvent[] = []
  for (const course of courses) {
    const totalWeeks = Math.max(1, course.totalWeeks || 16)
    for (const session of course.sessions ?? []) {
      if (!Number.isFinite(session.day) || !Number.isFinite(session.section)) continue
      for (let week = 1; week <= totalWeeks; week++) {
        const id = `${COURSE_EVENT_PREFIX}${course.id}-${session.day}-${session.section}-w${week}`
        if (hidden.has(id)) continue
        const weekMonday = shift(termMonday, (week - 1) * 7)
        generated.push({
          id,
          date: iso(shift(weekMonday, session.day)),
          start: SECTION_TO_START[Math.min(session.section, SECTION_TO_START.length - 1)] ?? 0,
          length: 2,
          title: course.name,
          detail: `${course.className} · ${session.room} · 第${week}周`,
          kind: 'course',
          major: course.major ?? null,
          done: previous.get(id)?.done,
        })
      }
    }
  }

  const seen = new Set<string>()
  const unique = generated.filter((item) => {
    const key = `${item.date}-${item.start}-${item.id}`
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

function journalKeyword(note: WorkJournalNote) {
  const text = note.title.trim() || note.content.trim() || note.kind
  return text.length > 16 ? `${text.slice(0, 16)}…` : text
}

/** 当日结束后，把随手记以关键词落到对应日期 */
export function syncJournalEvents(events: CalendarEvent[], notes: WorkJournalNote[], now = new Date()): CalendarEvent[] {
  const managed = events.filter((item) => !item.id.startsWith(JOURNAL_EVENT_PREFIX))
  const previous = new Map(events.filter((item) => item.id.startsWith(JOURNAL_EVENT_PREFIX)).map((item) => [item.id, item]))
  const today = iso(now)
  const hour = now.getHours()
  const generated: CalendarEvent[] = notes
    .filter((note) => note.date < today || (note.date === today && hour >= 18))
    .map((note) => ({
      id: `${JOURNAL_EVENT_PREFIX}${note.id}`,
      date: note.date,
      start: 0,
      length: 1,
      title: journalKeyword(note),
      detail: note.content.trim() || note.kind,
      kind: 'journal' as const,
      major: null,
      linkTo: { route: 'journal' as const },
      done: previous.get(`${JOURNAL_EVENT_PREFIX}${note.id}`)?.done,
    }))
  return [...managed, ...generated]
}

export function syncDerivedEvents(
  data: Pick<WorkbenchData, 'events' | 'courses' | 'assignments' | 'workNotes' | 'hiddenCourseEventIds' | 'meta'>,
  now = new Date(),
): CalendarEvent[] {
  const hidden = data.hiddenCourseEventIds ?? []
  const withCourses = syncCourseEvents(data.events, data.courses, data.meta.weekStart, data.meta.weekNumber, hidden)
  const withDeadlines = syncAssignmentDeadlines(withCourses, data.assignments)
  return syncJournalEvents(withDeadlines, data.workNotes ?? [], now)
}
