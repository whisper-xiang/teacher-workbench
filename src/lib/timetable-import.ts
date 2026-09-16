import type { Course } from '../data/types'
import { SECTIONS, WEEK_DAYS, createCourseFromSlot } from './courses'

export const TIMETABLE_TEXT_LIMIT = 12_000
const SLOT_LIMIT = 40

export type TimetableFormat =
  | 'workbench-json'
  | 'slot-json'
  | 'csv'
  | 'tsv'
  | 'html-table'
  | 'week-grid'
  | 'line-list'
  | 'unknown'

export type TimetableSlotDraft = {
  name: string
  day: number
  section: number
  room: string
}

export type TimetableImportParse = {
  format: TimetableFormat
  formatLabel: string
  text: string
  slots: TimetableSlotDraft[]
}

export type TimetablePreviewRow = TimetableSlotDraft & {
  key: string
  selected: boolean
  action: 'create' | 'add-session' | 'exists'
  occupiedBy?: string
}

const FORMAT_LABEL: Record<TimetableFormat, string> = {
  'workbench-json': '工作台备份里的课程',
  'slot-json': 'JSON 课表',
  csv: '逗号分隔表',
  tsv: '制表符表（Excel 粘贴）',
  'html-table': '网页 / 教务表格',
  'week-grid': '周课表网格',
  'line-list': '逐行课表',
  unknown: '未识别格式',
}

const DAY_INDEX: Record<string, number> = { 一: 0, 二: 1, 三: 2, 四: 3, 五: 4 }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function formatLabelOf(format: TimetableFormat) {
  return FORMAT_LABEL[format]
}

export function parseDayToken(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.round(value)
    if (n >= 0 && n <= 4) return n
    if (n === 5) return 4
    return null
  }
  const text = String(value ?? '').trim()
  if (!text) return null
  const named = text.match(/(?:周|星期|礼拜)\s*([一二三四五1-5])/)
  if (named) {
    const token = named[1]
    if (token in DAY_INDEX) return DAY_INDEX[token]
    const n = Number(token)
    if (n >= 1 && n <= 5) return n - 1
  }
  if (/^([一二三四五])$/.test(text)) return DAY_INDEX[text]
  const n = Number(text)
  if (Number.isFinite(n)) {
    if (n >= 0 && n <= 4) return n
    if (n === 5) return 4
  }
  return null
}

export function parseSectionToken(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.round(value)
    if (n >= 0 && n <= 4) return n
    if (n >= 1 && n <= 5) return n - 1
    return null
  }
  const text = String(value ?? '').trim()
  if (!text) return null
  if (/晚上|晚课|第?\s*9|19\s*[:：点]/.test(text)) return 4
  if (/7\s*[–\-到至和、,，]?\s*8|第?\s*[78]\s*节|16\s*[:：点]/.test(text)) return 3
  if (/5\s*[–\-到至和、,，]?\s*6|第?\s*[56]\s*节|14\s*[:：点]/.test(text)) return 2
  if (/3\s*[–\-到至和、,，]?\s*4|第?\s*[34]\s*节|10\s*[:：点]/.test(text)) return 1
  if (/1\s*[–\-到至和、,，]?\s*2|第?\s*[12]\s*节|08\s*[:：点]|8\s*[:：点]/.test(text)) return 0
  if (/下午/.test(text)) return 2
  if (/上午/.test(text)) return 0
  const n = Number(text)
  if (Number.isFinite(n)) {
    if (n >= 0 && n <= 4) return n
    if (n >= 1 && n <= 5) return n - 1
  }
  return null
}

export function cleanCourseName(value: string) {
  return value
    .replace(/^[《「『]+|[》」』]+$/g, '')
    .replace(/^\s*(课程|课名|名称)\s*[:：]\s*/, '')
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/[（(][^）)]*班[）)]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseRoomToken(text: string) {
  const matched = text.match(
    /([\u4e00-\u9fa5A-Za-z0-9]+楼\s*[A-Za-z]?\d{2,4}(?:-\d{2,4})?|[A-Za-z]?\d{3,4}\s*教室|待定教室)/,
  )
  return matched?.[1]?.replace(/\s+/g, ' ').trim() ?? ''
}

function normalizeSlot(input: {
  name?: string
  day?: number | null
  section?: number | null
  room?: string
}): TimetableSlotDraft | null {
  const name = cleanCourseName(input.name ?? '')
  if (!name || name.length > 40) return null
  if (/值班|会议|教研|班会|空|无课|自习/.test(name) && name.length <= 6) return null
  const day = input.day
  const section = input.section
  if (day == null || section == null || day < 0 || day > 4 || section < 0 || section > 4) return null
  return {
    name,
    day,
    section,
    room: input.room?.trim() || '待定教室',
  }
}

