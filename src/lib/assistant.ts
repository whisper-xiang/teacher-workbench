import type { BoardTask, Course, TeachingResource } from '../data/types'
import { SECTIONS, WEEK_DAYS } from './courses'
import { iso, shift, todayIso } from './dates'
import { parseReminderNaturalLanguage } from './reminder-nlp'

export type AssistantDraft =
  | {
      kind: 'reminder'
      title: string
      scheduledAt: string
      explanation: string
      rawInput: string
    }
  | {
      kind: 'course'
      name: string
      day: number
      section: number
      room: string
      existingId?: string
      mode: 'create' | 'add-session'
    }
  | {
      kind: 'resource'
      title: string
      type: TeachingResource['type']
      course: string
    }
  | {
      kind: 'task'
      title: string
      course: string
      dueDate: string
      taskKind: BoardTask['kind']
    }

export type AssistantParse = {
  text: string
  draft?: AssistantDraft
}

const DAY_INDEX: Record<string, number> = { 一: 0, 二: 1, 三: 2, 四: 3, 五: 4 }

function cleanup(text: string, extras: string[] = []) {
  let next = text
  for (const part of ['请', '帮我', '麻烦', '一下', '一个', '一份', ...extras].sort((a, b) => b.length - a.length)) {
    next = next.replaceAll(part, ' ')
  }
  return next.replace(/[\s，,。.!！?？；;：:]+/g, ' ').trim()
}

function parseCourse(input: string, courses: Course[]): Extract<AssistantDraft, { kind: 'course' }> | undefined {
  if (!/课程|排课|课表|加一节|加节|排一节/.test(input)) return undefined

  const dayMatch = input.match(/(?:周|星期)([一二三四五])/)
  const day = dayMatch ? DAY_INDEX[dayMatch[1]] : 0
  let section = /晚上|晚课/.test(input) ? 4 : /下午/.test(input) ? 2 : /上午/.test(input) ? 0 : 2
  const sectionMatch = input.match(/第?\s*([1-8])\s*[–\-到至和]?\s*([1-8])?\s*节/)
  if (sectionMatch) {
    const start = Number(sectionMatch[1])
    section = start <= 2 ? 0 : start <= 4 ? 1 : start <= 6 ? 2 : 3
  }

  const roomMatch = input.match(/([\u4e00-\u9fa5A-Za-z0-9]+楼\s*\d{2,4})/)
  const room = roomMatch?.[1] ?? '待定教室'
  const name = cleanup(input, [
    '在',
    '加一节',
    '加节',
    '排一节',
    '排课',
    '课程',
    '课表',
    dayMatch?.[0] ?? '',
    sectionMatch?.[0] ?? '',
    '上午',
    '下午',
    '晚上',
    '晚课',
    room,
  ])
  if (!name) return undefined

  const existing = courses.find((course) => name.includes(course.name) || course.name.includes(name))
  return {
    kind: 'course',
    name: existing?.name ?? name,
    day: day ?? 0,
    section,
    room,
    existingId: existing?.id,
    mode: existing ? 'add-session' : 'create',
  }
}

function parseResource(input: string, courses: Course[]): Extract<AssistantDraft, { kind: 'resource' }> | undefined {
  if (!/资源|课件|教案|上传|文献|试题|观察记录/.test(input)) return undefined
  const type: TeachingResource['type'] = /试题|测验|试卷/.test(input)
    ? '试题'
    : /视频/.test(input)
      ? '视频'
      : /文献|论文/.test(input)
        ? '文献'
        : /课件|PPT|ppt/.test(input)
          ? '课件'
          : '教案'
  const course = courses.find((item) => input.includes(item.name))
  const title = cleanup(input, ['上传', '到资源库', '资源库', '资源', '添加到', '加入', course?.name ?? '']) || '未命名资源'
  return { kind: 'resource', title, type, course: course?.name ?? '' }
}

