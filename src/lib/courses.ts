import { COURSE_EVENT_PREFIX } from '../data/sync'
import { inferMajorFromText, type CalendarEvent, type Course } from '../data/types'

export const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五'] as const
export const SECTIONS = ['1–2 节', '3–4 节', '5–6 节', '7–8 节', '晚上'] as const
export const SECTION_TIMES = ['08:00–09:40', '10:00–11:40', '14:00–15:40', '16:00–17:40', '19:00–20:40'] as const

export function matchCourseFromEvent(
  event: Pick<CalendarEvent, 'id' | 'kind' | 'title'>,
  courses: Course[],
) {
  if (event.kind !== 'course') return undefined
  return (
    courses.find((course) => event.id.startsWith(`${COURSE_EVENT_PREFIX}${course.id}-`)) ??
    courses.find((course) => course.name === event.title)
  )
}

export function currentCourseTopic(
  course: Pick<Course, 'weeklyTopics' | 'topic' | 'currentWeek'>,
  week = course.currentWeek,
): string {
  const planned = course.weeklyTopics?.[Math.max(0, (week || 1) - 1)]?.trim()
  return planned || course.topic?.trim() || ''
}

export function formatSession(session: { day: number; section: number; room: string }): string {
  const day = WEEK_DAYS[session.day] ?? '待定'
  const section = SECTIONS[session.section] ?? '时段'
  return `${day} ${section} · ${session.room}`
}

export function topicsFromText(text: string, totalWeeks: number): string[] {
  const lines = text.split('\n').map((line) => line.replace(/^\s*第?\s*\d+\s*周[:：]?\s*/, '').trim())
  const next = Array.from({ length: Math.max(1, totalWeeks) }, (_, index) => lines[index] ?? '')
  return next
}

export function topicsToText(topics: string[] | undefined): string {
  return (topics ?? []).join('\n')
}

export function withWeekTopic(course: Course, weekNumber: number, topic: string): Course {
  const total = Math.max(1, course.totalWeeks || 16)
  const week = Math.min(total, Math.max(1, weekNumber || course.currentWeek || 1))
  const trimmed = topic.trim()
  const weeklyTopics = Array.from({ length: total }, (_, index) => course.weeklyTopics?.[index] ?? '')
  if (trimmed) weeklyTopics[week - 1] = trimmed
  const current = weeklyTopics[week - 1]?.trim() || course.topic
  return {
    ...course,
    currentWeek: week,
    weeklyTopics,
    topic: current,
    progress: Math.round((week / total) * 100),
  }
}

export function createCourseFromSlot(input: {
  id: string
  classId: string
  name: string
  day: number
  section: number
  room: string
  weekNumber: number
  topic?: string
}): Course {
  const name = input.name.trim()
  const room = input.room.trim() || '待定教室'
  const totalWeeks = 16
  const week = Math.min(totalWeeks, Math.max(1, input.weekNumber || 1))
  const topic = input.topic?.trim() || ''
  const weeklyTopics = Array.from({ length: totalWeeks }, () => '')
  if (topic) weeklyTopics[week - 1] = topic
  return {
    id: input.id,
    name,
    code: 'EDU000',
    className: '待定班级',
    students: 0,
    weeks: `第 1–${totalWeeks} 周`,
    progress: Math.round((week / totalWeeks) * 100),
    status: '待更新',
    color: 'teal',
    major: inferMajorFromText(name),
    credits: 2,
    currentWeek: week,
    totalWeeks,
    topic: topic || undefined,
    weeklyTopics,
    sessions: [{ day: input.day, section: input.section, room }],
    classes: [
      {
        id: input.classId,
        name: '待定班级',
        studentCount: 0,
        currentWeek: week,
        nodes: [],
      },
    ],
  }
}
