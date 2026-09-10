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

export type CalendarKind = 'course' | 'duty' | 'meeting' | 'patrol' | 'deadline' | 'journal'

export type DeadlineLink = {
  route: RouteId
  param?: string
}

export type CalendarEvent = {
  id: string
  date: string
  start: number
  length: number
  title: string
  detail: string
  kind: CalendarKind
  major?: MajorId | null
  /** 截止事项跳转目标 */
  linkTo?: DeadlineLink
  /** 已处理完成 */
  done?: boolean
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
  /** 第 n 周教学主题，下标 0 对应第 1 周 */
  weeklyTopics?: string[]
  /** 一门课可带多个班级；缺省时由 className 生成 */
  classes?: CourseClassGroup[]
}

export type ClassNodeKind = '进度' | '作业发布' | '作业回收' | '学生表现' | '其他'

export const CLASS_NODE_KINDS: ClassNodeKind[] = ['进度', '作业发布', '作业回收', '学生表现', '其他']

export type ClassLessonNode = {
  id: string
  week: number
  kind: ClassNodeKind
  /** 节点说明，手工填写 */
  note: string
  markedAt?: string
}

export const PERFORMANCE_RATINGS = ['优秀', '良好', '一般', '需关注'] as const

export type PerformanceRating = (typeof PERFORMANCE_RATINGS)[number]

export type StudentPerformance = {
  id: string
  studentId: string
  week: number
  rating: PerformanceRating
  note: string
  markedAt: string
}

export type CourseClassGroup = {
  id: string
  name: string
  studentCount: number
  currentWeek: number
  nodes: ClassLessonNode[]
  performances?: StudentPerformance[]
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

export type HomeworkSubmission = {
  id: string
  studentId: string
  fileId?: string
  fileName?: string
  mimeType?: string
  size?: string
  uploadedAt: string
  score?: number
  comment?: string
  evaluatedAt?: string
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
  submissions?: HomeworkSubmission[]
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
  /** IndexedDB 中的本地文件键 */
  fileId?: string
  fileName?: string
  mimeType?: string
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

export type ToolCategory =
  | '政策与学会'
  | '备课工具'
  | '教学平台'
  | '学术工具'
  | '效率工具'
  | 'AI工具'
  | '备课与课堂'
  | '研究与写作'
  | '协作与事务'

export type ToolItem = {
  id: string
  name: string
  description: string
  category: ToolCategory
  initials: string
  tone: string
  /** 卡片展示用图标，缺省回退到 initials */
  icon?: string
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

export type PetKind = 'ning' | 'hamster' | 'puppy' | 'kitty' | 'bunny' | 'chick' | 'fox' | 'photo'

export type TeacherProfile = {
  name: string
  title: string
  college: string
  greetingName: string
  /** IndexedDB 中的照片 Q 版大头 */
  petAvatarId?: string
  /** 桌宠形象：预设萌宠或照片 Q 版 */
  petKind?: PetKind
}

export type WorkbenchMeta = {
  termLabel: string
  weekNumber: number
  weekStart: string
  demoBanner: boolean
  /** RSS 资讯上次拉取时间（ISO） */
  newsFetchedAt?: string
  /** 预置工具版本；低于当前版本时按 id 补齐新入口，不覆盖用户已有项 */
  presetToolsVersion?: number
}

export type WorkMaterial = {
  id: string
  title: string
  kind: string
  fileId?: string
  fileName?: string
  mimeType?: string
  size?: string
  updated: string
  /** 从文件识别或手工整理的正文 */
  extractedText?: string
  /** 处理备注 */
  note?: string
  processedAt?: string
}

export type WorkMilestone = {
  id: string
  name: string
  done: boolean
  due?: string
}

export type ResearchNoticeStatus = 'upcoming' | 'open'

export type ResearchNotice = {
  id: string
  title: string
  source: string
  summary: string
  category: string
  openAt: string
  closeAt: string
  status: ResearchNoticeStatus
  url?: string
  fileId?: string
  fileName?: string
  mimeType?: string
  size?: string
  extractedText?: string
  note?: string
}

export type ResearchProjectStatus = 'applying' | 'closing' | 'ended'

export type ResearchAchievement = {
  id: string
  title: string
  done: boolean
}

export type ResearchProject = {
  id: string
  title: string
  category: string
  status: ResearchProjectStatus
  summary: string
  noticeId?: string
  startDate?: string
  endDate?: string
  milestones: WorkMilestone[]
  materials: WorkMaterial[]
  achievements: ResearchAchievement[]
}

export const ACTIVITY_CATEGORIES = ['大创', '三下乡', '挑战杯', '互联网+', '其他'] as const

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]

export type ActivityProjectStatus = 'planning' | 'doing' | 'closing' | 'done'

export type ActivityProject = {
  id: string
  title: string
  category: ActivityCategory
  summary: string
  status: ActivityProjectStatus
  milestones: WorkMilestone[]
  materials: WorkMaterial[]
}

export const JOURNAL_KINDS = ['教学', '科研', '学生工作', '公共事务', '其他'] as const

export type JournalKind = (typeof JOURNAL_KINDS)[number]

export type WorkJournalFile = {
  id: string
  fileId: string
  fileName: string
  mimeType: string
  size: string
}

export type WorkJournalNote = {
  id: string
  /** YYYY-MM-DD，记下时自动带上，可改 */
  date: string
  title: string
  content: string
  kind: JournalKind
  files: WorkJournalFile[]
  createdAt: string
  /** 粘贴的微信聊天记录，按发言人 / 时间 / 正文展示 */
  contentKind?: 'chat'
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
  researchNotices: ResearchNotice[]
  researchProjects: ResearchProject[]
  activityProjects: ActivityProject[]
  workNotes: WorkJournalNote[]
  /** 调课删除的课程事件 id，整学期不再自动生成该节 */
  hiddenCourseEventIds: string[]
}

export type RouteId =
  | 'overview'
  | 'calendar'
  | 'tasks'
  | 'journal'
  | 'courses'
  | 'research'
  | 'activities'
  | 'students'
  | 'resources'
  | 'news'
  | 'tools'
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
