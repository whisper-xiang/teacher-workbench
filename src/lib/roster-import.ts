import { calcGradeTotal } from '../data/store'
import type { Course, GradeItem, StudentRecord } from '../data/types'

export const ROSTER_TEXT_LIMIT = 20_000
const ROW_LIMIT = 200

export type RosterFormat = 'grade-csv' | 'csv' | 'tsv' | 'html-table' | 'json' | 'line-list' | 'unknown'

export type RosterDraft = {
  name: string
  number: string
  usual?: number
  midterm?: number
  final?: number
}

export type RosterImportParse = {
  format: RosterFormat
  formatLabel: string
  text: string
  students: RosterDraft[]
}

export type RosterPreviewRow = RosterDraft & {
  key: string
  selected: boolean
  action: 'create' | 'exists'
}

const FORMAT_LABEL: Record<RosterFormat, string> = {
  'grade-csv': '成绩表',
  csv: '逗号分隔表',
  tsv: '制表符表（Excel 粘贴）',
  'html-table': '网页 / 教务表格',
  json: 'JSON 名单',
  'line-list': '逐行名单',
  unknown: '未识别格式',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value))
}

export function formatRosterLabel(format: RosterFormat) {
  return FORMAT_LABEL[format]
}

export function isStudentNumber(value: string) {
  return /^\d[\d-]{6,18}[A-Za-z]?$/.test(value.trim())
}

export function isPersonName(value: string) {
  const text = value.trim()
  if (!text || text.length > 16) return false
  if (/班|学院|学号|姓名|名字|专业|课程|序号|平时|期中|期末|总评|等级/.test(text)) return false
  if (/^[\u4e00-\u9fff·]{2,8}$/.test(text)) return true
  return /^[A-Za-z][A-Za-z\s·.'-]{1,24}$/.test(text)
}

function parseScore(value: unknown): number | undefined {
  if (value == null || value === '') return undefined
  const text = String(value).trim()
  if (!text || text === '-' || text === '—') return undefined
  const n = Number(text)
  if (!Number.isFinite(n)) return undefined
  return clampScore(n)
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i += 1
        continue
      }
      if (ch === '"') {
        quoted = false
        continue
      }
      current += ch
      continue
    }
    if (ch === '"') {
      quoted = true
      continue
    }
    if (ch === ',' || ch === '\t' || ch === ';' || ch === '，' || ch === '；') {
      out.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  out.push(current.trim())
  return out
}

function splitCells(line: string): string[] {
  const normalized = line
    .trim()
    .replace(/[（(](\d[\d-]{6,18}[A-Za-z]?)[）)]/g, ' $1 ')
    .replace(/^\d+[.、．)）]\s*/, '')
  const csv = parseCsvLine(normalized).filter(Boolean)
  if (csv.length >= 2) return csv
  return normalized
    .split(/[\s,，;；|]+/)
    .map((cell) => cell.trim())
    .filter(Boolean)
}

function headerMap(cells: string[]) {
  const indexOf = (pattern: RegExp) => cells.findIndex((cell) => pattern.test(cell.replace(/\s/g, '')))
  return {
    name: indexOf(/姓名|名字/),
    number: indexOf(/学号|学籍/),
    usual: indexOf(/平时|过程/),
    midterm: indexOf(/期中/),
    final: indexOf(/期末/),
  }
}

function draftFromCells(cells: string[], map?: ReturnType<typeof headerMap>): RosterDraft | null {
  const name = map && map.name >= 0 ? cells[map.name] ?? '' : ''
  const number = map && map.number >= 0 ? cells[map.number] ?? '' : ''
  const pickedName = isPersonName(name) ? name : cells.find(isPersonName)
  const pickedNumber = isStudentNumber(number) ? number : cells.find(isStudentNumber)
  const resolvedName = (pickedName || (name && !isStudentNumber(name) ? name : '')).trim()
  if (!resolvedName || /^(姓名|名字|学生)$/.test(resolvedName)) return null
  const draft: RosterDraft = {
    name: resolvedName,
    number: (pickedNumber || (isStudentNumber(number) ? number : '')).trim(),
  }
  if (map) {
    const usual = map.usual >= 0 ? parseScore(cells[map.usual]) : undefined
    const midterm = map.midterm >= 0 ? parseScore(cells[map.midterm]) : undefined
    const final = map.final >= 0 ? parseScore(cells[map.final]) : undefined
    if (usual != null) draft.usual = usual
    if (midterm != null) draft.midterm = midterm
    if (final != null) draft.final = final
  }
  return draft
}

