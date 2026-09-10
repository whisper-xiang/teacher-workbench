export type TranscriptMessage = {
  sender: string
  time: string
  text: string
}

const FILE_PATH_LINE =
  /^["']?(?:file:\/\/|\/|[A-Za-z]:[\\/]|\\\\).+\.(png|jpe?g|gif|webp|heic|heif|pdf|docx?|xlsx?|pptx?|txt|md|csv|rtf)["']?$/i
const FILE_TAG = /^\[(文件|图片|视频|链接|音乐|动画表情|表情)\]\s*(.*)$/
const CHAT_HEADER = /聊天记录/
const NAME_RE = /^[\u4e00-\u9fffA-Za-z0-9·•.\s_\-()（）]{1,32}$/

const RE_CN = /^(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
const RE_YMD = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
const RE_MD_SLASH = /^(\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
const RE_MD = /^(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
const RE_REL = /^(今天|昨天|前天)\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
const RE_TIME = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function formatCnDateTime(year: number, month: number, day: number, hour: number, minute: number) {
  return `${year}年${pad(month)}月${pad(day)}日 ${pad(hour)}:${pad(minute)}`
}

function shiftDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

export function parseDateTimeLine(line: string) {
  const text = line.trim()
  let match = text.match(RE_CN)
  if (match) return formatCnDateTime(+match[1], +match[2], +match[3], +match[4], +match[5])
  match = text.match(RE_YMD)
  if (match) return formatCnDateTime(+match[1], +match[2], +match[3], +match[4], +match[5])
  match = text.match(RE_MD)
  if (match) {
    const now = new Date()
    return formatCnDateTime(now.getFullYear(), +match[1], +match[2], +match[3], +match[4])
  }
  match = text.match(RE_MD_SLASH)
  if (match) {
    const now = new Date()
    return formatCnDateTime(now.getFullYear(), +match[1], +match[2], +match[3], +match[4])
  }
  match = text.match(RE_REL)
  if (match) {
    const date = shiftDays(match[1] === '昨天' ? -1 : match[1] === '前天' ? -2 : 0)
    return formatCnDateTime(date.getFullYear(), date.getMonth() + 1, date.getDate(), +match[2], +match[3])
  }
  match = text.match(RE_TIME)
  if (match) {
    const date = new Date()
    return formatCnDateTime(date.getFullYear(), date.getMonth() + 1, date.getDate(), +match[1], +match[2])
  }
  return ''
}

export function isoDateFromTranscriptTime(time: string) {
  const match = time.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (!match) return ''
  return `${match[1]}-${pad(+match[2])}-${pad(+match[3])}`
}

export function fileTagOf(text: string) {
  for (const line of text.split('\n')) {
    const match = line.trim().match(FILE_TAG)
    if (match) return { kind: match[1], name: match[2].trim() }
  }
  return null
}

function isName(line: string) {
  const text = line.trim()
  if (!text || !NAME_RE.test(text)) return false
  if (parseDateTimeLine(text)) return false
  if (FILE_TAG.test(text)) return false
  if (CHAT_HEADER.test(text)) return false
  if (/[。！？!?；;：:，,]/.test(text)) return false
  return true
}

function splitNameTime(line: string) {
  const parts = line.trim().split(/\s+/)
  if (parts.length < 2) return null
  for (let index = 1; index < parts.length; index += 1) {
    const sender = parts.slice(0, index).join(' ')
    const time = parseDateTimeLine(parts.slice(index).join(' '))
    if (time && isName(sender)) return { sender, time }
  }
  return null
}

function normalizeLines(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').trim()
}

function parseColonLine(line: string): TranscriptMessage | null {
  const paren = line.match(/^(.{1,32}?)[（(]([^）)]+)[）)][：:]\s*(.*)$/)
  if (paren && isName(paren[1].trim())) {
    return {
      sender: paren[1].trim(),
      time: parseDateTimeLine(paren[2]) || '',
      text: paren[3].trim(),
    }
  }
  const match = line.match(/^([^：:]{1,32})[：:]\s*(.+)$/)
  if (match && isName(match[1].trim())) {
    return { sender: match[1].trim(), time: '', text: match[2].trim() }
  }
  return null
}

function parseColonMessages(text: string) {
  const messages: TranscriptMessage[] = []
  for (const raw of normalizeLines(text).split('\n')) {
    const line = raw.trim()
    if (!line || CHAT_HEADER.test(line)) continue
    if (FILE_TAG.test(line)) {
      messages.push({ sender: messages.at(-1)?.sender ?? '', time: '', text: line })
      continue
    }
    const colon = parseColonLine(line)
    if (colon) {
      messages.push(colon)
      continue
    }
    if (!messages.length) return []
    messages[messages.length - 1].text = `${messages[messages.length - 1].text}\n${line}`.trim()
  }
  return messages
}

function isMessageStart(lines: string[], index: number) {
  const line = lines[index]?.trim() ?? ''
  if (!line || CHAT_HEADER.test(line)) return false
  if (FILE_TAG.test(line)) return true
  if (parseColonLine(line)) return true
  if (splitNameTime(line)) return true
  return isName(line) && Boolean(parseDateTimeLine(lines[index + 1]?.trim() ?? ''))
}

function takeBody(lines: string[], start: number) {
  const body: string[] = []
  let index = start
  while (index < lines.length) {
    const trimmed = lines[index].trim()
    if (!trimmed) {
      index += 1
      break
    }
    if (FILE_TAG.test(trimmed)) {
      if (!body.length) {
        body.push(lines[index].replace(/\s+$/g, ''))
        index += 1
      }
      break
    }
    if (CHAT_HEADER.test(trimmed) || isMessageStart(lines, index)) break
    if (isName(trimmed) && body.length && lines[index + 1]?.trim()) break
    body.push(lines[index].replace(/\s+$/g, ''))
    index += 1
  }
  return { text: body.join('\n').trim(), next: index }
}

function parseStreaming(text: string) {
  const lines = normalizeLines(text).split('\n')
  const messages: TranscriptMessage[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index].trim()
    if (!line || CHAT_HEADER.test(line)) {
      index += 1
      continue
    }
    const namedTime = splitNameTime(line)
    if (namedTime) {
      const body = takeBody(lines, index + 1)
      messages.push({ sender: namedTime.sender, time: namedTime.time, text: body.text })
      index = body.next
      continue
    }
    const colon = parseColonLine(line)
    if (colon) {
      messages.push(colon)
      index += 1
      continue
    }
    const next = lines[index + 1]?.trim() ?? ''
    if (isName(line) && parseDateTimeLine(next)) {
      const body = takeBody(lines, index + 2)
      messages.push({ sender: line, time: parseDateTimeLine(next), text: body.text })
      index = body.next
      continue
    }
    if (isName(line) && next) {
      const body = takeBody(lines, index + 1)
      if (body.text) messages.push({ sender: line, time: '', text: body.text })
      index = body.text ? body.next : index + 1
      continue
    }
    if (FILE_TAG.test(line)) {
      messages.push({ sender: messages.at(-1)?.sender ?? '', time: '', text: line })
      index += 1
      continue
    }
    if (FILE_PATH_LINE.test(line)) {
      index += 1
      continue
    }
    if (messages.length) {
      const last = messages[messages.length - 1]
      last.text = `${last.text}\n${line}`.trim()
    }
    index += 1
  }
  return messages
}

function confidence(messages: TranscriptMessage[], hasFiles: boolean, headed: boolean) {
  if (!messages.length) return 0
  let score = headed ? 3 : 0
  if (hasFiles) score += 2
  if (messages.length >= 2) score += 2
  if (messages.some((item) => item.time)) score += 2
  if (messages.some((item) => FILE_TAG.test(item.text))) score += 2
  if (messages.some((item) => item.sender)) score += 1
  return score
}

export function formatTranscript(messages: TranscriptMessage[]) {
  return messages
    .map((item) => [item.sender, item.time, item.text].filter((line) => line.trim()).join('\n'))
    .join('\n\n')
}

export function parseWeChatTranscript(text: string, options?: { hasFiles?: boolean; stored?: boolean }) {
  const raw = normalizeLines(text)
  if (!raw) return null
  const headed = CHAT_HEADER.test(raw)
  const streamed = parseStreaming(raw)
  const colon = parseColonMessages(raw)
  const picked = streamed.length >= colon.length ? streamed : colon
  if (!picked.length) return null
  if (options?.stored) return picked
  const score = confidence(picked, Boolean(options?.hasFiles), headed)
  if (score < 3) return null
  return picked
}

export function titleFromTranscript(messages: TranscriptMessage[]) {
  const senders = [...new Set(messages.map((item) => item.sender).filter(Boolean))]
  if (senders.length === 1) return `${senders[0]}的聊天`
  if (senders.length > 1) return `${senders[0]}、${senders[1]}${senders.length > 2 ? '等' : ''}的聊天`
  const file = messages.map((item) => fileTagOf(item.text)?.name).find(Boolean)
  return file || '聊天记录'
}

export function dateFromTranscript(messages: TranscriptMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const date = isoDateFromTranscriptTime(messages[index].time)
    if (date) return date
  }
  return ''
}

export function fileStem(name: string) {
  return name.replace(/\(\d+\)(?=\.[^.]+$)/, '').toLowerCase()
}

export function matchTranscriptFile<T extends { fileName: string; mimeType?: string }>(
  text: string,
  files: T[],
  used: Set<T>,
) {
  const tag = fileTagOf(text)
  if (!tag) return undefined
  const unused = files.filter((file) => !used.has(file))
  if (tag.kind === '图片' && !tag.name) {
    const image = unused.find((file) => (file.mimeType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|heic)$/i.test(file.fileName))
    if (image) used.add(image)
    return image
  }
  if (!tag.name) return undefined
  const hint = fileStem(tag.name)
  const hit =
    unused.find((file) => fileStem(file.fileName) === hint) ||
    unused.find((file) => fileStem(file.fileName).includes(hint) || hint.includes(fileStem(file.fileName)))
  if (hit) used.add(hit)
  return hit
}

export function bindTranscript<T extends { fileName: string; mimeType?: string }>(
  messages: TranscriptMessage[],
  files: T[],
) {
  const used = new Set<T>()
  const rows = messages.map((message) => ({
    message,
    file: matchTranscriptFile(message.text, files, used),
  }))
  return { rows, leftover: files.filter((file) => !used.has(file)) }
}

export function attachLooseFiles(messages: TranscriptMessage[], files: { name: string }[]) {
  if (!files.length) return messages
  const bound = bindTranscript(
    messages,
    files.map((file) => ({ fileName: file.name })),
  )
  if (!bound.leftover.length) return messages
  const sender = messages.at(-1)?.sender ?? ''
  return [
    ...messages,
    ...bound.leftover.map((file) => ({
      sender,
      time: '',
      text: `[文件] ${file.fileName}`,
    })),
  ]
}

function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
}

