export type IntakeGuess = {
  title: string
  source?: string
  category?: string
  kind?: string
  openAt?: string
  closeAt?: string
  summary?: string
  extractedText?: string
}

const SOURCE_HINTS: { match: RegExp; source: string; category: string }[] = [
  { match: /教育部|人文社科|社科司/, source: '教育部社科司', category: '教育部' },
  { match: /全国教育科学|教科规划/, source: '全国教科规划办', category: '教科规划' },
  { match: /陕西.*教育科学|省规划/, source: '陕西省教育科学研究院', category: '省规划' },
  { match: /哲学社会科学|社科联/, source: '陕西省社科联', category: '省社科' },
  { match: /教改|教务处/, source: '学校教务处', category: '校级教改' },
  { match: /大创|创新创业/, source: '创新创业学院', category: '大创' },
]

const ACTIVITY_HINTS: { match: RegExp; category: string }[] = [
  { match: /大创|创新创业训练/, category: '大创' },
  { match: /三下乡|社会实践/, category: '三下乡' },
  { match: /挑战杯/, category: '挑战杯' },
  { match: /互联网\+|创新大赛/, category: '互联网+' },
  { match: /技能大赛|社团/, category: '其他' },
]

const KIND_HINTS: { match: RegExp; kind: string }[] = [
  { match: /结题|验收|成果/, kind: '结题' },
  { match: /中期/, kind: '中期' },
  { match: /立项|申报|通知/, kind: '立项' },
  { match: /总结|报告/, kind: '总结' },
  { match: /过程|实施/, kind: '过程' },
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toIsoDate(year: string, month: string, day: string) {
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return ''
  return `${y}-${pad(m)}-${pad(d)}`
}

function collectDates(text: string) {
  const dates: string[] = []
  const push = (value: string) => {
    if (value && !dates.includes(value)) dates.push(value)
  }
  const named = /(?:截止|截至|结束|报名止|受理至)[^\d]{0,6}(\d{4})[-./年](\d{1,2})[-./月](\d{1,2})/g
  const start = /(?:开始|开放|启动|申报起)[^\d]{0,6}(\d{4})[-./年](\d{1,2})[-./月](\d{1,2})/g
  const plain = /(\d{4})[-./年](\d{1,2})[-./月](\d{1,2})日?/g
  let match: RegExpExecArray | null
  const closes: string[] = []
  const opens: string[] = []
  while ((match = named.exec(text))) closes.push(toIsoDate(match[1], match[2], match[3]))
  while ((match = start.exec(text))) opens.push(toIsoDate(match[1], match[2], match[3]))
  while ((match = plain.exec(text))) push(toIsoDate(match[1], match[2], match[3]))
  return {
    openAt: opens.find(Boolean) || dates[0] || '',
    closeAt: closes.find(Boolean) || dates[1] || dates[0] || '',
  }
}

function cleanTitle(name: string) {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickHint<T extends { match: RegExp }>(list: T[], text: string) {
  return list.find((item) => item.match.test(text))
}

function extractPdfStrings(raw: string) {
  const chunks: string[] = []
  const literal = /\(((?:\\.|[^\\)]){2,})\)\s*(?:Tj|TJ|'|")/g
  let match: RegExpExecArray | null
  while ((match = literal.exec(raw))) {
    const inner = match[1]
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
    if (/[\u4e00-\u9fffA-Za-z0-9]/.test(inner)) chunks.push(inner)
  }
  return chunks.join('').replace(/\s+/g, ' ').slice(0, 4000)
}

async function readExtractedText(file: File) {
  const lower = file.name.toLowerCase()
  if (file.type.startsWith('text/') || /\.(txt|md|csv|json|html?)$/.test(lower)) {
    return (await file.text()).slice(0, 4000)
  }
  if (file.type === 'application/pdf' || lower.endsWith('.pdf')) {
    const raw = new TextDecoder('latin1').decode(await file.arrayBuffer())
    return extractPdfStrings(raw)
  }
  return ''
}

function firstLine(text: string) {
  const line =
    text.match(/项目名称[:：]\s*(.+)/)?.[1] ||
    text.match(/课题名称[:：]\s*(.+)/)?.[1] ||
    text.match(/通知[:：]\s*(.+)/)?.[1] ||
    text.split(/\n/).map((item) => item.trim()).find((item) => item.length >= 4 && item.length <= 40)
  return line?.replace(/[。；;]+$/, '').trim() || ''
}

export async function guessFromFile(file: File, kinds: string[] = []): Promise<IntakeGuess> {
  const extractedText = await readExtractedText(file)
  const blob = `${file.name}\n${extractedText}`
  const dates = collectDates(blob)
  const sourceHit = pickHint(SOURCE_HINTS, blob)
  const activityHit = pickHint(ACTIVITY_HINTS, blob)
  const kindHit = pickHint(KIND_HINTS, blob)
  const kind = kindHit && kinds.length ? kinds.find((item) => item === kindHit.kind) || kinds.find((item) => blob.includes(item)) : kindHit?.kind
  const title = firstLine(extractedText) || cleanTitle(file.name) || '未命名资料'
  const summary = extractedText.replace(/\s+/g, ' ').trim().slice(0, 80)
  return {
    title,
    source: sourceHit?.source,
    category: sourceHit?.category || activityHit?.category,
    kind: kind || kinds[0],
    openAt: dates.openAt,
    closeAt: dates.closeAt,
    summary,
    extractedText: extractedText || undefined,
  }
}

export function fillIfEmpty(current: string, next?: string) {
  return current.trim() ? current : next?.trim() || current
}