function rowsFromText(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitCells)
    .filter((cells) => cells.length)
}

function rowsFromHtml(text: string): string[][] {
  const doc = new DOMParser().parseFromString(text, 'text/html')
  return [...doc.querySelectorAll('tr')].map((row) =>
    [...row.querySelectorAll('th,td')].map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean),
  )
}

function draftsFromRows(rows: string[][]): RosterDraft[] {
  if (!rows.length) return []
  const first = rows[0]
  const map = headerMap(first)
  const hasHeader = map.name >= 0 || map.number >= 0
  const data = hasHeader ? rows.slice(1) : rows
  const mapped = hasHeader ? map : undefined
  return data.map((cells) => draftFromCells(cells, mapped)).filter((item): item is RosterDraft => Boolean(item))
}

function asStudentLike(value: unknown): RosterDraft | null {
  if (!isRecord(value)) return null
  const name = String(value.name ?? value.姓名 ?? value.studentName ?? '').trim()
  const number = String(value.number ?? value.学号 ?? value.studentNo ?? value.studentId ?? '').trim()
  if (!name) return null
  const draft: RosterDraft = { name, number: isStudentNumber(number) || number ? number : '' }
  const usual = parseScore(value.usual ?? value.processScore ?? value.平时)
  const midterm = parseScore(value.midterm ?? value.期中)
  const final = parseScore(value.final ?? value.期末)
  if (usual != null) draft.usual = usual
  if (midterm != null) draft.midterm = midterm
  if (final != null) draft.final = final
  return draft
}

function draftsFromJson(parsed: unknown, courseId?: string): RosterDraft[] {
  const list = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.students)
      ? parsed.students
      : []
  const all = list.map(asStudentLike).filter((item): item is RosterDraft => Boolean(item))
  if (!courseId || !isRecord(parsed) || !Array.isArray(parsed.students)) return all
  const forCourse = (parsed.students as unknown[])
    .filter((item) => isRecord(item) && String(item.courseId ?? '') === courseId)
    .map(asStudentLike)
    .filter((item): item is RosterDraft => Boolean(item))
  return forCourse.length ? forCourse : all
}

