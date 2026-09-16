import type { Course } from '../data/types'
import { formatSession } from './courses'
import { todayIso, weekdayLabel } from './dates'
import {
  draftFromModel,
  draftSummary,
  type AssistantParse,
} from './assistant'

type ChatTurn = {
  role: 'user' | 'assistant'
  content: string
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function buildAssistantSystemPrompt(courses: Course[]) {
  const now = new Date()
  const courseLines = courses.length
    ? courses
        .map((course) => {
          const sessions = course.sessions.map((item) => formatSession(item)).join('、')
          return `- ${course.name}｜id:${course.id}｜${course.className}｜${sessions || '暂无时段'}`
        })
        .join('\n')
    : '（暂无课程）'

  return [
    '你是师范院校教育学院讲师的教学工作台助手。',
    '只帮老师整理本机工作台：提醒、排课、资源库登记、看板任务。不代写、不查重、不声称已经写入。',
    `现在是 ${todayIso()} ${weekdayLabel(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}。按本地时间理解「今天/明天/周几」。`,
    `已有课程：\n${courseLines}`,
    '只返回 JSON，不要 markdown。形状：{"text":"给老师的短回复","draft":null或对象}',
    'draft 只能是下列之一：',
    '提醒 {"kind":"reminder","title":"","scheduledAt":"YYYY-MM-DDTHH:mm:00","explanation":"为何是这个时间"}',
    '排课 {"kind":"course","name":"","day":0到4周一=0,"section":0到4其中0=1-2节,1=3-4节,2=5-6节,3=7-8节,4=晚上,"room":"","mode":"create或add-session","existingId":"匹配到的课程id可空"}',
    '资源 {"kind":"resource","title":"","type":"课件|教案|试题|视频|文献","course":"课程名可空"}',
    '任务 {"kind":"task","title":"","course":"课程或工作台","dueDate":"YYYY-MM-DD","taskKind":"教学|学生|教务|教研"}',
    '闲聊或问教学问题时 draft 为 null。要改工作台数据时必须给 draft，由老师在界面点确认。',
    'text 用「将写入」，不要说已经设置、已经添加。',
    '匹配已有课程时用 add-session 并填 existingId。没说教室就「待定教室」。没说钟点的提醒默认 09:00。',
    '学生成绩、花名册不要写 draft，引导去「学生与评价」。',
  ].join('\n')
}

function chatContent(data: unknown) {
  if (!data || typeof data !== 'object') return ''
  const choices = (data as { choices?: { message?: { content?: unknown } }[] }).choices
  const content = choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === 'object' && 'text' in part ? String((part as { text: unknown }).text ?? '') : '',
      )
      .join('')
  }
  return ''
}

function errorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== 'object') return fallback
  const error = (data as { error?: unknown }).error
  if (typeof error === 'string' && error.trim()) return error.trim()
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim()
    if (message) return message
  }
  return fallback
}

export function parseAssistantModelOutput(raw: string, input: string, courses: Course[]): AssistantParse {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const parsed = JSON.parse(trimmed) as unknown
  if (!parsed || typeof parsed !== 'object') throw new Error('模型没有返回可用结果')
  const row = parsed as Record<string, unknown>
  const text = String(row.text ?? '').trim()
  const draft = draftFromModel(row.draft, input, courses)
  if (!text && !draft) throw new Error('模型没有返回可用结果')
  if (draft) return { text: text || `将写入「${draftSummary(draft).title}」。`, draft }
  return { text: text || '可以说得再具体一些，例如提醒、加课、资源或看板任务。' }
}

export async function askAssistant(opts: {
  input: string
  courses: Course[]
  history: ChatTurn[]
}): Promise<AssistantParse> {
  const messages = [
    { role: 'system', content: buildAssistantSystemPrompt(opts.courses) },
    ...opts.history.map((item) => ({ role: item.role, content: item.content.slice(0, 800) })),
    { role: 'user', content: opts.input },
  ]

  let response: Response
  try {
    response = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    })
  } catch {
    throw new Error('浏览器没能连上豆包。请确认已用 npm run dev 打开本机工作台')
  }

  const data = (await response.json().catch(() => null)) as unknown
  if (!response.ok) {
    throw new Error(errorMessage(data, `豆包接口返回 ${response.status}`))
  }

  const content = chatContent(data)
  if (!content.trim()) throw new Error('模型没有返回可用结果')
  try {
    return parseAssistantModelOutput(content, opts.input, opts.courses)
  } catch {
    throw new Error('模型返回无法整理成草稿，请换一种说法再试')
  }
}
