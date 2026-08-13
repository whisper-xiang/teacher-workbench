import { currentCourseTopic } from '../lib/courses'
import { addDaysIso, diffDays, dueLabel, thisMondayIso, todayIso } from '../lib/dates'
import { createSeedData } from './seed'
import type {
  BoardPriority,
  BoardTask,
  CalendarEvent,
  Course,
  NewsItem,
  StudentRecord,
  TeachingResource,
  WorkbenchData,
} from './types'
import { inferMajorFromText } from './types'
import { syncAssignmentDeadlines, syncCourseEvents } from './sync'

export const STORAGE_KEY = 'teacher-workbench-data-v1'
const LEGACY_CALENDAR_KEY = 'teacher-calendar-events'
/** 旧版演示周起始日，加载时若仍处于演示模式则对齐到本周 */
export const LEGACY_DEMO_WEEK_START = '2025-05-12'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeCourse(course: Course): Course {
  const totalWeeks = course.totalWeeks ?? 16
  const currentWeek = course.currentWeek ?? (Math.round(((course.progress || 0) / 100) * totalWeeks) || 9)
  const weeklyTopics = Array.from({ length: totalWeeks }, (_, index) => course.weeklyTopics?.[index] ?? '')
  const topic = currentCourseTopic({ ...course, weeklyTopics, currentWeek }) || course.topic
  return {
    ...course,
    major: course.major ?? inferMajorFromText(`${course.className} ${course.name}`),
    credits: course.credits ?? 2,
    currentWeek,
    totalWeeks,
    sessions: course.sessions ?? [],
    weeklyTopics,
    topic,
  }
}

export function alignDataToWeekStart(data: WorkbenchData, nextWeekStart: string): WorkbenchData {
  const days = diffDays(data.meta.weekStart, nextWeekStart)
  const today = todayIso()
  const shiftIf = (value: string) => (days ? addDaysIso(value, days) : value)
  const assignments = data.assignments.map((item) => ({ ...item, due: shiftIf(item.due) }))
  const tasks = data.tasks.map((task) => {
    const dueDate = task.dueDate ? shiftIf(task.dueDate) : task.dueDate
    const keep = /已提交|已完成/.test(task.due)
    return {
      ...task,
      dueDate,
      due: keep ? task.due : dueDate ? dueLabel(dueDate, today) : task.due,
    }
  })
  const events = data.events
    .filter((item) => !item.id.startsWith('course-') && !item.id.startsWith('deadline-'))
    .map((item) => ({ ...item, date: shiftIf(item.date) }))

  return {
    ...data,
    meta: { ...data.meta, weekStart: nextWeekStart },
    assignments,
    tasks,
    dutyConfirmedDates: data.dutyConfirmedDates.map((date) => shiftIf(date)),
    events: syncAssignmentDeadlines(syncCourseEvents(events, data.courses, nextWeekStart), assignments),
  }
}

function normalizeStudent(student: StudentRecord): StudentRecord {
  return {
    ...student,
    major: student.major ?? inferMajorFromText(student.className || student.courseId),
    className: student.className || '未分班',
  }
}

function normalizeTask(task: BoardTask): BoardTask {
  const raw = (task as { priority?: string }).priority
  let priority: BoardPriority = 'low'
  if (raw === 'high' || raw === '紧急') priority = 'high'
  else if (raw === 'medium' || raw === '本周') priority = 'medium'
  else if (raw === 'low') priority = 'low'
  // 旧版「待审核」并入进行中
  const status = (task.status as string) === 'review' ? 'doing' : task.status
  return {
    ...task,
    status,
    priority,
    assignee: task.assignee?.trim() || '本人',
    major: task.major === undefined ? inferMajorFromText(task.course) : task.major,
  }
}

function normalizeResource(resource: TeachingResource): TeachingResource {
  return {
    ...resource,
    major: resource.major ?? inferMajorFromText(resource.course),
  }
}

function normalizeEvent(event: CalendarEvent): CalendarEvent {
  return {
    ...event,
    kind: event.kind || 'meeting',
    major: event.major ?? null,
    linkTo: event.linkTo,
    done: event.done,
  }
}

