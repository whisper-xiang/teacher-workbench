import type { Assignment, CalendarEvent, DeadlineLink, RouteId } from '../data/types'

export function deadlineLinkLabel(link: DeadlineLink): string {
  const labels: Partial<Record<RouteId, string>> = {
    students: '去录入 / 批改',
    resources: '打开资源库',
    courses: '打开课程档案',
    tasks: '打开教学看板',
    calendar: '查看日程',
  }
  return labels[link.route] ?? '前往处理'
}

export function inferDeadlineLink(
  event: Pick<CalendarEvent, 'id' | 'title' | 'detail'>,
  assignment?: Assignment,
): DeadlineLink | undefined {
  if (assignment) return { route: 'students', param: assignment.courseId }

  const text = `${event.title}${event.detail ?? ''}`
  if (/成绩|总评|录入|花名册|批改/.test(text)) return { route: 'students' }
  if (/实习|巡视材料/.test(text)) return { route: 'resources' }
  if (/课程方案|教案|教学设计|大纲/.test(text)) return { route: 'courses' }
  if (/作业/.test(text)) return { route: 'students' }
  return undefined
}
