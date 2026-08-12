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

export const times = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'] as const

export function todayIso(fallback = '2025-05-13') {
  try {
    return iso(new Date())
  } catch {
    return fallback
  }
}
