import { createSeedData } from './seed'
import type {
  BoardPriority,
  BoardTask,
  CalendarEvent,
  Course,
  StudentRecord,
  TeachingResource,
  WorkbenchData,
} from './types'
import { inferMajorFromText } from './types'
import { syncAssignmentDeadlines, syncCourseEvents } from './sync'

export const STORAGE_KEY = 'teacher-workbench-data-v1'
const LEGACY_CALENDAR_KEY = 'teacher-calendar-events'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeCourse(course: Course): Course {
  return {
    ...course,
    major: course.major ?? inferMajorFromText(`${course.className} ${course.name}`),
    credits: course.credits ?? 2,
    currentWeek: course.currentWeek ?? (Math.round(((course.progress || 0) / 100) * 16) || 9),
    totalWeeks: course.totalWeeks ?? 16,
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
  return {
    ...task,
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

  return {
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
    news: partial.news ?? seed.news,
    newsBookmarks: partial.newsBookmarks ?? seed.newsBookmarks,
    newsRead: partial.newsRead ?? seed.newsRead,
    // If user still has old short tool list, prefer richer seed once.
    tools: (partial.tools?.length ?? 0) >= 10 ? partial.tools! : seed.tools,
    favoriteTools: partial.favoriteTools ?? seed.favoriteTools,
    grades: partial.grades ?? seed.grades,
    dutyConfirmedDates: partial.dutyConfirmedDates ?? seed.dutyConfirmedDates,
    updatedAt: partial.updatedAt ?? new Date().toISOString(),
  }
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
