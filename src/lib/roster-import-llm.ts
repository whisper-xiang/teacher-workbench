import { postAssistantMessages } from './assistant-llm'
import {
  ROSTER_TEXT_LIMIT,
  dedupeRoster,
  formatRosterLabel,
  parseRosterLocal,
  sniffRosterFormat,
  studentFromModel,
  type RosterFormat,
  type RosterImportParse,
} from './roster-import'

export type RosterImportResult = RosterImportParse & {
  source: 'ai' | 'local'
}

const LOCAL_READY: RosterFormat[] = ['grade-csv', 'csv', 'tsv', 'json']

function buildRosterSystemPrompt(sniffed: { format: RosterFormat; formatLabel: string }, existing: string[]) {
  const known = existing.length ? existing.map((line) => `- ${line}`).join('\n') : '（本课花名册还是空的）'
  return [
    '你是师范院校教师工作台的花名册导入器。任务是识别用户贴入内容的数据格式，并抽出学生姓名与学号。',
    `本机初判格式：${sniffed.format}（${sniffed.formatLabel}）。若判断不同，以你的识别为准。`,
    `本课已有学生：\n${known}`,
    '只返回 JSON，不要 markdown。形状：',
    '{"format":"csv|tsv|html-table|json|line-list|grade-csv|unknown","formatLabel":"给老师看的中文格式名","text":"一句说明将写入多少人","students":[{"name":"姓名","number":"学号可空","usual":null,"midterm":null,"final":null}]}',
    '忽略表头、序号、教师、空行、班级名。姓名必填。学号没有就 "".',
    '若表里有平时 / 期中 / 期末分数，写成 0 到 100 的数字；没有就省略这些字段。',
    'text 用「将写入」，不要说已经导入。students 最多 200 条。认不出则 students 为空数组并说明原因。',
  ].join('\n')
}

function coerceFormat(value: unknown, fallback: RosterFormat): RosterFormat {
  const raw = String(value ?? '').trim()
  const allowed: RosterFormat[] = ['grade-csv', 'csv', 'tsv', 'html-table', 'json', 'line-list', 'unknown']
  return allowed.includes(raw as RosterFormat) ? (raw as RosterFormat) : fallback
}

export function parseRosterModelOutput(raw: string, fallbackFormat: RosterFormat): RosterImportParse {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const parsed = JSON.parse(trimmed) as unknown
  if (!parsed || typeof parsed !== 'object') throw new Error('模型没有返回可用结果')
  const row = parsed as Record<string, unknown>
  const format = coerceFormat(row.format, fallbackFormat)
  const students = dedupeRoster(
    (Array.isArray(row.students) ? row.students : []).map(studentFromModel).filter((item): item is NonNullable<typeof item> => Boolean(item)),
  )
  const formatLabel = String(row.formatLabel ?? '').trim() || formatRosterLabel(format)
  const text = String(row.text ?? '').trim()
  return {
    format,
    formatLabel,
    text:
      text ||
      (students.length
        ? `识别为${formatLabel}，将写入 ${students.length} 人。`
        : `按${formatLabel}看过了，没有抽出学生。`),
    students,
  }
}

export async function recognizeRosterImport(
  raw: string,
  courseId: string | undefined,
  existingLines: string[],
): Promise<RosterImportResult> {
  const text = raw.trim().slice(0, ROSTER_TEXT_LIMIT)
  if (!text) throw new Error('请先粘贴名单或选择文件')

  const local = parseRosterLocal(text, courseId)
  if (local.students.length && LOCAL_READY.includes(local.format)) {
    return { ...local, source: 'local' }
  }

  try {
    const content = await postAssistantMessages([
      { role: 'system', content: buildRosterSystemPrompt(sniffRosterFormat(text), existingLines) },
      { role: 'user', content: `请识别下面这份花名册的格式并抽出学生：\n\n${text}` },
    ])
    const ai = parseRosterModelOutput(content, local.format)
    if (ai.students.length) return { ...ai, source: 'ai' }
    if (local.students.length) {
      return {
        ...local,
        text: `${ai.text}已改用本机规则，抽出 ${local.students.length} 人。`,
        source: 'local',
      }
    }
    return { ...ai, source: 'ai' }
  } catch (error) {
    if (local.students.length) {
      const reason = error instanceof Error ? error.message : '识别服务不可用'
      return {
        ...local,
        text: `${reason}。已用本机规则识别为${local.formatLabel}，抽出 ${local.students.length} 人。`,
        source: 'local',
      }
    }
    throw error instanceof Error ? error : new Error('没有认出花名册')
  }
}
