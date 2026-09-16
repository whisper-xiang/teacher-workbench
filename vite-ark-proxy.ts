import type { IncomingMessage } from 'node:http'
import type { Connect, Plugin } from 'vite'

const MAX_BODY = 200_000
const DEFAULT_BASE = 'https://ark.cn-beijing.volces.com/api/plan/v3'
const DEFAULT_MODEL = 'doubao-seed-2.0-mini'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let overflow = false
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        overflow = true
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (overflow) {
        reject(new Error('too large'))
        return
      }
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw) as unknown)
      } catch {
        reject(new Error('invalid json'))
      }
    })
    req.on('error', reject)
  })
}

export function attachArkProxy(server: { middlewares: Connect.Server }, env: Record<string, string>) {
  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    if (!req.url?.startsWith('/api/assistant')) return next()
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end('Method not allowed')
      return
    }

    const apiKey = env.DOUBAO_API_KEY?.trim()
    const model = env.DOUBAO_MODEL?.trim() || DEFAULT_MODEL
    const baseUrl = (env.ARK_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/+$/, '')
    if (!apiKey) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: '还没有配置豆包接口，请在项目根目录填写 .env.local' }))
      return
    }

    let payload: unknown
    try {
      payload = await readJsonBody(req)
    } catch (error) {
      res.statusCode = 400
      res.end(error instanceof Error && error.message === 'too large' ? 'Body too large' : 'Invalid JSON')
      return
    }

    const messages = isRecord(payload) && Array.isArray(payload.messages) ? payload.messages : null
    if (!messages?.length) {
      res.statusCode = 400
      res.end('Missing messages')
      return
    }

    try {
      const upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          stream: false,
          thinking: { type: 'disabled' },
          response_format: { type: 'json_object' },
          messages,
        }),
      })
      const body = await upstream.text()
      res.statusCode = upstream.status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(body)
    } catch (error) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Fetch failed' }))
    }
  }

  server.middlewares.use(handler)
}

export function arkProxyPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'ark-assistant-proxy',
    configureServer(server) {
      attachArkProxy(server, env)
    },
    configurePreviewServer(server) {
      attachArkProxy(server, env)
    },
  }
}
