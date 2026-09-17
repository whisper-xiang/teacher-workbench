import { addDaysIso, todayIso } from './dates'
import { currentCourseTopic } from './courses'
import type {
  CalendarEvent,
  Course,
  MajorId,
  NewsCustomFeed,
  NewsItem,
  ResearchNotice,
  WorkJournalNote,
} from '../data/types'

export const NEWS_EVENT_PREFIX = 'news-'

const POLICY_CORE = /课标|课程标准|师范认证|专业认证|培养方案|教师法|教育法/
const POLICY_DOC = /指南|印发|意见|办法|规定|通知|部署|决定/
const RESEARCH_HINT = /征稿|征文|截稿|申报|课题|基金|规划项目|会议|论坛|研讨会/
const EDU_HINT = /教育|教师|学校|高校|师范|幼儿园|小学|学生|课程/

const MAJOR_PRE = /学前|幼儿|幼儿园|托育|幼教|游戏课程/
const MAJOR_PRI = /小学|小教|义务教育|识字教学|班主任/
const MAJOR_EDU = /师范|教育学|高等教育|高校|课程思政|教育原理|研究方法/

export function inferNewsMajors(text: string): MajorId[] {
  const majors: MajorId[] = []
  if (MAJOR_PRE.test(text)) majors.push('pre')
  if (MAJOR_PRI.test(text)) majors.push('pri')
  if (MAJOR_EDU.test(text)) majors.push('edu')
  return majors
}

export function mustReadScore(item: NewsItem): number {
  const text = `${item.title}${item.summary}`
  let score = 0
  if (POLICY_CORE.test(text)) score += 12
  if (POLICY_DOC.test(text) && EDU_HINT.test(text)) score += 8
  if (item.category === '政策通知') score += 5
  if (RESEARCH_HINT.test(text) && EDU_HINT.test(text)) score += 6
  if (item.fresh) score += 2
  return score
}

export function isMustRead(item: NewsItem) {
  return mustReadScore(item) >= 8
}

export function isNewsUnread(item: NewsItem, readIds: string[]) {
  return Boolean(item.fresh && !readIds.includes(item.id))
}

export function looksLikeResearchNews(item: NewsItem) {
  return item.category === '学术活动' || RESEARCH_HINT.test(`${item.title}${item.summary}`)
}

export function withFreshFlags(items: NewsItem[], now = Date.now()): NewsItem[] {
  const seen = new Set<string>()
  const unique: NewsItem[] = []
  for (const item of items) {
    const key = item.url || item.id
    if (seen.has(key) || seen.has(item.id)) continue
    seen.add(key)
    seen.add(item.id)
    unique.push(item)
  }
  return unique.map((item) => {
    const pub = item.pubAt ? new Date(item.pubAt).getTime() : Number.NaN
    const age = Number.isFinite(pub) ? now - pub : Number.NaN
    return {
      ...item,
      majors: item.majors ?? inferNewsMajors(`${item.title}${item.summary}`),
      fresh: Number.isFinite(age) ? age < 3 * 86_400_000 : Boolean(item.fresh),
      hot: Number.isFinite(age) ? age < 86_400_000 : Boolean(item.hot),
    }
  })
}

export function mergeFetchedNews(current: NewsItem[], incoming: NewsItem[], bookmarks: string[]): NewsItem[] {
  const incomingUrls = new Set(incoming.map((item) => item.url))
  const incomingIds = new Set(incoming.map((item) => item.id))
  const kept = current.filter(
    (item) => bookmarks.includes(item.id) && !incomingUrls.has(item.url) && !incomingIds.has(item.id),
  )
  return withFreshFlags([...incoming, ...kept])
}

export function remapNewsIds(ids: string[], previous: NewsItem[], next: NewsItem[]): string[] {
  const urlToId = new Map(next.map((item) => [item.url, item.id]))
  const prevById = new Map(previous.map((item) => [item.id, item]))
  const nextIds = new Set(next.map((item) => item.id))
  return [
    ...new Set(
      ids
        .map((id) => {
          if (nextIds.has(id)) return id
          const prev = prevById.get(id)
          return prev ? (urlToId.get(prev.url) ?? id) : id
        })
        .filter((id) => nextIds.has(id)),
    ),
  ]
}

