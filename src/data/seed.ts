import { dueLabel, iso, mondayOf, shift, todayIso } from '../lib/dates'
import { DEFAULT_FAVORITE_TOOL_IDS, DEFAULT_TOOLS, PRESET_TOOLS_VERSION } from './default-tools'
import type { Course, ReminderItem, ThesisAdvisee, WorkbenchData } from './types'
import { syncDerivedEvents } from './sync'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function localIso(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

function dayOf(weekStart: string, offset: number) {
  return iso(shift(new Date(`${weekStart}T12:00:00`), offset))
}

function weekTopics(entries: Record<number, string>, total = 16): string[] {
  const list = Array.from({ length: total }, () => '')
  for (const [week, title] of Object.entries(entries)) list[Number(week) - 1] = title
  return list
}

function withTopic(course: Course): Course {
  const topic = course.weeklyTopics?.[Math.max(0, course.currentWeek - 1)] || course.topic
  return { ...course, topic }
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
 * 日期相对本周一生成，避免概览停在过期演示周。
 */
function buildRawSeed(weekStart: string, today: string): WorkbenchData {
  const d = (offset: number) => dayOf(weekStart, offset)
  const due = (offset: number, done?: string) => {
    const date = d(offset)
    return { dueDate: date, due: done ?? dueLabel(date, today) }
  }

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    profile: {
      name: '王晓媛',
      title: '讲师',
      college: '教育学院',
      greetingName: '王晓媛老师',
    },
    meta: {
      termLabel: '2024–2025 学年第二学期',
      weekNumber: 9,
      weekStart,
      demoBanner: true,
      presetToolsVersion: PRESET_TOOLS_VERSION,
    },
    events: [
      { id: 'duty', date: d(1), start: 5, length: 2, title: '午间值班', detail: '教育楼一层大厅', kind: 'duty' },
      { id: 'group', date: d(1), start: 7, length: 2, title: '课程组教研会', detail: '教育楼 408', kind: 'meeting' },
      { id: 'patrol', date: d(3), start: 6, length: 2, title: '实习巡视', detail: '附属小学', kind: 'patrol', major: 'pri' },
      { id: 'research', date: d(4), start: 7, length: 2, title: '科研材料整理', detail: '办公室', kind: 'meeting' },
      { id: 'meeting', date: d(5), start: 4, length: 2, title: '学院教学例会', detail: '行政楼 312', kind: 'meeting' },
      { id: 'deadline-grade', date: d(5), start: 0, length: 1, title: '期中成绩录入截止', detail: '教务系统提交', kind: 'deadline', linkTo: { route: 'students', param: 'psy' } },
      { id: 'deadline-paper', date: d(4), start: 0, length: 1, title: '课程方案设计截止', detail: '教育学课程组', kind: 'deadline', major: 'edu', linkTo: { route: 'courses' } },
      { id: 'deadline-visit', date: d(3), start: 0, length: 1, title: '实习巡视材料提交', detail: '附属小学中期检查', kind: 'deadline', major: 'pri', linkTo: { route: 'resources' } },
      { id: 'paper-th-limin', date: d(4), start: 0, length: 1, title: '看李敏论文', detail: '小学课堂提问促进深度学习的实践研究', kind: 'deadline', linkTo: { route: 'papers', param: 'th-limin' } },
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
      withTopic({
        id: 'psy',
        name: '教育心理学',
        code: 'EDU203',
        className: '教育学 2024-1 班',
        students: 52,
        weeks: '第 1–16 周',
        progress: 56,
        status: '正常',
        color: 'teal',
        major: 'edu',
        credits: 3,
        currentWeek: 9,
        totalWeeks: 16,
        description: '研究教育情境中的心理现象与规律。',
        sessions: [{ day: 1, section: 2, room: '文科楼 205' }],
        weeklyTopics: weekTopics({
          7: '认知发展与教学',
          8: '学习动机理论',
          9: '期中复习与学习动机',
          10: '课堂管理中的动机策略',
          11: '自我效能与归因',
        }),
        classes: [
          {
            id: 'psy-c1',
            name: '教育学 2024-1 班',
            studentCount: 52,
            currentWeek: 9,
            nodes: [
              { id: 'psy-n1', week: 9, kind: '进度', note: '已讲到学习动机理论，下节进入期中案例讨论' },
              { id: 'psy-n2', week: 9, kind: '作业发布', note: '布置期中案例分析，周五回收' },
            ],
          },
          {
            id: 'psy-c2',
            name: '教育学 2024-2 班',
            studentCount: 48,
            currentWeek: 8,
            nodes: [
              { id: 'psy-n3', week: 8, kind: '学生表现', note: '该班进度慢一周，讨论参与度一般，需点名提问' },
            ],
          },
        ],
      }),
      withTopic({
        id: 'pre',
        name: '学前教育学',
        code: 'PRE201',
        className: '学前 2024-1 班',
        students: 46,
        weeks: '第 1–16 周',
        progress: 56,
        status: '正常',
        color: 'blue',
        major: 'pre',
        credits: 3,
        currentWeek: 9,
        totalWeeks: 16,
        description: '学前教育基本理论与幼儿园教育实践。',
        sessions: [{ day: 2, section: 1, room: '艺术楼 201' }],
        weeklyTopics: weekTopics({
          8: '幼儿园环境创设',
          9: '幼儿观察与记录',
          10: '游戏中的观察',
        }),
      }),
      withTopic({
        id: 'manage',
        name: '班级管理学',
        code: 'PME306',
        className: '小教 2023-2 班',
        students: 48,
        weeks: '第 1–16 周',
        progress: 50,
        status: '需关注',
        color: 'amber',
        major: 'pri',
        credits: 2,
        currentWeek: 8,
        totalWeeks: 16,
        description: '班级管理理论与实践，含家校沟通。',
        sessions: [{ day: 3, section: 3, room: '文科楼 102' }],
        weeklyTopics: weekTopics({
          7: '班干部培养',
          8: '班级文化建设',
          9: '家校沟通案例',
        }),
      }),
      withTopic({
        id: 'research',
        name: '教育研究方法',
        code: 'EDU401',
        className: '教育学 2023-1 班',
        students: 39,
        weeks: '第 1–16 周',
        progress: 63,
        status: '待更新',
        color: 'slate',
        major: 'edu',
        credits: 2,
        currentWeek: 10,
        totalWeeks: 16,
        description: '教育研究的基本范式与方法。',
        sessions: [
          { day: 3, section: 2, room: '教育楼 307' },
          { day: 1, section: 4, room: '教育楼 210' },
        ],
        weeklyTopics: weekTopics({
          9: '问卷调查设计',
          10: '访谈法与资料分析',
          11: '课堂观察研究',
        }),
      }),
      withTopic({
        id: 'chinese',
        name: '小学语文教学法',
        code: 'PME301',
        className: '小教 2023-1 班',
        students: 40,
        weeks: '第 1–16 周',
        progress: 50,
        status: '正常',
        color: 'green',
        major: 'pri',
        credits: 3,
        currentWeek: 8,
        totalWeeks: 16,
        description: '小学语文教学的目标、内容与方法。',
        sessions: [{ day: 1, section: 0, room: '教育楼 305' }],
        weeklyTopics: weekTopics({
          7: '汉语拼音教学',
          8: '识字与阅读教学',
          9: '阅读课型设计',
        }),
      }),
      withTopic({
        id: 'kinder',
        name: '幼儿园课程',
        code: 'PRE305',
        className: '学前 2023-1 班',
        students: 34,
        weeks: '第 1–16 周',
        progress: 44,
        status: '待更新',
        color: 'violet',
        major: 'pre',
        credits: 2,
        currentWeek: 7,
        totalWeeks: 16,
        description: '幼儿园课程理论与游戏教学融合。',
        sessions: [{ day: 4, section: 0, room: '艺术楼 308' }],
        weeklyTopics: weekTopics({
          6: '生活活动组织',
          7: '五大领域活动设计',
          8: '游戏课程实践',
        }),
      }),
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
      { id: 'a1', courseId: 'psy', title: '期中案例分析：从儿童行为看学习动机', due: `${d(1)}T23:59`, description: '请结合本周课堂观察，完成一份不少于 800 字的案例分析。', reviewed: ['陈思雨', '王若宁', '林知夏'], submitted: 50, total: 52, major: 'edu' },
      { id: 'a2', courseId: 'chinese', title: '小学语文识字教学设计', due: `${d(3)}T23:59`, description: '完成一份完整识字教学设计。', reviewed: ['韩雪儿'], submitted: 35, total: 40, major: 'pri' },
      { id: 'a3', courseId: 'pre', title: '幼儿园一日活动观察记录', due: `${d(4)}T23:59`, description: '提交观察记录与反思。', reviewed: [], submitted: 30, total: 46, major: 'pre' },
    ],
    tasks: [
      { id: 'exam', title: '批改教育心理学期中试卷', course: '教育心理学 · 教育学 2024-1 班', ...due(1), kind: '教学', status: 'todo', priority: 'high', major: 'edu', desc: '52 份试卷待批改', assignee: '王晓媛' },
      { id: 'practice', title: '确认小教实习中期检查安排', course: '小学教育专业 · 附属小学', ...due(2), kind: '学生', status: 'todo', priority: 'high', major: 'pri', desc: '走访附属小学，与实习指导教师沟通', assignee: '王晓媛' },
      { id: 'plan', title: '整理第 10 周教学设计', course: '教育研究方法', ...due(3), kind: '教学', status: 'todo', priority: 'medium', major: 'edu', desc: '补齐本周教案与课堂活动安排', assignee: '王晓媛' },
      { id: 'grade', title: '录入教育心理学期中成绩', course: '教育心理学 · 52 人', ...due(1), kind: '教务', status: 'doing', priority: 'high', major: 'edu', desc: '期中成绩录入并核对名单', assignee: '王晓媛' },
      { id: 'paper', title: '审阅 3 份本科生论文提纲', course: '2025 届本科毕业论文', ...due(4), kind: '学生', status: 'doing', priority: 'medium', major: 'edu', desc: '反馈提纲结构与文献建议', assignee: '王晓媛' },
      { id: 'record', title: '补充幼儿园课程教学记录', course: '幼儿园课程 · 第 7 教学周', ...due(-2), kind: '教学', status: 'doing', priority: 'low', major: 'pre', desc: '整理观摩与活动记录', assignee: '王晓媛' },
      { id: 'notice', title: '提交课程组教研会材料', course: '教育学课程组', ...due(0), kind: '教研', status: 'doing', priority: 'medium', major: null, desc: '汇总本周教研讨论要点', assignee: '教研室' },
      { id: 'visit', title: '登记本周实习巡视记录', course: '小学教育专业 · 4 名学生', ...due(-4, '已提交'), kind: '学生', status: 'done', priority: 'medium', major: 'pri', desc: '巡视记录已归档', assignee: '王晓媛' },
      { id: 'resource', title: '归档《班级管理学》案例资料', course: '班级管理学', ...due(-11, '已完成'), kind: '教学', status: 'done', priority: 'low', major: 'pri', desc: '案例资料已入库', assignee: '王晓媛' },
    ],
    resources: [
      { id: 'motivation', title: '学习动机：从理论到课堂', course: '教育心理学', type: '课件', updated: '今天 09:20', size: '18.4 MB', accent: 'teal', description: '第 9 周课堂课件。', tags: ['第 9 周', '学习动机'], major: 'edu', format: 'PPT', usedCount: 2, lastUsed: '昨天' },
      { id: 'observation', title: '幼儿观察记录活动设计', course: '学前教育学', type: '教案', updated: '昨天', size: '1.2 MB', accent: 'coral', description: '观察活动完整教学设计。', tags: ['活动设计', '观察'], major: 'pre', format: 'DOC' },
      { id: 'midterm', title: '教育心理学期中测验 A 卷', course: '教育心理学', type: '试题', updated: '上周', size: '682 KB', accent: 'amber', description: '期中测验试卷。', tags: ['期中', '试题'], major: 'edu', format: 'PDF' },
      { id: 'classroom', title: '班级文化建设：现场案例', course: '班级管理学', type: '视频', updated: '上周', size: '246 MB', accent: 'violet', description: '班主任工作场景案例。', tags: ['案例', '班级文化'], major: 'pri', format: 'MP4' },
      { id: 'research', title: '教育研究中的访谈法', course: '教育研究方法', type: '文献', updated: '两周前', size: '3.8 MB', accent: 'blue', description: '半结构化访谈阅读材料。', tags: ['研究方法', '访谈'], major: 'edu', format: 'PDF' },
      { id: 'literacy', title: '小学语文·识字教学课件', course: '小学语文教学法', type: '课件', updated: '两周前', size: '13.2 MB', accent: 'green', description: '识字教学课件。', tags: ['识字', '小教'], major: 'pri', format: 'PPT' },
      { id: 'guide', title: '《3-6岁儿童学习与发展指南》', course: '幼儿园课程', type: '文献', updated: '本月初', size: '2.1 MB', accent: 'slate', description: '学前核心参考文件。', tags: ['指南', '学前'], major: 'pre', format: 'PDF' },
    ],
    savedResources: ['motivation'],
    news: [],
    newsBookmarks: [],
    newsRead: [],
    tools: DEFAULT_TOOLS,
    favoriteTools: DEFAULT_FAVORITE_TOOL_IDS,
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
    researchNotices: [
      {
        id: 'rn-upcoming-1',
        title: '2026年度陕西省教育科学规划课题即将启动',
        source: '陕西省教育科学研究院',
        summary: '面向教育学、课程与教学论方向，预计近期发布指南。可先整理前期成果与团队分工。',
        category: '省规划',
        openAt: d(18),
        closeAt: d(45),
        status: 'upcoming',
        url: 'https://jyt.shaanxi.gov.cn/',
      },
      {
        id: 'rn-upcoming-2',
        title: '教育部人文社会科学研究项目申报预告',
        source: '教育部社科司',
        summary: '教育学门类规划基金、青年基金即将进入预报名阶段，需提前核对限项与校内截止。',
        category: '教育部',
        openAt: d(25),
        closeAt: d(55),
        status: 'upcoming',
        url: 'https://www.moe.gov.cn/',
      },
      {
        id: 'rn-open-1',
        title: '2026年大学生创新创业训练计划（校级）申报中',
        source: '学校教务处 / 创新创业学院',
        summary: '教师可指导国家级、省级大创。本轮已开放网报，需提交立项书与指导教师意见。',
        category: '大创',
        openAt: d(-8),
        closeAt: d(12),
        status: 'open',
      },
      {
        id: 'rn-open-2',
        title: '陕西省哲学社会科学研究专项（教育学）正在受理',
        source: '陕西省社科联',
        summary: '聚焦基础教育高质量发展、教师教育与师范人才培养，申报材料已进入校内审核窗口。',
        category: '省社科',
        openAt: d(-14),
        closeAt: d(6),
        status: 'open',
      },
    ],
    researchProjects: [
      {
        id: 'rp-applying-1',
        title: '课堂观察量表修订与师范生实习评价',
        category: '校级教改',
        status: 'applying',
        summary: '正在撰写申报书，拟对接教育心理学见习环节。',
        noticeId: 'rn-open-2',
        startDate: d(-5),
        endDate: d(6),
        milestones: [
          { id: 'rp-a-m1', name: '选题论证', done: true },
          { id: 'rp-a-m2', name: '申报书初稿', done: true },
          { id: 'rp-a-m3', name: '校内审核提交', done: false, due: d(4) },
        ],
        materials: [],
        achievements: [],
      },
      {
        id: 'rp-mine-1',
        title: '2026大创',
        category: '大创',
        status: 'closing',
        summary: '指导学生开展师范生教育实践能力培养路径研究，正在整理结题材料。',
        startDate: d(-90),
        endDate: d(20),
        milestones: [
          { id: 'rp-d-m1', name: '立项', done: true },
          { id: 'rp-d-m2', name: '中期检查', done: true },
          { id: 'rp-d-m3', name: '结题验收', done: false, due: d(20) },
        ],
        materials: [
          { id: 'rp-d-f1', title: '立项通知与任务书', kind: '立项', updated: '三个月前', size: '420 KB' },
          { id: 'rp-d-f2', title: '中期进展报告', kind: '中期', updated: '上周', size: '1.1 MB' },
        ],
        achievements: [
          { id: 'rp-d-a1', title: '学生实践报告', done: true },
          { id: 'rp-d-a2', title: '课堂观察案例集', done: true },
          { id: 'rp-d-a3', title: '成果展板', done: false },
          { id: 'rp-d-a4', title: '结题报告终稿', done: false },
        ],
      },
      {
        id: 'rp-mine-2',
        title: '陕西省十四五',
        category: '省规划',
        status: 'closing',
        summary: '教育高质量发展专题，已过中期，正在按成果清单补结题材料。',
        startDate: d(-400),
        endDate: d(40),
        milestones: [
          { id: 'rp-s-m1', name: '立项', done: true },
          { id: 'rp-s-m2', name: '中期检查', done: true },
          { id: 'rp-s-m3', name: '结题验收', done: false, due: d(40) },
        ],
        materials: [
          { id: 'rp-s-f1', title: '立项批文', kind: '立项', updated: '去年', size: '860 KB' },
          { id: 'rp-s-f2', title: '中期检查表', kind: '中期', updated: '两月前', size: '540 KB' },
        ],
        achievements: [
          { id: 'rp-s-a1', title: '核心论文 1 篇', done: true },
          { id: 'rp-s-a2', title: '调研报告', done: true },
          { id: 'rp-s-a3', title: '政策建议稿', done: false },
        ],
      },
      {
        id: 'rp-ended-1',
        title: '学前教师观察素养提升',
        category: '校级',
        status: 'ended',
        summary: '已结题并归档。',
        startDate: d(-500),
        endDate: d(-60),
        milestones: [
          { id: 'rp-e-m1', name: '立项', done: true },
          { id: 'rp-e-m2', name: '中期检查', done: true },
          { id: 'rp-e-m3', name: '结题验收', done: true },
        ],
        materials: [{ id: 'rp-e-f1', title: '结题证书扫描件', kind: '结题', updated: '两月前', size: '1.8 MB' }],
        achievements: [
          { id: 'rp-e-a1', title: '观察记录模板', done: true },
          { id: 'rp-e-a2', title: '结题报告', done: true },
        ],
      },
    ],
    activityProjects: [
      {
        id: 'ap-dachuang',
        title: '教育戏剧融入小学课堂的实践探索',
        category: '大创',
        summary: '指导小教学生将教育戏剧用于识字与阅读课，需整理立项与过程材料。',
        status: 'doing',
        milestones: [
          { id: 'ap-d-m1', name: '选题与组队', done: true },
          { id: 'ap-d-m2', name: '立项答辩', done: true },
          { id: 'ap-d-m3', name: '课堂实践', done: false },
          { id: 'ap-d-m4', name: '结题展示', done: false },
        ],
        materials: [{ id: 'ap-d-f1', title: '立项申请书', kind: '立项', updated: '上周', size: '780 KB' }],
      },
      {
        id: 'ap-xiaxiang',
        title: '乡村儿童阅读支持暑期实践',
        category: '三下乡',
        summary: '教育学院暑期三下乡团队，材料含方案、安全承诺与实践日志。',
        status: 'planning',
        milestones: [
          { id: 'ap-x-m1', name: '实践方案', done: true },
          { id: 'ap-x-m2', name: '行前培训', done: false },
          { id: 'ap-x-m3', name: '驻点实践', done: false },
        ],
        materials: [],
      },
      {
        id: 'ap-tiaozhan',
        title: '家校社协同育人机制调研',
        category: '挑战杯',
        summary: '挑战杯课外学术作品，正在补调研问卷与文献综述。',
        status: 'doing',
        milestones: [
          { id: 'ap-t-m1', name: '开题', done: true },
          { id: 'ap-t-m2', name: '调研实施', done: false },
          { id: 'ap-t-m3', name: '作品送审', done: false },
        ],
        materials: [],
      },
      {
        id: 'ap-internet',
        title: '幼儿园家园共育小程序',
        category: '互联网+',
        summary: '指导学前教育学生参加互联网+，需归档商业计划书与演示材料。',
        status: 'closing',
        milestones: [
          { id: 'ap-i-m1', name: '校赛', done: true },
          { id: 'ap-i-m2', name: '省赛材料', done: true },
          { id: 'ap-i-m3', name: '路演彩排', done: false },
        ],
        materials: [{ id: 'ap-i-f1', title: '商业计划书 v3', kind: '申报', updated: '昨天', size: '2.4 MB' }],
      },
    ],
    hiddenCourseEventIds: [],
    workNotes: [
      {
        id: 'jn-1',
        date: today,
        title: '教育心理学第 9 周课后：期中案例讨论',
        content: '教育学 2024-1 班完成学习动机案例讨论，已布置期中作业。',
        kind: '教学',
        files: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'jn-2',
        date: d(1),
        title: '课程组教研会发言要点',
        content: '汇总本周教学进度与期中命题分工，会后把纪要发到课程组。',
        kind: '公共事务',
        files: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'jn-3',
        date: d(-4),
        title: '附属小学实习巡视',
        content: '走访 4 名小教实习生，登记中期检查意见。',
        kind: '学生工作',
        files: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'jn-4',
        date: d(-11),
        title: '陕西省十四五中期材料核对',
        content: '核对调研报告与成果清单，待补政策建议稿。',
        kind: '科研',
        files: [],
        createdAt: new Date().toISOString(),
      },
    ],
    thesisAdvisees: [
      {
        id: 'th-limin',
        name: '李敏',
        topic: '小学课堂提问促进深度学习的实践研究',
        stage: '提纲',
        nextDate: d(4),
        drafts: [],
        notes: [],
      },
      {
        id: 'th-chen',
        name: '陈思雨',
        topic: '教育戏剧融入小学语文阅读课的行动研究',
        stage: '初稿',
        nextDate: d(-2),
        drafts: [],
        notes: [],
      },
    ] satisfies ThesisAdvisee[],
  }
}

export const createSeedData = (): WorkbenchData => {
  const weekStart = iso(mondayOf(new Date()))
  const rawSeed = buildRawSeed(weekStart, todayIso())
  return {
    ...rawSeed,
    events: syncDerivedEvents(rawSeed),
    reminders: buildSeedReminders(),
  }
}