function parseTask(input: string, courses: Course[]): Extract<AssistantDraft, { kind: 'task' }> | undefined {
  if (!/任务|看板|待办/.test(input)) return undefined
  const reminder = parseReminderNaturalLanguage(input)
  const course = courses.find((item) => input.includes(item.name))
  const title = cleanup(input, ['任务', '看板', '待办', '加上', '创建', course?.name ?? '']) || input.trim()
  const taskKind: BoardTask['kind'] = /学生|作业|论文/.test(input) ? '学生' : /教务|成绩/.test(input) ? '教务' : /教研/.test(input) ? '教研' : '教学'
  return {
    kind: 'task',
    title,
    course: course ? `${course.name} · ${course.className}` : '教学工作台',
    dueDate: reminder?.scheduledAt.slice(0, 10) ?? iso(shift(new Date(`${todayIso()}T12:00:00`), 1)),
    taskKind,
  }
}

export function parseAssistantInput(input: string, courses: Course[]): AssistantParse {
  const text = input.trim()
  if (!text) return { text: '请先说要记什么。' }

  if (/学生|花名册|成绩/.test(text) && !/任务|看板|提醒/.test(text)) {
    return { text: '学生与过程性评价请到「学生与评价」查看或导入花名册。我可以帮你记提醒、加课、登资源和看板任务。' }
  }

  const reminderLike = /提醒|记得|别忘|备忘|通知/.test(text)
  if (reminderLike) {
    const parsed = parseReminderNaturalLanguage(text)
    if (parsed) {
      return {
        text: `将写入提醒「${parsed.title}」。\n${parsed.explanation}`,
        draft: { kind: 'reminder', title: parsed.title, scheduledAt: parsed.scheduledAt, explanation: parsed.explanation, rawInput: text },
      }
    }
    return { text: '我没识别到时间。可以说「明天下午3点提醒我批改作业」。' }
  }

  const course = parseCourse(text, courses)
  if (course) {
    const when = `${WEEK_DAYS[course.day]} ${SECTIONS[course.section]} · ${course.room}`
    return {
      text: course.mode === 'add-session' ? `将为已有课程「${course.name}」加一时段：${when}` : `将新建课程「${course.name}」，时段 ${when}`,
      draft: course,
    }
  }

  const resource = parseResource(text, courses)
  if (resource) {
    return {
      text: `将在资源库登记「${resource.title}」（${resource.type}${resource.course ? ` · ${resource.course}` : ''}）。确认后可再补传文件。`,
      draft: resource,
    }
  }

  const task = parseTask(text, courses)
  if (task) {
    return { text: `将在教学看板新增任务「${task.title}」，截止 ${task.dueDate}。`, draft: task }
  }

  const parsed = parseReminderNaturalLanguage(text)
  if (parsed) {
    return {
      text: `将写入提醒「${parsed.title}」。\n${parsed.explanation}`,
      draft: { kind: 'reminder', title: parsed.title, scheduledAt: parsed.scheduledAt, explanation: parsed.explanation, rawInput: text },
    }
  }

  return {
    text: '可以说：\n· 「明天 8:30 提醒我批改作业」\n· 「周三下午加一节教育心理学」\n· 「把课堂观察记录加到资源库」\n· 「看板加一个整理教案的任务」',
  }
}

export function draftSummary(draft: AssistantDraft): { title: string; meta: string } {
  if (draft.kind === 'reminder') return { title: draft.title, meta: draft.explanation }
  if (draft.kind === 'course') {
    return {
      title: draft.name,
      meta: `${WEEK_DAYS[draft.day]} ${SECTIONS[draft.section]} · ${draft.room}${draft.mode === 'add-session' ? '（加时段）' : '（新建）'}`,
    }
  }
  if (draft.kind === 'resource') return { title: draft.title, meta: `${draft.type}${draft.course ? ` · ${draft.course}` : ''}` }
  return { title: draft.title, meta: `${draft.course} · ${draft.dueDate}` }
}