export function dedupeSlots(slots: TimetableSlotDraft[]) {
  const map = new Map<string, TimetableSlotDraft>()
  for (const slot of slots) {
    const key = `${slot.name}\0${slot.day}\0${slot.section}`
    const prev = map.get(key)
    if (!prev || (prev.room === '待定教室' && slot.room !== '待定教室')) map.set(key, slot)
  }
  return [...map.values()].slice(0, SLOT_LIMIT)
}

function pickField(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const direct = row[key]
    if (direct != null && String(direct).trim()) return direct
    const found = Object.entries(row).find(([name]) => name.includes(key))
    if (found && String(found[1] ?? '').trim()) return found[1]
  }
  return undefined
}

export function slotFromUnknown(value: unknown): TimetableSlotDraft | null {
  if (!isRecord(value)) return null
  const name = String(pickField(value, ['name', '课程名称', '课程名', '课名', '课程', 'title']) ?? '').trim()
  const dayRaw = pickField(value, ['day', '星期', '周几', '星期几', 'weekday'])
  const sectionRaw = pickField(value, ['section', '节次', '节', '时段', '大节'])
  const room = String(pickField(value, ['room', '教室', '地点', '上课地点', 'location']) ?? '').trim()
  return normalizeSlot({
    name,
    day: parseDayToken(dayRaw),
    section: parseSectionToken(sectionRaw),
    room: room || parseRoomToken(`${name} ${room}`),
  })
}

function slotsFromCourses(courses: unknown): TimetableSlotDraft[] {
  if (!Array.isArray(courses)) return []
  const slots: TimetableSlotDraft[] = []
  for (const item of courses) {
    if (!isRecord(item)) continue
    const name = String(item.name ?? '').trim()
    const sessions = Array.isArray(item.sessions) ? item.sessions : []
    for (const session of sessions) {
      if (!isRecord(session)) continue
      const slot = normalizeSlot({
        name,
        day: parseDayToken(session.day),
        section: parseSectionToken(session.section),
        room: String(session.room ?? ''),
      })
      if (slot) slots.push(slot)
    }
  }
  return slots
}

function slotsFromJson(value: unknown): { format: TimetableFormat; slots: TimetableSlotDraft[] } {
  if (Array.isArray(value)) {
    const fromCourses = slotsFromCourses(value)
    if (fromCourses.length) return { format: 'workbench-json', slots: fromCourses }
    return { format: 'slot-json', slots: value.map(slotFromUnknown).filter((item): item is TimetableSlotDraft => Boolean(item)) }
  }
  if (!isRecord(value)) return { format: 'unknown', slots: [] }
  if (Array.isArray(value.courses)) {
    return { format: 'workbench-json', slots: slotsFromCourses(value.courses) }
  }
  if (isRecord(value.data) && Array.isArray(value.data.courses)) {
    return { format: 'workbench-json', slots: slotsFromCourses(value.data.courses) }
  }
  if (Array.isArray(value.slots)) {
    return {
      format: 'slot-json',
      slots: value.slots.map(slotFromUnknown).filter((item): item is TimetableSlotDraft => Boolean(item)),
    }
  }
  const single = slotFromUnknown(value)
  return { format: single ? 'slot-json' : 'unknown', slots: single ? [single] : [] }
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function htmlTablesToTsv(html: string) {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []
  const lines = rows.map((row) => {
    const cells = row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []
    return cells
      .map((cell) =>
        cell
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .join('\t')
  })
  return lines.filter(Boolean).join('\n')
}

function splitCsvLine(line: string, delimiter: string) {
  if (delimiter !== ',') return line.split(delimiter).map((cell) => cell.trim())
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
}

function detectDelimiter(header: string) {
  if (header.includes('\t')) return '\t'
  if ((header.match(/;/g) ?? []).length > (header.match(/,/g) ?? []).length) return ';'
  if (header.includes(',')) return ','
  return '\t'
}

function headerIndex(cells: string[], keys: string[]) {
  return cells.findIndex((cell) => keys.some((key) => cell.includes(key)))
}

function parseDelimitedList(text: string): TimetableSlotDraft[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const delimiter = detectDelimiter(lines[0])
  const header = splitCsvLine(lines[0], delimiter)
  const nameAt = headerIndex(header, ['课程名称', '课程名', '课名', '课程', 'name'])
  const dayAt = headerIndex(header, ['星期', '周几', '星期几', 'weekday', 'day'])
  const sectionAt = headerIndex(header, ['节次', '节', '时段', 'section'])
  const roomAt = headerIndex(header, ['教室', '地点', 'room'])
  if (nameAt < 0 || (dayAt < 0 && sectionAt < 0)) return []
  const slots: TimetableSlotDraft[] = []
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line, delimiter)
    const blob = cells.join(' ')
    const slot = normalizeSlot({
      name: cells[nameAt] ?? '',
      day: parseDayToken(dayAt >= 0 ? cells[dayAt] : blob),
      section: parseSectionToken(sectionAt >= 0 ? cells[sectionAt] : blob),
      room: (roomAt >= 0 ? cells[roomAt] : '') || parseRoomToken(blob),
    })
    if (slot) slots.push(slot)
  }
  return slots
}