export function teacherMajors(courses: Course[]): MajorId[] {
  return [...new Set(courses.map((course) => course.major))]
}

export function itemMajors(item: NewsItem): MajorId[] {
  return item.majors?.length ? item.majors : inferNewsMajors(`${item.title}${item.summary}`)
}

export type NewsMajorFilter = 'all' | 'mine' | MajorId

export function matchesMajorFilter(item: NewsItem, filter: NewsMajorFilter, courses: Course[]): boolean {
  if (filter === 'all') return true
  const majors = itemMajors(item)
  if (filter !== 'mine') return majors.includes(filter)
  const mine = teacherMajors(courses)
  if (!majors.length || !mine.length) return true
  if (majors.some((major) => mine.includes(major))) return true
  const blob = `${item.title}${item.summary}`
  return courses.some((course) => {
    const topic = currentCourseTopic(course)
    return topic.length >= 2 && blob.includes(topic)
  })
}

export function pickMustRead(news: NewsItem[], readIds: string[], limit = 5): NewsItem[] {
  return [...news]
    .filter(isMustRead)
    .sort((left, right) => {
      const unreadDelta = Number(isNewsUnread(right, readIds)) - Number(isNewsUnread(left, readIds))
      if (unreadDelta) return unreadDelta
      return mustReadScore(right) - mustReadScore(left)
    })
    .slice(0, limit)
}

export function newsDeadlineId(newsId: string, date: string) {
  return `${NEWS_EVENT_PREFIX}${newsId}-${date}`
}

export function hasOpenNewsDeadline(events: CalendarEvent[], newsId: string) {
  return events.some((event) => event.id.startsWith(`${NEWS_EVENT_PREFIX}${newsId}`) && !event.done)
}

export function makeNewsDeadline(item: NewsItem, date: string): CalendarEvent {
  const academic = looksLikeResearchNews(item)
  return {
    id: newsDeadlineId(item.id, date),
    date,
    start: 0,
    length: 1,
    title: academic ? item.title : `看：${item.title}`,
    detail: `${item.source}\n${item.url}`,
    kind: 'deadline',
    major: itemMajors(item)[0] ?? null,
    linkTo: { route: 'news', param: item.id },
  }
}

export function hasJournalClip(notes: WorkJournalNote[], url: string) {
  return notes.some((note) => note.content.includes(url))
}

export function makeNewsJournalNote(
  item: NewsItem,
  input: { id: string; date: string; createdAt: string; courseName?: string },
): WorkJournalNote {
  const heading = input.courseName ? `${input.courseName} · ${item.title}` : item.title
  const kind = input.courseName ? '教学' : looksLikeResearchNews(item) ? '科研' : '教学'
  return {
    id: input.id,
    date: input.date,
    title: heading.slice(0, 80),
    content: [item.summary, item.url && `原文：${item.url}`].filter(Boolean).join('\n\n'),
    kind,
    files: [],
    createdAt: input.createdAt,
  }
}

export function hasResearchClip(notices: ResearchNotice[], url: string) {
  return notices.some((notice) => notice.url === url)
}

export function makeNewsResearchNotice(
  item: NewsItem,
  input: { id: string; today: string; closeAt: string },
): ResearchNotice {
  return {
    id: input.id,
    title: item.title,
    source: item.source,
    summary: item.summary,
    category: '资讯转入',
    openAt: input.today,
    closeAt: input.closeAt,
    status: 'upcoming',
    url: item.url,
  }
}

export function guessNewsDeadline(item: NewsItem, today = todayIso()): string {
  const text = `${item.title}${item.summary}`
  const isoMatch = text.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/)
  if (isoMatch) {
    const next = `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`
    if (next >= today) return next
  }
  const md = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (md) {
    const next = `${new Date().getFullYear()}-${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}`
    if (next >= today) return next
  }
  return addDaysIso(today, looksLikeResearchNews(item) ? 7 : 1)
}

export function parseRssFeedUrl(raw: string): string {
  const trimmed = raw.trim()
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('请填写完整的 http(s) 地址')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('RSS 地址只用 http 或 https')
  }
  return url.toString()
}

export function isNewsCustomFeed(value: unknown): value is NewsCustomFeed {
  if (!value || typeof value !== 'object') return false
  const feed = value as NewsCustomFeed
  return Boolean(feed.id && feed.name && feed.url)
}
