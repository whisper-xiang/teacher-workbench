import type { Connect } from 'vite'

/** 与 src/lib/rss.ts 中 RSS_FEEDS 的 url 保持一致 */
const ALLOWED = new Set([
  'https://www.chinanews.com.cn/rss/edu.xml',
  'http://www.people.com.cn/rss/scitech.xml',
  'https://www.chinanews.com.cn/rss/scroll-news.xml',
])

const rssHandler: Connect.NextHandleFunction = async (req, res, next) => {
  if (req.method !== 'GET' || !req.url?.startsWith('/api/rss')) return next()

  const query = new URL(req.url, 'http://local').searchParams
  const target = query.get('url')
  if (!target || !ALLOWED.has(target)) {
    res.statusCode = 400
    res.end('Invalid RSS url')
    return
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
        'User-Agent': 'TeacherWorkbench/1.0 (RSS reader)',
      },
    })
    if (!upstream.ok) {
      res.statusCode = upstream.status
      res.end(`Upstream error: ${upstream.status}`)
      return
    }
    const body = await upstream.text()
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.end(body)
  } catch (error) {
    res.statusCode = 502
    res.end(error instanceof Error ? error.message : 'Fetch failed')
  }
}

export function attachRssProxy(server: { middlewares: Connect.Server }) {
  server.middlewares.use(rssHandler)
}