function parseWeekGrid(text: string): TimetableSlotDraft[] {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\u00a0/g, ' ').trimEnd()).filter((line) => line.trim())
  if (!lines.length) return []
  const delimiter = lines.some((line) => line.includes('\t')) ? '\t' : /,{2,}/.test(lines[0]) ? ',' : /\s{2,}/
  const rows = lines.map((line) =>
    typeof delimiter === 'string' ? line.split(delimiter).map((cell) => cell.trim()) : line.split(delimiter).map((cell) => cell.trim()),
  )
  const headerIndexRow = rows.findIndex((cells) => cells.filter((cell) => parseDayToken(cell) != null).length >= 3)
  if (headerIndexRow < 0) return []
  const header = rows[headerIndexRow]
  const dayAt = header.map((cell) => parseDayToken(cell))
  const slots: TimetableSlotDraft[] = []
  for (const cells of rows.slice(headerIndexRow + 1)) {
    const section = parseSectionToken(cells[0] ?? '')
    if (section == null) continue
    cells.forEach((cell, index) => {
      if (index === 0) return
      const day = dayAt[index]
      if (day == null || !cell) return
      const room = parseRoomToken(cell)
      const name = cleanCourseName(room ? cell.replace(room, ' ') : cell)
      const slot = normalizeSlot({ name, day, section, room })
      if (slot) slots.push(slot)
    })
  }
  return slots
}

function parseLineList(text: string): TimetableSlotDraft[] {
  const slots: TimetableSlotDraft[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const day = parseDayToken(trimmed)
    const section = parseSectionToken(trimmed)
    if (day == null || section == null) continue
    const room = parseRoomToken(trimmed)
    const name = cleanCourseName(
      trimmed
        .replace(/(?:周|星期|礼拜)\s*[一二三四五1-5]/, ' ')
        .replace(/第?\s*[1-9]\s*[–\-到至和、,，]?\s*[1-9]?\s*节/g, ' ')
        .replace(/上午|下午|晚上|晚课/g, ' ')
        .replace(room, ' ')
        .replace(/在|于|教室/g, ' '),
    )
    const slot = normalizeSlot({ name, day, section, room })
    if (slot) slots.push(slot)
  }
  return slots
}

export function sniffTimetableFormat(raw: string): { format: TimetableFormat; formatLabel: string } {
  const text = raw.trim()
  if (!text) return { format: 'unknown', formatLabel: FORMAT_LABEL.unknown }
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as unknown
      const fromJson = slotsFromJson(parsed)
      if (fromJson.format !== 'unknown' || fromJson.slots.length) {
        return { format: fromJson.format, formatLabel: FORMAT_LABEL[fromJson.format] }
      }
    } catch {
      /* not json */
    }
  }
  if (/<table[\s>]/i.test(text) || /<tr[\s>]/i.test(text) || /<html[\s>]/i.test(text)) {
    return { format: 'html-table', formatLabel: FORMAT_LABEL['html-table'] }
  }
  const firstLines = text.split(/\r?\n/).slice(0, 6).join('\n')
  if ((/周一|星期一/.test(firstLines) && /周二|星期二/.test(firstLines)) || /节次/.test(firstLines)) {
    if (parseWeekGrid(text).length || /[\t].*周/.test(firstLines)) {
      return { format: 'week-grid', formatLabel: FORMAT_LABEL['week-grid'] }
    }
  }
  const header = text.split(/\r?\n/).find((line) => line.trim()) ?? ''
  if (/课程/.test(header) && /星期|周几|节次/.test(header)) {
    return { format: header.includes('\t') ? 'tsv' : 'csv', formatLabel: FORMAT_LABEL[header.includes('\t') ? 'tsv' : 'csv'] }
  }
  const lineHits = text.split(/\r?\n/).filter((line) => parseDayToken(line) != null && parseSectionToken(line) != null).length
  if (lineHits >= 2) return { format: 'line-list', formatLabel: FORMAT_LABEL['line-list'] }
  return { format: 'unknown', formatLabel: FORMAT_LABEL.unknown }
}

