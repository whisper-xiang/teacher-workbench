export type MajorId = 'edu' | 'pri' | 'pre'

export type Major = {
  id: MajorId
  name: string
  short: string
  color: string
}

export const MAJORS: Major[] = [
  { id: 'edu', name: '教育学', short: '教育学', color: '#2563eb' },
  { id: 'pri', name: '小学教育', short: '小教', color: '#0d9488' },
  { id: 'pre', name: '学前教育', short: '学前', color: '#7c3aed' },
]

export type CalendarKind = 'course' | 'duty' | 'meeting' | 'patrol' | 'deadline'

export type CalendarEvent = {
  id: string
  date: string
  start: number
  length: number
  title: string
  detail: string
  kind: CalendarKind
  major?: MajorId | null
}

export type DutySlot = {
  id: string
  day: number // 1=周一 … 5=周五
  period: '上午' | '下午' | '晚上'
  time: string
  type: string
  location: string
  note: string
}

export type Course = {
  id: string
  name: string
  code: string
  className: string
  students: number
  weeks: string
  progress: number
  status: '正常' | '待更新' | '需关注'
  color: string
  major: MajorId
  credits: number
  currentWeek: number
  totalWeeks: number
  sessions: { day: number; section: number; room: string }[]
  topic?: string
  description?: string
}

export type StudentRecord = {
  id: string
  name: string
  number: string
  group: string
  attendance: string
  homework: string
  status: '正常' | '关注' | '待跟进'
  courseId: string
  className: string
  major: MajorId
  processScore: number
  notes: string
}

export type Assignment = {
  id: string
  courseId: string
  title: string
  due: string
  description: string
  reviewed: string[]
  submitted?: number
  total?: number
  major?: MajorId
}

export type BoardStatus = 'todo' | 'doing' | 'done'

export type BoardPriority = 'high' | 'medium' | 'low'

export type BoardTask = {
  id: string
  title: string
  course: string
  due: string
  /** ISO date YYYY-MM-DD，用于逾期判断 */
  dueDate?: string
  kind: '教学' | '学生' | '教务' | '教研'
  status: BoardStatus
  priority?: BoardPriority
  major?: MajorId | null
  desc?: string
  assignee?: string
}

export type TeachingResource = {
  id: string
  title: string
  course: string
  type: '课件' | '教案' | '试题' | '视频' | '文献'
  updated: string
  size: string
  accent: string
  description: string
  tags: string[]
  major?: MajorId
  format?: 'PPT' | 'DOC' | 'PDF' | 'MP4' | '其他'
  /** 累计使用次数（标记已用累计） */
  usedCount?: number
  /** 最近使用时间显示文本 */
  lastUsed?: string
}

export type NewsItem = {
  id: string
  category: 'AI热点' | '政策通知' | '教研动态' | '学术活动' | '高校动态' | '行业观察'
  title: string
  summary: string
  source: string
  date: string
  tag: string
  accent: 'teal' | 'blue' | 'amber' | 'slate' | 'violet'
  fresh?: boolean
  hot?: boolean
  url: string
}

export type ToolCategory = '备课工具' | '教学平台' | '学术工具' | '效率工具' | 'AI工具' | '备课与课堂' | '研究与写作' | '协作与事务'

export type ToolItem = {
  id: string
  name: string
  description: string
  category: ToolCategory
  initials: string
  tone: string
  url?: string
  tags?: string[]
  typeLabel?: string
}

export type ReminderStatus = 'pending' | 'fired' | 'cancelled'

export type ReminderItem = {
  id: string
  title: string
  note?: string
  /** ISO datetime, local interpreted */
  scheduledAt: string
  status: ReminderStatus
  source: 'manual' | 'ai'
  rawInput?: string
  createdAt: string
  firedAt?: string
}

export type ReminderSettings = {
  systemNotifyEnabled: boolean
}

export type GradeItem = {
  id: string
  courseId: string
  studentId: string
  usual: number
  midterm: number
  final: number
  total: number
}

export type TeacherProfile = {
  name: string
  title: string
  college: string
  greetingName: string
}

export type WorkbenchMeta = {
  termLabel: string
  weekNumber: number
  weekStart: string
  demoBanner: boolean
  /** RSS 资讯上次拉取时间（ISO） */
  newsFetchedAt?: string
}

export type WorkbenchData = {
  version: 1
  updatedAt: string
  profile: TeacherProfile
  meta: WorkbenchMeta
  events: CalendarEvent[]
  dutyRoster: DutySlot[]
  courses: Course[]
  students: StudentRecord[]
  assignments: Assignment[]
  tasks: BoardTask[]
  resources: TeachingResource[]
  savedResources: string[]
  news: NewsItem[]
  newsBookmarks: string[]
  newsRead: string[]
  tools: ToolItem[]
  favoriteTools: string[]
  grades: GradeItem[]
  dutyConfirmedDates: string[]
  reminders: ReminderItem[]
  reminderSettings: ReminderSettings
}

export type RouteId =
  | 'overview'
  | 'calendar'
  | 'tasks'
  | 'courses'
  | 'resources'
  | 'news'
  | 'tools'
  | 'reminders'
  | 'settings'

export function majorName(id?: MajorId | null): string {
  return MAJORS.find((m) => m.id === id)?.name ?? '通用'
}

export function inferMajorFromText(text: string): MajorId {
  if (/学前|幼儿/.test(text)) return 'pre'
  if (/小教|小学/.test(text)) return 'pri'
  return 'edu'
}

export function letterGrade(score: number): { grade: string; tone: string } {
  if (score >= 90) return { grade: 'A', tone: 'success' }
  if (score >= 80) return { grade: 'B', tone: 'info' }
  if (score >= 70) return { grade: 'C', tone: 'warning' }
  if (score >= 60) return { grade: 'D', tone: 'muted' }
  return { grade: 'F', tone: 'danger' }
}
