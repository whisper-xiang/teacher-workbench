import type { Course } from '../data/types'

export const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五'] as const
export const SECTIONS = ['1–2 节', '3–4 节', '5–6 节', '7–8 节', '晚上'] as const
export const SECTION_TIMES = ['08:00–09:40', '10:00–11:40', '14:00–15:40', '16:00–17:40', '19:00–20:40'] as const

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