export function dedupeRoster(rows: RosterDraft[]): RosterDraft[] {
  const seen = new Set<string>()
  const out: RosterDraft[] = []
  for (const row of rows) {
    const key = `${row.number || ''}::${row.name}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
    if (out.length >= ROW_LIMIT) break
  }
  return out
}

export function sniffRosterFormat(raw: string): { format: RosterFormat; formatLabel: string } {
  const text = raw.trim()
  if (!text) return { format: 'unknown', formatLabel: FORMAT_LABEL.unknown }
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      JSON.parse(text)
      return { format: 'json', formatLabel: FORMAT_LABEL.json }
    } catch {
      /* not json */
    }
  }
  if (/<table[\s>]/i.test(text) || /<tr[\s>]/i.test(text) || /<html[\s>]/i.test(text)) {
    return { format: 'html-table', formatLabel: FORMAT_LABEL['html-table'] }
  }
  const header = text.split(/\r?\n/).find((line) => line.trim()) ?? ''
  const cells = splitCells(header)
  const map = headerMap(cells)
  if ((map.name >= 0 || map.number >= 0) && (map.usual >= 0 || map.midterm >= 0 || map.final >= 0)) {
    return { format: 'grade-csv', formatLabel: FORMAT_LABEL['grade-csv'] }
  }
  if (map.name >= 0 || map.number >= 0) {
    const format = header.includes('\t') ? 'tsv' : 'csv'
    return { format, formatLabel: FORMAT_LABEL[format] }
  }
  if (header.includes('\t') && splitCells(header).length >= 2) {
    return { format: 'tsv', formatLabel: FORMAT_LABEL.tsv }
  }
  if (/[,，;；]/.test(header) && splitCells(header).length >= 2) {
    return { format: 'csv', formatLabel: FORMAT_LABEL.csv }
  }
  const lines = text.split(/\r?\n/).filter(Boolean)
  const hits = lines.filter((line) => {
    const cells = splitCells(line)
    return Boolean(cells.find(isPersonName) || cells.find(isStudentNumber))
  }).length
  if (hits >= 1) return { format: 'line-list', formatLabel: FORMAT_LABEL['line-list'] }
  return { format: 'unknown', formatLabel: FORMAT_LABEL.unknown }
}

export function parseRosterLocal(raw: string, courseId?: string): RosterImportParse {
  const text = raw.trim().slice(0, ROSTER_TEXT_LIMIT)
  const sniffed = sniffRosterFormat(text)
  let students: RosterDraft[] = []

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      students = draftsFromJson(JSON.parse(text) as unknown, courseId)
    } catch {
      students = []
    }
  } else if (sniffed.format === 'html-table') {
    students = draftsFromRows(rowsFromHtml(text))
  } else {
    students = draftsFromRows(rowsFromText(text))
  }

  if (!students.length && sniffed.format !== 'json') {
    students = draftsFromRows(rowsFromText(text))
  }

  const unique = dedupeRoster(students)
  return {
    format: sniffed.format,
    formatLabel: FORMAT_LABEL[sniffed.format],
    text: unique.length
      ? `识别为${FORMAT_LABEL[sniffed.format]}，将写入 ${unique.length} 人。`
      : `按${FORMAT_LABEL[sniffed.format]}看过了，没有抽出学生。`,
    students: unique,
  }
}

export function previewRosterRows(roster: StudentRecord[], drafts: RosterDraft[]): RosterPreviewRow[] {
  const numbers = new Set(roster.map((item) => item.number).filter(Boolean))
  const names = new Set(roster.map((item) => item.name))
  return drafts.map((item, index) => {
    const exists = Boolean((item.number && numbers.has(item.number)) || names.has(item.name))
    return {
      ...item,
      key: `${item.number || 'no'}-${item.name}-${index}`,
      selected: !exists,
      action: exists ? 'exists' : 'create',
    }
  })
}

export function applyRosterImport(opts: {
  course: Course
  students: StudentRecord[]
  grades: GradeItem[]
  rows: RosterDraft[]
  uid: (prefix: string) => string
}) {
  const { course, uid } = opts
  let students = opts.students
  let grades = opts.grades
  const existingNumbers = new Set(students.filter((item) => item.courseId === course.id && item.number).map((item) => item.number))
  const existingNames = new Set(students.filter((item) => item.courseId === course.id).map((item) => item.name))
  let created = 0
  let skipped = 0
  let graded = 0

  for (const row of opts.rows) {
    if ((row.number && existingNumbers.has(row.number)) || existingNames.has(row.name)) {
      skipped += 1
      continue
    }
    const id = uid('stu')
    const usual = row.usual ?? 0
    students = [
      ...students,
      {
        id,
        name: row.name,
        number: row.number,
        group: '未分组',
        attendance: '100%',
        homework: '0 / 0',
        status: '正常',
        courseId: course.id,
        className: course.className,
        major: course.major,
        processScore: usual,
        notes: '',
      },
    ]
    existingNames.add(row.name)
    if (row.number) existingNumbers.add(row.number)
    created += 1
    if (row.usual != null || row.midterm != null || row.final != null) {
      const midterm = row.midterm ?? 0
      const final = row.final ?? 0
      grades = [
        ...grades,
        {
          id: uid('grade'),
          courseId: course.id,
          studentId: id,
          usual,
          midterm,
          final,
          total: calcGradeTotal(usual, midterm, final),
        },
      ]
      graded += 1
    }
  }

  return { students, grades, created, skipped, graded }
}

export function studentFromModel(value: unknown): RosterDraft | null {
  if (!isRecord(value)) return null
  const name = String(value.name ?? '').trim()
  if (!name) return null
  const draft: RosterDraft = {
    name,
    number: String(value.number ?? '').trim(),
  }
  const usual = parseScore(value.usual)
  const midterm = parseScore(value.midterm)
  const final = parseScore(value.final)
  if (usual != null) draft.usual = usual
  if (midterm != null) draft.midterm = midterm
  if (final != null) draft.final = final
  return draft
}

export async function readRosterSource(file: File): Promise<string> {
  const lower = file.name.toLowerCase()
  if (/\.(xlsx|xlsm|xlsb)$/.test(lower)) {
    throw new Error('Excel 工作簿请另存为 CSV，或直接从表格复制粘贴')
  }
  const asText = (await file.text()).replace(/^\uFEFF/, '')
  if (asText.includes('\0')) throw new Error('这是二进制文件，请改成 CSV 或复制粘贴')
  const sliced = asText.slice(0, ROSTER_TEXT_LIMIT).trim()
  if (!sliced) throw new Error('文件是空的')
  return sliced
}
