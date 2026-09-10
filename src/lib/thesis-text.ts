import { extractFileText } from './intake-file'

const TEXT_LIMIT = 12000
const ZIP_LOCAL = 0x04034b50

function readU16(view: DataView, offset: number) {
  return view.getUint16(offset, true)
}

function readU32(view: DataView, offset: number) {
  return view.getUint32(offset, true)
}

async function inflateRaw(data: Uint8Array) {
  const copy = new Uint8Array(data.byteLength)
  copy.set(data)
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function unzipEntry(buffer: ArrayBuffer, target: string) {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  let offset = 0
  while (offset + 30 <= bytes.length) {
    if (readU32(view, offset) !== ZIP_LOCAL) break
    const flags = readU16(view, offset + 6)
    const method = readU16(view, offset + 8)
    const compressed = readU32(view, offset + 18)
    const nameLen = readU16(view, offset + 26)
    const extraLen = readU16(view, offset + 28)
    if (flags & 8) break
    const nameStart = offset + 30
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLen))
    const dataStart = nameStart + nameLen + extraLen
    const data = bytes.subarray(dataStart, dataStart + compressed)
    if (name === target) {
      if (method === 0) return data
      if (method === 8) return inflateRaw(data)
      return null
    }
    offset = dataStart + compressed
  }
  return null
}

function xmlText(xml: string) {
  return xml
    .replace(/<w:tab\b[^/]*\/>/g, '\t')
    .replace(/<w:br\b[^/]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function extractDocxText(file: File) {
  try {
    const entry = await unzipEntry(await file.arrayBuffer(), 'word/document.xml')
    if (!entry) return ''
    return xmlText(new TextDecoder().decode(entry)).slice(0, TEXT_LIMIT)
  } catch {
    return ''
  }
}

export async function extractThesisText(file: File) {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.docx') || file.type.includes('wordprocessingml')) {
    return extractDocxText(file)
  }
  return extractFileText(file, TEXT_LIMIT)
}

export function composeThesisNote(summary: string, findings: { issue: string; location: string; say: string }[]) {
  const lines = [summary.trim()].filter(Boolean)
  for (const item of findings) {
    const issue = item.issue.trim()
    if (!issue) continue
    const location = item.location.trim()
    const say = item.say.trim()
    lines.push(location ? `${issue}（${location}）` : issue)
    if (say) lines.push(say)
  }
  return lines.join('\n')
}