export function htmlToPlainText(html: string) {
  if (!html.trim()) return ''
  const text = decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
      .replace(/<!--StartFragment-->/gi, '')
      .replace(/<!--EndFragment-->/gi, '')
      .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isPathOnlyText(text: string) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  return Boolean(lines.length) && lines.every((line) => FILE_PATH_LINE.test(line))
}

function isOnlyCopiedFilenames(text: string, fileNames: string[]) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length || !fileNames.length) return false
  return lines.every((line) => {
    const hint = fileTagOf(line)?.name || line
    return fileNames.some((name) => fileStem(name) === fileStem(hint) || name === line)
  })
}

function chatTextScore(text: string) {
  let score = 0
  if (/[：:]/.test(text)) score += 2
  if (FILE_TAG.test(text) || /\[文件\]/.test(text)) score += 2
  if (/年\d{1,2}月|聊天记录/.test(text)) score += 2
  if (text.split('\n').filter((line) => line.trim()).length >= 3) score += 1
  return score
}

export function clipboardChatText(data: DataTransfer | null, files: File[] = []) {
  if (!data) return ''
  const plain = (data.getData('text/plain') || data.getData('text') || '').trim()
  const htmlText = htmlToPlainText(data.getData('text/html') || '')
  const names = files.map((file) => file.name)
  const candidates = [plain, htmlText].filter(Boolean)
  const useful = candidates.filter((text) => !isPathOnlyText(text) && !isOnlyCopiedFilenames(text, names))
  if (!useful.length) return ''
  return useful.sort((a, b) => chatTextScore(b) - chatTextScore(a) || b.length - a.length)[0]
}

export async function readClipboardChatText(files: File[] = []) {
  if (!navigator.clipboard?.read) return ''
  try {
    const items = await navigator.clipboard.read()
    const fake = new DataTransfer()
    for (const item of items) {
      if (item.types.includes('text/html')) {
        fake.setData('text/html', await (await item.getType('text/html')).text())
      }
      if (item.types.includes('text/plain')) {
        fake.setData('text/plain', await (await item.getType('text/plain')).text())
      }
    }
    return clipboardChatText(fake, files)
  } catch {
    return ''
  }
}
