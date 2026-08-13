export type ParsedReminder = {
  title: string
  scheduledAt: string
  confidence: 'high' | 'medium' | 'low'
  explanation: string
}

const WEEKDAY_CHAR: Record<string, number> = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toLocalIso(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

export function toLocalDateTimeIso(date: Date) {
  return toLocalIso(date)
}

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function nextWeekday(base: Date, weekday: number, includeToday = false) {
  const today = base.getDay()
  let delta = weekday - today
  if (delta < 0 || (delta === 0 && !includeToday)) delta += 7
  return addDays(startOfDay(base), delta)
}

function parseClock(text: string): { hour: number; minute: number; matched: string } | null {
  const patterns: Array<{ re: RegExp; pick: (m: RegExpMatchArray) => { hour: number; minute: number } }> = [
    {
      re: /(上午|早上|清晨)\s*(\d{1,2})\s*点\s*半/,
      pick: (m) => ({ hour: Math.min(11, Number(m[2])), minute: 30 }),
    },
    {
      re: /(下午|傍晚|晚上|夜间)\s*(\d{1,2})\s*点\s*半/,
      pick: (m) => ({ hour: Math.min(23, Number(m[2]) === 12 ? 12 : Number(m[2]) + 12), minute: 30 }),
    },
    {
      re: /(中午)\s*(\d{1,2})?\s*点\s*半?/,
      pick: () => ({ hour: 12, minute: 0 }),
    },
    {
      re: /(上午|早上|清晨)\s*(\d{1,2})\s*点(?:\s*(\d{1,2})\s*分)?/,
      pick: (m) => ({ hour: Math.min(11, Number(m[2])), minute: Number(m[3] ?? 0) }),
    },
    {
      re: /(下午|傍晚|晚上|夜间)\s*(\d{1,2})\s*点(?:\s*(\d{1,2})\s*分)?/,
      pick: (m) => {
        const h = Number(m[2])
        return { hour: h === 12 ? 12 : h + 12, minute: Number(m[3] ?? 0) }
      },
    },
    {
      re: /(\d{1,2}):(\d{2})/,
      pick: (m) => ({ hour: Number(m[1]), minute: Number(m[2]) }),
    },
    {
      re: /(\d{1,2})\s*点(?:\s*半|\s*(\d{1,2})\s*分)?/,
      pick: (m) => ({ hour: Number(m[1]), minute: m[0].includes('半') ? 30 : Number(m[2] ?? 0) }),
    },
  ]

  for (const { re, pick } of patterns) {
    const match = text.match(re)
    if (match) {
      const clock = pick(match)
      return { ...clock, matched: match[0] }
    }
  }
  return null
}

function parseDatePart(text: string, base: Date): { date: Date; matched: string; confidence: ParsedReminder['confidence'] } | null {
  const relativeMinutes = text.match(/(\d+)\s*分钟(?:之)?后/)
  if (relativeMinutes) {
    const date = new Date(base.getTime() + Number(relativeMinutes[1]) * 60_000)
    return { date, matched: relativeMinutes[0], confidence: 'high' }
  }

  if (/半(?:个)?小时(?:之)?后/.test(text)) {
    const date = new Date(base.getTime() + 30 * 60_000)
    return { date, matched: '半小时后', confidence: 'high' }
  }

  const relativeHours = text.match(/(\d+(?:\.\d+)?)\s*小时(?:之)?后/)
  if (relativeHours) {
    const date = new Date(base.getTime() + Number(relativeHours[1]) * 3_600_000)
    return { date, matched: relativeHours[0], confidence: 'high' }
  }

  if (/大后天/.test(text)) {
    return { date: addDays(startOfDay(base), 3), matched: '大后天', confidence: 'high' }
  }

  if (/后天/.test(text)) {
    return { date: addDays(startOfDay(base), 2), matched: '后天', confidence: 'high' }
  }

  if (/明[天日]/.test(text)) {
    return { date: addDays(startOfDay(base), 1), matched: '明天', confidence: 'high' }
  }

  if (/今[天日]|今晚/.test(text)) {
    return { date: startOfDay(base), matched: '今天', confidence: 'high' }
  }

  const weekday = text.match(/(?:下)?周([一二三四五六日天])/)
  if (weekday) {
    const day = WEEKDAY_CHAR[weekday[1]]
    const date = nextWeekday(base, day, /本周/.test(text))
    return { date, matched: weekday[0], confidence: 'medium' }
  }

  const isoDate = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoDate) {
    const date = new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]))
    return { date, matched: isoDate[0], confidence: 'high' }
  }

  const monthDay = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (monthDay) {
    let date = new Date(base.getFullYear(), Number(monthDay[1]) - 1, Number(monthDay[2]))
    if (date.getTime() < startOfDay(base).getTime()) {
      date = new Date(base.getFullYear() + 1, Number(monthDay[1]) - 1, Number(monthDay[2]))
    }
    return { date, matched: monthDay[0], confidence: 'medium' }
  }

  return null
}

