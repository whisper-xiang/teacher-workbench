const SOLAR_FESTIVALS: Record<string, string> = {
  '01-01': '元旦',
  '02-14': '情人节',
  '03-08': '妇女节',
  '04-01': '愚人节',
  '05-01': '劳动节',
  '05-04': '青年节',
  '06-01': '儿童节',
  '07-01': '建党节',
  '08-01': '建军节',
  '09-10': '教师节',
  '10-01': '国庆节',
  '12-24': '平安夜',
  '12-25': '圣诞节',
}

/** 农历月日，不含闰月。除夕按「次日是否正月初一」单独判断。 */
const LUNAR_FESTIVALS: Record<string, string> = {
  '1-1': '春节',
  '1-15': '元宵节',
  '2-2': '龙抬头',
  '5-5': '端午节',
  '7-7': '七夕节',
  '7-15': '中元节',
  '8-15': '中秋节',
  '9-9': '重阳节',
  '12-8': '腊八节',
}

const LUNAR_MONTHS: Record<string, number> = {
  正月: 1,
  二月: 2,
  三月: 3,
  四月: 4,
  五月: 5,
  六月: 6,
  七月: 7,
  八月: 8,
  九月: 9,
  十月: 10,
  冬月: 11,
  十一月: 11,
  腊月: 12,
  十二月: 12,
}

const CN_DIGIT: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
}

type LunarDate = {
  month: number
  day: number
  leap: boolean
}

function parseLunarDay(label: string): number | null {
  if (label === '初十') return 10
  if (label.startsWith('初')) return CN_DIGIT[label.slice(1)] ?? null
  if (label === '二十' || label === '廿') return 20
  if (label === '三十') return 30
  if (label.startsWith('廿')) {
    const ones = CN_DIGIT[label.slice(1)]
    return ones ? 20 + ones : null
  }
  if (label.startsWith('十')) {
    const ones = CN_DIGIT[label.slice(1)]
    return ones ? 10 + ones : null
  }
  const numeric = Number(label)
  return Number.isInteger(numeric) ? numeric : null
}

function parseLunarMonth(label: string): { month: number; leap: boolean } | null {
  const leap = label.startsWith('闰')
  const month = LUNAR_MONTHS[leap ? label.slice(1) : label]
  return month ? { month, leap } : null
}

function chineseCalendarParts(date: Date) {
  return new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { dateStyle: 'full' }).formatToParts(date)
}

export function solarToLunar(date: Date): LunarDate | null {
  try {
    const parts = chineseCalendarParts(date)
    const monthLabel = parts.find((part) => part.type === 'month')?.value
    const dayLabel = parts.find((part) => part.type === 'day')?.value
    if (!monthLabel || !dayLabel) return null
    const month = parseLunarMonth(monthLabel)
    const day = parseLunarDay(dayLabel)
    if (!month || !day) return null
    return { month: month.month, day, leap: month.leap }
  } catch {
    return null
  }
}

/** 如「农历七月初七」 */
export function lunarDateLabel(date: Date) {
  try {
    const parts = chineseCalendarParts(date)
    const monthLabel = parts.find((part) => part.type === 'month')?.value
    const dayLabel = parts.find((part) => part.type === 'day')?.value
    if (!monthLabel || !dayLabel) return null
    const day = parseLunarDay(dayLabel)
    const dayText = day ? formatLunarDay(day) : dayLabel
    return `农历${monthLabel}${dayText}`
  } catch {
    return null
  }
}

function formatLunarDay(day: number) {
  const ones = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (day === 10) return '初十'
  if (day < 10) return `初${ones[day]}`
  if (day < 20) return `十${ones[day - 10]}`
  if (day === 20) return '二十'
  if (day === 30) return '三十'
  return `廿${ones[day - 20]}`
}

function solarKey(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isChuxi(date: Date) {
  const tomorrow = new Date(date)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const lunar = solarToLunar(tomorrow)
  return Boolean(lunar && !lunar.leap && lunar.month === 1 && lunar.day === 1)
}

export function festivalLabel(date: Date) {
  const names: string[] = []
  const lunar = solarToLunar(date)
  if (lunar && !lunar.leap) {
    const lunarName = LUNAR_FESTIVALS[`${lunar.month}-${lunar.day}`]
    if (lunarName) names.push(lunarName)
  }
  if (isChuxi(date)) names.push('除夕')
  const solarName = SOLAR_FESTIVALS[solarKey(date)]
  if (solarName) names.push(solarName)
  return names.join(' · ') || '今日无节日'
}