export function parseTimetableLocal(raw: string): TimetableImportParse {
  const text = raw.trim().slice(0, TIMETABLE_TEXT_LIMIT)
  const sniffed = sniffTimetableFormat(text)
  let slots: TimetableSlotDraft[] = []

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      slots = slotsFromJson(JSON.parse(text) as unknown).slots
    } catch {
      slots = []
    }
  }

  if (!slots.length && sniffed.format === 'html-table') {
    const tsv = htmlTablesToTsv(text)
    slots = parseWeekGrid(tsv)
    if (!slots.length) slots = parseDelimitedList(tsv)
    if (!slots.length) slots = parseLineList(stripHtml(text))
  }

  if (!slots.length) slots = parseWeekGrid(text)
  if (!slots.length) slots = parseDelimitedList(text)
  if (!slots.length) slots = parseLineList(text)

  const unique = dedupeSlots(slots)
  const format = sniffed.format === 'unknown' && unique.length ? 'line-list' : sniffed.format
  return {
    format,
    formatLabel: FORMAT_LABEL[format],
    text: unique.length
      ? `识别为${FORMAT_LABEL[format]}，抽出 ${unique.length} 个上课格子。确认后写入课表并同步日程。`
      : `按${FORMAT_LABEL[format]}看过了，没有抽出上课格子。`,
    slots: unique,
  }
}

export function slotFromModel(value: unknown): TimetableSlotDraft | null {
  return slotFromUnknown(value)
}

export function matchCourseByName(courses: Course[], name: string) {
  const trimmed = cleanCourseName(name)
  if (!trimmed) return undefined
  return (
    courses.find((course) => course.name === trimmed) ??
    courses.find((course) => trimmed.includes(course.name) || course.name.includes(trimmed))
  )
}

export function previewTimetableSlots(courses: Course[], slots: TimetableSlotDraft[]): TimetablePreviewRow[] {
  return slots.map((slot, index) => {
    const existing = matchCourseByName(courses, slot.name)
    const exists = Boolean(
      existing?.sessions.some((item) => item.day === slot.day && item.section === slot.section),
    )
    const occupied = courses.find((course) =>
      course.sessions.some((item) => item.day === slot.day && item.section === slot.section && course.id !== existing?.id),
    )
    const action = exists ? 'exists' : existing ? 'add-session' : 'create'
    return {
      ...slot,
      name: existing?.name ?? slot.name,
      key: `${slot.name}-${slot.day}-${slot.section}-${index}`,
      selected: action !== 'exists',
      action,
      occupiedBy: occupied?.name,
    }
  })
}

export function applyTimetableSlots(
  courses: Course[],
  slots: TimetableSlotDraft[],
  weekNumber: number,
  nextId: (prefix: string) => string,
): { courses: Course[]; created: number; added: number; skipped: number } {
  let next = courses
  let created = 0
  let added = 0
  let skipped = 0

  for (const slot of slots) {
    const existing = matchCourseByName(next, slot.name)
    if (existing) {
      const taken = existing.sessions.some((item) => item.day === slot.day && item.section === slot.section)
      if (taken) {
        skipped += 1
        continue
      }
      next = next.map((course) =>
        course.id === existing.id
          ? { ...course, sessions: [...course.sessions, { day: slot.day, section: slot.section, room: slot.room }] }
          : course,
      )
      added += 1
      continue
    }
    next = [
      ...next,
      createCourseFromSlot({
        id: nextId('course'),
        classId: nextId('class'),
        name: slot.name,
        day: slot.day,
        section: slot.section,
        room: slot.room,
        weekNumber,
      }),
    ]
    created += 1
  }

  return { courses: next, created, added, skipped }
}

export function slotWhenLabel(slot: Pick<TimetableSlotDraft, 'day' | 'section' | 'room'>) {
  return `${WEEK_DAYS[slot.day] ?? '待定'} ${SECTIONS[slot.section] ?? '时段'} · ${slot.room}`
}

export async function readTimetableSource(file: File): Promise<string> {
  const lower = file.name.toLowerCase()
  if (/\.(xlsx|xlsm|xlsb)$/.test(lower)) {
    throw new Error('Excel 工作簿请另存为 CSV，或直接从表格复制粘贴')
  }
  const asText = (await file.text()).replace(/^\uFEFF/, '')
  if (asText.includes('\0')) throw new Error('这是二进制文件，请改成 CSV 或复制粘贴')
  const sliced = asText.slice(0, TIMETABLE_TEXT_LIMIT).trim()
  if (!sliced) throw new Error('文件是空的')
  return sliced
}
