import type { NewsItem } from '../data/types'

export type RssFeedConfig = {
  id: string
  name: string
  url: string
  category: NewsItem['category']
  accent: NewsItem['accent']
  tag: string
  /** 仅保留标题或摘要匹配的教育相关条目 */
  keywords?: RegExp
}

/** 教育相关 RSS 源（经服务端代理拉取，规避浏览器 CORS） */
export const RSS_FEEDS: RssFeedConfig[] = [
  {
    id: 'chinanews-edu',
    name: '中国新闻网·教育',
    url: 'https://www.chinanews.com.cn/rss/edu.xml',
    category: '行业观察',
    accent: 'blue',
    tag: '教育动态',
  },
  {
    id: 'people-scitech',
    name: '人民网·科技',
    url: 'http://www.people.com.cn/rss/scitech.xml',
    category: 'AI热点',
    accent: 'violet',
    tag: '科技教育',
  },
  {
    id: 'chinanews-scroll',
    name: '中国新闻网',
    url: 'https://www.chinanews.com.cn/rss/scroll-news.xml',
    category: '行业观察',
    accent: 'slate',
    tag: '教育相关',
    keywords: /教育|学校|大学|教师|师范|课程|学生|人工智能|AI|教研/,
  },
]

function stripHtml(html: string): string {
  if (!html.includes('<')) return html.trim()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

function formatNewsDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr.slice(0, 10) || '未知日期'
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

function inferCategory(title: string, summary: string, fallback: NewsItem['category']): NewsItem['category'] {
  const text = `${title}${summary}`
  if (/AI|人工智能|大模型|ChatGPT|生成式|智能体/i.test(text)) return 'AI热点'
  if (/政策|通知|意见|办法|规定|部署|印发/i.test(text)) return '政策通知'
  if (/教研|工作坊|教学改进|课堂观察|教师发展/i.test(text)) return '教研动态'
  if (/论坛|会议|征文|征稿|学术|投稿/i.test(text)) return '学术活动'
  if (/大学|高校|师范|院校|校园/i.test(text)) return '高校动态'
  return fallback
}

function itemText(node: Element, selectors: string[]): string {
  for (const selector of selectors) {
    const el = node.querySelector(selector)
    const value = el?.textContent?.trim()
    if (value) return value
  }
  return ''
}

function itemLink(node: Element): string {
  const linkEl = node.querySelector('link')
  if (linkEl) {
    const href = linkEl.getAttribute('href')?.trim()
    if (href) return href
    const text = linkEl.textContent?.trim()
    if (text?.startsWith('http')) return text
  }
  const guid = node.querySelector('guid')?.textContent?.trim()
  if (guid?.startsWith('http')) return guid
  return ''
}

function parseRssXml(xml: string, feed: RssFeedConfig): Array<{ item: NewsItem; pubMs: number }> {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) return []

  const atomEntries = [...doc.querySelectorAll('entry')]
  const rssItems = [...doc.querySelectorAll('item')]
  const nodes = atomEntries.length ? atomEntries : rssItems

  const now = Date.now()
  const items: Array<{ item: NewsItem; pubMs: number }> = []

  nodes.forEach((node, index) => {
    const title = itemText(node, ['title'])
    const link = itemLink(node)
    if (!title || !link) return

    const rawSummary = itemText(node, ['description', 'summary', 'content'])
    const encoded = node.getElementsByTagName('content:encoded')[0]?.textContent?.trim()
    const summary = stripHtml(rawSummary || encoded || '').slice(0, 180) || title
    if (feed.keywords && !feed.keywords.test(`${title}${summary}`)) return
    const pubRaw = itemText(node, ['pubDate', 'published', 'updated'])
    const pubMs = pubRaw ? new Date(pubRaw).getTime() : now - index * 3_600_000
    const category = inferCategory(title, summary, feed.category)
    const accent =
      category === 'AI热点'
        ? 'violet'
        : category === '政策通知'
          ? 'teal'
          : category === '教研动态'
            ? 'blue'
            : category === '学术活动'
              ? 'amber'
              : feed.accent

    items.push({
      pubMs: Number.isNaN(pubMs) ? now - index * 3_600_000 : pubMs,
      item: {
        id: `rss-${feed.id}-${encodeURIComponent(link).slice(0, 80)}`,
        category,
        title,
        summary,
        source: feed.name,
        date: formatNewsDate(pubRaw || new Date(pubMs).toISOString()),
        tag: feed.tag,
        accent,
        fresh: now - pubMs < 3 * 86_400_000,
        hot: index < 2 || now - pubMs < 86_400_000,
        url: link,
      },
    })
  })

  return items.sort((a, b) => b.pubMs - a.pubMs)
}

async function fetchFeedXml(url: string): Promise<string> {
  const res = await fetch(`/api/rss?url=${encodeURIComponent(url)}`)
  if (!res.ok) throw new Error(`拉取失败 (${res.status})`)
  return res.text()
}

export async function fetchRssNews(limitPerFeed = 8): Promise<NewsItem[]> {
  const batches = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const xml = await fetchFeedXml(feed.url)
      return parseRssXml(xml, feed).slice(0, limitPerFeed)
    }),
  )

  const scored: Array<{ item: NewsItem; pubMs: number }> = []
  const seen = new Set<string>()

  for (const batch of batches) {
    if (batch.status !== 'fulfilled') continue
    for (const entry of batch.value) {
      const key = entry.item.url ?? entry.item.title
      if (seen.has(key)) continue
      seen.add(key)
      scored.push(entry)
    }
  }

  return scored.sort((a, b) => b.pubMs - a.pubMs).map((entry) => entry.item)
}
