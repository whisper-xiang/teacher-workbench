import type { ThesisAnalysis, ThesisFinding, ThesisStage } from '../data/types'
import { hasLlmSettings, loadLlmSettings } from './llm-settings'
import { composeThesisNote } from './thesis-text'

export type ThesisAnalyzeInput = {
  topic: string
  stage: ThesisStage
  text: string
  lastNote?: string
}

function stageHint(stage: ThesisStage) {
  if (stage === '选题') return '题目是否过大、对象清不清、这学期是否做得完。'
  if (stage === '开题' || stage === '提纲') return '章节能不能托住研究问题，有没有方法节，文献是不是只有政策文件。'
  if (stage === '初稿') return '问题、证据、结论是否对得上；方法有没有空转；会不会口号化。'
  if (stage === '修改') return '对照最近一条指导意见，看改了哪些、哪些还在。'
  if (stage === '查重') return '引用与体例、摘要关键词是否像论文。不要声称查重，不要测 AIGC。'
  if (stage === '答辩') return '可能被问到的口试点，给老师备课，不写讲稿。'
  return '是否已经收束，材料是否齐。'
}

export function buildThesisPrompt(input: ThesisAnalyzeInput) {
  const last = input.lastNote?.trim()
  return [
    '你是师范院校教育学院讲师的论文指导助手，只帮老师读本科毕业论文，不代写、不打分、不查重。',
    `当前阶段：${input.stage}。这一阶段请重点看：${stageHint(input.stage)}`,
    `题目：${input.topic.trim() || '未定题'}`,
    last ? `最近一条已确认指导意见：\n${last}` : '',
    '学生文稿：',
    input.text.slice(0, 10000),
    '只返回 JSON，不要 markdown。形状：{"summary":"2到3句总判断","findings":[{"issue":"问题一句","location":"章节或原句","say":"建议老师怎么说"}]}。',
    'findings 3到6条。口吻是指导教师，不是审稿人。',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function asFinding(value: unknown): ThesisFinding | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const issue = String(row.issue ?? '').trim()
  if (!issue) return null
  return {
    issue,
    location: String(row.location ?? '').trim(),
    say: String(row.say ?? '').trim(),
  }
}

export function parseThesisAnalysis(raw: string): ThesisAnalysis {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const parsed = JSON.parse(trimmed) as unknown
  if (!parsed || typeof parsed !== 'object') throw new Error('模型没有返回可用结果')
  const row = parsed as Record<string, unknown>
  const findings = Array.isArray(row.findings)
    ? row.findings.map(asFinding).filter((item): item is ThesisFinding => Boolean(item))
    : []
  const summary = String(row.summary ?? '').trim()
  if (!summary && !findings.length) throw new Error('模型没有返回可用结果')
  return {
    summary: summary || findings[0]?.issue || '已读完这一版。',
    findings,
    createdAt: new Date().toISOString(),
  }
}

function chatContent(data: unknown) {
  if (!data || typeof data !== 'object') return ''
  const choices = (data as { choices?: { message?: { content?: unknown } }[] }).choices
  const content = choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === 'object' && 'text' in part ? String((part as { text: unknown }).text ?? '') : ''))
      .join('')
  }
  return ''
}

export async function analyzeThesis(input: ThesisAnalyzeInput): Promise<ThesisAnalysis> {
  const settings = loadLlmSettings()
  if (!hasLlmSettings(settings)) {
    throw new Error('还没有配置模型接口，请到设置填写')
  }
  const body = input.text.trim()
  if (!body) throw new Error('读不出这一版正文，请另存为 PDF、Word 或纯文本再传')

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
        temperature: 0.3,
        messages: [
          { role: 'system', content: '你只返回 JSON，不解释。' },
          { role: 'user', content: buildThesisPrompt(input) },
        ],
      }),
    })
  } catch {
    throw new Error('浏览器没能连上模型接口。可检查地址，或复制提示词后把结果贴回来')
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail.slice(0, 160) || `模型接口返回 ${response.status}`)
  }

  const data = (await response.json()) as unknown
  return parseThesisAnalysis(chatContent(data))
}

export function analysisToNote(analysis: ThesisAnalysis) {
  return composeThesisNote(analysis.summary, analysis.findings)
}