function cleanupTitle(input: string, matchedParts: string[]) {
  let title = input.trim()
  const noise = [
    ...matchedParts,
    '请',
    '帮我',
    '麻烦',
    '提醒我',
    '提醒一下',
    '提醒',
    '记得',
    '别忘了',
    '别忘记',
    '定时',
    '设置',
    '安排',
    '在',
    '于',
  ]
  for (const part of noise.sort((a, b) => b.length - a.length)) {
    if (!part) continue
    title = title.replaceAll(part, ' ')
  }
  title = title.replace(/[\s，,。.!！?？；;：:]+/g, ' ').trim()
  return title || input.trim()
}

export function parseReminderNaturalLanguage(input: string, base = new Date()): ParsedReminder | null {
  const text = input.trim()
  if (!text) return null

  const matched: string[] = []
  let confidence: ParsedReminder['confidence'] = 'low'
  let target = new Date(base)

  const datePart = parseDatePart(text, base)
  if (datePart) {
    target = datePart.date
    matched.push(datePart.matched)
    confidence = datePart.confidence
  }

  const clock = parseClock(text)
  if (clock) {
    if (!datePart) {
      target = startOfDay(base)
      if (target.getTime() === startOfDay(base).getTime()) {
        const withClock = new Date(target)
        withClock.setHours(clock.hour, clock.minute, 0, 0)
        if (withClock.getTime() <= base.getTime()) {
          target = addDays(target, 1)
        }
      }
      confidence = 'medium'
    }
    target.setHours(clock.hour, clock.minute, 0, 0)
    matched.push(clock.matched)
    if (confidence === 'low') confidence = 'medium'
  } else if (datePart && !/分钟|小时/.test(datePart.matched)) {
    target.setHours(9, 0, 0, 0)
    confidence = confidence === 'high' ? 'medium' : confidence
  }

  if (!datePart && !clock) return null
  if (target.getTime() <= base.getTime() && !/分钟|小时/.test(text)) {
    target = addDays(target, 1)
    confidence = 'medium'
  }

  const title = cleanupTitle(text, matched)
  const explanation = `解析为 ${target.getFullYear()} 年 ${target.getMonth() + 1} 月 ${target.getDate()} 日 ${pad(target.getHours())}:${pad(target.getMinutes())}`

  return {
    title,
    scheduledAt: toLocalIso(target),
    confidence,
    explanation,
  }
}

export function formatReminderTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const now = new Date()
  const today = startOfDay(now)
  const targetDay = startOfDay(date)
  const dayDiff = Math.round((targetDay.getTime() - today.getTime()) / 86_400_000)
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (dayDiff === 0) return `今天 ${clock}`
  if (dayDiff === 1) return `明天 ${clock}`
  if (dayDiff === 2) return `后天 ${clock}`
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${clock}`
}
