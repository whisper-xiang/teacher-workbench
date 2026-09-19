import { hasLlmSettings, loadLlmSettings } from './llm-settings'

export function chatContent(data: unknown) {
  if (!data || typeof data !== 'object') return ''
  const choices = (data as { choices?: { message?: { content?: unknown } }[] }).choices
  const content = choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === 'object' && 'text' in part ? String((part as { text: unknown }).text ?? '') : '',
      )
      .join('')
  }
  return ''
}

export function parseModelJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  return JSON.parse(trimmed)
}

export async function completeChat(input: { system: string; user: string; temperature?: number }) {
  const settings = loadLlmSettings()
  if (!hasLlmSettings(settings)) {
    throw new Error('还没有配置模型接口，请到设置填写')
  }

  const endpoint = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: input.temperature ?? 0.3,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
      }),
    })
  } catch {
    throw new Error('浏览器没能连上模型接口。可检查地址，或到设置重新填写')
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail.slice(0, 160) || `模型接口返回 ${response.status}`)
  }

  const text = chatContent((await response.json()) as unknown).trim()
  if (!text) throw new Error('模型没有返回可用结果')
  return text
}
