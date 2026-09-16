import type { Course } from '../data/types'
import { formatSession } from './courses'
import { postAssistantMessages } from './assistant-llm'
import {
  TIMETABLE_TEXT_LIMIT,
  dedupeSlots,
  formatLabelOf,
  parseTimetableLocal,
  slotFromModel,
  sniffTimetableFormat,
  type TimetableFormat,
  type TimetableImportParse,
} from './timetable-import'

export type TimetableImportResult = TimetableImportParse & {
  source: 'ai' | 'local'
}

function buildTimetableSystemPrompt(courses: Course[], sniffed: { format: TimetableFormat; formatLabel: string }) {
  const courseLines = courses.length
    ? courses
        .map((course) => {
          const sessions = course.sessions.map((item) => formatSession(item)).join('、')
          return `- ${course.name}｜${sessions || '暂无时段'}`
        })
        .join('\n')
    : '（暂无课程）'

  return [
    '你是师范院校教师工作台的课表导入器。任务是识别用户贴入内容的数据格式，并抽出周一到周五的上课格子。',
    `本机初判格式：${sniffed.format}（${sniffed.formatLabel}）。若判断不同，以你的识别为准。`,
    `已有课程（同名请用准确课名）：\n${courseLines}`,
    '只返回 JSON，不要 markdown。形状：',
    '{"format":"csv|tsv|json|html-table|week-grid|line-list|workbench-json|unknown","formatLabel":"给老师看的中文格式名","text":"一句说明将写入多少格子","slots":[{"name":"课程名","day":0,"section":0,"room":"教室"}]}',
    'day：0=周一 … 4=周五。不要周六日。',
    'section：0=1-2节，1=3-4节，2=5-6节，3=7-8节，4=晚上。',
    '没写教室就 "待定教室"。忽略值班、会议、班会、空格子。班级名不要拼进课名。',
    'text 用「将写入」，不要说已经导入。slots 最多 40 条。认不出则 slots 为空数组并说明原因。',
  ].join('\n')
}

function coerceFormat(value: unknown, fallback: TimetableFormat): TimetableFormat {
  const raw = String(value ?? '').trim()
  const allowed: TimetableFormat[] = [
    'workbench-json',
    'slot-json',
    'csv',
    'tsv',
    'html-table',
    'week-grid',
    'line-list',
    'unknown',
  ]
  if (raw === 'json') return 'slot-json'
  return allowed.includes(raw as TimetableFormat) ? (raw as TimetableFormat) : fallback
}

export function parseTimetableModelOutput(raw: string, fallbackFormat: TimetableFormat): TimetableImportParse {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const parsed = JSON.parse(trimmed) as unknown
  if (!parsed || typeof parsed !== 'object') throw new Error('模型没有返回可用结果')
  const row = parsed as Record<string, unknown>
  const format = coerceFormat(row.format, fallbackFormat)
  const slots = dedupeSlots(
    (Array.isArray(row.slots) ? row.slots : []).map(slotFromModel).filter((item): item is NonNullable<typeof item> => Boolean(item)),
  )
  const formatLabel = String(row.formatLabel ?? '').trim() || formatLabelOf(format)
  const text = String(row.text ?? '').trim()
  return {
    format,
    formatLabel,
    text:
      text ||
      (slots.length
        ? `识别为${formatLabel}，将写入 ${slots.length} 个上课格子。`
        : `按${formatLabel}看过了，没有抽出上课格子。`),
    slots,
  }
}

export async function recognizeTimetableImport(raw: string, courses: Course[]): Promise<TimetableImportResult> {
  const text = raw.trim().slice(0, TIMETABLE_TEXT_LIMIT)
  if (!text) throw new Error('请先粘贴课表或选择文件')

  const local = parseTimetableLocal(text)
  if (local.format === 'workbench-json' && local.slots.length) {
    return { ...local, source: 'local' }
  }

  try {
    const content = await postAssistantMessages([
      { role: 'system', content: buildTimetableSystemPrompt(courses, sniffTimetableFormat(text)) },
      { role: 'user', content: `请识别下面这份课表的格式并抽出格子：\n\n${text}` },
    ])
    const ai = parseTimetableModelOutput(content, local.format)
    if (ai.slots.length) return { ...ai, source: 'ai' }
    if (local.slots.length) {
      return {
        ...local,
        text: `${ai.text}已改用本机规则，抽出 ${local.slots.length} 格。`,
        source: 'local',
      }
    }
    return { ...ai, source: 'ai' }
  } catch (error) {
    if (local.slots.length) {
      const reason = error instanceof Error ? error.message : '识别服务不可用'
      return {
        ...local,
        text: `${reason}。已用本机规则识别为${local.formatLabel}，抽出 ${local.slots.length} 格。`,
        source: 'local',
      }
    }
    throw error instanceof Error ? error : new Error('没有认出课表')
  }
}
