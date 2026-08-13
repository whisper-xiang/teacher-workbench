import type { RouteId, WorkbenchData } from '../data/types'

export type SearchResult = {
  id: string
  title: string
  meta: string
  group: string
  route: RouteId
  param?: string
}

const PAGE_ENTRIES: { id: RouteId; label: string }[] = [
  { id: 'overview', label: '工作概览' },
  { id: 'calendar', label: '日程与值班' },
  { id: 'tasks', label: '教学看板' },
  { id: 'reminders', label: '通知提醒' },
  { id: 'courses', label: '课程与排课' },
  { id: 'students', label: '学生与评价' },
  { id: 'resources', label: '教学资源库' },
  { id: 'news', label: '热点资讯' },
  { id: 'tools', label: '工具箱' },
  { id: 'settings', label: '设置与备份' },
]

function push(
  list: SearchResult[],
  item: Omit<SearchResult, 'id'> & { id?: string },
  suffix: string,
) {
  list.push({ ...item, id: item.id ?? `${item.route}-${suffix}` })
}

export function buildSearchIndex(data: WorkbenchData): SearchResult[] {
  const results: SearchResult[] = []

  PAGE_ENTRIES.forEach((page) => {
    push(results, { title: page.label, meta: '页面导航', group: '页面', route: page.id }, page.id)
  })

  data.courses.forEach((course) => {
    push(
      results,
      {
        id: `course-${course.id}`,
        title: course.name,
        meta: `${course.code} · ${course.className} · ${course.weeks}`,
        group: '课程',
        route: 'courses',
      },
      course.id,
    )
  })

  data.students.forEach((student) => {
    push(
      results,
      {
        id: `student-${student.id}`,
        title: student.name,
        meta: `${student.number} · ${student.className} · ${student.status}`,
        group: '学生',
        route: 'students',
        param: student.courseId,
      },
      student.id,
    )
  })

  data.tasks.forEach((task) => {
    push(
      results,
      {
        id: `task-${task.id}`,
        title: task.title,
        meta: `${task.course} · ${task.kind} · ${task.due}`,
        group: '看板任务',
        route: 'tasks',
      },
      task.id,
    )
  })

  data.resources.forEach((resource) => {
    push(
      results,
      {
        id: `resource-${resource.id}`,
        title: resource.title,
        meta: `${resource.course} · ${resource.type} · ${resource.tags.join('、')}`,
        group: '教学资源',
        route: 'resources',
      },
      resource.id,
    )
  })

  data.news.forEach((item) => {
    push(
      results,
      {
        id: `news-${item.id}`,
        title: item.title,
        meta: `${item.source} · ${item.category}`,
        group: '热点资讯',
        route: 'news',
      },
      item.id,
    )
  })

  data.tools.forEach((tool) => {
    push(
      results,
      {
        id: `tool-${tool.id}`,
        title: tool.name,
        meta: `${tool.category} · ${tool.description}`,
        group: '工具箱',
        route: 'tools',
      },
      tool.id,
    )
  })

  data.reminders.forEach((reminder) => {
    push(
      results,
      {
        id: `reminder-${reminder.id}`,
        title: reminder.title,
        meta: reminder.note || reminder.scheduledAt,
        group: '通知提醒',
        route: 'reminders',
      },
      reminder.id,
    )
  })

  data.events.forEach((event) => {
    push(
      results,
      {
        id: `event-${event.id}`,
        title: event.title,
        meta: `${event.date} · ${event.detail}`,
        group: '日程',
        route: 'calendar',
      },
      event.id,
    )
  })

  data.assignments.forEach((assignment) => {
    const course = data.courses.find((item) => item.id === assignment.courseId)
    push(
      results,
      {
        id: `assignment-${assignment.id}`,
        title: assignment.title,
        meta: `${course?.name ?? '课程'} · 截止 ${assignment.due.slice(0, 10)}`,
        group: '作业',
        route: 'students',
        param: assignment.courseId,
      },
      assignment.id,
    )
  })

  return results
}

export function searchWorkbench(index: SearchResult[], query: string, limit = 24): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  return index
    .filter((item) => `${item.title}${item.meta}${item.group}`.toLowerCase().includes(q))
    .slice(0, limit)
}

export function groupSearchResults(items: SearchResult[]): Map<string, SearchResult[]> {
  const map = new Map<string, SearchResult[]>()
  for (const item of items) {
    const bucket = map.get(item.group) ?? []
    bucket.push(item)
    map.set(item.group, bucket)
  }
  return map
}
