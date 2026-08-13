import type { ReminderItem, WorkbenchData } from './types'
import { syncAssignmentDeadlines, syncCourseEvents } from './sync'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function localIso(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

function buildSeedReminders(): ReminderItem[] {
  const later = new Date(Date.now() + 2 * 3_600_000)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(8, 30, 0, 0)
  const now = new Date().toISOString()
  return [
    {
      id: 'rem-seed-1',
      title: '批改教育心理学期中作业',
      note: '重点关注迟交与雷同检测',
      scheduledAt: localIso(later),
      status: 'pending',
      source: 'manual',
      createdAt: now,
    },
    {
      id: 'rem-seed-2',
      title: '实习巡视材料打包',
      scheduledAt: localIso(tomorrow),
      status: 'pending',
      source: 'ai',
      rawInput: '明天上午8点半提醒准备实习巡视材料',
      createdAt: now,
    },
  ]
}

/**
 * 种子数据只保存「非派生」事件（值班/会议/巡视/独立截止），
 * 课程事件与作业截止事件由 sync 层按课程/作业自动生成，保证单一数据源。
 */
const rawSeed: WorkbenchData = {
  version: 1,
  updatedAt: new Date().toISOString(),
  profile: {
    name: '李明华',
    title: '副教授',
    college: '教育学院',
    greetingName: '李明华老师',
  },
  meta: {
    termLabel: '2024–2025 学年第二学期',
    weekNumber: 9,
    weekStart: '2025-05-12',
    demoBanner: true,
  },
  events: [
    { id: 'duty', date: '2025-05-13', start: 5, length: 2, title: '午间值班', detail: '教育楼一层大厅', kind: 'duty' },
    { id: 'group', date: '2025-05-13', start: 7, length: 2, title: '课程组教研会', detail: '教育楼 408', kind: 'meeting' },
    { id: 'patrol', date: '2025-05-15', start: 6, length: 2, title: '实习巡视', detail: '附属小学', kind: 'patrol', major: 'pri' },
    { id: 'research', date: '2025-05-16', start: 7, length: 2, title: '科研材料整理', detail: '办公室', kind: 'meeting' },
    { id: 'meeting', date: '2025-05-17', start: 4, length: 2, title: '学院教学例会', detail: '行政楼 312', kind: 'meeting' },
    { id: 'deadline-grade', date: '2025-05-17', start: 0, length: 1, title: '期中成绩录入截止', detail: '教务系统提交', kind: 'deadline' },
    { id: 'deadline-paper', date: '2025-05-16', start: 0, length: 1, title: '课程方案设计截止', detail: '教育学课程组', kind: 'deadline', major: 'edu' },
    { id: 'deadline-visit', date: '2025-05-15', start: 0, length: 1, title: '实习巡视材料提交', detail: '附属小学中期检查', kind: 'deadline', major: 'pri' },
  ],
  dutyRoster: [
    { id: 'd1', day: 1, period: '上午', time: '08:00-12:00', type: '办公室值班', location: '教育学院 312', note: '学生答疑、教务接待' },
    { id: 'd2', day: 1, period: '下午', time: '14:00-15:40', type: '上课', location: '文科楼 205', note: '教育心理学' },
    { id: 'd3', day: 2, period: '上午', time: '08:00-09:40', type: '上课', location: '艺术楼 201', note: '学前教育学' },
    { id: 'd4', day: 2, period: '下午', time: '12:20-13:20', type: '办公室值班', location: '教育楼一层大厅', note: '午间值班' },
    { id: 'd5', day: 2, period: '晚上', time: '19:00-20:40', type: '上课', location: '教育楼 210', note: '教育研究方法（补课）' },
    { id: 'd6', day: 3, period: '上午', time: '08:00-09:40', type: '上课', location: '文科楼 102', note: '班级管理学' },
    { id: 'd7', day: 3, period: '下午', time: '14:00-16:00', type: '教学楼巡查', location: '教育楼 1-3 层', note: '课堂巡查 · 第 9 周' },
    { id: 'd8', day: 4, period: '上午', time: '08:00-12:00', type: '实习巡视', location: '附属小学', note: '小教实习中期检查' },
    { id: 'd9', day: 4, period: '下午', time: '14:00-15:40', type: '上课', location: '教育楼 307', note: '教育研究方法' },
    { id: 'd10', day: 5, period: '上午', time: '08:00-09:40', type: '上课', location: '艺术楼 308', note: '幼儿园课程（观摩）' },
    { id: 'd11', day: 5, period: '下午', time: '14:00-17:00', type: '办公室值班', location: '教育学院 312', note: '学生答疑、教研准备' },
  ],
  courses: [
    { id: 'psy', name: '教育心理学', code: 'EDU203', className: '教育学 2024-1 班', students: 52, weeks: '第 1–16 周', progress: 56, status: '正常', color: 'teal', major: 'edu', credits: 3, currentWeek: 9, totalWeeks: 16, topic: '期中复习与学习动机', description: '研究教育情境中的心理现象与规律。', sessions: [{ day: 1, section: 2, room: '文科楼 205' }] },
    { id: 'pre', name: '学前教育学', code: 'PRE201', className: '学前 2024-1 班', students: 46, weeks: '第 1–16 周', progress: 56, status: '正常', color: 'blue', major: 'pre', credits: 3, currentWeek: 9, totalWeeks: 16, topic: '幼儿观察与记录', description: '学前教育基本理论与幼儿园教育实践。', sessions: [{ day: 2, section: 1, room: '艺术楼 201' }] },
    { id: 'manage', name: '班级管理学', code: 'PME306', className: '小教 2023-2 班', students: 48, weeks: '第 1–16 周', progress: 50, status: '需关注', color: 'amber', major: 'pri', credits: 2, currentWeek: 8, totalWeeks: 16, topic: '班级文化建设', description: '班级管理理论与实践，含家校沟通。', sessions: [{ day: 3, section: 3, room: '文科楼 102' }] },
    { id: 'research', name: '教育研究方法', code: 'EDU401', className: '教育学 2023-1 班', students: 39, weeks: '第 1–16 周', progress: 63, status: '待更新', color: 'slate', major: 'edu', credits: 2, currentWeek: 10, totalWeeks: 16, topic: '访谈法与资料分析', description: '教育研究的基本范式与方法。', sessions: [{ day: 4, section: 2, room: '教育楼 307' }] },
    { id: 'chinese', name: '小学语文教学法', code: 'PME301', className: '小教 2023-1 班', students: 40, weeks: '第 1–16 周', progress: 50, status: '正常', color: 'green', major: 'pri', credits: 3, currentWeek: 8, totalWeeks: 16, topic: '识字与阅读教学', description: '小学语文教学的目标、内容与方法。', sessions: [{ day: 1, section: 0, room: '教育楼 305' }] },
    { id: 'kinder', name: '幼儿园课程', code: 'PRE305', className: '学前 2023-1 班', students: 34, weeks: '第 1–16 周', progress: 44, status: '待更新', color: 'violet', major: 'pre', credits: 2, currentWeek: 7, totalWeeks: 16, topic: '五大领域活动设计', description: '幼儿园课程理论与游戏教学融合。', sessions: [{ day: 4, section: 0, room: '艺术楼 308' }] },
  ],
  students: [
    { id: 's01', name: '陈思雨', number: '202401020113', group: '第一组', attendance: '100%', homework: '6 / 6', status: '正常', courseId: 'psy', className: '教育学 2024-1 班', major: 'edu', processScore: 88, notes: '目前学习状态稳定，暂无特别跟进事项。' },
    { id: 's02', name: '刘子涵', number: '202401020127', group: '第一组', attendance: '92%', homework: '5 / 6', status: '关注', courseId: 'psy', className: '教育学 2024-1 班', major: 'edu', processScore: 82, notes: '第 7 周缺勤 1 次；已提醒补交课堂观察记录。' },
    { id: 's03', name: '王若宁', number: '202401020135', group: '第二组', attendance: '100%', homework: '6 / 6', status: '正常', courseId: 'psy', className: '教育学 2024-1 班', major: 'edu', processScore: 90, notes: '课堂参与积极，可作为小组讨论引导者。' },
    { id: 's04', name: '周嘉言', number: '202401020141', group: '第二组', attendance: '88%', homework: '4 / 6', status: '待跟进', courseId: 'psy', className: '教育学 2024-1 班', major: 'edu', processScore: 74, notes: '作业提交偏晚，需确认是否存在时间安排困难。' },
    { id: 's05', name: '林知夏', number: '202401020152', group: '第三组', attendance: '96%', homework: '6 / 6', status: '正常', courseId: 'manage', className: '小教 2023-2 班', major: 'pri', processScore: 86, notes: '小教班级骨干，班会组织能力强。' },
    { id: 's06', name: '赵一鸣', number: '202401020166', group: '第三组', attendance: '96%', homework: '5 / 6', status: '关注', courseId: 'pre', className: '学前 2024-1 班', major: 'pre', processScore: 80, notes: '观察记录写作成熟度仍需提升。' },
    { id: 's07', name: '韩雪儿', number: '202401020178', group: '第一组', attendance: '98%', homework: '6 / 6', status: '正常', courseId: 'chinese', className: '小教 2023-1 班', major: 'pri', processScore: 91, notes: '语文教学设计完成度高。' },
    { id: 's08', name: '冯雨萌', number: '202401020189', group: '第二组', attendance: '94%', homework: '5 / 6', status: '关注', courseId: 'kinder', className: '学前 2023-1 班', major: 'pre', processScore: 84, notes: '活动方案创意好，材料准备可更细致。' },
  ],
  assignments: [
    { id: 'a1', courseId: 'psy', title: '期中案例分析：从儿童行为看学习动机', due: '2025-05-13T23:59', description: '请结合本周课堂观察，完成一份不少于 800 字的案例分析。', reviewed: ['陈思雨', '王若宁', '林知夏'], submitted: 50, total: 52, major: 'edu' },
    { id: 'a2', courseId: 'chinese', title: '小学语文识字教学设计', due: '2025-05-15T23:59', description: '完成一份完整识字教学设计。', reviewed: ['韩雪儿'], submitted: 35, total: 40, major: 'pri' },
    { id: 'a3', courseId: 'pre', title: '幼儿园一日活动观察记录', due: '2025-05-16T23:59', description: '提交观察记录与反思。', reviewed: [], submitted: 30, total: 46, major: 'pre' },
  ],
  tasks: [
    { id: 'exam', title: '批改教育心理学期中试卷', course: '教育心理学 · 教育学 2024-1 班', due: '今天 17:00', dueDate: '2025-05-13', kind: '教学', status: 'todo', priority: 'high', major: 'edu', desc: '52 份试卷待批改', assignee: '李明华' },
    { id: 'practice', title: '确认小教实习中期检查安排', course: '小学教育专业 · 附属小学', due: '明天', dueDate: '2025-05-14', kind: '学生', status: 'todo', priority: 'high', major: 'pri', desc: '走访附属小学，与实习指导教师沟通', assignee: '李明华' },
    { id: 'plan', title: '整理第 10 周教学设计', course: '教育研究方法', due: '5 月 15 日', dueDate: '2025-05-15', kind: '教学', status: 'todo', priority: 'medium', major: 'edu', desc: '补齐本周教案与课堂活动安排', assignee: '李明华' },
    { id: 'grade', title: '录入教育心理学期中成绩', course: '教育心理学 · 52 人', due: '今天 20:00', dueDate: '2025-05-13', kind: '教务', status: 'doing', priority: 'high', major: 'edu', desc: '期中成绩录入并核对名单', assignee: '李明华' },
    { id: 'paper', title: '审阅 3 份本科生论文提纲', course: '2025 届本科毕业论文', due: '5 月 16 日', dueDate: '2025-05-16', kind: '学生', status: 'doing', priority: 'medium', major: 'edu', desc: '反馈提纲结构与文献建议', assignee: '李明华' },
    { id: 'record', title: '补充幼儿园课程教学记录', course: '幼儿园课程 · 第 7 教学周', due: '5 月 10 日', dueDate: '2025-05-10', kind: '教学', status: 'doing', priority: 'low', major: 'pre', desc: '整理观摩与活动记录', assignee: '李明华' },
    { id: 'notice', title: '提交课程组教研会材料', course: '教育学课程组', due: '5 月 12 日', dueDate: '2025-05-12', kind: '教研', status: 'doing', priority: 'medium', major: null, desc: '汇总本周教研讨论要点', assignee: '教研室' },
    { id: 'visit', title: '登记本周实习巡视记录', course: '小学教育专业 · 4 名学生', due: '已提交', dueDate: '2025-05-08', kind: '学生', status: 'done', priority: 'medium', major: 'pri', desc: '巡视记录已归档', assignee: '李明华' },
    { id: 'resource', title: '归档《班级管理学》案例资料', course: '班级管理学', due: '已完成', dueDate: '2025-05-01', kind: '教学', status: 'done', priority: 'low', major: 'pri', desc: '案例资料已入库', assignee: '李明华' },
  ],
  resources: [
    { id: 'motivation', title: '学习动机：从理论到课堂', course: '教育心理学', type: '课件', updated: '今天 09:20', size: '18.4 MB', accent: 'teal', description: '第 9 周课堂课件。', tags: ['第 9 周', '学习动机'], major: 'edu', format: 'PPT', usedCount: 2, lastUsed: '昨天' },
    { id: 'observation', title: '幼儿观察记录活动设计', course: '学前教育学', type: '教案', updated: '昨天', size: '1.2 MB', accent: 'coral', description: '观察活动完整教学设计。', tags: ['活动设计', '观察'], major: 'pre', format: 'DOC' },
    { id: 'midterm', title: '教育心理学期中测验 A 卷', course: '教育心理学', type: '试题', updated: '5 月 9 日', size: '682 KB', accent: 'amber', description: '期中测验试卷。', tags: ['期中', '试题'], major: 'edu', format: 'PDF' },
    { id: 'classroom', title: '班级文化建设：现场案例', course: '班级管理学', type: '视频', updated: '5 月 7 日', size: '246 MB', accent: 'violet', description: '班主任工作场景案例。', tags: ['案例', '班级文化'], major: 'pri', format: 'MP4' },
    { id: 'research', title: '教育研究中的访谈法', course: '教育研究方法', type: '文献', updated: '5 月 3 日', size: '3.8 MB', accent: 'blue', description: '半结构化访谈阅读材料。', tags: ['研究方法', '访谈'], major: 'edu', format: 'PDF' },
    { id: 'literacy', title: '小学语文·识字教学课件', course: '小学语文教学法', type: '课件', updated: '5 月 1 日', size: '13.2 MB', accent: 'green', description: '识字教学课件。', tags: ['识字', '小教'], major: 'pri', format: 'PPT' },
    { id: 'guide', title: '《3-6岁儿童学习与发展指南》', course: '幼儿园课程', type: '文献', updated: '4 月 20 日', size: '2.1 MB', accent: 'slate', description: '学前核心参考文件。', tags: ['指南', '学前'], major: 'pre', format: 'PDF' },
  ],
  savedResources: ['motivation'],
  news: [],
  newsBookmarks: [],
  newsRead: [],
  tools: [
    { id: 'yuketang', name: '雨课堂', description: '课件推送、弹幕互动、随堂测验与学情数据', category: '备课工具', initials: '雨', tone: 'blue', url: 'https://www.yuketang.cn', tags: ['课堂互动', '数据统计'], typeLabel: '网页/小程序' },
    { id: 'chaoxing', name: '学习通', description: '课程管理、资源共享、签到、作业与考试', category: '备课工具', initials: '学', tone: 'teal', url: 'https://www.chaoxing.com', tags: ['课程管理'], typeLabel: 'App/网页' },
    { id: 'canva', name: 'Canva 可画', description: 'PPT、教学海报与信息图模板', category: '备课工具', initials: 'C', tone: 'coral', url: 'https://www.canva.cn', tags: ['PPT设计'], typeLabel: '网页/App' },
    { id: 'xmind', name: 'XMind', description: '知识体系梳理与课程框架设计', category: '备课工具', initials: 'X', tone: 'gold', url: 'https://www.xmind.cn', tags: ['思维导图'], typeLabel: '桌面/App' },
    { id: 'mooc', name: '中国大学 MOOC', description: '国家级在线课程平台，可建课与引用资源', category: '教学平台', initials: '慕', tone: 'navy', url: 'https://www.icourse163.org', tags: ['MOOC'], typeLabel: '网页/App' },
    { id: 'meeting', name: '腾讯会议', description: '在线授课、组会、答辩与录制', category: '教学平台', initials: '会', tone: 'blue', url: 'https://meeting.tencent.com', tags: ['在线授课'], typeLabel: 'App/网页' },
    { id: 'cnki', name: '中国知网', description: '期刊、学位论文与会议文献检索', category: '学术工具', initials: '知', tone: 'navy', url: 'https://www.cnki.net', tags: ['文献检索'], typeLabel: '网页' },
    { id: 'scholar', name: 'Google Scholar', description: '英文文献检索与引用追踪', category: '学术工具', initials: 'G', tone: 'slate', url: 'https://scholar.google.com', tags: ['英文文献'], typeLabel: '网页' },
    { id: 'zotero', name: 'Zotero', description: '文献管理与参考文献格式生成', category: '学术工具', initials: 'Z', tone: 'gold', url: 'https://www.zotero.org', tags: ['文献管理'], typeLabel: '桌面/插件' },
    { id: 'wjx', name: '问卷星', description: '教学满意度与学情调研问卷', category: '效率工具', initials: '问', tone: 'green', url: 'https://www.wjx.cn', tags: ['问卷'], typeLabel: '网页/小程序' },
    { id: 'docs', name: '腾讯文档', description: '教研室协作与教案共建', category: '效率工具', initials: '文', tone: 'green', url: 'https://docs.qq.com', tags: ['协同编辑'], typeLabel: '网页' },
    { id: 'yiyan', name: '文心一言', description: '教案生成、教学反思撰写辅助', category: 'AI工具', initials: '文', tone: 'violet', url: 'https://yiyan.baidu.com', tags: ['国产AI'], typeLabel: '网页/App' },
    { id: 'tongyi', name: '通义千问', description: '文档解析、PPT 生成与长文本理解', category: 'AI工具', initials: '通', tone: 'violet', url: 'https://tongyi.aliyun.com', tags: ['文档解析'], typeLabel: '网页/App' },
    { id: 'kimi', name: 'Kimi', description: '长文本处理论文速读与文献综述辅助', category: 'AI工具', initials: 'K', tone: 'coral', url: 'https://kimi.moonshot.cn', tags: ['论文速读'], typeLabel: '网页/App' },
    { id: 'metaso', name: '秘塔 AI 搜索', description: '无广告学术搜索，直达学术来源', category: 'AI工具', initials: '秘', tone: 'slate', url: 'https://metaso.cn', tags: ['AI搜索'], typeLabel: '网页' },
  ],
  favoriteTools: ['cnki', 'zotero', 'yuketang', 'kimi'],
  grades: [
    { id: 'g1', courseId: 'psy', studentId: 's01', usual: 90, midterm: 88, final: 0, total: 89 },
    { id: 'g2', courseId: 'psy', studentId: 's02', usual: 82, midterm: 76, final: 0, total: 79 },
    { id: 'g3', courseId: 'psy', studentId: 's03', usual: 92, midterm: 91, final: 0, total: 91 },
    { id: 'g4', courseId: 'psy', studentId: 's04', usual: 70, midterm: 68, final: 0, total: 69 },
    { id: 'g5', courseId: 'manage', studentId: 's05', usual: 86, midterm: 84, final: 0, total: 85 },
    { id: 'g6', courseId: 'pre', studentId: 's06', usual: 80, midterm: 78, final: 0, total: 79 },
    { id: 'g7', courseId: 'chinese', studentId: 's07', usual: 91, midterm: 89, final: 0, total: 90 },
    { id: 'g8', courseId: 'kinder', studentId: 's08', usual: 84, midterm: 80, final: 0, total: 82 },
  ],
  dutyConfirmedDates: [],
  reminders: [],
  reminderSettings: {
    systemNotifyEnabled: false,
  },
}

export const createSeedData = (): WorkbenchData => {
  const events = syncAssignmentDeadlines(
    syncCourseEvents(rawSeed.events, rawSeed.courses, rawSeed.meta.weekStart),
    rawSeed.assignments,
  )
  return {
    ...rawSeed,
    events,
    reminders: buildSeedReminders(),
  }
}
