import type { WorkJournalNote } from '../data/types'

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