function normalizeNews(partial: Partial<WorkbenchData>) {
  const raw = partial.news ?? []
  const isLegacySeed = raw.length > 0 && raw.every((item) => !item.id.startsWith('rss-'))
  if (isLegacySeed) {
    return { news: [] as NewsItem[], newsBookmarks: [] as string[], newsRead: [] as string[] }
  }
  const ids = new Set(raw.map((item) => item.id))
  return {
    news: raw,
    newsBookmarks: (partial.newsBookmarks ?? []).filter((id) => ids.has(id)),
    newsRead: (partial.newsRead ?? []).filter((id) => ids.has(id)),
  }
}

function mergeWithSeed(partial: Partial<WorkbenchData> | null): WorkbenchData {
  const seed = createSeedData()
  if (!partial || partial.version !== 1) return seed

  const courses = (partial.courses ?? seed.courses).map(normalizeCourse)
  const students = (partial.students ?? seed.students).map(normalizeStudent)
  const assignments = partial.assignments ?? seed.assignments
  const meta = { ...seed.meta, ...partial.meta }

  // 日历中的课程/截止事件是派生数据：先清掉历史手写课程事件，再按课程与作业重建
  const baseEvents = (partial.events ?? seed.events).map(normalizeEvent).filter((item) => item.kind !== 'course')
  const events = syncAssignmentDeadlines(syncCourseEvents(baseEvents, courses, meta.weekStart), assignments)
  const { news, newsBookmarks, newsRead } = normalizeNews(partial)

  const merged: WorkbenchData = {
    ...seed,
    ...partial,
    version: 1,
    profile: { ...seed.profile, ...partial.profile },
    meta,
    events,
    dutyRoster: partial.dutyRoster?.length ? partial.dutyRoster : seed.dutyRoster,
    courses,
    students,
    assignments,
    tasks: (partial.tasks ?? seed.tasks).map(normalizeTask),
    resources: (partial.resources ?? seed.resources).map(normalizeResource),
    savedResources: partial.savedResources ?? seed.savedResources,
    news,
    newsBookmarks,
    newsRead,
    // If user still has old short tool list, prefer richer seed once.
    tools: (partial.tools?.length ?? 0) >= 10 ? partial.tools! : seed.tools,
    favoriteTools: partial.favoriteTools ?? seed.favoriteTools,
    grades: partial.grades ?? seed.grades,
    dutyConfirmedDates: partial.dutyConfirmedDates ?? seed.dutyConfirmedDates,
    reminders: partial.reminders?.length ? partial.reminders : seed.reminders,
    reminderSettings: { ...seed.reminderSettings, ...partial.reminderSettings },
    updatedAt: partial.updatedAt ?? new Date().toISOString(),
  }

  if (merged.meta.demoBanner && merged.meta.weekStart === LEGACY_DEMO_WEEK_START) {
    return alignDataToWeekStart(merged, thisMondayIso())
  }
  return merged
}

export function loadWorkbenchData(): WorkbenchData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<WorkbenchData>
      return mergeWithSeed(parsed)
    }

    const legacy = localStorage.getItem(LEGACY_CALENDAR_KEY)
    if (legacy) {
      const events = JSON.parse(legacy)
      const data = createSeedData()
      if (Array.isArray(events) && events.length) {
        // 旧版日程并入后，重新按课程/作业生成派生事件
        const merged = [...data.events, ...events.map(normalizeEvent)]
        data.events = syncAssignmentDeadlines(syncCourseEvents(merged, data.courses, data.meta.weekStart), data.assignments)
      }
      saveWorkbenchData(data)
      return data
    }
  } catch {
    /* fall through */
  }
  return createSeedData()
}

export function saveWorkbenchData(data: WorkbenchData): void {
  const next: WorkbenchData = { ...data, updatedAt: new Date().toISOString(), version: 1 }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function resetWorkbenchData(): WorkbenchData {
  const data = createSeedData()
  data.meta.demoBanner = true
  saveWorkbenchData(data)
  return data
}

export function exportWorkbenchData(data: WorkbenchData): string {
  return JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2)
}

export function importWorkbenchData(json: string): WorkbenchData {
  const parsed = JSON.parse(json) as unknown
  if (!isObject(parsed)) throw new Error('无效的备份文件')
  const data = mergeWithSeed(parsed as Partial<WorkbenchData>)
  saveWorkbenchData(data)
  return data
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function calcGradeTotal(usual: number, midterm: number, final: number): number {
  if (final > 0) return Math.round(usual * 0.3 + midterm * 0.3 + final * 0.4)
  const weight = 0.6
  return Math.round((usual * 0.3 + midterm * 0.3) / weight)
}
