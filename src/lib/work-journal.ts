import type { TeacherProfile, WorkJournalNote } from '../data/types'
import { getResourceFile } from './resource-files'

export function journalYear(note: WorkJournalNote) {
  return Number(note.date.slice(0, 4)) || new Date().getFullYear()
}

export function journalMonth(note: WorkJournalNote) {
  return Number(note.date.slice(5, 7)) || 1
}

export function notesInYear(notes: WorkJournalNote[], year: number) {
  return [...notes]
    .filter((item) => journalYear(item) === year)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

export function journalStats(notes: WorkJournalNote[]) {
  const days = new Set(notes.map((item) => item.date))
  const byKind: Record<string, number> = {}
  for (const note of notes) byKind[note.kind] = (byKind[note.kind] ?? 0) + 1
  const files = notes.reduce((sum, item) => sum + item.files.length, 0)
  const byMonth = Array.from({ length: 12 }, (_, index) => notes.filter((item) => journalMonth(item) === index + 1).length)
  return { count: notes.length, days: days.size, files, byKind, byMonth }
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function fileDataUrl(fileId: string) {
  const stored = await getResourceFile(fileId)
  if (!stored || stored.blob.size > 2.5 * 1024 * 1024) return null
  if (!stored.type.startsWith('image/')) return null
  return new Promise<string | null>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(stored.blob)
  })
}

export async function buildYearJournalHtml(notes: WorkJournalNote[], year: number, profile: TeacherProfile) {
  const yearNotes = notesInYear(notes, year)
  const stats = journalStats(yearNotes)
  const kindLine = Object.entries(stats.byKind)
    .map(([kind, count]) => `${kind} ${count} 条`)
    .join(' · ')
  const monthBlocks = await Promise.all(
    Array.from({ length: 12 }, async (_, index) => {
      const month = index + 1
      const rows = yearNotes.filter((item) => journalMonth(item) === month)
      if (!rows.length) return ''
      const items = await Promise.all(
        rows.map(async (note) => {
          const images = (
            await Promise.all(
              note.files.map(async (file) => {
                const dataUrl = await fileDataUrl(file.fileId)
                if (!dataUrl) return `<p class="file">${escapeHtml(file.fileName)}</p>`
                return `<img src="${dataUrl}" alt="${escapeHtml(file.fileName)}" />`
              }),
            )
          ).join('')
          return `<article>
            <h3>${escapeHtml(note.date)} · ${escapeHtml(note.kind)} · ${escapeHtml(note.title)}</h3>
            <p>${escapeHtml(note.content).replaceAll('\n', '<br />') || '（无正文）'}</p>
            ${images}
          </article>`
        }),
      )
      return `<section><h2>${month} 月（${rows.length} 条）</h2>${items.join('')}</section>`
    }),
  )

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${year}年工作量随手记 · ${escapeHtml(profile.name)}</title>
  <style>
    body { font-family: "Noto Serif SC", "Songti SC", "STSong", serif; max-width: 820px; margin: 32px auto; padding: 0 24px 64px; color: #1f2a24; line-height: 1.65; }
    h1 { font-size: 26px; margin-bottom: 6px; }
    .meta, .stats { color: #5b6b63; font-size: 14px; }
    .stats { margin: 16px 0 28px; padding: 12px 14px; background: #f4f7f5; border-radius: 10px; }
    h2 { margin-top: 32px; font-size: 18px; border-bottom: 1px solid #dce5e0; padding-bottom: 6px; }
    article { margin: 16px 0 24px; }
    h3 { font-size: 15px; margin: 0 0 6px; }
    p { margin: 0 0 8px; white-space: pre-wrap; }
    img { max-width: 100%; max-height: 360px; display: block; margin: 8px 0; border-radius: 8px; border: 1px solid #e4ebe7; }
    .file { font-size: 12px; color: #6a7a73; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${year} 年教学工作量随手记</h1>
  <p class="meta">${escapeHtml(profile.college)} · ${escapeHtml(profile.name)}（${escapeHtml(profile.title)}） · 生成于 ${new Date().toLocaleString('zh-CN')}</p>
  <p class="stats">共 ${stats.count} 条记录 · ${stats.days} 个工作日有记 · 附件 ${stats.files} 份${kindLine ? ` · ${kindLine}` : ''}</p>
  ${monthBlocks.join('') || '<p>这一年还没有随手记。</p>'}
</body>
</html>`
}
