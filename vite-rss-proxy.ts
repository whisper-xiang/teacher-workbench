import type { Connect } from 'vite'

const MAX_BYTES = 1_500_000

function isAllowedRssUrl(raw: string) {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const rssHandler: Connect.NextHandleFunction = async (req, res, next) => {
  if (req.method !== 'GET' || !req.url?.startsWith('/api/rss')) return next()

  const query = new URL(req.url, 'http://local').searchParams
  const target = query.get('url')
  if (!target || !isAllowedRssUrl(target)) {
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
      signal: AbortSignal.timeout(15_000),
    })
    if (!upstream.ok) {
      res.statusCode = upstream.status
      res.end(`Upstream error: ${upstream.status}`)
      return
    }
    const buffer = Buffer.from(await upstream.arrayBuffer())
    if (buffer.byteLength > MAX_BYTES) {
      res.statusCode = 413
      res.end('Feed too large')
      return
    }
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.end(buffer)
  } catch (error) {
    res.statusCode = 502
    res.end(error instanceof Error ? error.message : 'Fetch failed')
  }
}

export function attachRssProxy(server: { middlewares: Connect.Server }) {
  server.middlewares.use(rssHandler)
}
