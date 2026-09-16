import { hasLlmSettings, loadLlmSettings } from './llm-settings'

type OptimizeInput = {
  title: string
  text: string
  note?: string
}

function chatContent(data: unknown) {
  if (!data || typeof data !== 'object') return ''
  const choices = (data as { choices?: { message?: { content?: unknown } }[] }).choices
  const content = choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => (part && typeof part === 'object' && 'text' in part ? String((part as { text: unknown }).text ?? '') : ''))
    .join('')
}

export async function optimizeResearchText(input: OptimizeInput) {
  const settings = loadLlmSettings()
  if (!hasLlmSettings(settings)) throw new Error('还没有配置模型接口，请先到设置填写')
  const text = input.text.trim()
  if (!text) throw new Error('请先输入或上传一段正文')

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
        temperature: 0.25,
        messages: [
          {
            role: 'system',
            content: '你是高校科研材料编辑。只返回优化后的完整正文，不解释，不添加原文没有的数据、结论或引用。',
          },
          {
            role: 'user',
            content: [
              `材料名称：${input.title || '未命名材料'}`,
              input.note?.trim() ? `修改要求：${input.note.trim()}` : '修改要求：提升表达准确性、逻辑连贯性和正式程度，保留原意与原有结构。',
              '原文：',
              text.slice(0, 12000),
            ].join('\n\n'),
          },
        ],
      }),
    })
  } catch {
    throw new Error('浏览器没能连上模型接口，请检查设置中的接口地址')
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail.slice(0, 160) || `模型接口返回 ${response.status}`)
  }

  const result = chatContent((await response.json()) as unknown).trim()
  if (!result) throw new Error('模型没有返回可用正文')
  return result.replace(/^```(?:\w+)?\s*/i, '').replace(/\s*```$/, '').trim()
}
