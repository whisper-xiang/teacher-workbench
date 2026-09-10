export const JOURNAL_FILE_ACCEPT =
  'image/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.rtf'

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff?|svg)$/i
const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|txt|md|csv|rtf|pages|numbers|key)$/i
const DOC_MIME =
  /^(application\/(pdf|msword|vnd\.(ms-|openxmlformats-)|rtf|haansoft)|text\/(plain|markdown|csv|rtf))/i
const GENERIC_NAME = /^(image|blob|untitled|filename|图片)(\.\w+)?$/i
const FILE_PATH_LINE =
  /^["']?(?:file:\/\/|\/|[A-Za-z]:[\\/]|\\\\).+\.(png|jpe?g|gif|webp|heic|heif|pdf|docx?|xlsx?|pptx?|txt|md|csv|rtf)["']?$/i

export function isJournalAttachment(file: File) {
  if (file.type.startsWith('image/')) return true
  if (DOC_MIME.test(file.type)) return true
  return IMAGE_EXT.test(file.name) || DOC_EXT.test(file.name)
}

function extFromMime(type: string) {
  if (type === 'image/jpeg') return 'jpg'
  if (type.includes('/')) {
    const sub = type.split('/')[1]?.split('+')[0] || ''
    if (sub && sub.length <= 8 && !sub.includes('.')) return sub
  }
  return 'bin'
}

export function normalizePastedFile(file: File, index: number) {
  const generic = !file.name || GENERIC_NAME.test(file.name)
  if (!generic) return file
  const fromName = file.name.includes('.') ? file.name.split('.').pop() : ''
  const ext = fromName || extFromMime(file.type || 'image/png')
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  return new File([file], `粘贴-${stamp}-${index + 1}.${ext}`, {
    type: file.type || 'application/octet-stream',
    lastModified: file.lastModified,
  })
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.type}:${file.lastModified}`
}

function filesFromHtmlImages(html: string) {
  const files: File[] = []
  const matches = html.matchAll(/<img[^>]+src=["'](data:image\/[a-zA-Z0-9.+-]+;base64,[^"']+)["']/gi)
  for (const match of matches) {
    const dataUrl = match[1]
    const comma = dataUrl.indexOf(',')
    if (comma < 0) continue
    const header = dataUrl.slice(0, comma)
    const mime = header.match(/data:(image\/[a-zA-Z0-9.+-]+);/i)?.[1] || 'image/png'
    try {
      const binary = atob(dataUrl.slice(comma + 1))
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
      files.push(new File([bytes], `image.${extFromMime(mime)}`, { type: mime }))
    } catch {
      // 忽略损坏的内嵌图
    }
  }
  return files
}

export function collectClipboardFiles(data: DataTransfer | null) {
  if (!data) return []
  const seen = new Set<string>()
  const out: File[] = []

  const push = (file: File | null) => {
    if (!file || !isJournalAttachment(file)) return
    const key = fileKey(file)
    if (seen.has(key)) return
    seen.add(key)
    out.push(file)
  }

  for (const file of Array.from(data.files)) push(file)
  for (const item of Array.from(data.items)) {
    if (item.kind === 'file') push(item.getAsFile())
  }
  if (!out.length) {
    for (const file of filesFromHtmlImages(data.getData('text/html'))) push(file)
  }
  return out.map((file, index) => normalizePastedFile(file, index))
}

export function looksLikeLocalFilePaths(text: string) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length || lines.length > 30) return false
  return lines.every((line) => FILE_PATH_LINE.test(line))
}
