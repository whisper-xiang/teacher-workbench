export const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const shift = (date: Date, days: number) => {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

export const mondayOf = (date: Date) => shift(date, -((date.getDay() + 6) % 7))

export const formatDayLabel = (date: Date) =>
  `${date.getMonth() + 1} 月 ${date.getDate()} 日`

export const weekdayLabel = (date: Date) =>
  `周${'日一二三四五六'[date.getDay()]}`

/** 08:00–16:00 整点 + 晚上补课 19:00/20:00，与课程节次、日历行对齐 */
export const times = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '19:00', '20:00'] as const

export function todayIso() {
  return iso(new Date())
}

export function thisMondayIso(date = new Date()) {
  return iso(mondayOf(date))
}

export function addDaysIso(value: string, days: number): string {
  const datePart = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return value
  return iso(shift(new Date(`${datePart}T12:00:00`), days)) + value.slice(10)
}

export function diffDays(from: string, to: string): number {
  const a = new Date(`${from.slice(0, 10)}T12:00:00`)
  const b = new Date(`${to.slice(0, 10)}T12:00:00`)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

export function dueLabel(date: string, today = todayIso()): string {
  const diff = diffDays(today, date.slice(0, 10))
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === -1) return '昨天'
  const d = new Date(`${date.slice(0, 10)}T12:00:00`)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}
