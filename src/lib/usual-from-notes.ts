import type { StudentRecord } from '../data/types'
import { completeChat, parseModelJson } from './llm-chat'

export type UsualScoreDraft = {
  studentId: string
  name: string
  usual: number
  reason: string
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 75
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function observationText(student: Pick<StudentRecord, 'notes' | 'observations'>) {
  const lines = (student.observations ?? []).map((item) => `${item.date} ${item.text}`.trim()).filter(Boolean)
  const leftover = student.notes.trim()
  if (leftover && !lines.some((line) => line.includes(leftover))) lines.push(leftover)
  return lines.join('\n')
}

export function heuristicUsual(text: string): { usual: number; reason: string } {
  const body = text.trim()
  if (!body) return { usual: 75, reason: '还没有课堂表现记录，先给一个中位平时分，可再改。' }
  let score = 80
  if (/优秀|很好|出色|突出|积极|认真|带头/.test(body)) score += 10
  if (/良好|不错|较好|投入/.test(body)) score += 5
  if (/一般|平常|稳定/.test(body)) score -= 3
  if (/迟到|缺席|缺勤|走神|需关注|较差|敷衍|不交|偏晚/.test(body)) score -= 12
  return {
    usual: clampScore(score),
    reason: '根据本学期课堂表现文字做了本机粗估，确认后写入平时成绩。',
  }
}

function asDraft(value: unknown, roster: StudentRecord[]): UsualScoreDraft | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const studentId = String(row.studentId ?? row.id ?? '').trim()
  const student = roster.find((item) => item.id === studentId) ?? roster.find((item) => item.name === String(row.name ?? '').trim())
  if (!student) return null
  return {
    studentId: student.id,
    name: student.name,
    usual: clampScore(Number(row.usual)),
    reason: String(row.reason ?? '').trim() || '根据课堂表现生成。',
  }
}

export async function proposeUsualScores(roster: StudentRecord[], courseName: string): Promise<UsualScoreDraft[]> {
  const lines = roster.map((student) => {
    const notes = observationText(student) || '（无文字记录）'
    return `- id:${student.id} 姓名:${student.name}\n${notes}`
  })
  const raw = await completeChat({
    system: '你只返回 JSON，不解释。你是师范院校教育学院讲师的过程性评价助手，根据老师写下的课堂表现文字估平时成绩，不编造没写过的事实。',
    user: [
      `课程：${courseName}`,
      '请为每位学生给出平时成绩（0-100 整数）和一两句依据，依据必须来自老师的文字。没有记录的给 75，并说明待补。',
      '只返回 JSON：{"scores":[{"studentId":"","usual":80,"reason":""}]}',
      lines.join('\n\n'),
    ].join('\n\n'),
    temperature: 0.2,
  })
  const parsed = parseModelJson(raw)
  const rows = parsed && typeof parsed === 'object' ? (parsed as { scores?: unknown }).scores : null
  const fromModel = Array.isArray(rows)
    ? rows.map((row) => asDraft(row, roster)).filter((item): item is UsualScoreDraft => Boolean(item))
    : []
  const seen = new Set(fromModel.map((item) => item.studentId))
  const missing = roster
    .filter((student) => !seen.has(student.id))
    .map((student) => {
      const guessed = heuristicUsual(observationText(student))
      return { studentId: student.id, name: student.name, ...guessed }
    })
  return [...fromModel, ...missing]
}

export function localUsualScores(roster: StudentRecord[]): UsualScoreDraft[] {
  return roster.map((student) => {
    const guessed = heuristicUsual(observationText(student))
    return { studentId: student.id, name: student.name, ...guessed }
  })
}
